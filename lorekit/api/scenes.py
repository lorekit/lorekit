"""Scene endpoints — view and edit individual scenes within a project.

All operations follow the timeline document pattern: read full timeline_json,
modify the specific track/item, write the whole document back.
"""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator

from lorekit import db
from lorekit.auth.user import get_current_user, CurrentUser
from lorekit.models import (
    Material,
    Timeline,
    SceneItem,
    TransitionItem,
    TextItem,
)

router = APIRouter(prefix="/api/scenes", tags=["scenes"])

FPS = 30


def _seconds_to_frames(seconds: float) -> int:
    return round(seconds * FPS)


def _load_timeline(project: dict) -> Timeline:
    """Load Timeline from project row. Raises 400 if no timeline exists."""
    tl = project.get("timeline_json")
    if not tl:
        raise HTTPException(status_code=400, detail="No timeline generated yet")
    if isinstance(tl, str):
        tl = json.loads(tl)
    return Timeline.model_validate(tl)


async def _save_timeline(project_id: str, timeline: Timeline, *, org_id: str | None = None) -> None:
    """Recalculate duration, increment version, and persist the timeline.

    Uses optimistic locking: the write only succeeds if the version in the DB
    matches the version we loaded. Raises 409 on conflict.
    """
    # Recompute total duration from all track items
    all_frames = [
        item.from_frame + item.duration_frames
        for track in timeline.tracks
        for item in track.items
    ]
    timeline.duration_frames = max(all_frames) if all_frames else 0

    # Optimistic lock: save the version we loaded, then increment
    loaded_version = timeline.version
    timeline.version += 1

    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    serialized = json.dumps(timeline.model_dump())

    pool = await db.get_pool()
    result = await pool.execute(
        """UPDATE universe_projects
           SET timeline_json = $1, updated_at = $2
           WHERE id = $3
           AND (timeline_json->>'version')::int = $4""",
        serialized, now, project_id, loaded_version,
    )
    if result == "UPDATE 0":
        raise HTTPException(
            status_code=409,
            detail="Timeline was modified concurrently. Please refresh and retry.",
        )


def _resolve_material(timeline: Timeline, material_id: str | None) -> Material | None:
    """Look up a material by ID."""
    if not material_id:
        return None
    return timeline.materials.get(material_id)


def _scene_to_response(scene: SceneItem, timeline: Timeline) -> dict:
    """Convert a SceneItem to the API response format, resolving material refs."""
    clip_mat = _resolve_material(timeline, scene.clip_material_id)
    kf_mat = _resolve_material(timeline, scene.keyframe_material_id)
    end_kf_mat = _resolve_material(timeline, scene.end_keyframe_material_id)

    return {
        "id": scene.id,
        "scene_id": scene.scene_id,
        "beat": scene.beat,
        "visual_description": scene.visual_description,
        "camera": scene.camera,
        "text_overlay": scene.text_overlay,
        "character_present": scene.character_present,
        "speed": scene.speed,
        "duration": scene.duration_frames / FPS,
        "from_frame": scene.from_frame,
        "duration_frames": scene.duration_frames,
        "clip_path": clip_mat.path if clip_mat else None,
        "clip_url": clip_mat.url if clip_mat else None,
        "keyframe_path": kf_mat.path if kf_mat else None,
        "keyframe_url": kf_mat.url if kf_mat else None,
        "keyframe_history": [
            {"path": m.path, "url": m.url}
            for mid in scene.keyframe_history
            if (m := _resolve_material(timeline, mid))
        ],
        "end_keyframe_url": end_kf_mat.url if end_kf_mat else None,
        "extracted_frames": [
            {"path": m.path, "url": m.url}
            for mid in scene.extracted_frame_ids
            if (m := _resolve_material(timeline, mid))
        ],
        "reference_images": [
            m.path or m.url
            for mid in scene.reference_image_ids
            if (m := _resolve_material(timeline, mid))
        ],
        "quote_id": scene.quote_id,
        "enabled": scene.enabled,
        "source_start_frame": scene.source_start_frame,
        "source_duration_frames": scene.source_duration_frames,
    }


def _transition_to_response(trans: TransitionItem, timeline: Timeline) -> dict:
    """Convert a TransitionItem to the API response format.

    Computes from_scene_id/to_scene_id from neighboring SceneItems
    for frontend compatibility.
    """
    clip_mat = _resolve_material(timeline, trans.clip_material_id)

    # Derive from_scene_id/to_scene_id from position on video track
    video_items = timeline.get_video_track().items
    from_scene_id = -1
    to_scene_id = -1
    try:
        idx = video_items.index(trans)
        # Look backward for the preceding scene
        for j in range(idx - 1, -1, -1):
            if isinstance(video_items[j], SceneItem):
                from_scene_id = video_items[j].scene_id
                break
        # Look forward for the following scene
        for j in range(idx + 1, len(video_items)):
            if isinstance(video_items[j], SceneItem):
                to_scene_id = video_items[j].scene_id
                break
    except ValueError:
        pass

    return {
        "id": trans.id,
        "from_scene_id": from_scene_id,
        "to_scene_id": to_scene_id,
        "transition_type": trans.transition_type,
        "type": trans.transition_type,  # alias for frontend compat
        "prompt": trans.prompt,
        "speed": trans.speed,
        "duration": trans.duration_frames / FPS,
        "from_frame": trans.from_frame,
        "duration_frames": trans.duration_frames,
        "in_offset": trans.in_offset,
        "out_offset": trans.out_offset,
        "clip_path": clip_mat.path if clip_mat else None,
        "clip_url": clip_mat.url if clip_mat else None,
        "enabled": trans.enabled,
    }


def _text_item_to_response(item: TextItem) -> dict:
    """Convert a TextItem to the API response format."""
    return {
        "id": item.id,
        "text": item.text,
        "font_family": item.font_family,
        "font_size": item.font_size,
        "color": item.color,
        "position": item.position,
        "width": item.width,
        "from_frame": item.from_frame,
        "duration_frames": item.duration_frames,
        "duration": item.duration_frames / FPS,
        "animation": item.animation,
        "enabled": item.enabled,
    }


def _find_scene(timeline: Timeline, scene_id: int) -> SceneItem | None:
    """Find a SceneItem by scene_id on the video track."""
    for item in timeline.get_video_track().items:
        if isinstance(item, SceneItem) and item.scene_id == scene_id:
            return item
    return None


def _recalc_frames(timeline: Timeline) -> None:
    """Recalculate from_frame for all items on the video track sequentially."""
    current = 0
    for item in timeline.get_video_track().items:
        item.from_frame = current
        current += item.duration_frames


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------


class SceneUpdate(BaseModel):
    visual_description: str | None = None
    camera: str | None = None
    text_overlay: str | None = None
    text_attribution: str | None = None
    duration: float | None = None  # seconds (3-15s)
    character_present: bool | None = None
    speed: float | None = None  # playback speed (0.25-4.0x)


class TransitionUpdate(BaseModel):
    transition_type: str | None = None
    prompt: str | None = None
    duration: float | None = None
    speed: float | None = None


class CopyKeyframeRequest(BaseModel):
    source_scene_id: int
    target_scene_ids: list[int]


def _validate_storage_path(v: str | None) -> str | None:
    """Reject paths that could escape the storage directory."""
    if v is not None and (".." in v or v.startswith("/")):
        raise ValueError("Invalid path: must be relative with no '..' segments")
    return v


class SetKeyframeRequest(BaseModel):
    keyframe_url: str | None = None
    keyframe_path: str | None = None

    _validate_path = field_validator("keyframe_path", mode="before")(_validate_storage_path)


class SetEndKeyframeRequest(BaseModel):
    end_keyframe_url: str | None = None


class ReorderRequest(BaseModel):
    scene_ids: list[int]


class ReferenceImagesBody(BaseModel):
    urls: list[str]

    @field_validator("urls", mode="before")
    @classmethod
    def validate_urls(cls, v: list[str]) -> list[str]:
        for url in v:
            if ".." in url or (not url.startswith("http") and url.startswith("/")):
                raise ValueError("Invalid URL/path")
        return v


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/{project_id}")
async def get_scenes(project_id: str, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Get all scenes for a project with clip URLs."""
    project = await db.get_project(project_id, org_id=user.org_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not project.get("timeline_json"):
        return {"scenes": [], "transitions": [], "total_duration": 0}

    timeline = _load_timeline(project)
    video_track = timeline.get_video_track()

    scenes = []
    transitions = []
    for item in video_track.items:
        if isinstance(item, SceneItem):
            scenes.append(_scene_to_response(item, timeline))
        elif isinstance(item, TransitionItem):
            transitions.append(_transition_to_response(item, timeline))

    # Extract text items from text-overlay track
    text_track = timeline.get_track("text-overlay")
    text_items = []
    if text_track:
        for item in text_track.items:
            if isinstance(item, TextItem):
                text_items.append(_text_item_to_response(item))

    return {
        "scenes": scenes,
        "transitions": transitions,
        "text_items": text_items,
        "total_duration": timeline.duration_frames / FPS,
    }


@router.patch("/{project_id}/{scene_id}")
async def update_scene(
    project_id: str, scene_id: int, body: SceneUpdate,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Update a single scene's editable fields."""
    project = await db.get_project(project_id, org_id=user.org_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    timeline = _load_timeline(project)
    scene = _find_scene(timeline, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail=f"Scene {scene_id} not found")

    updates = body.model_dump(exclude_none=True)
    if "speed" in updates and not (0.25 <= updates["speed"] <= 4.0):
        raise HTTPException(status_code=400, detail="Speed must be between 0.25 and 4.0")

    # Map duration (seconds) to duration_frames
    if "duration" in updates:
        dur = max(3.0, min(15.0, updates.pop("duration")))
        scene.duration_frames = _seconds_to_frames(dur)

    for key, val in updates.items():
        if hasattr(scene, key):
            setattr(scene, key, val)

    _recalc_frames(timeline)
    await _save_timeline(project_id, timeline, org_id=user.org_id)
    return _scene_to_response(scene, timeline)


@router.delete("/{project_id}/{scene_id}")
async def delete_scene(
    project_id: str, scene_id: int,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Delete a scene from a project."""
    project = await db.get_project(project_id, org_id=user.org_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    timeline = _load_timeline(project)
    video_track = timeline.get_video_track()

    scene_count = sum(1 for i in video_track.items if isinstance(i, SceneItem))
    if scene_count <= 2:
        raise HTTPException(status_code=400, detail="Cannot delete — minimum 2 scenes required")

    scene = _find_scene(timeline, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail=f"Scene {scene_id} not found")

    # Find the scene's index and remove it + adjacent transitions
    idx = video_track.items.index(scene)
    to_remove = {idx}

    # Remove transition before this scene (if exists)
    if idx > 0 and isinstance(video_track.items[idx - 1], TransitionItem):
        to_remove.add(idx - 1)
    # Remove transition after this scene (if exists)
    if idx < len(video_track.items) - 1 and isinstance(video_track.items[idx + 1], TransitionItem):
        to_remove.add(idx + 1)

    video_track.items = [item for i, item in enumerate(video_track.items) if i not in to_remove]

    # Renumber remaining scenes sequentially
    new_id = 0
    for item in video_track.items:
        if isinstance(item, SceneItem):
            item.scene_id = new_id
            new_id += 1

    # Clean up orphaned materials
    used_mids = set()
    for track in timeline.tracks:
        for item in track.items:
            if isinstance(item, SceneItem):
                for mid in [item.clip_material_id, item.keyframe_material_id,
                            item.end_keyframe_material_id]:
                    if mid:
                        used_mids.add(mid)
                used_mids.update(item.keyframe_history)
                used_mids.update(item.extracted_frame_ids)
                used_mids.update(item.reference_image_ids)
            elif isinstance(item, TransitionItem):
                if item.clip_material_id:
                    used_mids.add(item.clip_material_id)
    timeline.materials = {k: v for k, v in timeline.materials.items() if k in used_mids}

    _recalc_frames(timeline)
    await _save_timeline(project_id, timeline, org_id=user.org_id)

    remaining = sum(1 for i in video_track.items if isinstance(i, SceneItem))
    return {"deleted": scene_id, "scene_count": remaining}


@router.post("/{project_id}/reorder")
async def reorder_scenes(
    project_id: str, body: ReorderRequest,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Reorder scenes within a project."""
    project = await db.get_project(project_id, org_id=user.org_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    timeline = _load_timeline(project)
    video_track = timeline.get_video_track()

    # Build maps
    scene_map = {}
    transitions = []
    for item in video_track.items:
        if isinstance(item, SceneItem):
            scene_map[item.scene_id] = item
        elif isinstance(item, TransitionItem):
            transitions.append(item)

    # Rebuild video track in new order (scenes only, transitions stripped)
    reordered = []
    for new_idx, sid in enumerate(body.scene_ids):
        if sid not in scene_map:
            raise HTTPException(status_code=400, detail=f"Scene {sid} not found")
        scene = scene_map[sid]
        scene.scene_id = new_idx
        reordered.append(scene)

    video_track.items = reordered
    _recalc_frames(timeline)
    await _save_timeline(project_id, timeline, org_id=user.org_id)

    return {"scenes": [_scene_to_response(s, timeline) for s in reordered]}


@router.post("/{project_id}/copy-keyframe")
async def copy_keyframe(
    project_id: str, body: CopyKeyframeRequest,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Copy a keyframe from one scene to one or more target scenes."""
    project = await db.get_project(project_id, org_id=user.org_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    timeline = _load_timeline(project)
    source = _find_scene(timeline, body.source_scene_id)
    if not source or not source.keyframe_material_id:
        raise HTTPException(status_code=400, detail="Source scene has no keyframe")

    source_mat = timeline.materials.get(source.keyframe_material_id)
    if not source_mat:
        raise HTTPException(status_code=400, detail="Source keyframe material not found")

    for target_id in body.target_scene_ids:
        if target_id == body.source_scene_id:
            continue
        target = _find_scene(timeline, target_id)
        if not target:
            continue
        # Create a new material referencing the same file
        new_mat = Material(
            type="image",
            path=source_mat.path,
            url=source_mat.url,
            name=f"scene_{target_id}_keyframe",
        )
        timeline.add_material(new_mat)
        target.keyframe_material_id = new_mat.id

    await _save_timeline(project_id, timeline, org_id=user.org_id)
    return {"copied_to": body.target_scene_ids, "keyframe_url": source_mat.url}


@router.post("/{project_id}/{scene_id}/start-keyframe")
async def set_start_keyframe(
    project_id: str, scene_id: int, body: SetKeyframeRequest,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Set the start keyframe for a scene."""
    project = await db.get_project(project_id, org_id=user.org_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    timeline = _load_timeline(project)
    scene = _find_scene(timeline, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail=f"Scene {scene_id} not found")

    # Move old keyframe to history
    if scene.keyframe_material_id:
        scene.keyframe_history.append(scene.keyframe_material_id)

    # Create new material for the keyframe
    new_mat = Material(
        type="image",
        path=body.keyframe_path,
        url=body.keyframe_url,
        name=f"scene_{scene_id}_keyframe",
    )
    timeline.add_material(new_mat)
    scene.keyframe_material_id = new_mat.id

    await _save_timeline(project_id, timeline, org_id=user.org_id)
    return {"scene_id": scene_id, "keyframe_url": body.keyframe_url, "keyframe_path": body.keyframe_path}


@router.post("/{project_id}/{scene_id}/end-keyframe")
async def set_end_keyframe(
    project_id: str, scene_id: int, body: SetEndKeyframeRequest,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Set or clear the end keyframe for a scene."""
    project = await db.get_project(project_id, org_id=user.org_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    timeline = _load_timeline(project)
    scene = _find_scene(timeline, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail=f"Scene {scene_id} not found")

    if body.end_keyframe_url:
        mat = Material(type="image", url=body.end_keyframe_url, name=f"scene_{scene_id}_end_keyframe")
        timeline.add_material(mat)
        scene.end_keyframe_material_id = mat.id
    else:
        scene.end_keyframe_material_id = None

    await _save_timeline(project_id, timeline, org_id=user.org_id)
    return {"scene_id": scene_id, "end_keyframe_url": body.end_keyframe_url}


@router.delete("/{project_id}/transition/{from_id}/{to_id}")
async def delete_transition(
    project_id: str, from_id: int, to_id: int,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Delete a transition between two scenes (becomes a hard cut)."""
    project = await db.get_project(project_id, org_id=user.org_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    timeline = _load_timeline(project)
    video_track = timeline.get_video_track()

    # Find and remove the transition item that sits between the two scenes
    removed = False
    new_items = []
    for item in video_track.items:
        if isinstance(item, TransitionItem) and not removed:
            # Check if this transition is between the right scenes
            idx = len(new_items)
            prev_scene = next(
                (new_items[i] for i in range(idx - 1, -1, -1) if isinstance(new_items[i], SceneItem)),
                None,
            )
            # We identify by position: previous scene should have from_id
            if prev_scene and isinstance(prev_scene, SceneItem) and prev_scene.scene_id == from_id:
                removed = True
                continue
        new_items.append(item)

    video_track.items = new_items
    _recalc_frames(timeline)
    await _save_timeline(project_id, timeline, org_id=user.org_id)

    return {"deleted": f"{from_id}_{to_id}"}


@router.patch("/{project_id}/transition/{from_id}/{to_id}")
async def update_transition(
    project_id: str, from_id: int, to_id: int,
    body: TransitionUpdate,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Update a transition's editable fields."""
    project = await db.get_project(project_id, org_id=user.org_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    timeline = _load_timeline(project)
    video_track = timeline.get_video_track()

    # Find transition between these scenes
    transition = None
    insert_after_idx = None
    for i, item in enumerate(video_track.items):
        if isinstance(item, SceneItem) and item.scene_id == from_id:
            # Look at next item
            if i + 1 < len(video_track.items) and isinstance(video_track.items[i + 1], TransitionItem):
                transition = video_track.items[i + 1]
            else:
                insert_after_idx = i
            break

    if not transition:
        # Create new transition item
        transition = TransitionItem(
            prompt="",
            duration_frames=_seconds_to_frames(3.0),
        )
        if insert_after_idx is not None:
            video_track.items.insert(insert_after_idx + 1, transition)
        else:
            raise HTTPException(status_code=404, detail=f"Scene {from_id} not found")

    updates = body.model_dump(exclude_none=True)
    if "speed" in updates and not (0.25 <= updates["speed"] <= 4.0):
        raise HTTPException(status_code=400, detail="Speed must be between 0.25 and 4.0")

    if "duration" in updates:
        dur = max(3.0, min(15.0, updates.pop("duration")))
        transition.duration_frames = _seconds_to_frames(dur)

    for key, val in updates.items():
        if hasattr(transition, key):
            setattr(transition, key, val)

    _recalc_frames(timeline)
    await _save_timeline(project_id, timeline, org_id=user.org_id)
    return _transition_to_response(transition, timeline)


@router.post("/{project_id}/{scene_id}/reference-images")
async def set_reference_images(
    project_id: str, scene_id: int, body: ReferenceImagesBody,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Set reference images for a scene (max 5)."""
    project = await db.get_project(project_id, org_id=user.org_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    timeline = _load_timeline(project)
    scene = _find_scene(timeline, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail=f"Scene {scene_id} not found")

    urls = body.urls[:5]

    # Create materials for each reference image
    scene.reference_image_ids = []
    for url in urls:
        mat = Material(type="image", path=url, name=f"scene_{scene_id}_ref")
        timeline.add_material(mat)
        scene.reference_image_ids.append(mat.id)

    await _save_timeline(project_id, timeline, org_id=user.org_id)
    return {"scene_id": scene_id, "reference_images": urls}


# ---------------------------------------------------------------------------
# Text Item Endpoints
# ---------------------------------------------------------------------------


class TextItemCreate(BaseModel):
    text: str = "New Text"
    font_family: str = "Cinzel"
    font_size: int = 48
    color: str = "#FFFFFF"
    position: dict | None = None
    from_frame: int = 0
    duration_frames: int = 150  # 5s at 30fps


class TextItemUpdate(BaseModel):
    text: str | None = None
    font_family: str | None = None
    font_size: int | None = None
    color: str | None = None
    font_weight: int | None = None
    font_style: str | None = None
    text_decoration: str | None = None
    position: dict | None = None
    width: float | None = None
    from_frame: int | None = None
    duration_frames: int | None = None
    animation: dict | None = None
    enabled: bool | None = None


@router.post("/{project_id}/text")
async def add_text(
    project_id: str, body: TextItemCreate,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Add a text overlay to the project."""
    project = await db.get_project(project_id, org_id=user.org_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    timeline = _load_timeline(project)
    text_track = timeline.get_track("text-overlay")
    if not text_track:
        raise HTTPException(status_code=400, detail="No text track in timeline")

    item = TextItem(
        text=body.text,
        font_family=body.font_family,
        font_size=body.font_size,
        color=body.color,
        position=body.position or {"x": 0.5, "y": 0.5},
        from_frame=body.from_frame,
        duration_frames=body.duration_frames,
    )
    text_track.items.append(item)

    await _save_timeline(project_id, timeline, org_id=user.org_id)
    return _text_item_to_response(item)


@router.patch("/{project_id}/text/{text_id}")
async def update_text(
    project_id: str, text_id: str, body: TextItemUpdate,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Update a text overlay's properties."""
    project = await db.get_project(project_id, org_id=user.org_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    timeline = _load_timeline(project)
    text_track = timeline.get_track("text-overlay")
    if not text_track:
        raise HTTPException(status_code=404, detail="Text track not found")

    item = next((i for i in text_track.items if isinstance(i, TextItem) and i.id == text_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Text item not found")

    updates = body.model_dump(exclude_none=True)
    for key, val in updates.items():
        if hasattr(item, key):
            setattr(item, key, val)

    # Enforce minimum duration (0.5s)
    if item.duration_frames < 15:
        item.duration_frames = 15

    await _save_timeline(project_id, timeline, org_id=user.org_id)
    return _text_item_to_response(item)


@router.delete("/{project_id}/text/{text_id}")
async def delete_text(
    project_id: str, text_id: str,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Delete a text overlay."""
    project = await db.get_project(project_id, org_id=user.org_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    timeline = _load_timeline(project)
    text_track = timeline.get_track("text-overlay")
    if not text_track:
        raise HTTPException(status_code=404, detail="Text track not found")

    original_count = len(text_track.items)
    text_track.items = [i for i in text_track.items if not (isinstance(i, TextItem) and i.id == text_id)]

    if len(text_track.items) == original_count:
        raise HTTPException(status_code=404, detail="Text item not found")

    await _save_timeline(project_id, timeline, org_id=user.org_id)
    return {"deleted": text_id}

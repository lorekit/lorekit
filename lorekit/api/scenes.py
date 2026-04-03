"""Scene endpoints — view and edit individual scenes within a project."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from lorekit import db
from lorekit.auth.user import get_current_user, CurrentUser
from lorekit.models import StoryBreakdown, Transition

router = APIRouter(prefix="/api/scenes", tags=["scenes"])


class SceneUpdate(BaseModel):
    visual_description: str | None = None
    camera: str | None = None
    text_overlay: str | None = None
    text_attribution: str | None = None
    duration: float | None = None  # clip length (3-15s)
    character_present: bool | None = None
    speed: float | None = None  # playback speed (0.25-4.0x)


class TransitionUpdate(BaseModel):
    type: str | None = None  # "ai_morph", "hard_cut", "fade", "dissolve", etc.
    prompt: str | None = None
    duration: float | None = None
    speed: float | None = None
    clip_path: str | None = None
    clip_url: str | None = None


class CopyKeyframeRequest(BaseModel):
    source_scene_id: int
    target_scene_ids: list[int]


class SetKeyframeRequest(BaseModel):
    keyframe_url: str | None = None  # fal CDN URL (for AI API reuse)
    keyframe_path: str | None = None  # local storage path (for serving)


class SetEndKeyframeRequest(BaseModel):
    end_keyframe_url: str | None = None  # null to clear


class ReorderRequest(BaseModel):
    scene_ids: list[int]


@router.get("/{project_id}")
async def get_scenes(project_id: str, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Get all scenes for a project with clip URLs."""
    project = await db.get_project(project_id, org_id=user.org_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not project.get("story_json"):
        return {"scenes": [], "clips": []}

    story = StoryBreakdown.model_validate_json(project["story_json"])
    clips = json.loads(project.get("clips_json") or "[]")
    clip_map = {c["scene_id"]: c["clip_path"] for c in clips}
    keyframe_map = {c["scene_id"]: c.get("keyframe_url") for c in clips if c.get("keyframe_url")}
    keyframe_path_map = {c["scene_id"]: c.get("keyframe_path") for c in clips if c.get("keyframe_path")}
    keyframe_history_map = {c["scene_id"]: c.get("keyframe_history") for c in clips if c.get("keyframe_history")}
    end_keyframe_map = {c["scene_id"]: c.get("end_keyframe_url") for c in clips if c.get("end_keyframe_url")}
    extracted_frames_map = {c["scene_id"]: c.get("extracted_frames") for c in clips if c.get("extracted_frames")}
    reference_images_map = {c["scene_id"]: c.get("reference_images") for c in clips if c.get("reference_images")}

    # Backfill: merge transition_clips_json data into story.transitions
    tc_raw = json.loads(project.get("transition_clips_json") or "{}")
    needs_save = False

    if not story.transitions and tc_raw:
        # No transitions in story but have clip data — create them
        for key, val in tc_raw.items():
            parts = key.split("_")
            if len(parts) == 2:
                story.transitions.append(Transition(
                    from_scene_id=int(parts[0]),
                    to_scene_id=int(parts[1]),
                    type="ai_morph",
                    prompt=val.get("prompt", ""),
                    clip_path=val.get("clip_path"),
                    clip_url=val.get("clip_url"),
                ))
        story.transitions.sort(key=lambda t: t.from_scene_id)
        needs_save = True

    # Backfill clip_path/clip_url from transition_clips_json into existing transitions
    for t in story.transitions:
        tc_key = f"{t.from_scene_id}_{t.to_scene_id}"
        tc_entry = tc_raw.get(tc_key, {})
        if tc_entry.get("clip_path") and not t.clip_path:
            t.clip_path = tc_entry["clip_path"]
            t.clip_url = tc_entry.get("clip_url")
            t.type = "ai_morph"
            needs_save = True

    if needs_save:
        story.total_duration = (
            sum(s.effective_duration for s in story.scenes)
            + sum(t.effective_duration for t in story.transitions)
        )
        await db.update_project(project_id, org_id=user.org_id, story_json=story.model_dump_json())

    scenes = []
    for scene in story.scenes:
        s = scene.model_dump()
        s["clip_path"] = clip_map.get(scene.scene_id)
        s["keyframe_url"] = keyframe_map.get(scene.scene_id)
        s["keyframe_path"] = keyframe_path_map.get(scene.scene_id)
        s["keyframe_history"] = keyframe_history_map.get(scene.scene_id)
        s["end_keyframe_url"] = end_keyframe_map.get(scene.scene_id)
        s["extracted_frames"] = extracted_frames_map.get(scene.scene_id)
        s["reference_images"] = reference_images_map.get(scene.scene_id)
        scenes.append(s)

    transitions = [t.model_dump() for t in story.transitions]

    return {"scenes": scenes, "transitions": transitions, "total_duration": story.total_duration}


@router.patch("/{project_id}/{scene_id}")
async def update_scene(project_id: str, scene_id: int, body: SceneUpdate, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Update a single scene's editable fields."""
    project = await db.get_project(project_id, org_id=user.org_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not project.get("story_json"):
        raise HTTPException(status_code=400, detail="No story generated yet")

    story = StoryBreakdown.model_validate_json(project["story_json"])
    scene = next((s for s in story.scenes if s.scene_id == scene_id), None)
    if not scene:
        raise HTTPException(status_code=404, detail=f"Scene {scene_id} not found")

    updates = body.model_dump(exclude_none=True)
    if "speed" in updates and not (0.25 <= updates["speed"] <= 4.0):
        raise HTTPException(status_code=400, detail="Speed must be between 0.25 and 4.0")

    for key, val in updates.items():
        setattr(scene, key, val)
    # Clamp duration to Kling API range (3-15s)
    if scene.duration < 3.0:
        scene.duration = 3.0
    elif scene.duration > 15.0:
        scene.duration = 15.0

    # Recalculate total duration (scenes + transitions, using effective durations)
    story.total_duration = (
        sum(s.effective_duration for s in story.scenes)
        + sum(t.effective_duration for t in story.transitions)
    )

    await db.update_project(project_id, org_id=user.org_id, story_json=story.model_dump_json())
    return scene.model_dump()


@router.delete("/{project_id}/{scene_id}")
async def delete_scene(project_id: str, scene_id: int, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Delete a scene from a project. Renumbers remaining scenes sequentially."""
    project = await db.get_project(project_id, org_id=user.org_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not project.get("story_json"):
        raise HTTPException(status_code=400, detail="No story generated yet")

    story = StoryBreakdown.model_validate_json(project["story_json"])

    if len(story.scenes) <= 2:
        raise HTTPException(status_code=400, detail="Cannot delete — minimum 2 scenes required")

    scene = next((s for s in story.scenes if s.scene_id == scene_id), None)
    if not scene:
        raise HTTPException(status_code=404, detail=f"Scene {scene_id} not found")

    # Remove the scene
    story.scenes = [s for s in story.scenes if s.scene_id != scene_id]

    # Remove transitions involving this scene
    story.transitions = [
        t for t in story.transitions
        if t.from_scene_id != scene_id and t.to_scene_id != scene_id
    ]

    # Renumber scenes sequentially (1, 2, 3...)
    for i, s in enumerate(story.scenes):
        s.scene_id = i + 1

    # Rebuild transitions with new scene numbers
    new_transitions = []
    for i in range(len(story.scenes) - 1):
        from_id = story.scenes[i].scene_id
        to_id = story.scenes[i + 1].scene_id
        # Try to preserve existing transition data
        existing = next(
            (t for t in story.transitions if t.from_scene_id == from_id and t.to_scene_id == to_id),
            None,
        )
        if existing:
            new_transitions.append(existing)
    story.transitions = new_transitions

    # Recalculate total duration
    story.total_duration = (
        sum(s.effective_duration for s in story.scenes)
        + sum(t.effective_duration for t in story.transitions)
    )

    # Update clips_json — remove clips for deleted scene, renumber
    clips = json.loads(project.get("clips_json") or "[]")
    clips = [c for c in clips if c.get("scene_id") != scene_id]
    # Renumber clips to match new scene IDs
    remaining_clips = sorted(clips, key=lambda c: c.get("scene_id", 0))
    for i, clip in enumerate(remaining_clips):
        clip["scene_id"] = i + 1

    # Update transition_clips_json — remove entries for deleted scene
    tc_json = project.get("transition_clips_json")
    if tc_json:
        tc = json.loads(tc_json)
        tc = {
            k: v for k, v in tc.items()
            if str(scene_id) not in k.split("_")
        }
        tc_json = json.dumps(tc)
    else:
        tc_json = None

    await db.update_project(
        project_id,
        org_id=user.org_id,
        story_json=story.model_dump_json(),
        clips_json=json.dumps(remaining_clips),
        transition_clips_json=tc_json,
    )

    return {"deleted": scene_id, "scene_count": len(story.scenes)}


@router.post("/{project_id}/reorder")
async def reorder_scenes(project_id: str, body: ReorderRequest, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Reorder scenes within a project."""
    project = await db.get_project(project_id, org_id=user.org_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not project.get("story_json"):
        raise HTTPException(status_code=400, detail="No story generated yet")

    story = StoryBreakdown.model_validate_json(project["story_json"])

    scene_map = {s.scene_id: s for s in story.scenes}
    reordered = []
    for new_idx, sid in enumerate(body.scene_ids, start=1):
        if sid not in scene_map:
            raise HTTPException(status_code=400, detail=f"Scene {sid} not found")
        scene = scene_map[sid]
        scene.scene_id = new_idx
        reordered.append(scene)

    story.scenes = reordered
    await db.update_project(project_id, org_id=user.org_id, story_json=story.model_dump_json())

    return {"scenes": [s.model_dump() for s in story.scenes]}


@router.post("/{project_id}/copy-keyframe")
async def copy_keyframe(project_id: str, body: CopyKeyframeRequest, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Copy a keyframe from one scene to one or more target scenes."""
    project = await db.get_project(project_id, org_id=user.org_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    clips = json.loads(project.get("clips_json") or "[]")

    # Find source keyframe URL
    source_entry = next(
        (c for c in clips if c.get("scene_id") == body.source_scene_id and c.get("keyframe_url")),
        None,
    )
    if not source_entry or not source_entry.get("keyframe_url"):
        raise HTTPException(status_code=400, detail="Source scene has no keyframe")

    keyframe_url = source_entry["keyframe_url"]

    # Apply to each target scene
    existing_scenes = {c["scene_id"] for c in clips}
    for target_id in body.target_scene_ids:
        if target_id == body.source_scene_id:
            continue
        if target_id in existing_scenes:
            # Update existing entry — set keyframe, keep clip_path if present
            for c in clips:
                if c["scene_id"] == target_id:
                    c["keyframe_url"] = keyframe_url
                    break
        else:
            # Create new entry with just the keyframe
            clips.append({
                "scene_id": target_id,
                "keyframe_url": keyframe_url,
                "clip_path": None,
                "variant": None,
            })

    await db.update_project(project_id, org_id=user.org_id, clips_json=json.dumps(clips))

    return {"copied_to": body.target_scene_ids, "keyframe_url": keyframe_url}


@router.post("/{project_id}/{scene_id}/start-keyframe")
async def set_start_keyframe(
    project_id: str, scene_id: int, body: SetKeyframeRequest,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Set the start keyframe for a scene from an existing image URL."""
    project = await db.get_project(project_id, org_id=user.org_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    clips = json.loads(project.get("clips_json") or "[]")
    entry = next((c for c in clips if c.get("scene_id") == scene_id), None)
    if not entry:
        entry = {"scene_id": scene_id, "clip_path": None, "keyframe_url": None}
        clips.append(entry)
        clips.sort(key=lambda c: c["scene_id"])

    # Preserve old keyframe in history
    old_url = entry.get("keyframe_url")
    old_path = entry.get("keyframe_path")
    if old_path:
        history = entry.get("keyframe_history") or []
        history.append({"url": old_url, "path": old_path})
        entry["keyframe_history"] = history

    entry["keyframe_url"] = body.keyframe_url
    if body.keyframe_path:
        entry["keyframe_path"] = body.keyframe_path

    await db.update_project(project_id, org_id=user.org_id, clips_json=json.dumps(clips))
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

    clips = json.loads(project.get("clips_json") or "[]")
    entry = next((c for c in clips if c.get("scene_id") == scene_id), None)
    if not entry:
        # Create a new entry if none exists
        entry = {"scene_id": scene_id, "clip_path": None, "keyframe_url": None}
        clips.append(entry)
        clips.sort(key=lambda c: c["scene_id"])

    if body.end_keyframe_url:
        entry["end_keyframe_url"] = body.end_keyframe_url
    else:
        entry.pop("end_keyframe_url", None)

    await db.update_project(project_id, org_id=user.org_id, clips_json=json.dumps(clips))
    return {"scene_id": scene_id, "end_keyframe_url": body.end_keyframe_url}


@router.delete("/{project_id}/transition/{from_id}/{to_id}")
async def delete_transition(
    project_id: str, from_id: int, to_id: int,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Delete a transition between two scenes. The cut becomes a hard cut."""
    project = await db.get_project(project_id, org_id=user.org_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not project.get("story_json"):
        raise HTTPException(status_code=400, detail="No story generated yet")

    story = StoryBreakdown.model_validate_json(project["story_json"])
    story.transitions = [
        t for t in story.transitions
        if not (t.from_scene_id == from_id and t.to_scene_id == to_id)
    ]

    # Recalculate total duration
    story.total_duration = (
        sum(s.effective_duration for s in story.scenes)
        + sum(t.effective_duration for t in story.transitions)
    )

    # Remove from transition_clips_json
    tc_json = project.get("transition_clips_json")
    if tc_json:
        tc = json.loads(tc_json)
        tc.pop(f"{from_id}_{to_id}", None)
        tc_json = json.dumps(tc)
    else:
        tc_json = None

    await db.update_project(
        project_id,
        org_id=user.org_id,
        story_json=story.model_dump_json(),
        transition_clips_json=tc_json,
    )

    return {"deleted": f"{from_id}_{to_id}"}


@router.patch("/{project_id}/transition/{from_id}/{to_id}")
async def update_transition(
    project_id: str,
    from_id: int,
    to_id: int,
    body: TransitionUpdate,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Update a transition's editable fields."""
    project = await db.get_project(project_id, org_id=user.org_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not project.get("story_json"):
        raise HTTPException(status_code=400, detail="No story generated yet")

    story = StoryBreakdown.model_validate_json(project["story_json"])
    transition = next(
        (t for t in story.transitions if t.from_scene_id == from_id and t.to_scene_id == to_id),
        None,
    )
    if not transition:
        # Create new transition if it doesn't exist
        transition = Transition(from_scene_id=from_id, to_scene_id=to_id, prompt="")
        story.transitions.append(transition)

    updates = body.model_dump(exclude_none=True)
    if "speed" in updates and not (0.25 <= updates["speed"] <= 4.0):
        raise HTTPException(status_code=400, detail="Speed must be between 0.25 and 4.0")

    for key, val in updates.items():
        setattr(transition, key, val)
    # Clamp duration to Kling API range (3-15s)
    if transition.duration < 3.0:
        transition.duration = 3.0
    elif transition.duration > 15.0:
        transition.duration = 15.0

    # Recalculate total duration (scenes + transitions, using effective durations)
    story.total_duration = (
        sum(s.effective_duration for s in story.scenes)
        + sum(t.effective_duration for t in story.transitions)
    )

    await db.update_project(project_id, org_id=user.org_id, story_json=story.model_dump_json())
    return transition.model_dump()


class ReferenceImagesBody(BaseModel):
    urls: list[str]


@router.post("/{project_id}/{scene_id}/reference-images")
async def set_reference_images(
    project_id: str, scene_id: int, body: ReferenceImagesBody,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Set reference images for a scene (max 5)."""
    project = await db.get_project(project_id, org_id=user.org_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    urls = body.urls[:5]  # enforce max 5

    clips = json.loads(project.get("clips_json") or "[]")
    entry = next((c for c in clips if c.get("scene_id") == scene_id), None)
    if not entry:
        entry = {"scene_id": scene_id, "clip_path": None, "keyframe_url": None}
        clips.append(entry)
        clips.sort(key=lambda c: c["scene_id"])

    entry["reference_images"] = urls
    await db.update_project(project_id, org_id=user.org_id, clips_json=json.dumps(clips))
    return {"scene_id": scene_id, "reference_images": urls}

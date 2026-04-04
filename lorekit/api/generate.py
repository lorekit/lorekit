"""Generation endpoints — story, clips, render."""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator as pydantic_field_validator

from lorekit import db
from lorekit.auth.user import get_current_user, CurrentUser
from lorekit.config import get_settings
from lorekit.models import SourceItem, Timeline, SceneItem, TransitionItem, Material
from lorekit.storage import get_file_store, project_render_path, project_audio_path
from lorekit.tasks import get_task_runner

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/generate", tags=["generate"])


def _safe_error(exc: Exception) -> str:
    """Return a sanitized error message safe for client-facing job records.

    Avoids leaking file paths, DB connection strings, or API keys.
    """
    msg = str(exc)
    # Known safe error types — return their message directly
    if isinstance(exc, (ValueError, KeyError)):
        return msg[:200]
    # For everything else, return a generic message (details are in server logs)
    return f"Task failed ({type(exc).__name__}). Check server logs for details."


def _abs_path(storage_path: str) -> str:
    """Resolve a storage-relative path to an absolute filesystem path for ffmpeg.

    Validates the resolved path stays within the file store base directory
    to prevent path traversal attacks via crafted material paths.
    """
    if ".." in storage_path or storage_path.startswith("/"):
        raise ValueError("Invalid storage path")
    store = get_file_store()
    if hasattr(store, "base_dir"):
        resolved = (store.base_dir / storage_path).resolve()
        if not resolved.is_relative_to(store.base_dir.resolve()):
            raise ValueError("Path escapes storage directory")
        return str(resolved)
    return storage_path


def _load_timeline(project: dict) -> Timeline:
    """Load the Timeline document from a project row.

    asyncpg returns JSONB as a dict, but handle str for safety.
    """
    tl = project.get("timeline_json")
    if not tl:
        raise ValueError("No timeline")
    if isinstance(tl, str):
        tl = json.loads(tl)
    return Timeline.model_validate(tl)


def _save_timeline(timeline: Timeline) -> str:
    """Serialize a Timeline to a JSON string for DB storage."""
    return json.dumps(timeline.model_dump())


def _find_scene_item(timeline: Timeline, scene_id: int) -> SceneItem | None:
    """Find a SceneItem by scene_id on the video track."""
    track = timeline.get_video_track()
    for item in track.items:
        if isinstance(item, SceneItem) and item.scene_id == scene_id:
            return item
    return None


def _find_transition_item(
    timeline: Timeline, from_scene_id: int, to_scene_id: int,
) -> TransitionItem | None:
    """Find the TransitionItem between two scenes on the video track."""
    track = timeline.get_video_track()
    items = track.items
    for i, item in enumerate(items):
        if not isinstance(item, TransitionItem):
            continue
        # Check neighbours: preceding SceneItem has from_scene_id, following has to_scene_id
        prev_scene = next(
            (items[j] for j in range(i - 1, -1, -1) if isinstance(items[j], SceneItem)),
            None,
        )
        next_scene = next(
            (items[j] for j in range(i + 1, len(items)) if isinstance(items[j], SceneItem)),
            None,
        )
        if (prev_scene and prev_scene.scene_id == from_scene_id
                and next_scene and next_scene.scene_id == to_scene_id):
            return item
    return None


import re

_SAFE_ID_RE = re.compile(r'^[a-zA-Z0-9_-]+$')


class StoryRequest(BaseModel):
    character_id: str
    universe_id: str | None = None
    hook_quote_id: str | None = None
    truth_quote_id: str | None = None
    quote_ids: list[str] | None = None  # flexible: user picks quotes, backend assigns roles
    target_duration: int = 35
    arc_template: str | None = None  # "story", "rapid_montage", etc.
    theme: str | None = None  # vibe preset key, e.g. "dark_masculine"
    aspect_ratio: str = "9:16"  # "9:16" (portrait/short) or "16:9" (landscape)
    audio_mode: str = "auto"  # auto | narration | uploaded | silent
    uploaded_audio_path: str | None = None  # for uploaded mode

    @pydantic_field_validator("theme", "arc_template", mode="before")
    @classmethod
    def validate_safe_identifiers(cls, v: str | None) -> str | None:
        if v is not None and not _SAFE_ID_RE.match(v):
            raise ValueError("Must contain only alphanumeric characters, hyphens, or underscores")
        return v


class ClipsRequest(BaseModel):
    project_id: str


class SingleClipRequest(BaseModel):
    project_id: str
    scene_id: int


class KeyframeRequest(BaseModel):
    project_id: str
    scene_id: int
    reference_image_urls: list[str] | None = None  # Up to 14 reference images for Nano Banana 2


class TransitionRequest(BaseModel):
    project_id: str
    from_scene_id: int
    to_scene_id: int
    prompt: str = "Smooth cinematic transition, continuous fluid camera motion, seamless morph"
    duration: int = 3  # 3-15s — clip length sent to Kling API


class ExtractFrameRequest(BaseModel):
    project_id: str
    scene_id: int
    timestamp: float  # seconds into the clip


class RenderRequest(BaseModel):
    project_id: str
    raw: bool = False  # If True, just concat clips — no color grade, text, or audio
    text_overlays: bool = True
    color_grade: bool = True
    audio: bool = True


@router.post("/story")
async def generate_story_endpoint(body: StoryRequest, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Generate a story breakdown using the configured LLM.

    Creates a project if one doesn't exist, or updates existing project.
    """
    from lorekit.sources.database import get_character, select_source_pair
    from lorekit.story.generator import generate_story

    # Verify universe belongs to user's org
    uni = await db.get_universe(body.universe_id, org_id=user.org_id)
    if not uni:
        raise HTTPException(status_code=404, detail="Universe not found")

    # Verify character belongs to this universe
    pool = await db.get_pool()
    char_check = await pool.fetchrow(
        "SELECT id FROM characters WHERE id = $1 AND universe_id = $2",
        body.character_id, body.universe_id,
    )
    if not char_check:
        raise HTTPException(status_code=404, detail="Character not found in this universe")

    character = await get_character(pool, body.character_id)

    def _row_to_source_item(row: dict) -> SourceItem:
        return SourceItem(
            text=row["text"],
            short_version=row["short_version"],
            theme=row["theme"],
            emotional_function=row["emotional_function"],
            word_count=row["word_count"],
            read_time_seconds=row["read_time_seconds"],
            pair_with_visual=row["pair_with_visual"] or "",
        )

    # Select or fetch source items — all fetches scoped to user's universe
    if body.hook_quote_id and body.truth_quote_id:
        hook_row = await pool.fetchrow(
            """SELECT q.* FROM source_items q
               JOIN universes u ON q.universe_id = u.id
               WHERE q.id = $1 AND u.organization_id = $2""",
            body.hook_quote_id, user.org_id,
        )
        truth_row = await pool.fetchrow(
            """SELECT q.* FROM source_items q
               JOIN universes u ON q.universe_id = u.id
               WHERE q.id = $1 AND u.organization_id = $2""",
            body.truth_quote_id, user.org_id,
        )
        if not hook_row or not truth_row:
            raise HTTPException(status_code=404, detail="Source item not found")
        hook_quote = _row_to_source_item(dict(hook_row))
        truth_quote = _row_to_source_item(dict(truth_row))
    elif body.quote_ids and len(body.quote_ids) > 0:
        # Flexible: user picked source items, backend assigns roles
        n = len(body.quote_ids)
        placeholders = ", ".join(f"${i}" for i in range(1, n + 1))
        rows = await pool.fetch(
            f"""SELECT q.* FROM source_items q
                JOIN universes u ON q.universe_id = u.id
                WHERE q.id IN ({placeholders}) AND u.organization_id = ${n + 1}""",
            *body.quote_ids, user.org_id,
        )
        rows = [dict(r) for r in rows]
        if not rows:
            raise HTTPException(status_code=404, detail="No matching source items found")

        picked = [_row_to_source_item(r) for r in rows]

        # Smart assignment: shortest/punchiest -> hook, deepest -> truth
        # If only one picked, use it as hook and auto-select a truth
        if len(picked) == 1:
            hook_quote = picked[0]
            _, truth_quote = await select_source_pair(pool, body.character_id, org_id=user.org_id)
        else:
            # Sort by word count — shortest is hook, longest is truth
            sorted_picks = sorted(picked, key=lambda q: q.word_count)
            hook_quote = sorted_picks[0]
            truth_quote = sorted_picks[-1]
    else:
        hook_quote, truth_quote = await select_source_pair(pool, body.character_id, org_id=user.org_id)

    # If uploaded audio mode, analyze and use as timing constraint
    effective_duration = body.target_duration
    validated_audio_path: str | None = None
    if body.audio_mode == "uploaded" and body.uploaded_audio_path:
        # Reject absolute paths and traversal attempts regardless of store type
        raw = body.uploaded_audio_path
        if raw.startswith("/") or ".." in raw:
            raise HTTPException(status_code=400, detail="Invalid audio path")

        # Validate path resolves inside the file store
        store = get_file_store()
        if hasattr(store, "base_dir"):
            resolved = (store.base_dir / raw).resolve()
            if not resolved.is_relative_to(store.base_dir) or not resolved.exists():
                raise HTTPException(status_code=400, detail="Invalid audio path")
            safe_audio_path = str(resolved)
        else:
            safe_audio_path = raw
        validated_audio_path = raw  # store the clean relative path

        from lorekit.audio.analyzer import analyze_audio as _analyze_audio
        try:
            audio_analysis = await _analyze_audio(safe_audio_path)
            effective_duration = int(audio_analysis["duration_seconds"])
        except Exception:
            pass  # fallback to default duration

    # Generate story via LLM — returns a Timeline
    story = await generate_story(
        character=character,
        hook_quote=hook_quote,
        truth_quote=truth_quote,
        target_duration=effective_duration,
        theme=body.theme,
        arc_template=body.arc_template,
    )

    # Create project
    project_id = uuid.uuid4().hex[:12]
    arc_label = body.arc_template or "story"
    name = f"{character.name} — {hook_quote.theme} ({arc_label})"
    await db.create_project(
        project_id=project_id,
        character_id=body.character_id,
        universe_id=body.universe_id,
        name=name,
        hook_quote_id=body.hook_quote_id,
        truth_quote_id=body.truth_quote_id,
    )
    await db.update_project(
        project_id,
        org_id=user.org_id,
        status="story_ready",
        timeline_json=_save_timeline(story),
        aspect_ratio=body.aspect_ratio,
        audio_mode=body.audio_mode,
        uploaded_audio_path=validated_audio_path,
    )

    return {
        "project_id": project_id,
        "timeline": story.model_dump(),
    }


async def _generate_clips_task(job_id: str, project_id: str, org_id: str | None = None) -> None:
    """Background task: generate video clips via fal.ai for all scenes.

    Generates scene 1 first to capture its keyframe, then generates middle
    scenes, and finally generates the last scene with end_image_url set to
    scene 1's keyframe for seamless looping.
    """
    try:
        project = await db.get_project(project_id, org_id=org_id)
        if not project or not project.get("timeline_json"):
            await db.update_job(job_id, status="failed", message="No timeline found")
            return

        timeline = _load_timeline(project)
        video_track = timeline.get_video_track()
        character_id = project.get("character_id", "")

        # ---- THEME: from project row, resolve vibe text from DB ----
        theme = project.get("theme") or None
        style = await db.get_video_style(theme) if theme else None
        vibe_text = style["prompt"] if style and style.get("prompt") else None

        from lorekit.sources.database import get_character
        from lorekit.api.character import get_character_image_url

        pool = await db.get_pool()
        character = await get_character(pool, character_id)

        # ---- CHARACTER IMAGE: get the themed version ----
        character_image_url = await get_character_image_url(character_id, theme=theme)
        # Fallback to project-level image if no themed image found
        if not character_image_url:
            character_image_url = project.get("character_image_url")

        logger.info(
            "Clips task — project=%s theme=%s character_image=%s",
            project_id, theme, bool(character_image_url),
        )

        ar = project.get("aspect_ratio", "9:16")

        await db.update_project(project_id, org_id=org_id, status="generating")
        await db.update_job(job_id, status="running", message="Generating clips...")

        settings = get_settings()
        settings.ensure_dirs()

        from lorekit.video.generator import (
            generate_single_clip,
            _generate_keyframe_from_portrait,
            _generate_keyframe_text,
        )
        from lorekit.video.prompt_builder import build_video_prompt
        from lorekit.config import get_civilization

        civ_config = get_civilization(character.group)

        # Use resolved vibe text or fall back to settings default
        active_vibe = vibe_text or settings.video_vibe

        # Collect all SceneItems from the video track
        all_scene_items = [item for item in video_track.items if isinstance(item, SceneItem)]

        # Identify scenes that already have clips (material with a path)
        existing_scene_ids: set[int] = set()
        for si in all_scene_items:
            if si.clip_material_id:
                mat = timeline.materials.get(si.clip_material_id)
                if mat and mat.path:
                    existing_scene_ids.add(si.scene_id)

        scenes_to_generate = [si for si in all_scene_items if si.scene_id not in existing_scene_ids]
        total_gens = len(scenes_to_generate) + sum(1 for s in scenes_to_generate if s.beat == "cta")

        if total_gens == 0:
            await db.update_project(project_id, org_id=org_id, status="clips_ready")
            await db.update_job(job_id, status="completed", progress=100, message="All clips already exist")
            return

        # --- Generate scene 1's keyframe for loop support ---
        first_scene = all_scene_items[0]
        last_scene = all_scene_items[-1] if len(all_scene_items) > 1 else None
        hook_keyframe_url: str | None = None

        # Only generate the hook keyframe if we need it (first or last scene being generated)
        need_hook_keyframe = (
            first_scene.scene_id not in existing_scene_ids
            or (last_scene and last_scene.scene_id not in existing_scene_ids)
        )

        if need_hook_keyframe:
            await db.update_job(job_id, status="running", message="Generating hook keyframe for loop...")
            first_prompt = build_video_prompt(
                first_scene, character, civ_config.model_dump(), active_vibe, theme=theme,
            )
            if first_scene.character_present and character_image_url:
                hook_keyframe_url = await _generate_keyframe_from_portrait(
                    first_prompt, settings.fal_key, character_image_url, aspect_ratio=ar,
                )
            else:
                hook_keyframe_url = await _generate_keyframe_text(
                    first_prompt, settings.fal_key, aspect_ratio=ar,
                )
            logger.info("Hook keyframe generated for loop: %s", hook_keyframe_url)

        gen_idx = 0

        # Build map of per-scene end keyframes from materials, ensuring fal URLs
        from lorekit.storage.upload import ensure_fal_url
        end_keyframe_map: dict[int, str | None] = {}
        for si in all_scene_items:
            if si.end_keyframe_material_id:
                mat = timeline.materials.get(si.end_keyframe_material_id)
                if mat and (mat.url or mat.path):
                    url = mat.url or mat.path
                    end_keyframe_map[si.scene_id] = await ensure_fal_url(url)

        for i, scene_item in enumerate(scenes_to_generate):
            # Per-scene end keyframe takes priority; fall back to loop for last scene
            is_last = last_scene and scene_item.scene_id == last_scene.scene_id
            end_image_url = end_keyframe_map.get(scene_item.scene_id) or (hook_keyframe_url if is_last else None)

            await db.update_job(
                job_id,
                progress=(gen_idx / total_gens) * 100,
                message=f"Generating scene {scene_item.scene_id}/{len(all_scene_items)}: {scene_item.beat}"
                        + (" (loop -> hook)" if is_last else "")
                        + f" ({len(existing_scene_ids) + gen_idx + 1} of {len(all_scene_items)} total)",
            )

            # Generate the main clip (Subscribe variant if CTA scene)
            gen_scene = scene_item
            if scene_item.text_overlay and "{{CTA}}" in scene_item.text_overlay:
                gen_scene = scene_item.model_copy(
                    update={"visual_description": scene_item.visual_description.replace("{{CTA}}", "Subscribe")}
                )
            clip_path = await generate_single_clip(
                gen_scene, character, project_id,
                character_image_url, end_image_url=end_image_url, theme=theme,
                aspect_ratio=ar,
            )

            # Create a Material for the generated clip and attach to scene
            clip_mat = Material(type="video", path=clip_path, name=f"scene_{scene_item.scene_id}_clip")
            timeline.add_material(clip_mat)
            scene_item.clip_material_id = clip_mat.id
            gen_idx += 1

            # Save after each scene so progress is visible immediately
            await db.update_project(project_id, org_id=org_id, timeline_json=_save_timeline(timeline))

            # Generate "Follow" variant for CTA scenes
            if scene_item.text_overlay and "{{CTA}}" in scene_item.text_overlay:
                await db.update_job(
                    job_id,
                    progress=(gen_idx / total_gens) * 100,
                    message=f"Generating Follow variant for scene {scene_item.scene_id}",
                )
                follow_scene = scene_item.model_copy(
                    update={
                        "visual_description": scene_item.visual_description.replace("{{CTA}}", "Follow"),
                        "scene_id": scene_item.scene_id + 1000,
                    }
                )
                follow_path = await generate_single_clip(
                    follow_scene, character, project_id,
                    character_image_url, end_image_url=end_image_url, theme=theme,
                    aspect_ratio=ar,
                )
                follow_mat = Material(
                    type="video", path=follow_path,
                    name=f"scene_{scene_item.scene_id}_follow",
                )
                timeline.add_material(follow_mat)
                gen_idx += 1

        await db.update_project(
            project_id,
            org_id=org_id,
            status="clips_ready",
            timeline_json=_save_timeline(timeline),
        )
        await db.update_job(
            job_id,
            status="completed",
            progress=100,
            message="All clips generated" + (" (with loop)" if hook_keyframe_url else ""),
            result_json=_save_timeline(timeline),
        )
    except Exception as exc:
        logger.exception("Clip generation failed for project %s", project_id)
        await db.update_job(job_id, status="failed", message=_safe_error(exc))
        await db.update_project(project_id, org_id=org_id, status="story_ready")


@router.post("/clips")
async def generate_clips(body: ClipsRequest, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Start clip generation for all scenes. Returns job_id for polling."""
    project = await db.get_project(body.project_id, org_id=user.org_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not project.get("timeline_json"):
        raise HTTPException(status_code=400, detail="No story generated yet")

    job_id = uuid.uuid4().hex[:12]
    await db.create_job(job_id, body.project_id, "clips")
    runner = get_task_runner()
    await runner.submit(
        _generate_clips_task,
        task_type="clips",
        job_id=job_id,
        project_id=body.project_id,
        org_id=user.org_id,
    )

    return {"job_id": job_id}


async def _generate_single_clip_task(
    job_id: str, project_id: str, scene_id: int, org_id: str | None = None
) -> None:
    """Background task: regenerate a single scene clip."""
    try:
        project = await db.get_project(project_id, org_id=org_id)
        if not project or not project.get("timeline_json"):
            await db.update_job(job_id, status="failed", message="No timeline found")
            return

        timeline = _load_timeline(project)
        scene_item = _find_scene_item(timeline, scene_id)
        if not scene_item:
            await db.update_job(job_id, status="failed", message=f"Scene {scene_id} not found")
            return

        character_id = project.get("character_id", "")

        # ---- THEME: from project row ----
        theme = project.get("theme") or None

        from lorekit.sources.database import get_character
        from lorekit.api.character import get_character_image_url

        pool = await db.get_pool()
        character = await get_character(pool, character_id)

        # ---- CHARACTER IMAGE: get the themed version ----
        character_image_url = await get_character_image_url(character_id, theme=theme)
        if not character_image_url:
            character_image_url = project.get("character_image_url")

        await db.update_job(job_id, status="running", message=f"Regenerating scene {scene_id}")

        settings = get_settings()
        settings.ensure_dirs()

        from lorekit.video.generator import generate_single_clip as gen_clip

        # Check for pre-generated keyframe material
        existing_keyframe: str | None = None
        if scene_item.keyframe_material_id:
            mat = timeline.materials.get(scene_item.keyframe_material_id)
            if mat:
                existing_keyframe = mat.url or mat.path

        ar = project.get("aspect_ratio", "9:16")

        existing_end_keyframe: str | None = None
        if scene_item.end_keyframe_material_id:
            mat = timeline.materials.get(scene_item.end_keyframe_material_id)
            if mat:
                existing_end_keyframe = mat.url or mat.path

        # Ensure all image URLs are fal CDN accessible
        from lorekit.storage.upload import ensure_fal_url
        existing_keyframe = await ensure_fal_url(existing_keyframe) or existing_keyframe
        existing_end_keyframe = await ensure_fal_url(existing_end_keyframe)

        clip_path = await gen_clip(
            scene_item, character, project_id, character_image_url,
            end_image_url=existing_end_keyframe,
            theme=theme, keyframe_url=existing_keyframe, aspect_ratio=ar,
        )

        # Create a Material for the new clip and update scene item
        clip_mat = Material(type="video", path=clip_path, name=f"scene_{scene_id}_clip")
        timeline.add_material(clip_mat)
        scene_item.clip_material_id = clip_mat.id

        await db.update_project(project_id, org_id=org_id, timeline_json=_save_timeline(timeline))
        await db.update_job(
            job_id,
            status="completed",
            progress=100,
            message=f"Scene {scene_id} regenerated",
            result_json=json.dumps({"scene_id": scene_id, "clip_path": clip_path}),
        )

    except Exception as exc:
        logger.exception("Single clip generation failed")
        await db.update_job(job_id, status="failed", message=_safe_error(exc))


@router.post("/clip")
async def generate_single_clip_endpoint(body: SingleClipRequest, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Regenerate one scene clip. Returns job_id for polling."""
    project = await db.get_project(body.project_id, org_id=user.org_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    job_id = uuid.uuid4().hex[:12]
    await db.create_job(job_id, body.project_id, "clip")
    runner = get_task_runner()
    await runner.submit(
        _generate_single_clip_task,
        task_type="clip",
        job_id=job_id,
        project_id=body.project_id,
        scene_id=body.scene_id,
        org_id=user.org_id,
    )

    return {"job_id": job_id}


# ---------------------------------------------------------------------------
# Keyframe-only generation (preview before committing to video)
# ---------------------------------------------------------------------------

async def _generate_keyframe_task(
    job_id: str, project_id: str, scene_id: int, org_id: str | None = None,
    reference_image_urls: list[str] | None = None,
) -> None:
    """Background task: generate only the keyframe (still image) for one scene."""
    try:
        project = await db.get_project(project_id, org_id=org_id)
        if not project or not project.get("timeline_json"):
            await db.update_job(job_id, status="failed", message="No timeline found")
            return

        timeline = _load_timeline(project)
        scene_item = _find_scene_item(timeline, scene_id)
        if not scene_item:
            await db.update_job(job_id, status="failed", message=f"Scene {scene_id} not found")
            return

        character_id = project.get("character_id", "")
        theme = project.get("theme") or None

        from lorekit.sources.database import get_character
        from lorekit.api.character import get_character_image_url
        from lorekit.video.generator import (
            _generate_keyframe_from_portrait,
            _generate_keyframe_text,
            _generate_keyframe_with_refs,
            _generate_keyframe_kontext,
        )
        from lorekit.video.prompt_builder import build_video_prompt
        from lorekit.config import get_civilization
        from lorekit.api.character import _resolve_ref_image_for_fal

        pool = await db.get_pool()
        character = await get_character(pool, character_id)

        character_image_url = await get_character_image_url(character_id, theme=theme)
        if not character_image_url:
            character_image_url = project.get("character_image_url")

        settings = get_settings()
        civ_config = get_civilization(character.group)

        # Resolve vibe text from DB video_styles table
        style = await db.get_video_style(theme) if theme else None
        vibe_text = style["prompt"] if style and style.get("prompt") else settings.video_vibe

        ar = project.get("aspect_ratio", "9:16")

        await db.update_job(job_id, status="running", message=f"Generating keyframe for scene {scene_id}...")

        # Identify portrait BEFORE CDN resolution (compare original local paths)
        portrait_idx: int | None = None
        if reference_image_urls and character_image_url:
            portrait_path = character_image_url.split("?")[0]
            for i, ref_url in enumerate(reference_image_urls):
                ref_path = ref_url.split("?")[0]
                if ref_path == portrait_path or ref_path.endswith(portrait_path.lstrip("/")):
                    portrait_idx = i
                    break

        # Resolve ALL refs to CDN URLs
        resolved_refs: list[str] = []
        if reference_image_urls:
            for ref_url in reference_image_urls:
                resolved = await _resolve_ref_image_for_fal(ref_url.split("?")[0])
                if resolved:
                    resolved_refs.append(resolved)

        # Reorder: portrait first (position 1 gets strongest influence in Nano Banana 2)
        has_portrait = False
        if portrait_idx is not None and portrait_idx < len(resolved_refs):
            portrait_resolved = resolved_refs.pop(portrait_idx)
            ordered_refs = [portrait_resolved] + resolved_refs
            has_portrait = True
        else:
            ordered_refs = resolved_refs

        # Extract themed character description
        from lorekit.video.characters import get_character_description
        char_desc = get_character_description(
            character_id, theme=theme,
            db_descriptions_json=json.dumps(character.character_descriptions) if character.character_descriptions else None,
            db_base_description=character.character_description,
        ) if scene_item.character_present else None

        # Determine which image model to use from the style
        image_model = style.get("image_model", "kontext") if style else "kontext"

        # When using reference images with Nano Banana, skip character in prompt
        # (it goes in Image 1 label). For Kontext, include character in prompt.
        has_refs = bool(ordered_refs) or (scene_item.character_present and bool(character_image_url))
        skip_char = has_refs and image_model == "nano_banana_2"
        prompt = build_video_prompt(
            scene_item, character, civ_config.model_dump(), vibe_text, theme=theme,
            skip_character=skip_char,
        )

        if ordered_refs:
            if image_model == "nano_banana_2":
                keyframe_url = await _generate_keyframe_with_refs(
                    prompt, settings.fal_key, ordered_refs, aspect_ratio=ar,
                    character_description=char_desc,
                    has_portrait=has_portrait,
                )
            else:
                # Kontext — preserves character identity and vibe from references
                keyframe_url = await _generate_keyframe_kontext(
                    prompt, settings.fal_key, ordered_refs, aspect_ratio=ar,
                )
        elif scene_item.character_present and character_image_url:
            if image_model == "nano_banana_2":
                keyframe_url = await _generate_keyframe_with_refs(
                    prompt, settings.fal_key, [character_image_url], aspect_ratio=ar,
                    character_description=char_desc,
                    has_portrait=True,
                )
            else:
                keyframe_url = await _generate_keyframe_kontext(
                    prompt, settings.fal_key, [character_image_url], aspect_ratio=ar,
                )
        else:
            # No references → text-to-image
            keyframe_url = await _generate_keyframe_text(
                prompt, settings.fal_key, aspect_ratio=ar,
            )

        logger.info("Keyframe generated for scene %d: %s", scene_id, keyframe_url)

        # Download keyframe to durable storage (fal CDN URLs expire after ~7 days)
        import time
        from lorekit.storage import get_file_store
        store = get_file_store()
        ts = int(time.time())
        keyframe_path = f"projects/{project_id}/keyframes/scene_{scene_id:03d}_{ts}.png"
        async with httpx.AsyncClient(timeout=60.0) as dl_client:
            resp = await dl_client.get(keyframe_url)
            resp.raise_for_status()
            await store.write(keyframe_path, resp.content)
        logger.info("Keyframe stored locally: %s", keyframe_path)

        # Push old keyframe to history before overwriting
        old_kf_id = scene_item.keyframe_material_id
        if old_kf_id:
            scene_item.keyframe_history.append(old_kf_id)

        # Create a new Material for the keyframe
        kf_mat = Material(type="image", path=keyframe_path, url=keyframe_url, name=f"scene_{scene_id}_keyframe")
        timeline.add_material(kf_mat)
        scene_item.keyframe_material_id = kf_mat.id

        await db.update_project(project_id, org_id=org_id, timeline_json=_save_timeline(timeline))
        await db.update_job(
            job_id,
            status="completed",
            progress=100,
            message=f"Keyframe ready for scene {scene_id}",
            result_json=json.dumps({"scene_id": scene_id, "keyframe_url": keyframe_url, "keyframe_path": keyframe_path}),
        )

    except Exception as exc:
        logger.exception("Keyframe generation failed for scene %d", scene_id)
        await db.update_job(job_id, status="failed", message=_safe_error(exc))


@router.post("/keyframe")
async def generate_keyframe_endpoint(body: KeyframeRequest, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Generate only the keyframe (reference image) for one scene. Returns job_id."""
    project = await db.get_project(body.project_id, org_id=user.org_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not project.get("timeline_json"):
        raise HTTPException(status_code=400, detail="No story generated yet")

    job_id = uuid.uuid4().hex[:12]
    await db.create_job(job_id, body.project_id, "keyframe")
    runner = get_task_runner()
    await runner.submit(
        _generate_keyframe_task,
        task_type="keyframe",
        job_id=job_id,
        project_id=body.project_id,
        scene_id=body.scene_id,
        org_id=user.org_id,
        reference_image_urls=body.reference_image_urls,
    )

    return {"job_id": job_id}


@router.post("/transition")
async def generate_transition_endpoint(body: TransitionRequest, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Generate an AI morph transition between two adjacent clips. Returns job_id."""
    project = await db.get_project(body.project_id, org_id=user.org_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    job_id = uuid.uuid4().hex[:12]
    await db.create_job(job_id, body.project_id, "transition")
    runner = get_task_runner()
    await runner.submit(
        _generate_transition_task,
        task_type="transition",
        job_id=job_id,
        project_id=body.project_id,
        from_scene_id=body.from_scene_id,
        to_scene_id=body.to_scene_id,
        prompt=body.prompt,
        duration=body.duration,
        org_id=user.org_id,
    )

    return {"job_id": job_id}


@router.post("/extract-frame")
async def extract_frame_endpoint(body: ExtractFrameRequest, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Extract a single frame from a generated clip at a given timestamp.

    Synchronous — returns immediately with the frame URL and storage path.
    """
    import subprocess
    import tempfile

    project = await db.get_project(body.project_id, org_id=user.org_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    timeline = _load_timeline(project)
    scene_item = _find_scene_item(timeline, body.scene_id)
    if not scene_item or not scene_item.clip_material_id:
        raise HTTPException(status_code=400, detail=f"Scene {body.scene_id} has no generated clip")

    clip_mat = timeline.materials.get(scene_item.clip_material_id)
    if not clip_mat or not clip_mat.path:
        raise HTTPException(status_code=400, detail=f"Scene {body.scene_id} has no clip path")

    # Resolve to absolute path
    clip_abs = _abs_path(clip_mat.path)
    if not Path(clip_abs).exists():
        logger.warning("Extract frame: clip file not found at %s", clip_abs)
        raise HTTPException(status_code=400, detail="Clip file not found")

    # Clamp timestamp
    timestamp = max(0.0, body.timestamp)

    # Extract frame with ffmpeg
    with tempfile.TemporaryDirectory() as tmpdir:
        frame_file = f"{tmpdir}/frame.png"
        try:
            subprocess.run(
                ["ffmpeg", "-y", "-ss", str(timestamp), "-i", clip_abs,
                 "-frames:v", "1", "-q:v", "2", frame_file],
                capture_output=True, check=True,
            )
        except subprocess.CalledProcessError as exc:
            logger.error("ffmpeg frame extraction failed: %s", exc.stderr.decode()[:500] if exc.stderr else str(exc))
            raise HTTPException(status_code=400, detail="Failed to extract frame — timestamp may be out of range")

        if not Path(frame_file).exists():
            raise HTTPException(status_code=400, detail="Frame extraction produced no output")

        # Store durably
        from lorekit.storage import get_file_store, project_frame_path
        store = get_file_store()
        storage_path = project_frame_path(body.project_id, body.scene_id, timestamp, org_id=user.org_id)
        with open(frame_file, "rb") as f:
            frame_bytes = f.read()
        await store.write(storage_path, frame_bytes)

    # Serve from local storage (fal CDN URLs expire, local paths don't)
    frame_url = f"/files/{storage_path}"

    # Create a Material for the extracted frame and add to scene
    frame_mat = Material(
        type="image", path=storage_path, url=frame_url,
        name=f"scene_{body.scene_id}_frame_{timestamp:.2f}",
    )
    timeline.add_material(frame_mat)
    scene_item.extracted_frame_ids.append(frame_mat.id)

    await db.update_project(body.project_id, org_id=user.org_id, timeline_json=_save_timeline(timeline))

    return {"url": frame_url, "path": storage_path, "timestamp": round(timestamp, 2)}


async def _generate_transition_task(
    job_id: str, project_id: str, from_scene_id: int, to_scene_id: int,
    prompt: str = "Smooth cinematic transition, continuous fluid camera motion, seamless morph",
    duration: int = 3,
    org_id: str | None = None,
) -> None:
    """Background task: extract frames from adjacent clips and generate an AI morph transition."""
    import subprocess
    import tempfile

    try:
        project = await db.get_project(project_id, org_id=org_id)
        if not project or not project.get("timeline_json"):
            await db.update_job(job_id, status="failed", message="No timeline found")
            return

        timeline = _load_timeline(project)

        # Find the SceneItems for the from/to scenes to get their clip materials
        from_scene = _find_scene_item(timeline, from_scene_id)
        to_scene = _find_scene_item(timeline, to_scene_id)

        if not from_scene or not from_scene.clip_material_id:
            await db.update_job(job_id, status="failed", message=f"Scene {from_scene_id} has no clip")
            return
        if not to_scene or not to_scene.clip_material_id:
            await db.update_job(job_id, status="failed", message=f"Scene {to_scene_id} has no clip")
            return

        from_mat = timeline.materials.get(from_scene.clip_material_id)
        to_mat = timeline.materials.get(to_scene.clip_material_id)

        if not from_mat or not from_mat.path:
            await db.update_job(job_id, status="failed", message=f"Scene {from_scene_id} has no clip path")
            return
        if not to_mat or not to_mat.path:
            await db.update_job(job_id, status="failed", message=f"Scene {to_scene_id} has no clip path")
            return

        from lorekit.storage import get_file_store
        from lorekit.video.generator import _generate_transition_clip
        from lorekit.api.character import _resolve_ref_image_for_fal

        store = get_file_store()
        settings = get_settings()

        await db.update_job(job_id, status="running", message="Extracting frames from clips...")

        # Resolve clip paths to local files
        from_path = store.base_dir / from_mat.path if hasattr(store, "base_dir") else None
        to_path = store.base_dir / to_mat.path if hasattr(store, "base_dir") else None

        if not from_path or not from_path.exists() or not to_path or not to_path.exists():
            await db.update_job(job_id, status="failed", message="Clip files not found on disk")
            return

        # Extract last frame of clip A and first frame of clip B using ffmpeg
        with tempfile.TemporaryDirectory() as tmpdir:
            last_frame = f"{tmpdir}/last_frame.png"
            first_frame = f"{tmpdir}/first_frame.png"

            # Last frame of from_clip
            subprocess.run([
                "ffmpeg", "-y", "-sseof", "-0.1", "-i", str(from_path),
                "-frames:v", "1", "-q:v", "2", last_frame,
            ], capture_output=True, check=True)

            # First frame of to_clip
            subprocess.run([
                "ffmpeg", "-y", "-i", str(to_path),
                "-frames:v", "1", "-q:v", "2", first_frame,
            ], capture_output=True, check=True)

            # Upload frames to fal CDN
            import fal_client
            import os
            if not os.environ.get("FAL_KEY"):
                os.environ["FAL_KEY"] = settings.fal_key

            with open(last_frame, "rb") as f:
                last_frame_url = fal_client.upload(f.read(), content_type="image/png")
            with open(first_frame, "rb") as f:
                first_frame_url = fal_client.upload(f.read(), content_type="image/png")

        await db.update_job(job_id, status="running", message="Generating AI transition...")

        # Generate the morph transition video
        transition_video_url = await _generate_transition_clip(
            start_image_url=last_frame_url,
            end_image_url=first_frame_url,
            fal_key=settings.fal_key,
            prompt=prompt,
            duration=str(max(3, min(15, duration))),
        )

        # Download and store the transition clip
        from lorekit.storage import get_file_store
        store = get_file_store()
        transition_path = f"projects/{project_id}/transitions/t_{from_scene_id}_{to_scene_id}.mp4"

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(transition_video_url)
            resp.raise_for_status()
            await store.write(transition_path, resp.content)

        # Create a Material for the transition clip
        trans_mat = Material(
            type="video", path=transition_path, url=transition_video_url,
            name=f"transition_{from_scene_id}_{to_scene_id}",
        )
        timeline.add_material(trans_mat)

        # Find or create the TransitionItem on the video track
        trans_item = _find_transition_item(timeline, from_scene_id, to_scene_id)
        if trans_item:
            trans_item.clip_material_id = trans_mat.id
        else:
            # Insert a new TransitionItem between the two scenes
            video_track = timeline.get_video_track()
            new_trans = TransitionItem(
                transition_type="ai_morph",
                prompt=prompt,
                duration_frames=max(3, min(15, duration)) * timeline.fps,
                clip_material_id=trans_mat.id,
            )
            # Find position: after from_scene, before to_scene
            insert_idx = None
            for idx, item in enumerate(video_track.items):
                if isinstance(item, SceneItem) and item.scene_id == from_scene_id:
                    insert_idx = idx + 1
                    break
            if insert_idx is not None:
                video_track.items.insert(insert_idx, new_trans)
            else:
                video_track.items.append(new_trans)

        # Recalculate total duration
        video_track = timeline.get_video_track()
        total_frames = 0
        for item in video_track.items:
            if isinstance(item, SceneItem):
                total_frames += item.duration_frames
            elif isinstance(item, TransitionItem) and item.transition_type == "ai_morph":
                total_frames += item.duration_frames
        timeline.duration_frames = total_frames

        await db.update_project(project_id, org_id=org_id, timeline_json=_save_timeline(timeline))

        await db.update_job(
            job_id, status="completed",
            message="AI transition generated",
            result_json=json.dumps({
                "from_scene_id": from_scene_id,
                "to_scene_id": to_scene_id,
                "clip_path": transition_path,
            }),
        )
        logger.info("AI transition generated: scene %d → %d", from_scene_id, to_scene_id)

    except Exception as e:
        logger.exception("Transition generation failed")
        await db.update_job(job_id, status="failed", message=_safe_error(e))


async def _raw_concat(
    clips: list[str],
    scenes: list,
    output_path: str,
    total_duration: float,
    aspect_ratio: str = "9:16",
) -> None:
    """Concat clips with crossfades — no color grade, no text, no audio.

    Simple ffmpeg: trim each clip to scene duration, force fps, scale, crossfade, export.
    """
    if aspect_ratio == "16:9":
        out_w, out_h = 1920, 1080
    else:
        out_w, out_h = 1080, 1920

    durations = [s.duration for s in scenes]
    filter_parts: list[str] = []
    input_args: list[str] = []

    for i, clip in enumerate(clips):
        input_args.extend(["-i", clip])

    # Trim + fps + scale each clip
    for i, dur in enumerate(durations):
        filter_parts.append(
            f"[{i}:v]trim=0:{dur},setpts=PTS-STARTPTS,"
            f"fps=24,"
            f"scale={out_w}:{out_h}:force_original_aspect_ratio=decrease,"
            f"pad={out_w}:{out_h}:(ow-iw)/2:(oh-ih)/2[v{i}]"
        )

    # Crossfade transitions
    if len(clips) > 1:
        transition_duration = 0.3
        cumulative = durations[0]
        for i in range(1, len(clips)):
            offset = max(0, cumulative - transition_duration)
            left = "[v0]" if i == 1 else f"[xf{i - 2}]"
            right = f"[v{i}]"
            out = "[vout]" if i == len(clips) - 1 else f"[xf{i - 1}]"
            filter_parts.append(
                f"{left}{right}xfade=transition=fade:"
                f"duration={transition_duration}:offset={offset:.3f}{out}"
            )
            cumulative += durations[i] - transition_duration
        video_label = "[vout]"
    else:
        video_label = "[v0]"

    filter_graph = ";".join(filter_parts)

    cmd = [
        "ffmpeg", "-y",
        *input_args,
        "-filter_complex", filter_graph,
        "-map", video_label,
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "20",
        "-t", str(total_duration),
        "-r", "24",
        "-pix_fmt", "yuv420p",
        "-an",  # no audio
        output_path,
    ]

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()

    if proc.returncode != 0:
        raise RuntimeError(
            f"ffmpeg raw concat failed (exit {proc.returncode}): "
            f"{stderr.decode(errors='replace')[-1000:]}"
        )

    logger.info("Raw concat complete: %s", output_path)


async def _render_task(
    job_id: str,
    project_id: str,
    raw: bool = False,
    text_overlays: bool = True,
    color_grade: bool = True,
    audio: bool = True,
    org_id: str | None = None,
) -> None:
    """Background task: assemble final video from clips.

    If raw=True: just concat clips with crossfades, no color grade/text/audio.
    Otherwise uses the individual flags to control pipeline steps.
    """
    try:
        project = await db.get_project(project_id, org_id=org_id)
        if not project:
            await db.update_job(job_id, status="failed", message="Project not found")
            return

        if not project.get("timeline_json"):
            await db.update_job(job_id, status="failed", message="Missing timeline")
            return

        timeline = _load_timeline(project)
        video_track = timeline.get_video_track()

        # Collect ordered SceneItems
        all_scene_items = [item for item in video_track.items if isinstance(item, SceneItem)]

        # Look up character group for civilization context
        character_id = project.get("character_id", "")
        pool = await db.get_pool()
        char_row = await pool.fetchrow("SELECT group_name, universe_id FROM characters WHERE id = $1", character_id)
        civilization = char_row["group_name"] if char_row else "roman"
        universe_id = char_row["universe_id"] if char_row else None

        # Load color grade: prefer project_effects, fall back to environment
        color_grade_override: dict | None = None
        if color_grade:
            # First try project-specific color grade effect
            effect_row = await pool.fetchrow(
                "SELECT settings_json FROM project_effects WHERE project_id = $1 AND effect_type = 'color_grade' AND enabled = 1 ORDER BY sort_order LIMIT 1",
                project_id,
            )
            if effect_row and effect_row["settings_json"]:
                try:
                    color_grade_override = json.loads(effect_row["settings_json"])
                except (json.JSONDecodeError, TypeError):
                    pass

            # Fall back to environment if no project effect
            if not color_grade_override and universe_id:
                env_row = await pool.fetchrow(
                    "SELECT color_grade_json FROM environments WHERE universe_id = $1 AND LOWER(name) = LOWER($2)",
                    universe_id, civilization,
                )
                if env_row and env_row["color_grade_json"]:
                    try:
                        color_grade_override = json.loads(env_row["color_grade_json"])
                    except (json.JSONDecodeError, TypeError):
                        pass

        ar = project.get("aspect_ratio", "9:16")

        await db.update_project(project_id, org_id=org_id, status="assembling")

        settings = get_settings()
        settings.ensure_dirs()

        # Per-project output directory rooted under the file store
        project_output_dir = Path(_abs_path(project_render_path(project_id, ""))).parent
        project_output_dir.mkdir(parents=True, exist_ok=True)

        # Build ordered clip list from timeline materials — skip scenes without clips
        ordered_clips: list[str] = []
        ordered_scenes: list[SceneItem] = []
        skipped: list[int] = []
        for scene_item in all_scene_items:
            if not scene_item.clip_material_id:
                skipped.append(scene_item.scene_id)
                continue
            mat = timeline.materials.get(scene_item.clip_material_id)
            if not mat or not mat.path:
                skipped.append(scene_item.scene_id)
                continue
            ordered_clips.append(_abs_path(mat.path))
            ordered_scenes.append(scene_item)

        if not ordered_clips:
            await db.update_job(
                job_id, status="failed",
                message="No clips available to render",
            )
            return

        if skipped:
            logger.info(
                "Rendering with partial clips — skipping scenes %s (no clips)",
                skipped,
            )

        # Calculate total duration from video track items
        total_duration = 0.0
        for item in video_track.items:
            if isinstance(item, SceneItem) and item.clip_material_id:
                mat = timeline.materials.get(item.clip_material_id)
                if mat and mat.path:
                    total_duration += item.effective_duration
            elif isinstance(item, TransitionItem) and item.transition_type == "ai_morph":
                total_duration += item.duration_frames / timeline.fps / (item.speed if item.speed > 0 else 1.5)

        if raw:
            # --- RAW MODE: just concat clips with crossfades, no effects ---
            await db.update_job(job_id, status="running", progress=20, message="Concatenating raw clips...")

            final_path = _abs_path(project_render_path(project_id, "raw.mp4"))
            await _raw_concat(ordered_clips, ordered_scenes, final_path, total_duration, aspect_ratio=ar)
        else:
            # --- CUSTOM MODE: selectively enable audio / color grade / text ---

            # Step 1: Build audio mix based on project audio_mode
            audio_mode = project.get("audio_mode", "auto")

            if audio and audio_mode == "silent":
                audio = False  # force silent track

            if audio and audio_mode == "uploaded":
                uploaded_path = project.get("uploaded_audio_path")
                if uploaded_path:
                    resolved = _abs_path(uploaded_path)
                    if Path(resolved).exists():
                        audio_path = resolved
                    else:
                        logger.warning("Uploaded audio not found at %s, falling back to silent", resolved)
                        audio = False
                else:
                    logger.warning("audio_mode=uploaded but no uploaded_audio_path, falling back to silent")
                    audio = False

            elif audio:
                # audio_mode is "auto" or "narration" — use build_audio_timeline
                await db.update_job(job_id, status="running", progress=10, message="Building audio mix...")

                from lorekit.audio.mixer import build_audio_timeline

                try:
                    audio_output_dir = str(Path(_abs_path(project_audio_path(project_id, ""))).parent)
                    audio_path = await build_audio_timeline(
                        ordered_scenes, total_duration, civilization,
                        str(settings.audio_assets_dir),
                        output_dir=audio_output_dir,
                    )
                except Exception as audio_exc:
                    logger.warning("Audio mix failed (%s), using silent track", audio_exc)
                    audio = False  # fall through to silent

            if not audio:
                silent_path = _abs_path(project_audio_path(project_id, "silent.wav"))
                Path(silent_path).parent.mkdir(parents=True, exist_ok=True)
                import subprocess
                subprocess.run([
                    "ffmpeg", "-y", "-f", "lavfi",
                    "-i", "anullsrc=r=44100:cl=stereo",
                    "-t", str(total_duration),
                    silent_path,
                ], capture_output=True, check=True)
                audio_path = silent_path

            # Step 2: Stitch clips + transitions + color grade + audio
            await db.update_job(job_id, status="running", progress=40, message="Stitching video...")

            from lorekit.assembly.stitch import stitch_video

            stitched_path = _abs_path(project_render_path(project_id, "stitched.mp4"))

            # Resolve absolute paths for AI morph transition clip materials
            for item in video_track.items:
                if isinstance(item, TransitionItem) and item.clip_material_id:
                    mat = timeline.materials.get(item.clip_material_id)
                    if mat and mat.path:
                        mat.path = _abs_path(mat.path)

            await stitch_video(
                timeline=timeline,
                audio_path=audio_path,
                output_path=stitched_path,
                civilization=civilization,
                total_duration=total_duration,
                aspect_ratio=ar,
                color_grade_override=color_grade_override,
                color_grade=color_grade,
            )

            # Step 3: Burn text overlays (optional)
            if text_overlays:
                await db.update_job(job_id, status="running", progress=75, message="Adding text overlays...")

                from lorekit.assembly.overlay import add_text_overlays

                final_path = _abs_path(project_render_path(project_id, "final.mp4"))
                await add_text_overlays(
                    stitched_path, ordered_scenes, civilization, final_path,
                )
                Path(stitched_path).unlink(missing_ok=True)
            else:
                final_path = stitched_path

        # Determine the storage-relative path for DB/URL serving
        store = get_file_store()
        if hasattr(store, "base_dir") and final_path.startswith(str(store.base_dir)):
            storage_final_path = final_path[len(str(store.base_dir)) + 1:]  # strip base_dir + /
        else:
            storage_final_path = final_path

        # Save timestamped copy for render history
        from datetime import datetime, timezone
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        ext = Path(final_path).suffix or ".mp4"
        history_filename = f"render_{timestamp}{ext}"
        history_path = _abs_path(project_render_path(project_id, history_filename))
        import shutil
        try:
            shutil.copy2(final_path, history_path)
        except Exception:
            logger.warning("Failed to save render history copy")
        history_storage_path = history_path
        if hasattr(store, "base_dir") and history_path.startswith(str(store.base_dir)):
            history_storage_path = history_path[len(str(store.base_dir)) + 1:]

        await db.update_project(
            project_id,
            org_id=org_id,
            status="rendered",
            output_path=storage_final_path,
        )
        await db.update_job(
            job_id,
            status="completed",
            progress=100,
            message="Video rendered",
            result_json=json.dumps({
                "output_path": storage_final_path,
                "history_path": history_storage_path,
                "timestamp": timestamp,
            }),
        )

    except Exception as exc:
        logger.exception("Render failed for project %s", project_id)
        await db.update_job(job_id, status="failed", message=_safe_error(exc))
        await db.update_project(project_id, org_id=org_id, status="clips_ready")


@router.post("/render")
async def render_video(body: RenderRequest, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Assemble final video from clips. Returns job_id for polling."""
    project = await db.get_project(body.project_id, org_id=user.org_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    job_id = uuid.uuid4().hex[:12]
    await db.create_job(job_id, body.project_id, "render")
    runner = get_task_runner()
    await runner.submit(
        _render_task,
        task_type="render",
        job_id=job_id,
        project_id=body.project_id,
        raw=body.raw,
        text_overlays=body.text_overlays,
        color_grade=body.color_grade,
        audio=body.audio,
        org_id=user.org_id,
    )

    return {"job_id": job_id}

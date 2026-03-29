"""Generation endpoints — story, clips, render."""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from lorekit import db
from lorekit.config import get_settings
from lorekit.models import SourceItem, StoryBreakdown

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/generate", tags=["generate"])


class StoryRequest(BaseModel):
    character_id: str
    universe_id: str | None = None
    hook_quote_id: str | None = None
    truth_quote_id: str | None = None
    quote_ids: list[str] | None = None  # flexible: user picks quotes, backend assigns roles
    target_duration: int = 35
    arc_template: str | None = None  # "story", "rapid_montage", etc.
    theme: str | None = None  # vibe preset key, e.g. "dark_masculine"
    audio_mode: str = "auto"  # auto | narration | uploaded | silent
    uploaded_audio_path: str | None = None  # for uploaded mode


class ClipsRequest(BaseModel):
    project_id: str


class SingleClipRequest(BaseModel):
    project_id: str
    scene_id: int


class KeyframeRequest(BaseModel):
    project_id: str
    scene_id: int


class RenderRequest(BaseModel):
    project_id: str
    raw: bool = False  # If True, just concat clips — no color grade, text, or audio
    text_overlays: bool = True
    color_grade: bool = True
    audio: bool = True


@router.post("/story")
async def generate_story_endpoint(body: StoryRequest) -> dict:
    """Generate a story breakdown using the configured LLM.

    Creates a project if one doesn't exist, or updates existing project.
    """
    from lorekit.sources.database import get_character, select_source_pair
    from lorekit.story.generator import generate_story

    conn = await db.connect()
    try:
        character = await get_character(conn, body.character_id)

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

        # Select or fetch source items
        if body.hook_quote_id and body.truth_quote_id:
            # Legacy: explicit hook + truth IDs
            cursor = await conn.execute(
                "SELECT * FROM source_items WHERE id = ?", (body.hook_quote_id,)
            )
            hook_row = await cursor.fetchone()
            cursor = await conn.execute(
                "SELECT * FROM source_items WHERE id = ?", (body.truth_quote_id,)
            )
            truth_row = await cursor.fetchone()
            if not hook_row or not truth_row:
                raise HTTPException(status_code=404, detail="Source item not found")
            hook_quote = _row_to_source_item(dict(hook_row))
            truth_quote = _row_to_source_item(dict(truth_row))
        elif body.quote_ids and len(body.quote_ids) > 0:
            # Flexible: user picked source items, backend assigns roles
            placeholders = ",".join("?" for _ in body.quote_ids)
            cursor = await conn.execute(
                f"SELECT * FROM source_items WHERE id IN ({placeholders})",
                body.quote_ids,
            )
            rows = [dict(r) for r in await cursor.fetchall()]
            if not rows:
                raise HTTPException(status_code=404, detail="No matching source items found")

            picked = [_row_to_source_item(r) for r in rows]

            # Smart assignment: shortest/punchiest -> hook, deepest -> truth
            # If only one picked, use it as hook and auto-select a truth
            if len(picked) == 1:
                hook_quote = picked[0]
                _, truth_quote = await select_source_pair(conn, body.character_id)
            else:
                # Sort by word count — shortest is hook, longest is truth
                sorted_picks = sorted(picked, key=lambda q: q.word_count)
                hook_quote = sorted_picks[0]
                truth_quote = sorted_picks[-1]
        else:
            hook_quote, truth_quote = await select_source_pair(conn, body.character_id)
    finally:
        await conn.close()

    # If uploaded audio mode, analyze and use as timing constraint
    effective_duration = body.target_duration
    if body.audio_mode == "uploaded" and body.uploaded_audio_path:
        from lorekit.audio.analyzer import analyze_audio as _analyze_audio
        try:
            audio_analysis = await _analyze_audio(body.uploaded_audio_path)
            effective_duration = int(audio_analysis["duration_seconds"])
        except Exception:
            pass  # fallback to default duration

    # Generate story via LLM
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
        status="story_ready",
        story_json=story.model_dump_json(),
        audio_mode=body.audio_mode,
        uploaded_audio_path=body.uploaded_audio_path,
    )

    return {
        "project_id": project_id,
        "story": story.model_dump(),
    }


async def _generate_clips_task(job_id: str, project_id: str) -> None:
    """Background task: generate video clips via fal.ai for all scenes.

    Generates scene 1 first to capture its keyframe, then generates middle
    scenes, and finally generates the last scene with end_image_url set to
    scene 1's keyframe for seamless looping.
    """
    try:
        project = await db.get_project(project_id)
        if not project or not project.get("story_json"):
            await db.update_job(job_id, status="failed", message="No story found")
            return

        story = StoryBreakdown.model_validate_json(project["story_json"])
        character_id = project.get("character_id", "")

        # ---- THEME: extract from story, resolve vibe text ----
        theme = story.theme or None  # "" -> None
        from lorekit.config import VIBE_PRESETS
        vibe_text = (
            VIBE_PRESETS[theme]["prompt"]
            if theme and theme in VIBE_PRESETS and VIBE_PRESETS[theme].get("prompt")
            else None
        )

        from lorekit.sources.database import get_character
        from lorekit.api.character import get_character_image_url

        conn = await db.connect()
        try:
            character = await get_character(conn, character_id)
        finally:
            await conn.close()

        # ---- CHARACTER IMAGE: get the themed version ----
        character_image_url = await get_character_image_url(character_id, theme=theme)
        # Fallback to project-level image if no themed image found
        if not character_image_url:
            character_image_url = project.get("character_image_url")

        logger.info(
            "Clips task — project=%s theme=%s character_image=%s",
            project_id, theme, bool(character_image_url),
        )

        await db.update_project(project_id, status="generating")
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

        # Per-project clips directory — isolates each project's clips
        project_clips_dir = str(settings.clips_dir / project_id)

        # Load existing clips so we can skip scenes that already have one
        existing_clips = json.loads(project.get("clips_json") or "[]")
        existing_scene_ids = {c["scene_id"] for c in existing_clips if c.get("clip_path")}
        clips: list[dict] = list(existing_clips)

        all_scenes = story.scenes
        scenes_to_generate = [s for s in all_scenes if s.scene_id not in existing_scene_ids]
        total_gens = len(scenes_to_generate) + sum(1 for s in scenes_to_generate if s.cta_scene)

        if total_gens == 0:
            await db.update_project(project_id, status="clips_ready")
            await db.update_job(job_id, status="completed", progress=100, message="All clips already exist")
            return

        # --- Generate scene 1's keyframe for loop support ---
        first_scene = all_scenes[0]
        last_scene = all_scenes[-1] if len(all_scenes) > 1 else None
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
                    first_prompt, settings.fal_key, character_image_url,
                )
            else:
                hook_keyframe_url = await _generate_keyframe_text(
                    first_prompt, settings.fal_key,
                )
            logger.info("Hook keyframe generated for loop: %s", hook_keyframe_url)

        gen_idx = 0

        for i, scene in enumerate(scenes_to_generate):
            # Determine if this is the last scene (gets end_image_url for loop)
            is_last = last_scene and scene.scene_id == last_scene.scene_id
            end_image_url = hook_keyframe_url if is_last else None

            await db.update_job(
                job_id,
                progress=(gen_idx / total_gens) * 100,
                message=f"Generating scene {scene.scene_id}/{len(all_scenes)}: {scene.beat}"
                        + (" (loop -> hook)" if is_last else "")
                        + f" ({len(existing_scene_ids) + gen_idx + 1} of {len(all_scenes)} total)",
            )

            # Generate the main clip (Subscribe variant if CTA scene)
            gen_scene = scene
            if scene.cta_scene:
                gen_scene = scene.model_copy(
                    update={"visual_description": scene.visual_description.replace("{{CTA}}", "Subscribe")}
                )
            clip_path = await generate_single_clip(
                gen_scene, character, project_clips_dir,
                character_image_url, end_image_url=end_image_url, theme=theme,
            )
            clips.append({
                "scene_id": scene.scene_id,
                "clip_path": clip_path,
                "variant": "subscribe" if scene.cta_scene else None,
            })
            gen_idx += 1

            # Save after each scene so progress is visible immediately
            await db.update_project(project_id, clips_json=json.dumps(clips))

            # Generate "Follow" variant for CTA scenes
            if scene.cta_scene:
                await db.update_job(
                    job_id,
                    progress=(gen_idx / total_gens) * 100,
                    message=f"Generating Follow variant for scene {scene.scene_id}",
                )
                follow_scene = scene.model_copy(
                    update={
                        "visual_description": scene.visual_description.replace("{{CTA}}", "Follow"),
                        "scene_id": scene.scene_id + 1000,
                    }
                )
                follow_path = await generate_single_clip(
                    follow_scene, character, project_clips_dir,
                    character_image_url, end_image_url=end_image_url, theme=theme,
                )
                clips.append({
                    "scene_id": scene.scene_id,
                    "clip_path": follow_path,
                    "variant": "follow",
                })
                gen_idx += 1

        await db.update_project(
            project_id,
            status="clips_ready",
            clips_json=json.dumps(clips),
        )
        await db.update_job(
            job_id,
            status="completed",
            progress=100,
            message="All clips generated" + (" (with loop)" if hook_keyframe_url else ""),
            result_json=json.dumps(clips),
        )
    except Exception as exc:
        logger.exception("Clip generation failed for project %s", project_id)
        await db.update_job(job_id, status="failed", message=str(exc))
        await db.update_project(project_id, status="story_ready")


@router.post("/clips")
async def generate_clips(body: ClipsRequest) -> dict:
    """Start clip generation for all scenes. Returns job_id for polling."""
    project = await db.get_project(body.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not project.get("story_json"):
        raise HTTPException(status_code=400, detail="No story generated yet")

    job_id = uuid.uuid4().hex[:12]
    await db.create_job(job_id, body.project_id, "clips")
    asyncio.create_task(_generate_clips_task(job_id, body.project_id))

    return {"job_id": job_id}


async def _generate_single_clip_task(
    job_id: str, project_id: str, scene_id: int
) -> None:
    """Background task: regenerate a single scene clip."""
    try:
        project = await db.get_project(project_id)
        if not project or not project.get("story_json"):
            await db.update_job(job_id, status="failed", message="No story found")
            return

        story = StoryBreakdown.model_validate_json(project["story_json"])
        scene = next((s for s in story.scenes if s.scene_id == scene_id), None)
        if not scene:
            await db.update_job(job_id, status="failed", message=f"Scene {scene_id} not found")
            return

        character_id = project.get("character_id", "")

        # ---- THEME: extract from story ----
        theme = story.theme or None

        from lorekit.sources.database import get_character
        from lorekit.api.character import get_character_image_url

        conn = await db.connect()
        try:
            character = await get_character(conn, character_id)
        finally:
            await conn.close()

        # ---- CHARACTER IMAGE: get the themed version ----
        character_image_url = await get_character_image_url(character_id, theme=theme)
        if not character_image_url:
            character_image_url = project.get("character_image_url")

        await db.update_job(job_id, status="running", message=f"Regenerating scene {scene_id}")

        settings = get_settings()
        settings.ensure_dirs()

        from lorekit.video.generator import generate_single_clip as gen_clip

        # Per-project clips directory
        project_clips_dir = str(settings.clips_dir / project_id)

        # Check for pre-generated keyframe in clips_json
        existing_clips = json.loads(project.get("clips_json") or "[]")
        existing_entry = next((c for c in existing_clips if c.get("scene_id") == scene_id), None)
        existing_keyframe = existing_entry.get("keyframe_url") if existing_entry else None

        clip_path = await gen_clip(
            scene, character, project_clips_dir, character_image_url,
            theme=theme, keyframe_url=existing_keyframe,
        )

        # Update clips list — preserve keyframe_url
        clips = [c for c in existing_clips if c.get("scene_id") != scene_id]
        clips.append({
            "scene_id": scene_id,
            "clip_path": clip_path,
            "keyframe_url": existing_keyframe,
        })
        clips.sort(key=lambda c: c["scene_id"])

        await db.update_project(project_id, clips_json=json.dumps(clips))
        await db.update_job(
            job_id,
            status="completed",
            progress=100,
            message=f"Scene {scene_id} regenerated",
            result_json=json.dumps({"scene_id": scene_id, "clip_path": clip_path}),
        )

    except Exception as exc:
        logger.exception("Single clip generation failed")
        await db.update_job(job_id, status="failed", message=str(exc))


@router.post("/clip")
async def generate_single_clip_endpoint(body: SingleClipRequest) -> dict:
    """Regenerate one scene clip. Returns job_id for polling."""
    project = await db.get_project(body.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    job_id = uuid.uuid4().hex[:12]
    await db.create_job(job_id, body.project_id, "clip")
    asyncio.create_task(_generate_single_clip_task(job_id, body.project_id, body.scene_id))

    return {"job_id": job_id}


# ---------------------------------------------------------------------------
# Keyframe-only generation (preview before committing to video)
# ---------------------------------------------------------------------------

async def _generate_keyframe_task(
    job_id: str, project_id: str, scene_id: int
) -> None:
    """Background task: generate only the keyframe (still image) for one scene."""
    try:
        project = await db.get_project(project_id)
        if not project or not project.get("story_json"):
            await db.update_job(job_id, status="failed", message="No story found")
            return

        story = StoryBreakdown.model_validate_json(project["story_json"])
        scene = next((s for s in story.scenes if s.scene_id == scene_id), None)
        if not scene:
            await db.update_job(job_id, status="failed", message=f"Scene {scene_id} not found")
            return

        character_id = project.get("character_id", "")
        theme = story.theme or None

        from lorekit.sources.database import get_character
        from lorekit.api.character import get_character_image_url
        from lorekit.video.generator import (
            _generate_keyframe_from_portrait,
            _generate_keyframe_text,
        )
        from lorekit.video.prompt_builder import build_video_prompt
        from lorekit.config import get_civilization, VIBE_PRESETS

        conn = await db.connect()
        try:
            character = await get_character(conn, character_id)
        finally:
            await conn.close()

        character_image_url = await get_character_image_url(character_id, theme=theme)
        if not character_image_url:
            character_image_url = project.get("character_image_url")

        settings = get_settings()
        civ_config = get_civilization(character.group)

        vibe_text = (
            VIBE_PRESETS[theme]["prompt"]
            if theme and theme in VIBE_PRESETS and VIBE_PRESETS[theme].get("prompt")
            else settings.video_vibe
        )

        await db.update_job(job_id, status="running", message=f"Generating keyframe for scene {scene_id}...")

        prompt = build_video_prompt(
            scene, character, civ_config.model_dump(), vibe_text, theme=theme,
        )

        if scene.character_present and character_image_url:
            keyframe_url = await _generate_keyframe_from_portrait(
                prompt, settings.fal_key, character_image_url,
            )
        else:
            keyframe_url = await _generate_keyframe_text(
                prompt, settings.fal_key,
            )

        logger.info("Keyframe generated for scene %d: %s", scene_id, keyframe_url)

        # Store the keyframe URL in clips_json
        clips = json.loads(project.get("clips_json") or "[]")
        existing = next((c for c in clips if c.get("scene_id") == scene_id), None)
        if existing:
            existing["keyframe_url"] = keyframe_url
        else:
            clips.append({"scene_id": scene_id, "keyframe_url": keyframe_url, "clip_path": None})
            clips.sort(key=lambda c: c["scene_id"])

        await db.update_project(project_id, clips_json=json.dumps(clips))
        await db.update_job(
            job_id,
            status="completed",
            progress=100,
            message=f"Keyframe ready for scene {scene_id}",
            result_json=json.dumps({"scene_id": scene_id, "keyframe_url": keyframe_url}),
        )

    except Exception as exc:
        logger.exception("Keyframe generation failed for scene %d", scene_id)
        await db.update_job(job_id, status="failed", message=str(exc))


@router.post("/keyframe")
async def generate_keyframe_endpoint(body: KeyframeRequest) -> dict:
    """Generate only the keyframe (reference image) for one scene. Returns job_id."""
    project = await db.get_project(body.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not project.get("story_json"):
        raise HTTPException(status_code=400, detail="No story generated yet")

    job_id = uuid.uuid4().hex[:12]
    await db.create_job(job_id, body.project_id, "keyframe")
    asyncio.create_task(_generate_keyframe_task(job_id, body.project_id, body.scene_id))

    return {"job_id": job_id}


async def _raw_concat(
    clips: list[str],
    scenes: list,
    output_path: str,
    total_duration: float,
) -> None:
    """Concat clips with crossfades — no color grade, no text, no audio.

    Simple ffmpeg: trim each clip to scene duration, force fps, scale to
    1080x1920, crossfade between them, export.
    """
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
            f"scale=1080:1920:force_original_aspect_ratio=decrease,"
            f"pad=1080:1920:(ow-iw)/2:(oh-ih)/2[v{i}]"
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
) -> None:
    """Background task: assemble final video from clips.

    If raw=True: just concat clips with crossfades, no color grade/text/audio.
    Otherwise uses the individual flags to control pipeline steps.
    """
    try:
        project = await db.get_project(project_id)
        if not project:
            await db.update_job(job_id, status="failed", message="Project not found")
            return

        story_json = project.get("story_json")
        clips_json = project.get("clips_json")
        if not story_json or not clips_json:
            await db.update_job(job_id, status="failed", message="Missing story or clips")
            return

        story = StoryBreakdown.model_validate_json(story_json)
        clip_entries = json.loads(clips_json)
        # Look up character group for civilization context
        character_id = project.get("character_id", "")
        conn = await db.connect()
        try:
            cursor = await conn.execute("SELECT group_name FROM characters WHERE id = ?", (character_id,))
            char_row = await cursor.fetchone()
            civilization = char_row["group_name"] if char_row else "roman"
        finally:
            await conn.close()

        await db.update_project(project_id, status="assembling")

        settings = get_settings()
        settings.ensure_dirs()

        # Per-project output directory — isolates each project's rendered files
        project_output_dir = settings.output_dir / project_id
        project_output_dir.mkdir(parents=True, exist_ok=True)

        # Map scene_id -> clip_path (use "subscribe" variant if available, skip "follow" variants)
        clip_map: dict[int, str] = {}
        for entry in clip_entries:
            sid = entry.get("scene_id")
            path = entry.get("clip_path")
            variant = entry.get("variant")
            if sid is not None and path and variant != "follow":
                if sid not in clip_map or variant == "subscribe":
                    clip_map[sid] = path

        # Build ordered clip list matching scene order — skip scenes without clips
        ordered_clips: list[str] = []
        ordered_scenes: list = []
        skipped: list[int] = []
        for scene in story.scenes:
            clip_path = clip_map.get(scene.scene_id)
            if not clip_path:
                skipped.append(scene.scene_id)
                continue
            ordered_clips.append(clip_path)
            ordered_scenes.append(scene)

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

        total_duration = sum(s.duration for s in ordered_scenes)

        if raw:
            # --- RAW MODE: just concat clips with crossfades, no effects ---
            await db.update_job(job_id, status="running", progress=20, message="Concatenating raw clips...")

            final_path = str(project_output_dir / "raw.mp4")
            await _raw_concat(ordered_clips, ordered_scenes, final_path, total_duration)
        else:
            # --- CUSTOM MODE: selectively enable audio / color grade / text ---

            # Step 1: Build audio mix (or silent track)
            if audio:
                await db.update_job(job_id, status="running", progress=10, message="Building audio mix...")

                from lorekit.audio.mixer import build_audio_timeline

                try:
                    audio_path = await build_audio_timeline(
                        ordered_scenes, total_duration, civilization,
                        str(settings.audio_assets_dir),
                        output_dir=str(project_output_dir),
                    )
                except Exception as audio_exc:
                    logger.warning("Audio mix failed (%s), using silent track", audio_exc)
                    audio = False  # fall through to silent

            if not audio:
                silent_path = str(project_output_dir / "silent.wav")
                import subprocess
                subprocess.run([
                    "ffmpeg", "-y", "-f", "lavfi",
                    "-i", f"anullsrc=r=44100:cl=stereo",
                    "-t", str(total_duration),
                    silent_path,
                ], capture_output=True, check=True)
                audio_path = silent_path

            # Step 2: Stitch clips + transitions + color grade + audio
            await db.update_job(job_id, status="running", progress=40, message="Stitching video...")

            from lorekit.assembly.stitch import stitch_video

            # Parse per-scene transitions from project
            render_transitions: list[str] | None = None
            transitions_raw = project.get("transitions_json")
            if transitions_raw:
                try:
                    t_data = json.loads(transitions_raw)
                    # t_data is a list of {scene_id: int, transition: str}
                    # Build ordered transition list matching scene boundaries
                    t_map = {item["scene_id"]: item["transition"] for item in t_data}
                    render_transitions = []
                    for idx in range(len(ordered_scenes) - 1):
                        sid = ordered_scenes[idx].scene_id
                        render_transitions.append(t_map.get(sid, "fade"))
                except (json.JSONDecodeError, KeyError, TypeError):
                    logger.warning("Invalid transitions_json, using defaults")

            stitched_path = str(project_output_dir / "stitched.mp4")
            await stitch_video(
                ordered_clips, ordered_scenes, audio_path,
                stitched_path, civilization, total_duration,
                transitions=render_transitions,
            )

            # Step 3: Burn text overlays (optional)
            if text_overlays:
                await db.update_job(job_id, status="running", progress=75, message="Adding text overlays...")

                from lorekit.assembly.overlay import add_text_overlays

                final_path = str(project_output_dir / "final.mp4")
                await add_text_overlays(
                    stitched_path, ordered_scenes, civilization, final_path,
                )
                Path(stitched_path).unlink(missing_ok=True)
            else:
                final_path = stitched_path

        await db.update_project(
            project_id,
            status="rendered",
            output_path=final_path,
        )
        await db.update_job(
            job_id,
            status="completed",
            progress=100,
            message="Video rendered",
            result_json=json.dumps({"output_path": final_path}),
        )

    except Exception as exc:
        logger.exception("Render failed for project %s", project_id)
        await db.update_job(job_id, status="failed", message=str(exc))
        await db.update_project(project_id, status="clips_ready")


@router.post("/render")
async def render_video(body: RenderRequest) -> dict:
    """Assemble final video from clips. Returns job_id for polling."""
    project = await db.get_project(body.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    job_id = uuid.uuid4().hex[:12]
    await db.create_job(job_id, body.project_id, "render")
    asyncio.create_task(_render_task(
        job_id, body.project_id,
        raw=body.raw,
        text_overlays=body.text_overlays,
        color_grade=body.color_grade,
        audio=body.audio,
    ))

    return {"job_id": job_id}

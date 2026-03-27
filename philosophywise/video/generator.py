"""fal.ai Kling video generation — V3 Pro (characters) + O3 (environments).

Character scenes use Kling V3 Pro with native `elements` for character
consistency — the model receives the character portrait directly and
references it as @Element1 in the prompt.

Environment scenes use Kling O3 (newest model, best visual quality).

Both paths start with a Flux keyframe for scene composition.

Loop support: scene 1's keyframe is passed as `end_image_url` to the last
scene, so the video naturally loops back to the opening frame.
"""

from __future__ import annotations

import asyncio
import logging
import time
from pathlib import Path

import httpx

from philosophywise.config import get_settings
from philosophywise.models import Philosopher, Scene
from philosophywise.video.prompt_builder import build_video_prompt

logger = logging.getLogger(__name__)

# Keyframe generation
FAL_FLUX_I2I_ENDPOINT = "https://queue.fal.run/fal-ai/flux/dev/image-to-image"
FAL_FLUX_T2I_ENDPOINT = "https://queue.fal.run/fal-ai/flux/dev"

# Character scenes — V3 Pro has native elements for character consistency
FAL_KLING_V3_PRO_I2V = "https://queue.fal.run/fal-ai/kling-video/v3/pro/image-to-video"

# Environment scenes — O3 is the newest model, best cinematic quality
FAL_KLING_O3_I2V = "https://queue.fal.run/fal-ai/kling-video/o3/standard/image-to-video"

MAX_RETRIES = 3
INITIAL_BACKOFF = 2.0
POLL_INTERVAL = 5.0


async def generate_scene_clips(
    scenes: list[Scene],
    philosopher: Philosopher,
    clips_dir: str,
    character_image_url: str | None = None,
) -> list[str]:
    """Generate all scene video clips with seamless loop support.

    Flow:
    1. Generate scene 1's keyframe FIRST (needed as loop target for last scene)
    2. Generate scene 1's video from that keyframe
    3. Generate all middle scenes in parallel
    4. Generate last scene with end_image_url = scene 1's keyframe (loop!)

    Returns list of clip file paths ordered by scene_id.
    """
    Path(clips_dir).mkdir(parents=True, exist_ok=True)

    if not scenes:
        return []

    settings = get_settings()
    from philosophywise.config import get_civilization
    civ_config = get_civilization(philosopher.civilization)

    first_scene = scenes[0]
    last_scene = scenes[-1] if len(scenes) > 1 else None
    middle_scenes = scenes[1:-1] if len(scenes) > 2 else []

    # --- Step 1: Generate scene 1's keyframe ---
    first_prompt = build_video_prompt(
        first_scene, philosopher, civ_config.model_dump(), settings.video_vibe,
    )
    has_char_first = first_scene.character_present and character_image_url

    if has_char_first:
        hook_keyframe_url = await _generate_keyframe_from_portrait(
            first_prompt, settings.fal_key, character_image_url,  # type: ignore
        )
    else:
        hook_keyframe_url = await _generate_keyframe_text(
            first_prompt, settings.fal_key,
        )

    logger.info("Hook keyframe generated: %s", hook_keyframe_url)

    # --- Step 2: Generate scene 1 video (using the keyframe we already made) ---
    first_clip_path = await _generate_clip_with_keyframe(
        first_scene, philosopher, clips_dir, settings,
        civ_config.model_dump(), character_image_url,
        keyframe_url=hook_keyframe_url,
    )

    # --- Step 3: Generate middle scenes in parallel ---
    middle_tasks = [
        generate_single_clip(scene, philosopher, clips_dir, character_image_url)
        for scene in middle_scenes
    ]
    middle_results = await asyncio.gather(*middle_tasks, return_exceptions=True)

    for i, result in enumerate(middle_results):
        if isinstance(result, BaseException):
            logger.error("Scene %d failed: %s", middle_scenes[i].scene_id, result)
            raise result

    # --- Step 4: Generate last scene with end_image_url for loop ---
    last_clip_path: str | None = None
    if last_scene:
        last_clip_path = await generate_single_clip(
            last_scene, philosopher, clips_dir, character_image_url,
            end_image_url=hook_keyframe_url,
        )

    # Assemble in order
    clip_paths: list[str] = [first_clip_path]
    clip_paths.extend(str(r) for r in middle_results)
    if last_clip_path:
        clip_paths.append(last_clip_path)

    logger.info("Generated %d clips with loop support", len(clip_paths))
    return clip_paths


async def generate_single_clip(
    scene: Scene,
    philosopher: Philosopher,
    clips_dir: str,
    character_image_url: str | None = None,
    end_image_url: str | None = None,
) -> str:
    """Generate one video clip.

    Routing:
    - character_present=True + portrait → Flux keyframe → Kling V3 Pro i2v with elements
    - character_present=True, no portrait → Flux keyframe → Kling V3 Pro i2v
    - character_present=False → Flux keyframe → Kling O3 i2v

    If end_image_url is provided (loop scene), passes it to Kling so the
    video transitions toward that ending frame.

    Retries up to 3 times with exponential backoff.
    Returns path to downloaded clip.
    """
    from philosophywise.config import get_civilization

    civ_config = get_civilization(philosopher.civilization)
    settings = get_settings()

    return await _generate_clip_with_keyframe(
        scene, philosopher, clips_dir, settings,
        civ_config.model_dump(), character_image_url,
        end_image_url=end_image_url,
    )


async def _generate_clip_with_keyframe(
    scene: Scene,
    philosopher: Philosopher,
    clips_dir: str,
    settings: object,
    civ_config: dict,
    character_image_url: str | None = None,
    keyframe_url: str | None = None,
    end_image_url: str | None = None,
) -> str:
    """Core clip generation — optionally reuses a pre-generated keyframe.

    If keyframe_url is provided, skips keyframe generation.
    If end_image_url is provided, passes it to Kling for loop support.
    """
    clip_path = str(Path(clips_dir) / f"scene_{scene.scene_id:03d}.mp4")

    full_prompt = build_video_prompt(
        scene, philosopher, civ_config, settings.video_vibe,  # type: ignore[attr-defined]
    )
    anim_prompt = build_video_prompt(
        scene, philosopher, civ_config, settings.video_vibe,  # type: ignore[attr-defined]
        skip_character=True,
    )

    has_character = scene.character_present and character_image_url
    route = "v3pro_elements" if has_character else ("v3pro_noref" if scene.character_present else "o3")

    if end_image_url:
        route += "+loop"

    logger.info(
        "Scene %d — route: %s (character_present=%s, has_portrait=%s, loop=%s)",
        scene.scene_id, route, scene.character_present,
        bool(character_image_url), bool(end_image_url),
    )

    last_error: Exception | None = None

    for attempt in range(MAX_RETRIES):
        try:
            start_time = time.monotonic()

            if has_character:
                video_url = await _generate_character_scene(
                    full_prompt, anim_prompt, scene.duration,
                    settings.fal_key, character_image_url,  # type: ignore
                    scene_id_hint=scene.scene_id,
                    keyframe_url=keyframe_url,
                    end_image_url=end_image_url,
                )
            elif scene.character_present:
                video_url = await _generate_character_scene_no_ref(
                    full_prompt, scene.duration, settings.fal_key,  # type: ignore
                    scene_id_hint=scene.scene_id,
                    keyframe_url=keyframe_url,
                    end_image_url=end_image_url,
                )
            else:
                video_url = await _generate_environment_scene(
                    full_prompt, scene.duration, settings.fal_key,  # type: ignore
                    scene_id_hint=scene.scene_id,
                    keyframe_url=keyframe_url,
                    end_image_url=end_image_url,
                )

            elapsed = time.monotonic() - start_time
            logger.info("Scene %d generated in %.1fs via %s", scene.scene_id, elapsed, route)

            await _download_clip(video_url, clip_path, settings.fal_key)  # type: ignore
            _log_cost(scene.scene_id, scene.duration, route)
            return clip_path

        except Exception as exc:
            last_error = exc
            if attempt < MAX_RETRIES - 1:
                backoff = INITIAL_BACKOFF * (2 ** attempt)
                logger.warning(
                    "Scene %d attempt %d failed (%s), retrying in %.1fs",
                    scene.scene_id, attempt + 1, exc, backoff,
                )
                await asyncio.sleep(backoff)
            else:
                logger.error(
                    "Scene %d failed after %d attempts: %s",
                    scene.scene_id, MAX_RETRIES, exc,
                )

    raise RuntimeError(
        f"Scene {scene.scene_id} generation failed after {MAX_RETRIES} attempts"
    ) from last_error


# ---------------------------------------------------------------------------
# Keyframe generation (Flux)
# ---------------------------------------------------------------------------

async def _generate_keyframe_from_portrait(
    scene_prompt: str,
    fal_key: str,
    character_image_url: str,
) -> str:
    """Generate a keyframe via Flux img2img from the character portrait."""
    headers = _fal_headers(fal_key)

    image_prompt = (
        f"Single still frame, 9:16 vertical composition, cinematic framing. "
        f"{scene_prompt[:1900]}"
    )

    payload = {
        "image_url": character_image_url,
        "prompt": image_prompt,
        "strength": 0.9,
        "num_images": 1,
        "num_inference_steps": 40,
        "guidance_scale": 3.5,
        "enable_safety_checker": False,
    }

    return await _submit_and_get_image(FAL_FLUX_I2I_ENDPOINT, payload, headers, "Flux i2i keyframe")


async def _generate_keyframe_text(
    scene_prompt: str,
    fal_key: str,
) -> str:
    """Generate a keyframe via Flux text-to-image (no reference image)."""
    headers = _fal_headers(fal_key)

    image_prompt = (
        f"Single still frame, 9:16 vertical composition, cinematic framing. "
        f"{scene_prompt[:1900]}"
    )

    payload = {
        "prompt": image_prompt,
        "image_size": {"width": 768, "height": 1344},
        "num_images": 1,
        "enable_safety_checker": False,
    }

    return await _submit_and_get_image(FAL_FLUX_T2I_ENDPOINT, payload, headers, "Flux t2i keyframe")


# ---------------------------------------------------------------------------
# Route 1: Character scene WITH portrait — Kling V3 Pro + elements
# ---------------------------------------------------------------------------

async def _generate_character_scene(
    full_prompt: str,
    anim_prompt: str,
    duration: float,
    fal_key: str,
    character_image_url: str,
    scene_id_hint: int | None = None,
    keyframe_url: str | None = None,
    end_image_url: str | None = None,
) -> str:
    """Character scene with portrait: Flux keyframe → Kling V3 Pro i2v + elements."""
    headers = _fal_headers(fal_key)

    # Generate keyframe if not provided
    if not keyframe_url:
        logger.info("Scene %s — generating Flux keyframe from portrait", scene_id_hint or "?")
        keyframe_url = await _generate_keyframe_from_portrait(full_prompt, fal_key, character_image_url)

    duration_str = str(max(3, min(15, int(round(duration)))))
    element_prompt = anim_prompt.rstrip(". ") + ". @Element1 is the main character."

    payload: dict = {
        "start_image_url": keyframe_url,
        "prompt": element_prompt[:2500],
        "duration": duration_str,
        "generate_audio": False,
        "negative_prompt": "static, frozen, text, subtitles, watermarks, logos, words, blurry, distorted",
        "cfg_scale": 0.5,
        "elements": [
            {
                "frontal_image_url": character_image_url,
                "reference_image_urls": [character_image_url],
            }
        ],
    }

    if end_image_url:
        payload["end_image_url"] = end_image_url

    return await _submit_and_get_video(
        FAL_KLING_V3_PRO_I2V, payload, headers,
        label=f"V3 Pro i2v+elements scene {scene_id_hint}",
    )


# ---------------------------------------------------------------------------
# Route 2: Character scene WITHOUT portrait — Kling V3 Pro (no elements)
# ---------------------------------------------------------------------------

async def _generate_character_scene_no_ref(
    full_prompt: str,
    duration: float,
    fal_key: str,
    scene_id_hint: int | None = None,
    keyframe_url: str | None = None,
    end_image_url: str | None = None,
) -> str:
    """Character scene without portrait: Flux keyframe → Kling V3 Pro i2v."""
    headers = _fal_headers(fal_key)

    if not keyframe_url:
        logger.info("Scene %s — generating Flux keyframe (no portrait)", scene_id_hint or "?")
        keyframe_url = await _generate_keyframe_text(full_prompt, fal_key)

    duration_str = str(max(3, min(15, int(round(duration)))))

    payload: dict = {
        "start_image_url": keyframe_url,
        "prompt": f"{full_prompt[:2000]}. Smooth natural motion, dynamic camera movement.",
        "duration": duration_str,
        "generate_audio": False,
        "negative_prompt": "static, frozen, text, subtitles, watermarks, logos, words, blurry, distorted",
        "cfg_scale": 0.5,
    }

    if end_image_url:
        payload["end_image_url"] = end_image_url

    return await _submit_and_get_video(
        FAL_KLING_V3_PRO_I2V, payload, headers,
        label=f"V3 Pro i2v scene {scene_id_hint}",
    )


# ---------------------------------------------------------------------------
# Route 3: Environment scene — Kling O3 (newest model, best quality)
# ---------------------------------------------------------------------------

async def _generate_environment_scene(
    full_prompt: str,
    duration: float,
    fal_key: str,
    scene_id_hint: int | None = None,
    keyframe_url: str | None = None,
    end_image_url: str | None = None,
) -> str:
    """Environment scene: Flux keyframe → Kling O3 i2v."""
    headers = _fal_headers(fal_key)

    if not keyframe_url:
        logger.info("Scene %s — generating Flux keyframe (environment)", scene_id_hint or "?")
        keyframe_url = await _generate_keyframe_text(full_prompt, fal_key)

    duration_str = str(max(3, min(15, int(round(duration)))))

    payload: dict = {
        "image_url": keyframe_url,  # O3 uses `image_url`, not `start_image_url`
        "prompt": f"{full_prompt[:2000]}. Smooth natural motion, cinematic camera movement.",
        "duration": duration_str,
        "generate_audio": False,
    }

    if end_image_url:
        payload["end_image_url"] = end_image_url

    return await _submit_and_get_video(
        FAL_KLING_O3_I2V, payload, headers,
        label=f"O3 i2v scene {scene_id_hint}",
    )


# ---------------------------------------------------------------------------
# Shared fal.ai helpers
# ---------------------------------------------------------------------------

def _fal_headers(fal_key: str) -> dict:
    return {
        "Authorization": f"Key {fal_key}",
        "Content-Type": "application/json",
    }


async def _submit_and_get_video(
    endpoint: str,
    payload: dict,
    headers: dict,
    label: str = "",
) -> str:
    """Submit a fal.ai video job, poll until done, return the video URL."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(endpoint, json=payload, headers=headers)
        response.raise_for_status()
        job = response.json()
        request_id = job["request_id"]
        logger.info("%s — submitted job %s", label, request_id)

        status_url = job.get("status_url", f"{endpoint}/requests/{request_id}/status")

        while True:
            await asyncio.sleep(POLL_INTERVAL)
            status_resp = await client.get(status_url, headers=headers)
            status_resp.raise_for_status()
            status_data = status_resp.json()

            status = status_data.get("status")
            if status == "COMPLETED":
                break
            elif status in ("FAILED", "CANCELLED"):
                error_msg = status_data.get("error", "unknown error")
                raise RuntimeError(f"{label} job {request_id} {status}: {error_msg}")

        result_url = (
            status_url[:-7] if status_url.endswith("/status")
            else job.get("response_url", f"{endpoint}/requests/{request_id}")
        )
        result_resp = await client.get(result_url, headers=headers)
        result_resp.raise_for_status()
        result_data = result_resp.json()

        video_url = result_data.get("video", {}).get("url")
        if not video_url:
            raise RuntimeError(f"No video URL in response for {label} job {request_id}")

        return video_url


async def _submit_and_get_image(
    endpoint: str,
    payload: dict,
    headers: dict,
    label: str = "",
) -> str:
    """Submit a fal.ai image job, poll until done, return the image URL."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(endpoint, json=payload, headers=headers)
        resp.raise_for_status()
        job = resp.json()
        request_id = job["request_id"]
        status_url = job.get("status_url", f"{endpoint}/requests/{request_id}/status")

        while True:
            await asyncio.sleep(2)
            status_resp = await client.get(status_url, headers=headers)
            status_resp.raise_for_status()
            status_data = status_resp.json()
            status = status_data.get("status")
            if status == "COMPLETED":
                break
            elif status in ("FAILED", "CANCELLED"):
                raise RuntimeError(f"{label} failed: {status_data}")

        result_url = (
            status_url[:-7] if status_url.endswith("/status")
            else f"{endpoint}/requests/{request_id}"
        )
        result_resp = await client.get(result_url, headers=headers)
        result_resp.raise_for_status()
        result_data = result_resp.json()

    images = result_data.get("images", [])
    if not images:
        raise RuntimeError(f"{label}: no image generated")

    image_url = images[0]["url"]
    logger.info("%s generated: %s", label, image_url)
    return image_url


async def _download_clip(url: str, output_path: str, fal_key: str) -> None:
    """Download a video clip from a URL to a local file."""
    headers = {"Authorization": f"Key {fal_key}"}

    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream("GET", url, headers=headers) as response:
            response.raise_for_status()
            with open(output_path, "wb") as f:
                async for chunk in response.aiter_bytes(chunk_size=65536):
                    f.write(chunk)

    logger.info("Downloaded clip to %s", output_path)


def _log_cost(scene_id: int, duration: float, route: str) -> None:
    """Log the estimated cost for a generation."""
    flux_cost = 0.04
    if "v3pro" in route:
        video_cost = duration * 0.14
        label = f"Flux+V3Pro {duration:.0f}s"
    else:
        video_cost = duration * 0.10
        label = f"Flux+O3 {duration:.0f}s"

    total = flux_cost + video_cost
    logger.info("Scene %d cost estimate: $%.2f (%s)", scene_id, total, label)

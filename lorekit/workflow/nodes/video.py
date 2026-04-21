"""Video generation node executors — Kling V3 Pro and Kling O3."""

from __future__ import annotations

import logging
from typing import Any

from lorekit.workflow.models import WorkflowNode
from lorekit.workflow.engine import register_executor

logger = logging.getLogger(__name__)


async def execute_kling_v3_pro(node: WorkflowNode, inputs: dict[str, Any]) -> dict[str, Any]:
    """Generate video using Kling V3 Pro (character scenes with elements)."""
    from lorekit.config import get_settings
    from lorekit.video.generator import _submit_and_get_video, _fal_headers

    fal_key = get_settings().fal_key
    headers = _fal_headers(fal_key)

    # Build motion prompt from scene data (source of truth)
    # Kling's prompt drives animation/motion, not image content (keyframe handles that)
    prompt = inputs.get("prompt", "")
    scene_id = inputs.get("scene_id")
    if scene_id and not prompt:
        from lorekit.workflow.nodes.image import _load_scene_data
        scene_data = await _load_scene_data(inputs, int(scene_id))
        if scene_data:
            parts = []
            if scene_data.get("visual_description"):
                parts.append(scene_data["visual_description"])
            if scene_data.get("camera"):
                parts.append(scene_data["camera"])
            prompt = ". ".join(parts)

    duration = inputs.get("duration", 5)
    duration_str = str(max(3, min(15, int(round(duration)))))

    # Ensure image URLs are accessible by fal.ai (upload local files)
    from lorekit.workflow.nodes.image import _ensure_fal_urls
    start_urls = await _ensure_fal_urls([inputs["start_image"]])
    if not start_urls:
        raise ValueError("start_image could not be resolved to a valid URL")

    payload: dict = {
        "start_image_url": start_urls[0],
        "prompt": str(prompt)[:2500],
        "duration": duration_str,
        "generate_audio": False,
        "negative_prompt": inputs.get(
            "negative_prompt",
            "static, frozen, text, subtitles, watermarks, logos, words, blurry, distorted",
        ),
        "cfg_scale": inputs.get("cfg_scale", 0.5),
    }

    # Elements for character consistency
    elements = inputs.get("elements")
    if elements:
        payload["elements"] = elements

    # End image for loops/transitions
    end_image = inputs.get("end_image")
    if end_image:
        end_urls = await _ensure_fal_urls([end_image])
        if end_urls:
            end_image = end_urls[0]
        payload["end_image_url"] = end_image

    url = await _submit_and_get_video(
        "https://queue.fal.run/fal-ai/kling-video/v3/pro/image-to-video",
        payload, headers, f"Kling V3 Pro ({node.label})",
    )

    node.cost = duration * 0.14
    return {"url": url}


async def execute_kling_o3(node: WorkflowNode, inputs: dict[str, Any]) -> dict[str, Any]:
    """Generate video using Kling O3 (environment/cinematic scenes)."""
    from lorekit.config import get_settings
    from lorekit.video.generator import _submit_and_get_video, _fal_headers

    fal_key = get_settings().fal_key
    headers = _fal_headers(fal_key)

    duration = inputs.get("duration", 5)
    duration_str = str(max(3, min(15, int(round(duration)))))

    # Ensure image URLs are accessible by fal.ai
    from lorekit.workflow.nodes.image import _ensure_fal_urls
    raw_image = inputs.get("image_url") or inputs.get("start_image")
    image_urls = await _ensure_fal_urls([raw_image]) if raw_image else []
    if not image_urls:
        raise ValueError("image_url/start_image could not be resolved to a valid URL")

    payload: dict = {
        "image_url": image_urls[0],
        "prompt": str(inputs.get("prompt", ""))[:2500],
        "duration": duration_str,
        "generate_audio": False,
    }

    end_image = inputs.get("end_image")
    if end_image:
        end_urls = await _ensure_fal_urls([end_image])
        if end_urls:
            end_image = end_urls[0]
        payload["end_image_url"] = end_image

    url = await _submit_and_get_video(
        "https://queue.fal.run/fal-ai/kling-video/o3/standard/image-to-video",
        payload, headers, f"Kling O3 ({node.label})",
    )

    node.cost = duration * 0.10
    return {"url": url}


async def execute_transition(node: WorkflowNode, inputs: dict[str, Any]) -> dict[str, Any]:
    """Generate a transition between two clips using Kling V3 Pro.

    Uses start_image/end_image if provided (from connected keyframes),
    otherwise extracts last/first frames from from_clip/to_clip.
    """
    import subprocess
    import tempfile
    from lorekit.config import get_settings
    from lorekit.video.generator import _submit_and_get_video, _fal_headers

    fal_key = get_settings().fal_key
    headers = _fal_headers(fal_key)

    duration = inputs.get("duration", 3)
    duration_str = str(max(3, min(15, int(round(duration)))))

    # Resolve start frame: prefer explicit start_image, else extract from from_clip
    start_image_url = inputs.get("start_image")
    end_image_url = inputs.get("end_image")

    if (not start_image_url or not end_image_url) and (inputs.get("from_clip") or inputs.get("to_clip")):
        from lorekit.storage import get_file_store
        import fal_client
        import os
        if not os.environ.get("FAL_KEY"):
            os.environ["FAL_KEY"] = fal_key

        store = get_file_store()

        with tempfile.TemporaryDirectory() as tmpdir:
            # Extract last frame from from_clip
            if not start_image_url and inputs.get("from_clip"):
                from_clip = inputs["from_clip"]
                if isinstance(from_clip, str) and not from_clip.startswith("http"):
                    from_path = store.base_dir / from_clip if hasattr(store, "base_dir") else None
                    if from_path and from_path.exists():
                        last_frame = f"{tmpdir}/last_frame.png"
                        subprocess.run([
                            "ffmpeg", "-y", "-sseof", "-0.1", "-i", str(from_path),
                            "-frames:v", "1", "-q:v", "2", last_frame,
                        ], capture_output=True, check=True)
                        with open(last_frame, "rb") as f:
                            start_image_url = fal_client.upload(f.read(), content_type="image/png")

            # Extract first frame from to_clip
            if not end_image_url and inputs.get("to_clip"):
                to_clip = inputs["to_clip"]
                if isinstance(to_clip, str) and not to_clip.startswith("http"):
                    to_path = store.base_dir / to_clip if hasattr(store, "base_dir") else None
                    if to_path and to_path.exists():
                        first_frame = f"{tmpdir}/first_frame.png"
                        subprocess.run([
                            "ffmpeg", "-y", "-i", str(to_path),
                            "-frames:v", "1", "-q:v", "2", first_frame,
                        ], capture_output=True, check=True)
                        with open(first_frame, "rb") as f:
                            end_image_url = fal_client.upload(f.read(), content_type="image/png")

    if not start_image_url or not end_image_url:
        raise ValueError("Transition requires both start and end images (connect clips or keyframes)")

    payload: dict = {
        "start_image_url": start_image_url,
        "end_image_url": end_image_url,
        "prompt": str(inputs.get("prompt", "Smooth cinematic transition, continuous fluid camera motion"))[:2500],
        "duration": duration_str,
        "generate_audio": False,
        "negative_prompt": "static, frozen, text, watermarks, blurry, distorted",
        "cfg_scale": 0.5,
    }

    url = await _submit_and_get_video(
        "https://queue.fal.run/fal-ai/kling-video/v3/pro/image-to-video",
        payload, headers, f"Transition ({node.label})",
    )

    node.cost = duration * 0.14
    return {"url": url}


async def execute_lipsync(node: WorkflowNode, inputs: dict[str, Any]) -> dict[str, Any]:
    """Lip sync a video to an audio track using Sync LipSync v3."""
    from lorekit.config import get_settings
    from lorekit.video.generator import _submit_and_get_video, _fal_headers
    from lorekit.workflow.nodes.image import _ensure_fal_urls

    fal_key = get_settings().fal_key
    headers = _fal_headers(fal_key)

    video_url = inputs.get("video", "")
    audio_url = inputs.get("audio", "")

    if not video_url or not audio_url:
        raise ValueError("Lip sync requires both video and audio inputs")

    # Ensure URLs are accessible by fal.ai
    resolved = await _ensure_fal_urls([video_url, audio_url])
    video_url = resolved[0] if len(resolved) > 0 else video_url
    audio_url = resolved[1] if len(resolved) > 1 else audio_url

    payload: dict = {
        "video_url": video_url,
        "audio_url": audio_url,
    }

    url = await _submit_and_get_video(
        "https://queue.fal.run/fal-ai/sync-lipsync/v3",
        payload, headers, f"Lip Sync ({node.label})",
    )

    duration = inputs.get("duration", 5)
    node.cost = duration * 0.13
    return {"url": url}


async def execute_kling_v3_pro_t2v(node: WorkflowNode, inputs: dict[str, Any]) -> dict[str, Any]:
    """Generate video from text prompt using Kling V3 Pro (no image input needed)."""
    from lorekit.config import get_settings
    from lorekit.video.generator import _submit_and_get_video, _fal_headers

    fal_key = get_settings().fal_key
    headers = _fal_headers(fal_key)

    prompt = inputs.get("prompt", "")
    scene_id = inputs.get("scene_id")
    if scene_id and not prompt:
        from lorekit.workflow.nodes.image import _load_scene_data
        scene_data = await _load_scene_data(inputs, int(scene_id))
        if scene_data:
            parts = []
            if scene_data.get("visual_description"):
                parts.append(scene_data["visual_description"])
            if scene_data.get("camera"):
                parts.append(scene_data["camera"])
            prompt = ". ".join(parts)

    duration = inputs.get("duration", 5)
    duration_str = str(max(3, min(15, int(round(duration)))))

    payload: dict = {
        "prompt": str(prompt)[:2500],
        "duration": duration_str,
        "aspect_ratio": inputs.get("aspect_ratio", "16:9"),
        "generate_audio": False,
        "negative_prompt": inputs.get(
            "negative_prompt",
            "static, frozen, text, subtitles, watermarks, logos, words, blurry, distorted",
        ),
        "cfg_scale": inputs.get("cfg_scale", 0.5),
    }

    url = await _submit_and_get_video(
        "https://queue.fal.run/fal-ai/kling-video/v3/pro/text-to-video",
        payload, headers, f"Kling V3 Pro T2V ({node.label})",
    )

    node.cost = duration * 0.112
    return {"url": url}


# Register executors
register_executor("kling_v3_pro", execute_kling_v3_pro)
register_executor("kling_o3", execute_kling_o3)
register_executor("kling_v3_pro_t2v", execute_kling_v3_pro_t2v)
register_executor("transition", execute_transition)
register_executor("lipsync", execute_lipsync)

"""Image generation node executors — Kontext and Nano Banana 2."""

from __future__ import annotations

import logging
from typing import Any

from lorekit.workflow.models import WorkflowNode
from lorekit.workflow.engine import register_executor

logger = logging.getLogger(__name__)


async def _load_scene_data(inputs: dict[str, Any], scene_id: int) -> dict[str, Any] | None:
    """Load scene creative direction from the project timeline."""
    project_id = inputs.get("_project_id")
    if not project_id:
        return None
    from lorekit import db
    project = await db.get_project(project_id)
    if not project:
        return None
    import json as _json
    tl = project.get("timeline_json")
    if not tl:
        return None
    tl_data = _json.loads(tl) if isinstance(tl, str) else tl
    for track in tl_data.get("tracks", []):
        if track.get("id") != "video-main":
            continue
        for item in track.get("items", []):
            if item.get("type") == "scene" and item.get("scene_id") == scene_id:
                return item
    return None


async def _ensure_fal_urls(urls: list[str]) -> list[str]:
    """Convert local /files/ paths to fal.ai-accessible URLs."""
    from lorekit.storage.upload import ensure_fal_url
    result = []
    for url in urls:
        resolved = await ensure_fal_url(url)
        if resolved:
            result.append(resolved)
    return result


async def _fal_image_job(endpoint: str, payload: dict, fal_key: str, label: str) -> str:
    """Submit an image generation job to fal.ai and return the result URL."""
    # Reuse the existing fal.ai submit/poll pattern from video generator
    from lorekit.video.generator import _submit_and_get_image, _fal_headers
    headers = _fal_headers(fal_key)
    return await _submit_and_get_image(endpoint, payload, headers, label)


async def execute_kontext_keyframe(node: WorkflowNode, inputs: dict[str, Any]) -> dict[str, Any]:
    """Generate a keyframe using Kontext Max Multi."""
    from lorekit.config import get_settings

    fal_key = get_settings().fal_key

    # Read prompt: prefer explicit prompt param, else load from scene (source of truth)
    prompt = inputs.get("prompt", "")
    scene_id = inputs.get("scene_id")
    if scene_id and not prompt:
        scene = await _load_scene_data(inputs, int(scene_id))
        if scene:
            prompt = scene.get("visual_description", "")

    # Collect reference images from ref_1, ref_2, ref_3, ref_4 keys
    ref_images = inputs.get("reference_images", [])
    if isinstance(ref_images, str):
        ref_images = [ref_images]
    for i in range(1, 5):
        ref = inputs.get(f"ref_{i}")
        if ref and ref not in ref_images:
            ref_images.append(ref)

    ref_images = await _ensure_fal_urls(ref_images[:4])

    if not ref_images:
        raise ValueError(
            "Kontext Keyframe requires at least one reference image. "
            "Use 'flux_text_to_image' or 'nano_banana' for prompt-only generation."
        )

    payload: dict[str, Any] = {
        "prompt": prompt,
        "image_urls": ref_images,
        "aspect_ratio": inputs.get("aspect_ratio", "16:9"),
        "output_format": "png",
        "safety_tolerance": 6,
    }

    url = await _fal_image_job(
        "https://queue.fal.run/fal-ai/flux-pro/kontext/max/multi",
        payload, fal_key, f"Kontext keyframe ({node.label})",
    )
    return {"url": url}


async def execute_flux_text_to_image(node: WorkflowNode, inputs: dict[str, Any]) -> dict[str, Any]:
    """Generate an image from text using Flux 2 Pro. No reference images needed."""
    from lorekit.config import get_settings

    fal_key = get_settings().fal_key

    prompt = inputs.get("prompt", "")
    scene_id = inputs.get("scene_id")
    if scene_id and not prompt:
        scene = await _load_scene_data(inputs, int(scene_id))
        if scene:
            prompt = scene.get("visual_description", "")

    payload = {
        "prompt": prompt,
        "aspect_ratio": inputs.get("aspect_ratio", "16:9"),
        "output_format": "png",
        "safety_tolerance": 5,
    }

    url = await _fal_image_job(
        "https://queue.fal.run/fal-ai/flux-2-pro",
        payload, fal_key, f"Flux 2 Pro ({node.label})",
    )
    return {"url": url}


async def execute_nano_banana(node: WorkflowNode, inputs: dict[str, Any]) -> dict[str, Any]:
    """Generate an image using Nano Banana 2."""
    from lorekit.config import get_settings

    fal_key = get_settings().fal_key
    image_urls = inputs.get("image_urls", [])
    if isinstance(image_urls, str):
        image_urls = [image_urls]
    image_urls = await _ensure_fal_urls(image_urls[:14])

    payload: dict[str, Any] = {
        "prompt": inputs.get("prompt", ""),
        "aspect_ratio": inputs.get("aspect_ratio", "16:9"),
        "output_format": "png",
        "safety_tolerance": 6,
    }
    if image_urls:
        payload["image_urls"] = image_urls

    url = await _fal_image_job(
        "https://queue.fal.run/fal-ai/nano-banana-2",
        payload, fal_key, f"Nano Banana 2 ({node.label})",
    )
    return {"url": url}


async def execute_kontext_edit(node: WorkflowNode, inputs: dict[str, Any]) -> dict[str, Any]:
    """Edit a single image using Kontext Max (single image in/out).

    Best for changing clothing/background while keeping face identical.
    """
    from lorekit.config import get_settings

    fal_key = get_settings().fal_key
    image_url = inputs.get("image", "")
    resolved = await _ensure_fal_urls([image_url]) if image_url else []
    image_url = resolved[0] if resolved else image_url

    payload = {
        "prompt": inputs.get("prompt", ""),
        "image_url": image_url,
        "aspect_ratio": inputs.get("aspect_ratio", "16:9"),
        "output_format": "png",
        "safety_tolerance": 6,
    }

    url = await _fal_image_job(
        "https://queue.fal.run/fal-ai/flux-pro/kontext/max",
        payload, fal_key, f"Kontext edit ({node.label})",
    )
    return {"url": url}


# Register executors
register_executor("kontext_keyframe", execute_kontext_keyframe)
register_executor("kontext_edit", execute_kontext_edit)
register_executor("nano_banana", execute_nano_banana)
register_executor("flux_text_to_image", execute_flux_text_to_image)

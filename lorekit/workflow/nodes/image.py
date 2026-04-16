"""Image generation node executors — Kontext and Nano Banana 2."""

from __future__ import annotations

import logging
from typing import Any

from lorekit.workflow.models import WorkflowNode
from lorekit.workflow.engine import register_executor

logger = logging.getLogger(__name__)


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
    ref_images = inputs.get("reference_images", [])
    if isinstance(ref_images, str):
        ref_images = [ref_images]

    payload = {
        "prompt": inputs.get("prompt", ""),
        "image_urls": ref_images[:5],
        "aspect_ratio": inputs.get("aspect_ratio", "9:16"),
        "output_format": "png",
        "safety_tolerance": 6,
    }

    url = await _fal_image_job(
        "https://queue.fal.run/fal-ai/flux-pro/kontext/max/multi",
        payload, fal_key, f"Kontext keyframe ({node.label})",
    )
    return {"url": url}


async def execute_nano_banana(node: WorkflowNode, inputs: dict[str, Any]) -> dict[str, Any]:
    """Generate an image using Nano Banana 2."""
    from lorekit.config import get_settings

    fal_key = get_settings().fal_key
    image_urls = inputs.get("image_urls", [])
    if isinstance(image_urls, str):
        image_urls = [image_urls]

    payload = {
        "prompt": inputs.get("prompt", ""),
        "image_urls": image_urls[:14],
        "aspect_ratio": inputs.get("aspect_ratio", "9:16"),
        "output_format": "png",
        "safety_tolerance": 6,
    }

    url = await _fal_image_job(
        "https://queue.fal.run/fal-ai/nano-banana-2",
        payload, fal_key, f"Nano Banana 2 ({node.label})",
    )
    return {"url": url}


# Register executors
register_executor("kontext_keyframe", execute_kontext_keyframe)
register_executor("nano_banana", execute_nano_banana)

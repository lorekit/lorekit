"""Transform node executors — Face Swap, Upscale, Background Removal."""

from __future__ import annotations

import logging
from typing import Any

from lorekit.workflow.models import WorkflowNode
from lorekit.workflow.engine import register_executor

logger = logging.getLogger(__name__)


async def execute_face_swap(node: WorkflowNode, inputs: dict[str, Any]) -> dict[str, Any]:
    """Swap a source face onto a target image."""
    from lorekit.config import get_settings
    from lorekit.video.generator import _submit_and_get_image, _fal_headers

    fal_key = get_settings().fal_key
    payload = {
        "source_image_url": inputs["source_face"],
        "target_image_url": inputs["target_image"],
    }

    url = await _submit_and_get_image(
        "https://queue.fal.run/fal-ai/face-swap",
        payload, _fal_headers(fal_key), f"Face Swap ({node.label})",
    )
    node.cost = 0.05
    return {"url": url}


async def execute_upscale(node: WorkflowNode, inputs: dict[str, Any]) -> dict[str, Any]:
    """Upscale an image using Real-ESRGAN."""
    from lorekit.config import get_settings
    from lorekit.video.generator import _submit_and_get_image, _fal_headers

    fal_key = get_settings().fal_key
    payload = {
        "image_url": inputs["image"],
        "scale": inputs.get("scale", 2),
    }

    url = await _submit_and_get_image(
        "https://queue.fal.run/fal-ai/real-esrgan",
        payload, _fal_headers(fal_key), f"Upscale ({node.label})",
    )
    node.cost = 0.02
    return {"url": url}


async def execute_bg_remove(node: WorkflowNode, inputs: dict[str, Any]) -> dict[str, Any]:
    """Remove background from an image."""
    from lorekit.config import get_settings
    from lorekit.video.generator import _submit_and_get_image, _fal_headers

    fal_key = get_settings().fal_key
    payload = {
        "image_url": inputs["image"],
    }

    url = await _submit_and_get_image(
        "https://queue.fal.run/fal-ai/bria/background-removal",
        payload, _fal_headers(fal_key), f"BG Remove ({node.label})",
    )
    node.cost = 0.02
    return {"url": url}


register_executor("face_swap", execute_face_swap)
register_executor("upscale", execute_upscale)
register_executor("bg_remove", execute_bg_remove)

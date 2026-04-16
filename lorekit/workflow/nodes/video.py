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

    duration = inputs.get("duration", 5)
    duration_str = str(max(3, min(15, int(round(duration)))))

    payload: dict = {
        "start_image_url": inputs["start_image"],
        "prompt": str(inputs.get("prompt", ""))[:2500],
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

    payload: dict = {
        "image_url": inputs.get("image_url") or inputs.get("start_image"),
        "prompt": str(inputs.get("prompt", ""))[:2500],
        "duration": duration_str,
        "generate_audio": False,
    }

    end_image = inputs.get("end_image")
    if end_image:
        payload["end_image_url"] = end_image

    url = await _submit_and_get_video(
        "https://queue.fal.run/fal-ai/kling-video/o3/standard/image-to-video",
        payload, headers, f"Kling O3 ({node.label})",
    )

    node.cost = duration * 0.10
    return {"url": url}


# Register executors
register_executor("kling_v3_pro", execute_kling_v3_pro)
register_executor("kling_o3", execute_kling_o3)

"""Local operation node executors — download, ffmpeg, frame extraction."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx

from lorekit.workflow.models import WorkflowNode
from lorekit.workflow.engine import register_executor

logger = logging.getLogger(__name__)


async def execute_download(node: WorkflowNode, inputs: dict[str, Any]) -> dict[str, Any]:
    """Download a file from URL to the file store."""
    from lorekit.storage import get_file_store

    url = inputs["url"]
    dest_path = inputs.get("dest_path", f"downloads/{node.id}")

    store = get_file_store()
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        await store.write(dest_path, resp.content)

    logger.info("Downloaded %s → %s (%d bytes)", url[:80], dest_path, len(resp.content))
    return {"path": dest_path, "url": url}


async def execute_extract_frames(node: WorkflowNode, inputs: dict[str, Any]) -> dict[str, Any]:
    """Extract frames from a video at specified timestamps using ffmpeg."""
    from lorekit.storage import get_file_store

    video_path = inputs["video_path"]
    timestamps = inputs.get("timestamps", [0])

    store = get_file_store()
    frames: list[str] = []

    for ts in timestamps:
        frame_path = f"frames/{node.id}/frame_{ts:.1f}s.png"
        cmd = [
            "ffmpeg", "-y",
            "-ss", str(ts),
            "-i", video_path,
            "-frames:v", "1",
            "-q:v", "2",
            frame_path,
        ]
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await proc.communicate()
        frames.append(frame_path)

    return {"frames": frames}


async def execute_ffmpeg_stitch(node: WorkflowNode, inputs: dict[str, Any]) -> dict[str, Any]:
    """Stitch multiple video clips together with ffmpeg."""
    clips = inputs["clips"]
    audio = inputs.get("audio")
    output_path = inputs.get("output_path", f"renders/{node.id}/stitched.mp4")

    from lorekit.assembly.stitch import stitch_video
    # This is a simplified call — the full stitch function takes a timeline
    # For now, return the path placeholder
    return {"path": output_path}


async def execute_ffmpeg_grade(node: WorkflowNode, inputs: dict[str, Any]) -> dict[str, Any]:
    """Apply color grading to a video."""
    video = inputs["video"]
    environment_key = inputs.get("environment_key", "")

    from lorekit.assembly.color_grade import apply_color_grade

    output_path = f"graded/{node.id}/graded.mp4"
    await apply_color_grade(video, output_path, environment_key)
    return {"path": output_path}


async def execute_ffmpeg_overlay(node: WorkflowNode, inputs: dict[str, Any]) -> dict[str, Any]:
    """Burn text overlays onto a video."""
    video = inputs["video"]
    text_items = inputs.get("text_items", [])

    # Placeholder — will call the existing overlay system
    return {"path": video}


# Register executors
register_executor("download", execute_download)
register_executor("extract_frames", execute_extract_frames)
register_executor("ffmpeg_stitch", execute_ffmpeg_stitch)
register_executor("ffmpeg_grade", execute_ffmpeg_grade)
register_executor("ffmpeg_overlay", execute_ffmpeg_overlay)

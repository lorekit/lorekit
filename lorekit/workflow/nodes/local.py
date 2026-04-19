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
    return {"path": dest_path, "url": f"/files/{dest_path}"}


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
    """Stitch multiple video clips together. Delegates to video_stitch."""
    return await execute_video_stitch(node, inputs)


async def execute_ffmpeg_grade(node: WorkflowNode, inputs: dict[str, Any]) -> dict[str, Any]:
    """Apply color grading to a video."""
    video = inputs["video"]
    environment_key = inputs.get("environment_key", "")

    from lorekit.assembly.color_grade import apply_color_grade

    output_path = f"graded/{node.id}/graded.mp4"
    await apply_color_grade(video, output_path, environment_key)
    return {"path": output_path}


async def execute_ffmpeg_overlay(node: WorkflowNode, inputs: dict[str, Any]) -> dict[str, Any]:
    """Burn text overlays onto a video using ffmpeg drawtext."""
    from lorekit.storage import get_file_store

    video = inputs["video"]
    text = inputs.get("text", "")
    font_size = inputs.get("font_size", 48)
    color = inputs.get("color", "white")
    position = inputs.get("position", "center")

    if not text:
        return {"path": video}

    store = get_file_store()
    abs_video = str(store.base_dir / video) if hasattr(store, "base_dir") else video
    output_path = f"overlays/{node.id}/overlay.mp4"
    abs_output = str(store.base_dir / output_path) if hasattr(store, "base_dir") else output_path

    import os
    os.makedirs(os.path.dirname(abs_output), exist_ok=True)

    # Map position to ffmpeg x/y expressions
    pos_map = {
        "center": "x=(w-text_w)/2:y=(h-text_h)/2",
        "top": "x=(w-text_w)/2:y=40",
        "bottom": "x=(w-text_w)/2:y=h-text_h-40",
    }
    xy = pos_map.get(position, pos_map["center"])
    escaped_text = text.replace("'", "'\\''").replace(":", "\\:")

    proc = await asyncio.create_subprocess_exec(
        "ffmpeg", "-y", "-i", abs_video,
        "-vf", f"drawtext=text='{escaped_text}':fontsize={font_size}:fontcolor={color}:{xy}",
        "-c:a", "copy", abs_output,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    if proc.returncode != 0:
        logger.error("ffmpeg overlay failed: %s", stderr.decode()[:500])
        raise RuntimeError("Text overlay failed")

    return {"path": output_path}


async def execute_character_ref(node: WorkflowNode, inputs: dict[str, Any]) -> dict[str, Any]:
    """Pass-through: outputs the character image URL from params."""
    return {"url": node.params.get("image_url", "")}


async def execute_video_stitch(node: WorkflowNode, inputs: dict[str, Any]) -> dict[str, Any]:
    """Stitch clips and transitions into a final video using ffmpeg concat.

    Inputs are named clip_1, clip_2, ... and transition_1_2, transition_2_3, ...
    They arrive in the correct playback order based on naming convention.
    """
    from lorekit.storage import get_file_store

    store = get_file_store()

    # Collect all video URLs/paths from inputs, sorted by key name
    # Keys are like: clip_1, transition_1_2, clip_2, transition_2_3, clip_3
    segments: list[tuple[str, str]] = []
    for key in sorted(inputs.keys()):
        val = inputs[key]
        if isinstance(val, str) and val:
            segments.append((key, val))

    if not segments:
        raise ValueError("No clips provided for stitching")

    output_path = f"renders/{node.id}/final.mp4"

    # Download remote URLs to local files
    local_paths: list[str] = []
    async with httpx.AsyncClient(timeout=120.0) as client:
        for key, url_or_path in segments:
            if url_or_path.startswith("http"):
                dl_path = f"renders/{node.id}/{key}.mp4"
                resp = await client.get(url_or_path)
                resp.raise_for_status()
                await store.write(dl_path, resp.content)
                local_paths.append(str(store.base_dir / dl_path) if hasattr(store, "base_dir") else dl_path)
            else:
                abs_path = str(store.base_dir / url_or_path) if hasattr(store, "base_dir") else url_or_path
                local_paths.append(abs_path)

    # Create ffmpeg concat file
    import tempfile
    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
        for p in local_paths:
            f.write(f"file '{p}'\n")
        concat_file = f.name

    abs_output = str(store.base_dir / output_path) if hasattr(store, "base_dir") else output_path
    import os
    os.makedirs(os.path.dirname(abs_output), exist_ok=True)

    proc = await asyncio.create_subprocess_exec(
        "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", concat_file,
        "-c", "copy", abs_output,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    if proc.returncode != 0:
        logger.error("ffmpeg stitch failed: %s", stderr.decode()[:500])
        raise RuntimeError("Video stitch failed")

    os.unlink(concat_file)
    logger.info("Stitched %d segments → %s", len(local_paths), output_path)
    return {"path": output_path}


# Register executors
register_executor("character_ref", execute_character_ref)
register_executor("download", execute_download)
register_executor("extract_frames", execute_extract_frames)
register_executor("ffmpeg_stitch", execute_ffmpeg_stitch)
register_executor("ffmpeg_grade", execute_ffmpeg_grade)
register_executor("ffmpeg_overlay", execute_ffmpeg_overlay)
register_executor("video_stitch", execute_video_stitch)

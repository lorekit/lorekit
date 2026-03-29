"""Video assembly — concatenate clips with transitions and audio."""

from __future__ import annotations

import asyncio
import logging
import shlex
from pathlib import Path

from lorekit.assembly.color_grade import get_color_grade_filter
from lorekit.assembly.transitions import build_transition_filter
from lorekit.models import Scene

logger = logging.getLogger(__name__)


async def stitch_video(
    clips: list[str],
    scenes: list[Scene],
    audio_path: str,
    output_path: str,
    civilization: str,
    total_duration: float,
    transitions: list[str] | None = None,
) -> str:
    """Assemble the final video from clips + audio.

    Steps:
    1. Trim each clip to its scene duration (clips may be slightly longer)
    2. Apply cross-dissolve transitions between scenes (0.3s)
    3. Concatenate all clips
    4. Apply civilization color grade
    5. Overlay the mixed audio
    6. Export as intermediate (for text overlay step)

    Returns path to intermediate video (no text yet).
    """
    if len(clips) != len(scenes):
        raise ValueError(
            f"Clip count ({len(clips)}) doesn't match scene count ({len(scenes)})"
        )

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    durations = [s.duration for s in scenes]
    transition_duration = 0.3

    # Build the complete filter graph
    filter_parts: list[str] = []
    input_args: list[str] = []

    # Add video inputs
    for i, clip in enumerate(clips):
        input_args.extend(["-i", clip])

    # Trim each clip to scene duration, force constant framerate, and scale to 1080x1920
    for i, dur in enumerate(durations):
        filter_parts.append(
            f"[{i}:v]trim=0:{dur},setpts=PTS-STARTPTS,"
            f"fps=24,"
            f"scale=1080:1920:force_original_aspect_ratio=decrease,"
            f"pad=1080:1920:(ow-iw)/2:(oh-ih)/2[v{i}]"
        )

    # Build transition filter chain
    if len(clips) > 1:
        transition_filter = build_transition_filter(
            clip_count=len(clips),
            durations=durations,
            transitions=transitions,
            default_transition="fade",
            default_duration=transition_duration,
        )
        filter_parts.append(transition_filter)
        video_label = "[vout]"
    else:
        video_label = "[v0]"

    # Apply color grade
    color_filter = get_color_grade_filter(civilization)
    filter_parts.append(f"{video_label}{color_filter}[graded]")

    filter_graph = ";".join(filter_parts)

    # Build full ffmpeg command
    cmd = [
        "ffmpeg", "-y",
        *input_args,
        "-i", audio_path,
        "-filter_complex", filter_graph,
        "-map", "[graded]",
        "-map", f"{len(clips)}:a",
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "20",
        "-c:a", "aac",
        "-b:a", "192k",
        "-t", str(total_duration),
        "-r", "30",
        "-pix_fmt", "yuv420p",
        output_path,
    ]

    logger.info("Stitching %d clips into %s", len(clips), output_path)
    await _run_ffmpeg(cmd)
    logger.info("Stitch complete: %s", output_path)
    return output_path


async def _run_ffmpeg(cmd: list[str]) -> None:
    """Run an ffmpeg command via subprocess."""
    logger.debug("Running: %s", " ".join(shlex.quote(c) for c in cmd))

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()

    if proc.returncode != 0:
        raise RuntimeError(
            f"ffmpeg failed (exit {proc.returncode}): {stderr.decode(errors='replace')}"
        )

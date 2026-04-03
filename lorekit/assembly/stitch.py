"""Video assembly — concatenate clips with transitions and audio."""

from __future__ import annotations

import asyncio
import logging
import shlex
from pathlib import Path

from lorekit.assembly.color_grade import get_color_grade_filter
from lorekit.assembly.transitions import build_transition_filter
from lorekit.models import Scene, Transition

logger = logging.getLogger(__name__)


async def stitch_video(
    clips: list[str],
    scenes: list[Scene],
    audio_path: str,
    output_path: str,
    civilization: str,
    total_duration: float,
    transitions: list[Transition] | None = None,
    aspect_ratio: str = "9:16",
    color_grade_override: dict | None = None,
    color_grade: bool = True,
) -> str:
    """Assemble the final video from clips + audio.

    Steps:
    1. Trim each clip to its generation duration, apply per-segment speed
    2. Interleave AI transition clips as their own segments
    3. Concatenate all clips (with ffmpeg xfade for standard transitions)
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

    # Build transition lookup
    trans_map: dict[str, Transition] = {}
    if transitions:
        for t in transitions:
            trans_map[f"{t.from_scene_id}_{t.to_scene_id}"] = t

    # Interleave AI morph clips and determine ffmpeg transition types
    expanded_clips: list[str] = []
    expanded_gen_durations: list[float] = []
    expanded_speeds: list[float] = []
    expanded_transitions: list[str] = []

    for i, (clip, scene) in enumerate(zip(clips, scenes)):
        expanded_clips.append(clip)
        expanded_gen_durations.append(scene.duration)
        expanded_speeds.append(scene.speed)

        if i < len(scenes) - 1:
            trans_key = f"{scene.scene_id}_{scenes[i + 1].scene_id}"
            t = trans_map.get(trans_key)

            if t and t.type == "ai_morph" and t.clip_path:
                # AI morph: interleave the generated clip with hard cuts on both sides
                expanded_transitions.append("hard_cut")
                expanded_clips.append(t.clip_path)
                expanded_gen_durations.append(t.duration)
                expanded_speeds.append(t.speed)
                expanded_transitions.append("hard_cut")
            elif t and t.type not in ("none", "hard_cut", "ai_morph"):
                # Standard ffmpeg transition (fade, dissolve, wipe, etc.)
                expanded_transitions.append(t.type)
            else:
                # Hard cut (default)
                expanded_transitions.append("hard_cut")

    # Use expanded lists for the rest of the pipeline
    clips = expanded_clips
    ffmpeg_transitions = expanded_transitions

    # Build the complete filter graph
    filter_parts: list[str] = []
    input_args: list[str] = []

    # Add video inputs
    for i, clip in enumerate(clips):
        input_args.extend(["-i", clip])

    # Resolve output dimensions from aspect ratio
    if aspect_ratio == "16:9":
        out_w, out_h = 1920, 1080
    else:
        out_w, out_h = 1080, 1920

    # Trim each clip to generation duration, apply speed, scale
    for i, (gen_dur, speed) in enumerate(zip(expanded_gen_durations, expanded_speeds)):
        # Clamp speed to safe range to prevent division-by-zero or FFmpeg expression injection
        speed = max(0.25, min(4.0, float(speed)))
        gen_dur = max(0.1, min(30.0, float(gen_dur)))
        speed_filter = f"setpts=PTS/{speed}," if speed != 1.0 else ""
        filter_parts.append(
            f"[{i}:v]trim=0:{gen_dur},setpts=PTS-STARTPTS,"
            f"{speed_filter}"
            f"fps=24,"
            f"scale={out_w}:{out_h}:force_original_aspect_ratio=decrease,"
            f"pad={out_w}:{out_h}:(ow-iw)/2:(oh-ih)/2[v{i}]"
        )

    # Simple concat — AI transition clips are already interleaved
    if len(clips) > 1:
        concat_inputs = "".join(f"[v{i}]" for i in range(len(clips)))
        filter_parts.append(f"{concat_inputs}concat=n={len(clips)}:v=1:a=0[vout]")
        video_label = "[vout]"
    else:
        video_label = "[v0]"

    # Apply color grade (or passthrough if disabled)
    if color_grade:
        color_filter = get_color_grade_filter(civilization, color_grade_override=color_grade_override)
        filter_parts.append(f"{video_label}{color_filter}[graded]")
    else:
        filter_parts.append(f"{video_label}null[graded]")

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

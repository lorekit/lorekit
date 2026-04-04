"""Video assembly — concatenate clips with transitions and audio."""

from __future__ import annotations

import asyncio
import logging
import shlex
from pathlib import Path

from lorekit.assembly.color_grade import get_color_grade_filter
from lorekit.models import Timeline, SceneItem, TransitionItem

logger = logging.getLogger(__name__)


async def stitch_video(
    timeline: Timeline,
    audio_path: str,
    output_path: str,
    civilization: str,
    total_duration: float,
    aspect_ratio: str = "9:16",
    color_grade_override: dict | None = None,
    color_grade: bool = True,
    resolve_path=None,
) -> str:
    """Assemble the final video from timeline + audio.

    Args:
        timeline: The Timeline document containing video track items and materials.
        audio_path: Path to the mixed audio file.
        output_path: Output file path.
        civilization: Civilization key for color grading.
        total_duration: Target duration in seconds.
        aspect_ratio: "9:16" or "16:9".
        color_grade_override: Optional color grade settings dict.
        color_grade: Whether to apply color grading.
        resolve_path: Callable to resolve storage paths to absolute paths.
            Signature: (storage_path: str) -> str

    Returns path to intermediate video (no text yet).
    """
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    video_track = timeline.get_video_track()

    def _safe_resolve(mat_path: str) -> str:
        """Resolve path with traversal guard."""
        if ".." in mat_path or mat_path.startswith("/"):
            raise ValueError(f"Unsafe material path rejected")
        return resolve_path(mat_path) if resolve_path else mat_path

    # Build ordered list of clips with durations and speeds
    expanded_clips: list[str] = []
    expanded_gen_durations: list[float] = []
    expanded_speeds: list[float] = []
    expanded_transitions: list[str] = []

    for i, item in enumerate(video_track.items):
        if isinstance(item, SceneItem):
            mat = timeline.materials.get(item.clip_material_id or "")
            if not mat or not mat.path:
                raise ValueError(f"Scene {item.scene_id} has no clip material")
            clip_path = _safe_resolve(mat.path)
            expanded_clips.append(clip_path)
            expanded_gen_durations.append(item.duration)
            expanded_speeds.append(item.speed)

            # Check if next item is NOT a transition → hard cut
            if i < len(video_track.items) - 1:
                next_item = video_track.items[i + 1]
                if isinstance(next_item, TransitionItem):
                    pass  # transition will handle it
                elif isinstance(next_item, SceneItem):
                    expanded_transitions.append("hard_cut")

        elif isinstance(item, TransitionItem):
            if item.transition_type == "ai_morph" and item.clip_material_id:
                mat = timeline.materials.get(item.clip_material_id)
                if mat and mat.path:
                    # AI morph: interleave the generated clip with hard cuts
                    expanded_transitions.append("hard_cut")
                    clip_path = _safe_resolve(mat.path)
                    expanded_clips.append(clip_path)
                    expanded_gen_durations.append(item.duration_frames / 30.0)
                    expanded_speeds.append(item.speed)
                    expanded_transitions.append("hard_cut")
                else:
                    expanded_transitions.append("hard_cut")
            elif item.transition_type not in ("none", "hard_cut", "ai_morph"):
                expanded_transitions.append(item.transition_type)
            else:
                expanded_transitions.append("hard_cut")

    if not expanded_clips:
        raise ValueError("No clips found in timeline video track")

    clips = expanded_clips

    # Build the complete filter graph
    filter_parts: list[str] = []
    input_args: list[str] = []

    for clip in clips:
        input_args.extend(["-i", clip])

    if aspect_ratio == "16:9":
        out_w, out_h = 1920, 1080
    else:
        out_w, out_h = 1080, 1920

    for i, (gen_dur, speed) in enumerate(zip(expanded_gen_durations, expanded_speeds)):
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

    if len(clips) > 1:
        concat_inputs = "".join(f"[v{i}]" for i in range(len(clips)))
        filter_parts.append(f"{concat_inputs}concat=n={len(clips)}:v=1:a=0[vout]")
        video_label = "[vout]"
    else:
        video_label = "[v0]"

    if color_grade:
        color_filter = get_color_grade_filter(civilization, color_grade_override=color_grade_override)
        filter_parts.append(f"{video_label}{color_filter}[graded]")
    else:
        filter_parts.append(f"{video_label}null[graded]")

    filter_graph = ";".join(filter_parts)

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

"""Text overlays via ffmpeg — ASS subtitles and drawtext filters."""

from __future__ import annotations

import asyncio
import logging
import shlex
import tempfile
from pathlib import Path

from lorekit.config import CIVILIZATIONS, CivilizationPreset
from lorekit.models import Scene

logger = logging.getLogger(__name__)


async def add_text_overlays(
    video_path: str,
    scenes: list[Scene],
    civilization: str,
    output_path: str,
    channel_name: str = "LoreKit",
) -> str:
    """Burn text overlays onto the video using ffmpeg ASS subtitles.

    For each scene with text_overlay:
    1. Calculate exact start/end time based on cumulative scene durations
    2. Text appears 0.5s after scene starts
    3. Apply civilization-specific font, color, shadow
    4. Add attribution text below quote
    5. Add persistent channel watermark (corner, 40% opacity)

    Returns path to final video with text.
    """
    civ_config = CIVILIZATIONS.get(civilization)
    if not civ_config:
        logger.warning("Unknown civilization %r, using roman defaults", civilization)
        civ_config = CIVILIZATIONS["roman"]

    ass_content = build_ass_subtitle(scenes, civ_config.model_dump())

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    # Write ASS file to temp location
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".ass", delete=False, encoding="utf-8"
    ) as f:
        f.write(ass_content)
        ass_path = f.name

    # Build ffmpeg command with ASS subtitles + watermark
    watermark_filter = (
        f"drawtext=text='{channel_name}':"
        f"fontsize=24:fontcolor=white@0.4:"
        f"x=w-tw-20:y=h-th-20"
    )

    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-vf", f"ass={ass_path},{watermark_filter}",
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "20",
        "-c:a", "copy",
        output_path,
    ]

    logger.info("Adding text overlays to %s", output_path)
    await _run_ffmpeg(cmd)

    # Clean up temp file
    Path(ass_path).unlink(missing_ok=True)

    logger.info("Text overlay complete: %s", output_path)
    return output_path


def build_ass_subtitle(
    scenes: list[Scene],
    civilization_config: dict,
    resolution: tuple[int, int] = (1080, 1920),
) -> str:
    """Generate an ASS subtitle file content string for the text overlays.

    Benefits of ASS over drawtext:
    - Better font rendering
    - Easier word-by-word animation
    - Proper shadow/outline control
    - Can handle multiple text styles in one pass
    """
    width, height = resolution
    font = civilization_config.get("font", "Cinzel")
    text_color = civilization_config.get("text_color", "#FFFFFF")
    shadow_style = civilization_config.get("text_shadow", "warm")

    # Convert hex color to ASS BGR format (ASS uses &HBBGGRR&)
    ass_color = _hex_to_ass_color(text_color)
    outline_color = _get_shadow_color(shadow_style)

    header = (
        "[Script Info]\n"
        "Title: LoreKit\n"
        "ScriptType: v4.00+\n"
        f"PlayResX: {width}\n"
        f"PlayResY: {height}\n"
        "WrapStyle: 0\n"
        "ScaledBorderAndShadow: yes\n"
        "\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, "
        "OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, "
        "ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, "
        "Alignment, MarginL, MarginR, MarginV, Encoding\n"
        f"Style: Quote,{font},52,{ass_color},&H00FFFFFF,{outline_color},"
        f"&H80000000,-1,0,0,0,100,100,0,0,1,3,2,5,40,40,200,1\n"
        f"Style: Attribution,{font},32,{ass_color},&H00FFFFFF,{outline_color},"
        f"&H80000000,0,-1,0,0,100,100,0,0,1,2,1,5,40,40,130,1\n"
        "\n"
        "[Events]\n"
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, "
        "Effect, Text\n"
    )

    events: list[str] = []
    cumulative_time = 0.0

    for scene in scenes:
        if scene.text_overlay:
            start_time = cumulative_time + 0.5  # 0.5s after scene starts
            end_time = cumulative_time + scene.duration - 0.3

            # Format text with line breaks at ~30 chars
            formatted_text = _wrap_text(scene.text_overlay, max_width=30)

            # Fade-in effect: {\fad(500,300)} = 500ms fade in, 300ms fade out
            start_str = _seconds_to_ass_time(start_time)
            end_str = _seconds_to_ass_time(end_time)

            events.append(
                f"Dialogue: 0,{start_str},{end_str},Quote,,0,0,0,,"
                f"{{\\fad(500,300)}}{formatted_text}"
            )

            # Attribution text
            if scene.text_attribution:
                attr_start = start_time + 0.3
                attr_start_str = _seconds_to_ass_time(attr_start)
                events.append(
                    f"Dialogue: 0,{attr_start_str},{end_str},Attribution,,0,0,0,,"
                    f"{{\\fad(500,300)}}\u2014 {scene.text_attribution}"
                )

        cumulative_time += scene.duration

    return header + "\n".join(events) + "\n"


def _wrap_text(text: str, max_width: int = 30) -> str:
    """Wrap text at approximately max_width characters per line.

    Uses ASS line break (\\N) for newlines.
    """
    words = text.split()
    lines: list[str] = []
    current_line: list[str] = []
    current_length = 0

    for word in words:
        if current_length + len(word) + 1 > max_width and current_line:
            lines.append(" ".join(current_line))
            current_line = [word]
            current_length = len(word)
        else:
            current_line.append(word)
            current_length += len(word) + (1 if current_length > 0 else 0)

    if current_line:
        lines.append(" ".join(current_line))

    return "\\N".join(lines)


def _seconds_to_ass_time(seconds: float) -> str:
    """Convert seconds to ASS time format (H:MM:SS.CC)."""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    centiseconds = int((seconds % 1) * 100)
    return f"{hours}:{minutes:02d}:{secs:02d}.{centiseconds:02d}"


def _hex_to_ass_color(hex_color: str) -> str:
    """Convert hex color (#RRGGBB) to ASS color format (&H00BBGGRR).

    ASS uses BGR order with alpha prefix.
    """
    hex_color = hex_color.lstrip("#")
    if len(hex_color) != 6:
        return "&H00FFFFFF"

    r = hex_color[0:2]
    g = hex_color[2:4]
    b = hex_color[4:6]
    return f"&H00{b}{g}{r}"


def _get_shadow_color(shadow_style: str) -> str:
    """Get ASS outline/shadow color based on civilization shadow style."""
    shadow_colors: dict[str, str] = {
        "warm": "&H00004080",      # Warm amber shadow
        "cool": "&H00804000",      # Cool blue shadow
        "minimal": "&H00404040",   # Subtle grey shadow
    }
    return shadow_colors.get(shadow_style, "&H00000000")


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

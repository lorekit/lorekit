"""Civilization-specific color grading via ffmpeg filters."""

from __future__ import annotations

import asyncio
import logging
import shlex

from lorekit.config import CIVILIZATIONS

logger = logging.getLogger(__name__)

# Extended color grading presets beyond what's in CivilizationPreset
_GRADE_EXTRAS: dict[str, dict] = {
    "roman": {
        "curves": "curves=preset=lighter",
        "shadows": "colorlevels=rimax=0.95:gimax=0.90:bimax=0.85",
        "description": "warm temperature, lifted shadows, slight vignette",
    },
    "greek": {
        "curves": "curves=preset=increase_contrast",
        "shadows": "colorlevels=rimin=0.05:gimin=0.05:bimin=0.08",
        "description": "high contrast, clean whites, slightly cool mid-tones",
    },
    "chinese": {
        "curves": "curves=preset=vintage",
        "shadows": "colorlevels=rimin=0.08:gimin=0.05:bimin=0.05",
        "description": "desaturated, crushed blacks, green tint in shadows",
    },
    "japanese": {
        "curves": "curves=preset=lighter",
        "shadows": "colorlevels=rimax=0.92:gimax=0.92:bimax=0.90",
        "description": "low saturation, film grain, soft contrast, warm highlights",
    },
}


def get_color_grade_filter(
    civilization: str,
    color_grade_override: dict | None = None,
) -> str:
    """Return ffmpeg filter string for color grading.

    If color_grade_override is provided (from DB environment), use those values.
    Otherwise fall back to hardcoded civilization presets.

    Expected override keys: temperature, saturation, contrast, vignette
    """
    if color_grade_override:
        from lorekit.config import ColorGrade
        cg = ColorGrade(
            temperature=color_grade_override.get("temperature", 6500),
            saturation=color_grade_override.get("saturation", 1.0),
            contrast=color_grade_override.get("contrast", 1.0),
            vignette=color_grade_override.get("vignette", 0.0),
        )
    else:
        preset = CIVILIZATIONS.get(civilization)
        if not preset:
            logger.warning("Unknown civilization %r, using neutral grade", civilization)
            return "null"
        cg = preset.color_grade
    filters: list[str] = []

    # Color temperature
    filters.append(f"colortemperature=temperature={cg.temperature}")

    # Saturation and contrast
    filters.append(f"eq=contrast={cg.contrast}:saturation={cg.saturation}")

    # Vignette
    if cg.vignette > 0:
        # Map 0-1 vignette intensity to PI angle (higher = stronger)
        angle = cg.vignette * 3.14159
        filters.append(f"vignette=PI/{3.14159 / angle:.1f}" if angle > 0 else "")

    # Extended grading — only when using civilization presets, not custom overrides
    if not color_grade_override:
        extras = _GRADE_EXTRAS.get(civilization, {})
        if curves := extras.get("curves"):
            filters.append(curves)
        if shadows := extras.get("shadows"):
            filters.append(shadows)

        # Japanese-specific: film grain
        if civilization == "japanese":
            filters.append("noise=alls=8:allf=t")

    # Remove empty strings
    filters = [f for f in filters if f]

    return ",".join(filters)


async def apply_color_grade(
    input_path: str,
    output_path: str,
    civilization: str,
) -> str:
    """Apply color grading via ffmpeg. Returns output path."""
    filter_str = get_color_grade_filter(civilization)

    cmd = [
        "ffmpeg", "-y",
        "-i", input_path,
        "-vf", filter_str,
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "20",
        "-c:a", "copy",
        output_path,
    ]

    logger.info("Applying %s color grade to %s", civilization, input_path)
    await _run_ffmpeg(cmd)
    logger.info("Color grade complete: %s", output_path)
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

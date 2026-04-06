"""Text overlays via Skia rendering + ffmpeg overlay compositing.

Uses skia-python (Chrome's graphics engine) for text rendering so the
export matches the browser preview. Each TextItem is rendered as a
transparent PNG, then composited onto the video with ffmpeg.

Adding a new font: drop the TTF in lorekit/assembly/fonts/. No calibration needed.
"""

from __future__ import annotations

import asyncio
import logging
import shlex
import tempfile
from pathlib import Path

import skia

from lorekit.models import TextItem

logger = logging.getLogger(__name__)

FONTS_DIR = Path(__file__).parent / "fonts"
REFERENCE_HEIGHT = 1280


def _get_font_file(family: str, weight: int) -> str:
    """Get the best matching TTF file for a font family and weight."""
    prefix = family.replace(" ", "")

    exact = FONTS_DIR / f"{prefix}-{weight}.ttf"
    if exact.exists():
        return str(exact)

    candidates = sorted(FONTS_DIR.glob(f"{prefix}-*.ttf"))
    if candidates:
        def weight_dist(p: Path) -> int:
            try:
                return abs(int(p.stem.split("-")[1]) - weight)
            except (IndexError, ValueError):
                return 9999
        return str(min(candidates, key=weight_dist))

    fallbacks = sorted(FONTS_DIR.glob("Cinzel-*.ttf"))
    if fallbacks:
        return str(fallbacks[0])
    any_font = sorted(FONTS_DIR.glob("*.ttf"))
    if any_font:
        return str(any_font[0])
    raise FileNotFoundError(f"No font files found in {FONTS_DIR}")


def _wrap_text(text: str, font: skia.Font, max_width: float) -> list[str]:
    """Word-wrap text using Skia's font metrics — same engine as Chrome."""
    words = text.split()
    lines: list[str] = []
    current: list[str] = []

    for word in words:
        test_line = " ".join(current + [word])
        if font.measureText(test_line) > max_width and current:
            lines.append(" ".join(current))
            current = [word]
        else:
            current.append(word)

    if current:
        lines.append(" ".join(current))
    return lines


def _hex_to_skia_color(hex_color: str, alpha: int = 255) -> int:
    """Convert #RRGGBB to Skia color int."""
    h = hex_color.lstrip("#")
    if len(h) != 6:
        return skia.Color(255, 255, 255, alpha)
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return skia.Color(r, g, b, alpha)


def _render_text_png(
    item: TextItem,
    resolution: tuple[int, int],
) -> str:
    """Render a single TextItem as a transparent PNG using Skia (Chrome's engine).

    Returns path to the temporary PNG file.
    """
    width, height = resolution

    # Font — same TTF files, rendered by Skia (identical to Chrome)
    font_size = round((item.font_size or 48) * height / REFERENCE_HEIGHT)
    font_weight = item.font_weight or 400
    font_path = _get_font_file(item.font_family or "Cinzel", font_weight)
    typeface = skia.Typeface.MakeFromFile(font_path)
    font = skia.Font(typeface, font_size)
    font.setEdging(skia.Font.Edging.kAntiAlias)
    font.setSubpixel(True)

    # Text wrapping using Skia metrics
    container_w = item.width if item.width else 0.8
    max_text_width = container_w * width
    lines = _wrap_text(item.text, font, max_text_width)

    # Line height and total block height
    metrics = font.getMetrics()
    line_height = font_size * 1.3  # match CSS lineHeight: 1.3
    total_text_height = len(lines) * line_height

    # Position — same as CSS: left=x*100%, top=y*100%, translate(-50%,-50%)
    pos = item.position or {"x": 0.5, "y": 0.5}
    center_x = pos.get("x", 0.5) * width
    center_y = pos.get("y", 0.5) * height

    # Color
    text_color = _hex_to_skia_color(item.color or "#FFFFFF")

    # Create Skia surface (transparent)
    surface = skia.Surface(width, height)
    canvas = surface.getCanvas()
    canvas.clear(skia.ColorTRANSPARENT)

    # Draw shadow first — matches CSS textShadow: "0 2px 8px rgba(0,0,0,0.8)"
    shadow_paint = skia.Paint(
        Color=skia.Color(0, 0, 0, 200),
        AntiAlias=True,
        MaskFilter=skia.MaskFilter.MakeBlur(skia.kNormal_BlurStyle, 4.0),
    )
    for i, line in enumerate(lines):
        line_w = font.measureText(line)
        x = center_x - line_w / 2
        y = center_y - total_text_height / 2 + i * line_height + font_size + 2
        canvas.drawString(line, x, y, font, shadow_paint)

    # Draw main text
    text_paint = skia.Paint(Color=text_color, AntiAlias=True)
    for i, line in enumerate(lines):
        line_w = font.measureText(line)
        x = center_x - line_w / 2
        y = center_y - total_text_height / 2 + i * line_height + font_size
        canvas.drawString(line, x, y, font, text_paint)

    # Save to temp PNG
    image = surface.makeImageSnapshot()
    data = image.encodeToData(skia.EncodedImageFormat.kPNG, 100)

    tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
    tmp.write(bytes(data))
    tmp.close()
    return tmp.name


async def add_text_overlays(
    video_path: str,
    text_items: list[TextItem],
    output_path: str,
    resolution: tuple[int, int] = (1080, 1920),
) -> str:
    """Render text overlays as transparent PNGs (via Skia) and composite onto video."""
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    if not text_items:
        import shutil
        shutil.copy2(video_path, output_path)
        return output_path

    # Render each text item as a PNG
    png_paths: list[tuple[str, float, float]] = []
    for item in text_items:
        if not item.text:
            continue
        png_path = _render_text_png(item, resolution)
        start_t = item.from_frame / 30.0
        end_t = (item.from_frame + item.duration_frames) / 30.0
        png_paths.append((png_path, start_t, end_t))

    if not png_paths:
        import shutil
        shutil.copy2(video_path, output_path)
        return output_path

    # Build ffmpeg command: chain overlay filters for each PNG
    inputs = ["-i", video_path]
    for png_path, _, _ in png_paths:
        inputs.extend(["-i", png_path])

    filters = []
    n = len(png_paths)
    for i, (_, start_t, end_t) in enumerate(png_paths):
        input_label = f"[tmp{i}]" if i > 0 else "[0:v]"
        output_label = f"[tmp{i+1}]" if i < n - 1 else "[out]"
        overlay = (
            f"{input_label}[{i+1}:v]overlay=0:0"
            f":enable='between(t,{start_t:.3f},{end_t:.3f})'"
            f"{output_label}"
        )
        filters.append(overlay)

    filter_complex = ";".join(filters)

    cmd = [
        "ffmpeg", "-y",
        *inputs,
        "-filter_complex", filter_complex,
        "-map", "[out]",
        "-map", "0:a?",
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "20",
        "-c:a", "copy",
        output_path,
    ]

    logger.info("Adding %d text overlays to %s", len(png_paths), output_path)
    await _run_ffmpeg(cmd)

    # Clean up temp PNGs
    for png_path, _, _ in png_paths:
        Path(png_path).unlink(missing_ok=True)

    logger.info("Text overlay complete: %s", output_path)
    return output_path


async def _run_ffmpeg(cmd: list[str]) -> None:
    """Run an ffmpeg command via subprocess."""
    logger.debug("Running: %s", " ".join(shlex.quote(c) for c in cmd))

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()

    if proc.returncode != 0:
        raise RuntimeError(
            f"ffmpeg failed (exit {proc.returncode}): {stderr.decode(errors='replace')}"
        )

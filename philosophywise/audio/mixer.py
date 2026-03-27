"""ffmpeg audio timeline builder — mix music, SFX, and ambient into one track."""

from __future__ import annotations

import asyncio
import logging
import shlex
from pathlib import Path

from philosophywise.audio.library import get_music_for_mood, get_sfx, scan_audio_assets
from philosophywise.models import Scene

logger = logging.getLogger(__name__)


async def build_audio_timeline(
    scenes: list[Scene],
    total_duration: float,
    civilization: str,
    assets_dir: str,
    output_dir: str | None = None,
) -> str:
    """Build a complete audio mix as a single WAV file.

    Process:
    1. Select a music bed based on civilization + dominant scene mood
    2. Trim/loop music to total_duration
    3. Apply volume automation per scene (louder on conflict, softer on stillness)
    4. Layer SFX at their specified timestamps
    5. Layer ambient sounds
    6. Layer text reveal sounds at text overlay timestamps
    7. Mix everything down to a single audio file

    Uses ffmpeg for all mixing.

    Args:
        output_dir: Directory for the audio mix file. If None, falls back to
            ``<assets_dir>/../../output`` for backwards compatibility.

    Returns path to the mixed audio file.
    """
    if output_dir:
        out_dir = Path(output_dir)
    else:
        assets_path = Path(assets_dir)
        out_dir = assets_path.parent.parent.parent / "output"
    out_dir.mkdir(parents=True, exist_ok=True)
    output_path = str(out_dir / "audio_mix.wav")

    index = scan_audio_assets(assets_dir)
    dominant_mood = _get_dominant_mood(scenes)

    music_path = select_music_bed(civilization, dominant_mood, assets_dir, index)
    if not music_path:
        logger.warning("No music bed found, generating silent audio")
        await _generate_silence(total_duration, output_path)
        return output_path

    # Gather SFX entries with their timestamps
    sfx_entries = _collect_sfx_entries(scenes, index)
    ambient_entries = _collect_ambient_entries(scenes, index)
    scene_volumes = _build_scene_volumes(scenes)

    filter_graph = build_ffmpeg_audio_filter(
        music_path=music_path,
        sfx_entries=sfx_entries,
        ambient_entries=ambient_entries,
        total_duration=total_duration,
        scene_volumes=scene_volumes,
    )

    # Build the ffmpeg command
    input_args = ["-i", music_path]
    for entry in sfx_entries:
        input_args.extend(["-i", entry["path"]])
    for entry in ambient_entries:
        input_args.extend(["-i", entry["path"]])

    cmd = [
        "ffmpeg", "-y",
        *input_args,
        "-filter_complex", filter_graph,
        "-map", "[out]",
        "-t", str(total_duration),
        "-ar", "44100",
        "-ac", "2",
        output_path,
    ]

    await _run_ffmpeg(cmd)
    logger.info("Audio mix complete: %s", output_path)
    return output_path


def select_music_bed(
    civilization: str,
    mood: str,
    assets_dir: str,
    index: dict | None = None,
) -> str | None:
    """Pick appropriate music file from the assets library."""
    if index is None:
        index = scan_audio_assets(assets_dir)

    path = get_music_for_mood(index, civilization, mood)
    if path:
        logger.info("Selected music bed: %s (civ=%s, mood=%s)", path, civilization, mood)
        return path

    # Fallback: try any mood for this civilization
    music_index: dict = index.get("music", {})
    music_civ = music_index.get(civilization, {})
    for mood_files in music_civ.values():
        if mood_files:
            fallback = mood_files[0]
            logger.info("Fallback music bed: %s", fallback)
            return fallback

    # Final fallback: any music file at all
    for civ_moods in music_index.values():
        for mood_files in civ_moods.values():
            if mood_files:
                fallback = mood_files[0]
                logger.info("Global fallback music: %s", fallback)
                return fallback

    return None


def build_ffmpeg_audio_filter(
    music_path: str,
    sfx_entries: list[dict],
    ambient_entries: list[dict],
    total_duration: float,
    scene_volumes: list[dict],
) -> str:
    """Build the complex ffmpeg filter graph for audio mixing.

    Handles:
    - Music bed looping/trimming with volume automation
    - SFX placement at specific timestamps
    - Ambient sound layering
    - Final mixdown
    """
    filters: list[str] = []
    mix_inputs: list[str] = []
    input_idx = 0

    # Music bed: loop to total_duration and apply volume
    volume_expr = _build_volume_expression(scene_volumes)
    filters.append(
        f"[{input_idx}:a]aloop=loop=-1:size=2e+09,atrim=0:{total_duration},"
        f"volume='{volume_expr}':eval=frame[music]"
    )
    mix_inputs.append("[music]")
    input_idx += 1

    # SFX entries
    for i, entry in enumerate(sfx_entries):
        label = f"sfx{i}"
        delay_ms = int(entry["time"] * 1000)
        vol = entry.get("volume", 0.8)
        filters.append(
            f"[{input_idx}:a]volume={vol},adelay={delay_ms}|{delay_ms},"
            f"apad=whole_dur={total_duration}[{label}]"
        )
        mix_inputs.append(f"[{label}]")
        input_idx += 1

    # Ambient entries
    for i, entry in enumerate(ambient_entries):
        label = f"amb{i}"
        vol = entry.get("volume", 0.2)
        filters.append(
            f"[{input_idx}:a]aloop=loop=-1:size=2e+09,atrim=0:{total_duration},"
            f"volume={vol}[{label}]"
        )
        mix_inputs.append(f"[{label}]")
        input_idx += 1

    # Final mixdown
    if len(mix_inputs) == 1:
        filters.append(f"{mix_inputs[0]}acopy[out]")
    else:
        mix_str = "".join(mix_inputs)
        filters.append(f"{mix_str}amix=inputs={len(mix_inputs)}:normalize=0[out]")

    return ";".join(filters)


def _get_dominant_mood(scenes: list[Scene]) -> str:
    """Determine the dominant mood from scene beats."""
    beat_to_mood: dict[str, str] = {
        "hook": "epic",
        "world": "ambient",
        "conflict": "epic",
        "stillness": "contemplative",
        "truth": "intimate",
        "loop": "epic",
    }
    mood_counts: dict[str, int] = {}
    for scene in scenes:
        mood = beat_to_mood.get(scene.beat, "ambient")
        mood_counts[mood] = mood_counts.get(mood, 0) + 1

    if not mood_counts:
        return "ambient"
    return max(mood_counts, key=mood_counts.get)  # type: ignore[arg-type]


def _collect_sfx_entries(scenes: list[Scene], index: dict) -> list[dict]:
    """Collect all SFX entries with absolute timestamps."""
    entries: list[dict] = []
    cumulative_time = 0.0

    for scene in scenes:
        for cue in scene.audio.sfx:
            path = get_sfx(index, "transitions", cue.sound)
            if not path:
                path = get_sfx(index, "battle", cue.sound)
            if not path:
                path = get_sfx(index, "emotional", cue.sound)
            if path:
                entries.append({
                    "path": path,
                    "time": cumulative_time + cue.time,
                    "volume": cue.volume,
                })

        # Text reveal SFX
        if scene.audio.text_reveal_sfx and scene.text_overlay:
            cue = scene.audio.text_reveal_sfx
            path = get_sfx(index, "text_reveal", cue.sound)
            if path:
                entries.append({
                    "path": path,
                    "time": cumulative_time + cue.time,
                    "volume": cue.volume,
                })

        cumulative_time += scene.duration

    return entries


def _collect_ambient_entries(scenes: list[Scene], index: dict) -> list[dict]:
    """Collect ambient sound entries."""
    entries: list[dict] = []
    seen_sounds: set[str] = set()

    for scene in scenes:
        if scene.audio.ambient and scene.audio.ambient.sound not in seen_sounds:
            path = get_sfx(index, "ambient", scene.audio.ambient.sound)
            if path:
                entries.append({
                    "path": path,
                    "volume": scene.audio.ambient.volume,
                })
                seen_sounds.add(scene.audio.ambient.sound)

    return entries


def _build_scene_volumes(scenes: list[Scene]) -> list[dict]:
    """Build volume automation data per scene."""
    volumes: list[dict] = []
    cumulative_time = 0.0

    beat_volumes: dict[str, float] = {
        "hook": 0.8,
        "world": 0.6,
        "conflict": 0.9,
        "stillness": 0.4,
        "truth": 0.5,
        "loop": 0.7,
    }

    for scene in scenes:
        vol = beat_volumes.get(scene.beat, 0.6) * scene.audio.music_volume
        volumes.append({
            "start": cumulative_time,
            "end": cumulative_time + scene.duration,
            "volume": vol,
        })
        cumulative_time += scene.duration

    return volumes


def _build_volume_expression(scene_volumes: list[dict]) -> str:
    """Build an ffmpeg volume expression for per-scene volume automation."""
    if not scene_volumes:
        return "0.7"

    parts: list[str] = []
    for sv in scene_volumes:
        parts.append(
            f"if(between(t,{sv['start']:.2f},{sv['end']:.2f}),{sv['volume']:.2f}"
        )

    # Build nested if expression, default to 0.7
    expr = "0.7"
    for part in reversed(parts):
        expr = f"{part},{expr})"

    return expr


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


async def _generate_silence(duration: float, output_path: str) -> None:
    """Generate a silent audio file of the specified duration."""
    cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi",
        "-i", f"anullsrc=r=44100:cl=stereo",
        "-t", str(duration),
        "-ar", "44100",
        "-ac", "2",
        output_path,
    ]
    await _run_ffmpeg(cmd)

"""Audio analysis utilities - duration, BPM, beat detection, energy analysis."""

import asyncio
import json
import logging
from pathlib import Path
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)


async def get_audio_duration(file_path: str) -> float:
    """Get audio duration in seconds using ffprobe."""
    proc = await asyncio.create_subprocess_exec(
        "ffprobe", "-v", "quiet", "-show_entries", "format=duration",
        "-of", "csv=p=0", file_path,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, _ = await proc.communicate()
    try:
        return float(stdout.decode().strip())
    except (ValueError, TypeError):
        return 0.0


def _load_audio(file_path: str) -> tuple[np.ndarray, int]:
    """Load audio file using librosa. Returns (waveform, sample_rate)."""
    import librosa
    y, sr = librosa.load(file_path, sr=22050, mono=True)
    return y, sr


def _detect_beats(y: np.ndarray, sr: int) -> dict[str, Any]:
    """Detect BPM, beat timestamps, and onset strength."""
    import librosa

    # BPM and beat frames
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    # tempo may be an array in newer librosa
    bpm = float(tempo) if np.ndim(tempo) == 0 else float(tempo[0])
    beat_times = librosa.frames_to_time(beat_frames, sr=sr).tolist()

    # Onset strength envelope
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    onset_times = librosa.frames_to_time(np.arange(len(onset_env)), sr=sr)

    # Find strong onsets (peaks above mean + 1.5 std)
    threshold = float(np.mean(onset_env) + 1.5 * np.std(onset_env))
    strong_onset_indices = np.where(onset_env > threshold)[0]
    strong_onset_times = onset_times[strong_onset_indices].tolist()

    return {
        "bpm": round(bpm, 1),
        "beat_count": len(beat_times),
        "beat_times": [round(t, 3) for t in beat_times],
        "strong_onset_times": [round(t, 3) for t in strong_onset_times],
        "onset_threshold": round(threshold, 3),
    }


def _analyze_energy(y: np.ndarray, sr: int, hop_length: int = 512) -> dict[str, Any]:
    """Analyze spectral energy over time - identifies high/low energy sections."""
    import librosa

    # RMS energy
    rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]
    rms_times = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=hop_length)

    # Normalize RMS to 0-1
    rms_max = float(np.max(rms)) if np.max(rms) > 0 else 1.0
    rms_normalized = (rms / rms_max).tolist()

    # Spectral centroid (brightness indicator)
    spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr, hop_length=hop_length)[0]

    # Low frequency energy ratio (bass detection)
    S = np.abs(librosa.stft(y, hop_length=hop_length))
    freq_bins = librosa.fft_frequencies(sr=sr)
    bass_mask = freq_bins <= 150  # below 150 Hz = bass
    bass_energy = np.sum(S[bass_mask, :] ** 2, axis=0)
    total_energy = np.sum(S ** 2, axis=0) + 1e-10
    bass_ratio = (bass_energy / total_energy).tolist()

    # Find bass drops: moments where bass energy spikes dramatically
    bass_arr = np.array(bass_ratio)
    bass_mean = float(np.mean(bass_arr))
    bass_std = float(np.std(bass_arr))
    bass_drop_threshold = bass_mean + 2.0 * bass_std
    bass_drop_frames = np.where(bass_arr > bass_drop_threshold)[0]

    # Cluster nearby bass drop frames into events (within 0.5s of each other)
    bass_drop_times = []
    if len(bass_drop_frames) > 0:
        frame_times = librosa.frames_to_time(bass_drop_frames, sr=sr, hop_length=hop_length)
        # Cluster: only keep first frame in each cluster
        clusters = []
        current_cluster = [frame_times[0]]
        for t in frame_times[1:]:
            if t - current_cluster[-1] < 0.5:
                current_cluster.append(t)
            else:
                clusters.append(current_cluster)
                current_cluster = [t]
        clusters.append(current_cluster)
        bass_drop_times = [round(float(c[0]), 3) for c in clusters]

    return {
        "rms_times": [round(float(t), 3) for t in rms_times[::10]],  # downsample for response size
        "rms_energy": [round(float(r), 3) for r in rms_normalized[::10]],
        "bass_drop_times": bass_drop_times,
        "bass_drop_count": len(bass_drop_times),
        "avg_energy": round(float(np.mean(rms)), 4),
        "peak_energy": round(float(np.max(rms)), 4),
    }


def _detect_sections(y: np.ndarray, sr: int) -> list[dict]:
    """Detect structural sections (intro, verse, chorus, drop, outro) using spectral clustering."""
    import librosa

    # Use librosa's structural analysis
    # Compute mel spectrogram for self-similarity
    S = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)

    # Recurrence matrix for section detection
    try:
        # Use agglomerative clustering on the self-similarity matrix
        bound_frames = librosa.segment.agglomerative(S, k=None)
        bound_times = librosa.frames_to_time(bound_frames, sr=sr).tolist()
    except Exception:
        # Fallback: split evenly into ~4 sections
        duration = len(y) / sr
        bound_times = [i * duration / 4 for i in range(5)]

    # Build sections
    duration = len(y) / sr
    # Ensure we have start and end
    if not bound_times or bound_times[0] > 0.5:
        bound_times = [0.0] + bound_times
    if bound_times[-1] < duration - 0.5:
        bound_times.append(duration)

    sections = []
    for i in range(len(bound_times) - 1):
        start = bound_times[i]
        end = bound_times[i + 1]
        section_duration = end - start

        # Label sections heuristically based on position and duration
        position_ratio = start / duration if duration > 0 else 0
        if position_ratio < 0.1 and section_duration < duration * 0.2:
            label = "intro"
        elif position_ratio > 0.85:
            label = "outro"
        elif section_duration < duration * 0.1:
            label = "transition"
        else:
            label = "section"

        sections.append({
            "index": i + 1,
            "label": label,
            "start": round(start, 3),
            "end": round(end, 3),
            "duration": round(section_duration, 3),
        })

    return sections


def _generate_beat_synced_segments(
    beat_analysis: dict,
    energy_analysis: dict,
    sections: list[dict],
    duration: float,
    beats_per_cut: int = 4,
) -> list[dict]:
    """Generate video scene segments synced to beats with transition metadata.

    Args:
        beat_analysis: output from _detect_beats
        energy_analysis: output from _analyze_energy
        sections: output from _detect_sections
        duration: total audio duration
        beats_per_cut: how many beats per scene cut (default 4 = 1 bar at 4/4)

    Returns list of segments with:
        - index, start, end, duration
        - transition: "hard_cut" | "flash" | "zoom" | "fade" | "whip_pan"
        - energy_level: 0.0-1.0 (drives visual intensity)
        - camera_speed: "slow" | "medium" | "fast"
        - has_bass_drop: bool
    """
    beat_times = beat_analysis.get("beat_times", [])
    bass_drops = set(energy_analysis.get("bass_drop_times", []))
    strong_onsets = set(beat_analysis.get("strong_onset_times", []))

    if not beat_times:
        # Fallback: even splits
        segment_duration = max(3.0, duration / max(1, round(duration / 4)))
        segments = []
        current = 0.0
        idx = 1
        while current < duration:
            end = min(current + segment_duration, duration)
            segments.append({
                "index": idx,
                "start": round(current, 3),
                "end": round(end, 3),
                "duration": round(end - current, 3),
                "transition": "hard_cut",
                "energy_level": 0.5,
                "camera_speed": "medium",
                "has_bass_drop": False,
            })
            current = end
            idx += 1
        return segments

    # Group beats into segments (N beats per cut)
    segments = []
    idx = 1
    i = 0
    while i < len(beat_times):
        start = beat_times[i]
        # End at N beats later or end of track
        end_idx = min(i + beats_per_cut, len(beat_times) - 1)
        end = beat_times[end_idx] if end_idx < len(beat_times) else duration

        # If this is the last segment, extend to end of track
        if end_idx >= len(beat_times) - 1:
            end = duration

        seg_duration = end - start
        if seg_duration < 0.5:
            i = end_idx + 1
            continue

        # Check for bass drops in this segment
        has_bass_drop = any(
            start <= bd <= end for bd in bass_drops
        )

        # Check for strong onsets
        onset_count = sum(1 for o in strong_onsets if start <= o <= end)
        has_strong_onset = onset_count >= 2

        # Calculate energy level for this segment
        # Use RMS data if available, otherwise estimate from onset density
        rms_energy = energy_analysis.get("rms_energy", [])
        rms_times = energy_analysis.get("rms_times", [])
        if rms_energy and rms_times:
            seg_energies = [
                e for t, e in zip(rms_times, rms_energy)
                if start <= t <= end
            ]
            energy_level = float(np.mean(seg_energies)) if seg_energies else 0.5
        else:
            energy_level = 0.5

        # Determine transition type
        if has_bass_drop:
            transition = "flash"
        elif has_strong_onset:
            transition = "zoom"
        elif energy_level > 0.7:
            transition = "whip_pan"
        elif energy_level < 0.3:
            transition = "fade"
        else:
            transition = "hard_cut"

        # Camera speed based on energy
        if energy_level > 0.7:
            camera_speed = "fast"
        elif energy_level < 0.3:
            camera_speed = "slow"
        else:
            camera_speed = "medium"

        segments.append({
            "index": idx,
            "start": round(start, 3),
            "end": round(end, 3),
            "duration": round(seg_duration, 3),
            "transition": transition,
            "energy_level": round(energy_level, 3),
            "camera_speed": camera_speed,
            "has_bass_drop": has_bass_drop,
        })

        idx += 1
        i = end_idx + 1 if end_idx > i else i + 1

    return segments


async def analyze_audio(file_path: str, beats_per_cut: int | None = None) -> dict:
    """Full audio analysis — duration, beats, energy, sections, beat-synced segments.
    
    Args:
        file_path: path to audio file
        beats_per_cut: beats per scene cut. If None, auto-selects based on duration:
                       ≤30s → 1 (every beat), ≤60s → 2 (every 2 beats), >60s → 4 (every bar)

    Returns comprehensive analysis dict.
    """
    duration = await get_audio_duration(file_path)

    # Auto-select beats_per_cut based on duration for fast-paced edits
    if beats_per_cut is None:
        if duration <= 30:
            beats_per_cut = 1  # every beat — rapid fire for shorts
        elif duration <= 60:
            beats_per_cut = 2  # every 2 beats — fast cuts
        else:
            beats_per_cut = 4  # every bar — standard pacing for longer content

    # Get format info via ffprobe
    proc = await asyncio.create_subprocess_exec(
        "ffprobe", "-v", "quiet", "-print_format", "json",
        "-show_format", "-show_streams", file_path,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, _ = await proc.communicate()

    format_info = {}
    try:
        data = json.loads(stdout.decode())
        fmt = data.get("format", {})
        streams = data.get("streams", [])
        audio_stream = next((s for s in streams if s.get("codec_type") == "audio"), {})
        format_info = {
            "sample_rate": int(audio_stream.get("sample_rate", 44100)),
            "channels": int(audio_stream.get("channels", 2)),
            "codec": audio_stream.get("codec_name", "unknown"),
            "bit_rate": int(fmt.get("bit_rate", 0)),
        }
    except Exception:
        format_info = {"sample_rate": 44100, "channels": 2, "codec": "unknown", "bit_rate": 0}

    # Run librosa analysis in thread pool (it's CPU-bound)
    def _librosa_analysis():
        try:
            y, sr = _load_audio(file_path)
        except Exception as e:
            logger.warning("librosa load failed for %s: %s", file_path, e)
            return None, None, None

        beat_data = _detect_beats(y, sr)
        energy_data = _analyze_energy(y, sr)
        section_data = _detect_sections(y, sr)
        return beat_data, energy_data, section_data

    beat_data, energy_data, section_data = await asyncio.to_thread(_librosa_analysis)

    # Generate beat-synced segments
    if beat_data and energy_data:
        segments = _generate_beat_synced_segments(
            beat_data, energy_data, section_data or [], duration, beats_per_cut
        )
        # Build the full response
        return {
            "duration_seconds": round(duration, 2),
            **format_info,
            "beats": beat_data,
            "energy": energy_data,
            "sections": section_data or [],
            "segments": segments,
            "segment_count": len(segments),
            "beats_per_cut": beats_per_cut,
            "analysis_type": "beat_synced",
        }
    else:
        # Fallback to simple segmentation
        if duration <= 60:
            segment_duration = max(3.0, duration / max(1, round(duration / 4)))
        else:
            segment_duration = max(5.0, duration / max(1, round(duration / 7)))

        segments = []
        current = 0.0
        idx = 1
        while current < duration:
            end = min(current + segment_duration, duration)
            segments.append({
                "index": idx,
                "start": round(current, 2),
                "end": round(end, 2),
                "duration": round(end - current, 2),
                "transition": "hard_cut",
                "energy_level": 0.5,
                "camera_speed": "medium",
                "has_bass_drop": False,
            })
            current = end
            idx += 1

        return {
            "duration_seconds": round(duration, 2),
            **format_info,
            "segments": segments,
            "segment_count": len(segments),
            "analysis_type": "simple",
        }

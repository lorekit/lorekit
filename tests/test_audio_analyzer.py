"""Tests for audio analysis utilities."""

from __future__ import annotations

import asyncio
import subprocess
from pathlib import Path
from unittest.mock import patch

import pytest

from lorekit.audio.analyzer import analyze_audio, get_audio_duration


@pytest.fixture
def short_wav(tmp_path: Path) -> Path:
    """Create a short silent WAV file using ffmpeg."""
    wav_path = tmp_path / "test_audio.wav"
    subprocess.run(
        [
            "ffmpeg", "-y", "-f", "lavfi",
            "-i", "anullsrc=r=44100:cl=stereo",
            "-t", "5",
            str(wav_path),
        ],
        capture_output=True,
        check=True,
    )
    return wav_path


@pytest.fixture
def sine_wav(tmp_path: Path) -> Path:
    """Create a 5-second sine wave at 440Hz for beat analysis."""
    wav_path = tmp_path / "sine_audio.wav"
    subprocess.run(
        [
            "ffmpeg", "-y", "-f", "lavfi",
            "-i", "sine=frequency=440:duration=5",
            str(wav_path),
        ],
        capture_output=True,
        check=True,
    )
    return wav_path


@pytest.mark.asyncio
async def test_analyze_short_audio(short_wav: Path):
    """Test analyzing a short audio file."""
    result = await analyze_audio(str(short_wav))
    assert result["duration_seconds"] == pytest.approx(5.0, abs=0.5)
    assert result["sample_rate"] == 44100
    assert result["channels"] == 2
    assert result["segment_count"] > 0
    assert len(result["segments"]) == result["segment_count"]


@pytest.mark.asyncio
async def test_analyze_segments(short_wav: Path):
    """Test that segment generation works correctly."""
    result = await analyze_audio(str(short_wav))
    segments = result["segments"]

    # All segments have positive duration
    for seg in segments:
        assert seg["duration"] > 0


@pytest.mark.asyncio
async def test_get_audio_duration(short_wav: Path):
    """Test getting audio duration."""
    duration = await get_audio_duration(str(short_wav))
    assert duration == pytest.approx(5.0, abs=0.5)


@pytest.mark.asyncio
async def test_get_audio_duration_nonexistent():
    """Test duration of nonexistent file returns 0."""
    duration = await get_audio_duration("/nonexistent/path.wav")
    assert duration == 0.0


@pytest.mark.asyncio
async def test_beat_analysis_structure(sine_wav: Path):
    """Test that beat-aware analysis returns the expected structure."""
    result = await analyze_audio(str(sine_wav))
    assert result["analysis_type"] == "beat_synced"
    assert "beats" in result
    assert "energy" in result
    assert "segments" in result
    assert "sections" in result

    beats = result["beats"]
    assert "bpm" in beats
    assert "beat_count" in beats
    assert "beat_times" in beats
    assert "strong_onset_times" in beats
    assert isinstance(beats["bpm"], float)
    assert isinstance(beats["beat_count"], int)
    assert isinstance(beats["beat_times"], list)


@pytest.mark.asyncio
async def test_bass_drop_detection_structure(sine_wav: Path):
    """Test that energy analysis has bass drop fields."""
    result = await analyze_audio(str(sine_wav))
    assert "energy" in result
    energy = result["energy"]
    assert "bass_drop_times" in energy
    assert "bass_drop_count" in energy
    assert isinstance(energy["bass_drop_times"], list)
    assert isinstance(energy["bass_drop_count"], int)
    assert "avg_energy" in energy
    assert "peak_energy" in energy


@pytest.mark.asyncio
async def test_segment_transitions(sine_wav: Path):
    """Test that segments have transition metadata."""
    result = await analyze_audio(str(sine_wav))
    segments = result["segments"]
    assert len(segments) > 0

    valid_transitions = {"hard_cut", "flash", "zoom", "fade", "whip_pan"}
    valid_speeds = {"slow", "medium", "fast"}

    for seg in segments:
        assert "transition" in seg
        assert seg["transition"] in valid_transitions
        assert "energy_level" in seg
        assert isinstance(seg["energy_level"], (int, float))
        assert 0.0 <= seg["energy_level"] <= 1.0
        assert "camera_speed" in seg
        assert seg["camera_speed"] in valid_speeds
        assert "has_bass_drop" in seg
        assert isinstance(seg["has_bass_drop"], bool)


@pytest.mark.asyncio
async def test_fallback_without_librosa(short_wav: Path):
    """Test fallback to simple segments when librosa fails."""
    with patch("lorekit.audio.analyzer._load_audio", side_effect=Exception("librosa not available")):
        result = await analyze_audio(str(short_wav))
        assert result["analysis_type"] == "simple"
        assert "beats" not in result
        assert "energy" not in result
        assert result["segment_count"] > 0
        # Fallback segments should still have transition metadata
        for seg in result["segments"]:
            assert seg["transition"] == "hard_cut"
            assert seg["energy_level"] == 0.5
            assert seg["camera_speed"] == "medium"
            assert seg["has_bass_drop"] is False

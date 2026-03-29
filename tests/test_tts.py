"""Tests for TTS service utilities."""

from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

from lorekit.audio.tts import TTS_MODELS, get_available_tts_models, _get_audio_duration


def test_tts_models_available():
    """Verify TTS_MODELS dict has expected models."""
    models = get_available_tts_models()
    assert len(models) >= 3
    assert "fal-ai/minimax/speech-2.6-turbo" in models
    assert "fal-ai/orpheus-tts" in models
    assert "fal-ai/elevenlabs/tts/multilingual-v2" in models

    # Each model has required fields
    for key, model in models.items():
        assert "name" in model
        assert "supports_voice_id" in model
        assert isinstance(model["name"], str)
        assert isinstance(model["supports_voice_id"], bool)


def test_tts_models_match_constant():
    """Ensure get_available_tts_models returns TTS_MODELS."""
    assert get_available_tts_models() is TTS_MODELS


@pytest.fixture
def short_wav(tmp_path: Path) -> Path:
    """Create a short silent WAV file using ffmpeg."""
    wav_path = tmp_path / "test_tts.wav"
    subprocess.run(
        [
            "ffmpeg", "-y", "-f", "lavfi",
            "-i", "anullsrc=r=44100:cl=stereo",
            "-t", "3",
            str(wav_path),
        ],
        capture_output=True,
        check=True,
    )
    return wav_path


@pytest.mark.asyncio
async def test_get_audio_duration(short_wav: Path):
    """Test _get_audio_duration with a real wav file."""
    duration = await _get_audio_duration(str(short_wav))
    assert duration == pytest.approx(3.0, abs=0.5)


@pytest.mark.asyncio
async def test_get_audio_duration_bad_file():
    """Test _get_audio_duration with nonexistent file."""
    duration = await _get_audio_duration("/nonexistent/file.wav")
    assert duration == 0.0

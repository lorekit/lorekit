"""Text-to-speech generation via fal.ai."""

import asyncio
import logging
import uuid
from pathlib import Path
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# Supported TTS models on fal.ai
TTS_MODELS = {
    "fal-ai/minimax/speech-2.6-turbo": {
        "name": "MiniMax Speech 2.6 Turbo",
        "supports_voice_id": True,
        "supports_reference_audio": False,
    },
    "fal-ai/orpheus-tts": {
        "name": "Orpheus TTS",
        "supports_voice_id": True,
        "supports_reference_audio": True,
    },
    "fal-ai/elevenlabs/tts/multilingual-v2": {
        "name": "ElevenLabs Multilingual v2",
        "supports_voice_id": True,
        "supports_reference_audio": False,
    },
    "fal-ai/elevenlabs/tts/turbo-v2.5": {
        "name": "ElevenLabs Turbo v2.5",
        "supports_voice_id": True,
        "supports_reference_audio": False,
    },
}


async def generate_speech(
    text: str,
    fal_key: str,
    model: str = "fal-ai/minimax/speech-2.6-turbo",
    voice_id: str | None = None,
    output_dir: str = "./output/audio",
) -> dict[str, Any]:
    """Generate speech audio from text using fal.ai.

    Returns dict with:
        - audio_path: local file path to the generated audio
        - audio_url: remote URL of generated audio
        - duration_seconds: duration of the audio in seconds
    """
    import fal_client

    # Build request based on model
    request: dict[str, Any] = {"prompt": text}
    if voice_id:
        request["voice_id"] = voice_id

    result = await asyncio.to_thread(
        fal_client.run,
        model,
        arguments=request,
    )

    # Extract audio URL from result
    audio_url = None
    if isinstance(result, dict):
        # Different models return audio in different fields
        audio_data = result.get("audio")
        if isinstance(audio_data, dict):
            audio_url = audio_data.get("url")
        elif isinstance(audio_data, str):
            audio_url = audio_data

        if not audio_url:
            audio_url = result.get("audio_url")

        if not audio_url:
            output_data = result.get("output")
            if isinstance(output_data, dict):
                audio_url = output_data.get("url")

    if not audio_url:
        logger.error("No audio URL in TTS response: %s", result)
        raise RuntimeError("TTS generation failed: no audio URL in response")

    # Download audio file
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    audio_filename = f"tts_{uuid.uuid4().hex[:8]}.wav"
    audio_path = str(Path(output_dir) / audio_filename)

    async with httpx.AsyncClient() as client:
        resp = await client.get(audio_url)
        resp.raise_for_status()
        with open(audio_path, "wb") as f:
            f.write(resp.content)

    # Get duration using ffprobe
    duration = await _get_audio_duration(audio_path)

    return {
        "audio_path": audio_path,
        "audio_url": audio_url,
        "duration_seconds": duration,
    }


async def _get_audio_duration(file_path: str) -> float:
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


async def generate_narration_for_scenes(
    scenes: list[dict],  # list of {scene_id, text}
    fal_key: str,
    model: str = "fal-ai/minimax/speech-2.6-turbo",
    voice_id: str | None = None,
    output_dir: str = "./output/audio",
) -> list[dict]:
    """Generate narration for multiple scenes.

    Returns list of {scene_id, audio_path, duration_seconds}.
    """
    results = []
    for scene in scenes:
        text = scene.get("text", "").strip()
        if not text:
            results.append({
                "scene_id": scene["scene_id"],
                "audio_path": None,
                "duration_seconds": 0.0,
            })
            continue

        result = await generate_speech(
            text=text,
            fal_key=fal_key,
            model=model,
            voice_id=voice_id,
            output_dir=output_dir,
        )
        results.append({
            "scene_id": scene["scene_id"],
            "audio_path": result["audio_path"],
            "duration_seconds": result["duration_seconds"],
        })

    return results


def get_available_tts_models() -> dict:
    """Return available TTS model info."""
    return TTS_MODELS

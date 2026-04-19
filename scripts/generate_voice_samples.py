#!/usr/bin/env python3
"""Generate TTS voice preview samples for all models.

Saves short audio clips to web/public/audio/voices/{model_key}/{voice_id}.mp3
so they can be served as static assets by Next.js.

Usage:
    cd /path/to/lorekit
    python scripts/generate_voice_samples.py
"""

import asyncio
import logging
import os
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

SAMPLE_TEXT = "Hello, this is a sample of my voice. How does it sound?"

# Map model endpoints to short directory names
MODEL_KEYS = {
    "fal-ai/minimax/speech-2.6-turbo": "minimax",
    "fal-ai/orpheus-tts": "orpheus",
    "fal-ai/elevenlabs/tts/multilingual-v2": "elevenlabs",
    "fal-ai/elevenlabs/tts/turbo-v2.5": "elevenlabs-turbo",
}

OUTPUT_DIR = Path(__file__).parent.parent / "web" / "public" / "audio" / "voices"


async def generate_sample(model: str, voice_id: str, output_path: Path) -> bool:
    """Generate a single voice sample."""
    if output_path.exists():
        logger.info("  SKIP %s (already exists)", output_path.name)
        return True

    try:
        import fal_client

        fal_key = os.environ.get("FAL_KEY", "")
        if not fal_key:
            logger.error("FAL_KEY not set")
            return False

        os.environ["FAL_KEY"] = fal_key

        # Build request — different models use different param names
        request: dict = {"prompt": SAMPLE_TEXT}
        if "orpheus" in model:
            request = {"text": SAMPLE_TEXT, "voice": voice_id}
        elif "elevenlabs" in model:
            request = {"text": SAMPLE_TEXT, "voice": voice_id}
        else:
            # MiniMax
            request = {"prompt": SAMPLE_TEXT, "voice_setting": {"voice_id": voice_id}}

        result = await asyncio.to_thread(fal_client.run, model, arguments=request)

        # Extract audio URL
        audio_url = None
        if isinstance(result, dict):
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
            logger.error("  FAIL %s — no audio URL in response: %s", voice_id, result)
            return False

        # Download
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.get(audio_url)
            resp.raise_for_status()
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_bytes(resp.content)

        logger.info("  OK   %s (%d bytes)", output_path.name, len(resp.content))
        return True

    except Exception as exc:
        logger.error("  FAIL %s — %s", voice_id, exc)
        return False


async def main():
    from lorekit.audio.tts import TTS_MODELS

    total = 0
    success = 0

    for model_endpoint, model_info in TTS_MODELS.items():
        model_key = MODEL_KEYS.get(model_endpoint)
        if not model_key:
            continue

        voices = model_info.get("voices", [])
        if not voices:
            continue

        logger.info("\n%s (%d voices)", model_info["name"], len(voices))

        for voice in voices:
            total += 1
            output_path = OUTPUT_DIR / model_key / f"{voice['id']}.mp3"
            if await generate_sample(model_endpoint, voice["id"], output_path):
                success += 1

    logger.info("\nDone: %d/%d samples generated", success, total)


if __name__ == "__main__":
    asyncio.run(main())

"""Audio generation node executors — TTS models."""

from __future__ import annotations

import logging
from typing import Any

from lorekit.workflow.models import WorkflowNode
from lorekit.workflow.engine import register_executor

logger = logging.getLogger(__name__)

# Map node types to their default fal.ai model
TTS_MODELS = {
    "tts_minimax": "fal-ai/minimax/speech-2.6-turbo",
    "tts_orpheus": "fal-ai/orpheus-tts",
    "tts_elevenlabs": "fal-ai/elevenlabs/tts/multilingual-v2",
}


async def execute_tts(node: WorkflowNode, inputs: dict[str, Any]) -> dict[str, Any]:
    """Generate speech using a fal.ai TTS model."""
    from lorekit.audio.tts import generate_speech
    from lorekit.config import get_settings

    text = inputs.get("text", "")
    voice_id = inputs.get("voice_id") or None
    model = TTS_MODELS.get(node.type, "fal-ai/minimax/speech-2.6-turbo")

    result = await generate_speech(
        text=text,
        fal_key=get_settings().fal_key,
        model=model,
        voice_id=voice_id,
    )

    url = result.get("audio_url", "")
    node.cost = 0.06
    return {"url": url}


register_executor("tts_minimax", execute_tts)
register_executor("tts_orpheus", execute_tts)
register_executor("tts_elevenlabs", execute_tts)

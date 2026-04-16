"""Audio generation node executors — TTS models."""

from __future__ import annotations

import logging
from typing import Any

from lorekit.workflow.models import WorkflowNode
from lorekit.workflow.engine import register_executor

logger = logging.getLogger(__name__)


async def execute_tts(node: WorkflowNode, inputs: dict[str, Any]) -> dict[str, Any]:
    """Generate speech using a fal.ai TTS model."""
    from lorekit.audio.tts import generate_tts

    text = inputs.get("text", "")
    voice_id = inputs.get("voice_id", "")
    model = inputs.get("model", "fal-ai/minimax/speech-2.6-turbo")

    result = await generate_tts(text=text, voice_id=voice_id, model=model)
    return {"url": result.get("url", result.get("audio_url", ""))}


# Register executors
register_executor("tts_minimax", execute_tts)
register_executor("tts_orpheus", execute_tts)
register_executor("tts_elevenlabs", execute_tts)

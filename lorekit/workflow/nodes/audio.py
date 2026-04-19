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


async def _load_character_voice(project_id: str, scene_id: int) -> dict[str, Any] | None:
    """Load the character's voice config from the project's character."""
    from lorekit import db
    project = await db.get_project(project_id)
    if not project:
        return None
    character_id = project.get("character_id")
    if not character_id:
        return None
    return await db.get_character_voice(character_id)


async def execute_tts(node: WorkflowNode, inputs: dict[str, Any]) -> dict[str, Any]:
    """Generate speech using a fal.ai TTS model.

    Auto-loads narration from scene and voice from character config.
    """
    from lorekit.audio.tts import generate_speech
    from lorekit.config import get_settings

    text = inputs.get("text", "")
    scene_id = inputs.get("scene_id")
    project_id = inputs.get("_project_id", "")

    # Auto-load narration from scene
    if scene_id and not text:
        from lorekit.workflow.nodes.image import _load_scene_data
        scene_data = await _load_scene_data(inputs, int(scene_id))
        if scene_data:
            text = scene_data.get("narration", "")

    if not text:
        raise ValueError("TTS requires text input — set narration on the scene or pass text directly")

    # Resolve voice: explicit param > character voice config > model default
    voice_id = inputs.get("voice_id") or None
    model = TTS_MODELS.get(node.type, "fal-ai/minimax/speech-2.6-turbo")

    if not voice_id and project_id and scene_id:
        char_voice = await _load_character_voice(project_id, int(scene_id))
        if char_voice:
            voice_id = char_voice.get("voice_id_str") or None
            # Use character's preferred TTS model if it matches this node type
            char_model = char_voice.get("tts_model", "")
            if char_model == model:
                voice_id = char_voice.get("voice_id_str") or voice_id

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

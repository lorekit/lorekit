"""Voice profile API endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from lorekit import db
from lorekit.auth.user import get_current_user, CurrentUser
from lorekit.audio.tts import get_available_tts_models

router = APIRouter(tags=["voices"])


async def _verify_universe_access(universe_id: str, org_id: str) -> None:
    """Verify the universe belongs to the user's org."""
    uni = await db.get_universe(universe_id, org_id=org_id)
    if not uni:
        raise HTTPException(status_code=404, detail="Universe not found")


class VoiceUpsertRequest(BaseModel):
    tts_model: str = "fal-ai/minimax/speech-2.6-turbo"
    voice_id: str | None = None
    voice_name: str = "Default"
    reference_audio_path: str | None = None
    settings_json: str | None = None


@router.get("/api/universes/{universe_id}/characters/{character_id}/voice")
async def get_voice(universe_id: str, character_id: str, user: CurrentUser = Depends(get_current_user)) -> dict | None:
    """Get voice profile for a character."""
    await _verify_universe_access(universe_id, user.org_id)
    voice = await db.get_character_voice(character_id)
    return voice


@router.put("/api/universes/{universe_id}/characters/{character_id}/voice")
async def upsert_voice(
    universe_id: str, character_id: str, body: VoiceUpsertRequest, user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Create or update voice profile for a character."""
    await _verify_universe_access(universe_id, user.org_id)
    existing = await db.get_character_voice(character_id)
    if existing:
        result = await db.update_character_voice(
            existing["id"],
            tts_model=body.tts_model,
            voice_id=body.voice_id,
            voice_name=body.voice_name,
            reference_audio_path=body.reference_audio_path,
            settings_json=body.settings_json,
        )
        return result or existing
    else:
        voice_id = uuid.uuid4().hex[:12]
        return await db.create_character_voice(
            voice_id=voice_id,
            character_id=character_id,
            tts_model=body.tts_model,
            voice_id_str=body.voice_id,
            voice_name=body.voice_name,
            reference_audio_path=body.reference_audio_path,
            settings_json=body.settings_json,
        )


@router.delete("/api/universes/{universe_id}/characters/{character_id}/voice")
async def delete_voice(universe_id: str, character_id: str, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Delete voice profile for a character."""
    await _verify_universe_access(universe_id, user.org_id)
    existing = await db.get_character_voice(character_id)
    if not existing:
        return {"deleted": False}
    deleted = await db.delete_character_voice(existing["id"])
    return {"deleted": deleted}


@router.get("/api/tts-models")
async def list_tts_models(user: CurrentUser = Depends(get_current_user)) -> dict:
    """Return available TTS models."""
    return get_available_tts_models()

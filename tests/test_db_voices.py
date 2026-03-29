"""Tests for character voice CRUD operations."""

from __future__ import annotations

import uuid

import pytest
import pytest_asyncio

from lorekit import db


@pytest.mark.asyncio
async def test_create_character_voice(initialized_db, sample_character):
    """Test creating a character voice profile."""
    voice_id = f"voice-{uuid.uuid4().hex[:8]}"
    voice = await db.create_character_voice(
        voice_id=voice_id,
        character_id=sample_character,
        tts_model="fal-ai/minimax/speech-2.6-turbo",
        voice_id_str="test-voice-123",
        voice_name="Deep Narrator",
        db_path=initialized_db,
    )
    assert voice["id"] == voice_id
    assert voice["character_id"] == sample_character
    assert voice["tts_model"] == "fal-ai/minimax/speech-2.6-turbo"
    assert voice["voice_id"] == "test-voice-123"
    assert voice["voice_name"] == "Deep Narrator"
    assert voice["created_at"]
    assert voice["updated_at"]


@pytest.mark.asyncio
async def test_get_character_voice(initialized_db, sample_character):
    """Test retrieving a character voice profile."""
    voice_id = f"voice-{uuid.uuid4().hex[:8]}"
    await db.create_character_voice(
        voice_id=voice_id,
        character_id=sample_character,
        voice_name="Test Voice",
        db_path=initialized_db,
    )
    result = await db.get_character_voice(sample_character, db_path=initialized_db)
    assert result is not None
    assert result["id"] == voice_id
    assert result["voice_name"] == "Test Voice"

    # Non-existent character should return None
    result2 = await db.get_character_voice("nonexistent", db_path=initialized_db)
    assert result2 is None


@pytest.mark.asyncio
async def test_update_character_voice(initialized_db, sample_character):
    """Test updating a character voice profile."""
    voice_id = f"voice-{uuid.uuid4().hex[:8]}"
    await db.create_character_voice(
        voice_id=voice_id,
        character_id=sample_character,
        voice_name="Original",
        db_path=initialized_db,
    )
    updated = await db.update_character_voice(
        voice_id,
        voice_name="Updated Voice",
        tts_model="fal-ai/orpheus-tts",
        db_path=initialized_db,
    )
    assert updated is not None
    assert updated["voice_name"] == "Updated Voice"
    assert updated["tts_model"] == "fal-ai/orpheus-tts"


@pytest.mark.asyncio
async def test_delete_character_voice(initialized_db, sample_character):
    """Test deleting a character voice profile."""
    voice_id = f"voice-{uuid.uuid4().hex[:8]}"
    await db.create_character_voice(
        voice_id=voice_id,
        character_id=sample_character,
        db_path=initialized_db,
    )
    deleted = await db.delete_character_voice(voice_id, db_path=initialized_db)
    assert deleted is True

    # Should be gone now
    result = await db.get_character_voice(sample_character, db_path=initialized_db)
    assert result is None

    # Deleting again should return False
    deleted2 = await db.delete_character_voice(voice_id, db_path=initialized_db)
    assert deleted2 is False

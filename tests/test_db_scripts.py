"""Tests for scripts DB operations."""

from __future__ import annotations

import uuid

import pytest

from lorekit import db


@pytest.mark.asyncio
async def test_create_script_idea(initialized_db, sample_universe):
    """Create an idea script, verify fields."""
    script_id = uuid.uuid4().hex
    script = await db.create_script(
        script_id=script_id,
        universe_id=sample_universe,
        title="My First Idea",
        script_type="idea",
        content="A character walks into a bar...",
        character_ids=["char-1", "char-2"],
        db_path=initialized_db,
    )
    assert script["id"] == script_id
    assert script["universe_id"] == sample_universe
    assert script["title"] == "My First Idea"
    assert script["script_type"] == "idea"
    assert script["content"] == "A character walks into a bar..."
    assert script["status"] == "draft"
    assert '"char-1"' in script["character_ids_json"]
    assert '"char-2"' in script["character_ids_json"]
    assert script["created_at"] is not None
    assert script["updated_at"] is not None


@pytest.mark.asyncio
async def test_create_script_full(initialized_db, sample_universe):
    """Create a full_script, verify type."""
    script_id = uuid.uuid4().hex
    script = await db.create_script(
        script_id=script_id,
        universe_id=sample_universe,
        title="Full Script",
        script_type="full_script",
        content="INT. OFFICE - DAY\n\nCharacter enters...",
        target_duration_seconds=120,
        scene_count=5,
        db_path=initialized_db,
    )
    assert script["script_type"] == "full_script"
    assert script["target_duration_seconds"] == 120
    assert script["scene_count"] == 5


@pytest.mark.asyncio
async def test_list_scripts_by_universe(initialized_db, sample_universe):
    """Create multiple scripts, list, verify count."""
    for i in range(3):
        await db.create_script(
            script_id=uuid.uuid4().hex,
            universe_id=sample_universe,
            title=f"Script {i}",
            db_path=initialized_db,
        )

    scripts = await db.list_scripts_by_universe(sample_universe, db_path=initialized_db)
    assert len(scripts) == 3


@pytest.mark.asyncio
async def test_list_scripts_by_character(initialized_db, sample_universe):
    """Create scripts with different characters, filter by one."""
    await db.create_script(
        script_id=uuid.uuid4().hex,
        universe_id=sample_universe,
        title="Script with Alice",
        character_ids=["alice", "bob"],
        db_path=initialized_db,
    )
    await db.create_script(
        script_id=uuid.uuid4().hex,
        universe_id=sample_universe,
        title="Script with Bob only",
        character_ids=["bob"],
        db_path=initialized_db,
    )
    await db.create_script(
        script_id=uuid.uuid4().hex,
        universe_id=sample_universe,
        title="Script with Charlie",
        character_ids=["charlie"],
        db_path=initialized_db,
    )

    # Filter by alice -> should get 1
    alice_scripts = await db.list_scripts_by_universe(
        sample_universe, character_id="alice", db_path=initialized_db
    )
    assert len(alice_scripts) == 1
    assert alice_scripts[0]["title"] == "Script with Alice"

    # Filter by bob -> should get 2
    bob_scripts = await db.list_scripts_by_universe(
        sample_universe, character_id="bob", db_path=initialized_db
    )
    assert len(bob_scripts) == 2


@pytest.mark.asyncio
async def test_update_script_type_progression(initialized_db, sample_universe):
    """Create idea, update to outline, verify."""
    script_id = uuid.uuid4().hex
    script = await db.create_script(
        script_id=script_id,
        universe_id=sample_universe,
        title="Evolving Script",
        script_type="idea",
        db_path=initialized_db,
    )
    assert script["script_type"] == "idea"

    updated = await db.update_script(
        script_id, script_type="outline", db_path=initialized_db
    )
    assert updated["script_type"] == "outline"

    updated2 = await db.update_script(
        script_id, script_type="full_script", content="Full content here", db_path=initialized_db
    )
    assert updated2["script_type"] == "full_script"
    assert updated2["content"] == "Full content here"


@pytest.mark.asyncio
async def test_delete_script(initialized_db, sample_universe):
    """Create and delete, verify gone."""
    script_id = uuid.uuid4().hex
    await db.create_script(
        script_id=script_id,
        universe_id=sample_universe,
        title="To Delete",
        db_path=initialized_db,
    )

    deleted = await db.delete_script(script_id, db_path=initialized_db)
    assert deleted is True

    gone = await db.get_script(script_id, db_path=initialized_db)
    assert gone is None

    # Double delete should return False
    deleted2 = await db.delete_script(script_id, db_path=initialized_db)
    assert deleted2 is False

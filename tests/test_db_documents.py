"""Tests for character_documents and document_chunks DB operations."""

from __future__ import annotations

import uuid

import pytest

from lorekit import db


@pytest.mark.asyncio
async def test_create_document(initialized_db, sample_universe, sample_character):
    """Create a document and verify its fields."""
    doc_id = uuid.uuid4().hex[:12]
    doc = await db.create_document(
        doc_id=doc_id,
        character_id=sample_character,
        universe_id=sample_universe,
        name="Test Document",
        doc_type="text",
        content="Hello world",
        db_path=initialized_db,
    )
    assert doc["id"] == doc_id
    assert doc["character_id"] == sample_character
    assert doc["universe_id"] == sample_universe
    assert doc["name"] == "Test Document"
    assert doc["doc_type"] == "text"
    assert doc["content"] == "Hello world"
    assert doc["status"] == "pending"
    assert doc["chunk_count"] == 0

    # Verify get_document works
    fetched = await db.get_document(doc_id, db_path=initialized_db)
    assert fetched is not None
    assert fetched["id"] == doc_id


@pytest.mark.asyncio
async def test_list_documents_by_character(initialized_db, sample_universe, sample_character):
    """Create multiple documents and verify list + character filter."""
    # Create docs for sample_character
    for i in range(3):
        await db.create_document(
            doc_id=uuid.uuid4().hex[:12],
            character_id=sample_character,
            universe_id=sample_universe,
            name=f"Doc {i}",
            content=f"Content {i}",
            db_path=initialized_db,
        )

    # Create a doc for a different character
    other_char = f"other-char-{uuid.uuid4().hex[:8]}"
    conn = await db.connect(initialized_db)
    try:
        await conn.execute(
            "INSERT INTO characters (id, universe_id, name, group_name) VALUES (?, ?, ?, ?)",
            (other_char, sample_universe, "Other", "group"),
        )
        await conn.commit()
    finally:
        await conn.close()

    await db.create_document(
        doc_id=uuid.uuid4().hex[:12],
        character_id=other_char,
        universe_id=sample_universe,
        name="Other Doc",
        content="Other content",
        db_path=initialized_db,
    )

    # List for sample_character should return 3
    docs = await db.list_documents_by_character(sample_character, db_path=initialized_db)
    assert len(docs) == 3

    # List for other should return 1
    other_docs = await db.list_documents_by_character(other_char, db_path=initialized_db)
    assert len(other_docs) == 1


@pytest.mark.asyncio
async def test_delete_document_cascades_chunks(initialized_db, sample_universe, sample_character):
    """Create a document with chunks, delete the doc, verify chunks are gone."""
    doc_id = uuid.uuid4().hex[:12]
    await db.create_document(
        doc_id=doc_id,
        character_id=sample_character,
        universe_id=sample_universe,
        name="To Delete",
        content="Some content",
        db_path=initialized_db,
    )

    # Create chunks
    for i in range(5):
        await db.create_chunk(
            chunk_id=uuid.uuid4().hex[:12],
            document_id=doc_id,
            character_id=sample_character,
            chunk_index=i,
            content=f"Chunk {i}",
            token_count=10,
            db_path=initialized_db,
        )

    # Verify chunks exist
    chunks = await db.list_chunks_by_document(doc_id, db_path=initialized_db)
    assert len(chunks) == 5

    # Delete document
    deleted = await db.delete_document(doc_id, db_path=initialized_db)
    assert deleted is True

    # Verify document gone
    assert await db.get_document(doc_id, db_path=initialized_db) is None

    # Verify chunks are also gone
    chunks = await db.list_chunks_by_document(doc_id, db_path=initialized_db)
    assert len(chunks) == 0


@pytest.mark.asyncio
async def test_document_status_transitions(initialized_db, sample_universe, sample_character):
    """Create a pending document, update to ready, verify transition."""
    doc_id = uuid.uuid4().hex[:12]
    doc = await db.create_document(
        doc_id=doc_id,
        character_id=sample_character,
        universe_id=sample_universe,
        name="Status Test",
        content="Content here",
        db_path=initialized_db,
    )
    assert doc["status"] == "pending"

    # Update to processing
    updated = await db.update_document(doc_id, status="processing", db_path=initialized_db)
    assert updated["status"] == "processing"

    # Update to ready with chunk_count
    updated = await db.update_document(doc_id, status="ready", chunk_count=3, db_path=initialized_db)
    assert updated["status"] == "ready"
    assert updated["chunk_count"] == 3

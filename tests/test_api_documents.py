"""Tests for the documents API endpoints."""

from __future__ import annotations

import pytest
import httpx


@pytest.mark.asyncio
async def test_upload_text_document(async_client: httpx.AsyncClient):
    """POST creates a document."""
    # First create a universe and character
    uni_resp = await async_client.post("/api/universes", json={
        "name": "Doc Test Universe",
        "description": "For testing documents",
    })
    assert uni_resp.status_code == 200
    universe_id = uni_resp.json()["id"]

    # Create a character via the characters endpoint
    char_resp = await async_client.post(f"/api/universes/{universe_id}/characters", json={
        "name": "Doc Test Char",
        "group_name": "test",
    })
    assert char_resp.status_code == 200
    character_id = char_resp.json()["id"]

    # Create a document
    doc_resp = await async_client.post(
        f"/api/universes/{universe_id}/characters/{character_id}/documents/",
        json={"name": "My Knowledge", "content": "Some important text here"},
    )
    assert doc_resp.status_code == 200
    doc = doc_resp.json()
    assert doc["name"] == "My Knowledge"
    assert doc["status"] == "pending"
    assert doc["content"] == "Some important text here"


@pytest.mark.asyncio
async def test_list_documents(async_client: httpx.AsyncClient):
    """GET returns list of documents."""
    # Create universe + character
    uni_resp = await async_client.post("/api/universes", json={"name": "List Test"})
    universe_id = uni_resp.json()["id"]

    char_resp = await async_client.post(f"/api/universes/{universe_id}/characters", json={
        "name": "List Char",
        "group_name": "test",
    })
    character_id = char_resp.json()["id"]

    # Create two documents
    for i in range(2):
        await async_client.post(
            f"/api/universes/{universe_id}/characters/{character_id}/documents/",
            json={"name": f"Doc {i}", "content": f"Content {i}"},
        )

    # List
    list_resp = await async_client.get(
        f"/api/universes/{universe_id}/characters/{character_id}/documents/"
    )
    assert list_resp.status_code == 200
    docs = list_resp.json()
    assert len(docs) == 2


@pytest.mark.asyncio
async def test_delete_document_removes_chunks(async_client: httpx.AsyncClient):
    """DELETE cascades to chunks."""
    uni_resp = await async_client.post("/api/universes", json={"name": "Delete Test"})
    universe_id = uni_resp.json()["id"]

    char_resp = await async_client.post(f"/api/universes/{universe_id}/characters", json={
        "name": "Delete Char",
        "group_name": "test",
    })
    character_id = char_resp.json()["id"]

    # Create doc with lots of content
    doc_resp = await async_client.post(
        f"/api/universes/{universe_id}/characters/{character_id}/documents/",
        json={"name": "Big Doc", "content": " ".join(f"word{i}" for i in range(1000))},
    )
    doc_id = doc_resp.json()["id"]

    # Process it to create chunks
    process_resp = await async_client.post(
        f"/api/universes/{universe_id}/characters/{character_id}/documents/{doc_id}/process"
    )
    assert process_resp.status_code == 200
    assert process_resp.json()["chunks_created"] > 0

    # Delete
    del_resp = await async_client.delete(
        f"/api/universes/{universe_id}/characters/{character_id}/documents/{doc_id}"
    )
    assert del_resp.status_code == 200
    assert del_resp.json()["deleted"] is True

    # Verify gone
    get_resp = await async_client.get(
        f"/api/universes/{universe_id}/characters/{character_id}/documents/{doc_id}"
    )
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_process_document_creates_chunks(async_client: httpx.AsyncClient):
    """POST /process creates chunks and updates status."""
    uni_resp = await async_client.post("/api/universes", json={"name": "Process Test"})
    universe_id = uni_resp.json()["id"]

    char_resp = await async_client.post(f"/api/universes/{universe_id}/characters", json={
        "name": "Process Char",
        "group_name": "test",
    })
    character_id = char_resp.json()["id"]

    # Create doc with enough content to chunk
    content = " ".join(f"word{i}" for i in range(600))
    doc_resp = await async_client.post(
        f"/api/universes/{universe_id}/characters/{character_id}/documents/",
        json={"name": "Chunked Doc", "content": content},
    )
    doc_id = doc_resp.json()["id"]

    # Process
    process_resp = await async_client.post(
        f"/api/universes/{universe_id}/characters/{character_id}/documents/{doc_id}/process"
    )
    assert process_resp.status_code == 200
    result = process_resp.json()
    assert result["chunks_created"] > 1

    # Verify document status is now 'ready'
    doc_resp2 = await async_client.get(
        f"/api/universes/{universe_id}/characters/{character_id}/documents/{doc_id}"
    )
    assert doc_resp2.json()["status"] == "ready"
    assert doc_resp2.json()["chunk_count"] == result["chunks_created"]


@pytest.mark.asyncio
async def test_upload_to_nonexistent_character_404(async_client: httpx.AsyncClient):
    """Verify 404 when uploading to a nonexistent character."""
    uni_resp = await async_client.post("/api/universes", json={"name": "404 Test"})
    universe_id = uni_resp.json()["id"]

    resp = await async_client.post(
        f"/api/universes/{universe_id}/characters/nonexistent-char/documents/",
        json={"name": "Should Fail", "content": "test"},
    )
    assert resp.status_code == 404

"""Tests for the scripts API endpoints."""

from __future__ import annotations

import pytest
import httpx


async def _create_universe(client: httpx.AsyncClient) -> str:
    resp = await client.post("/api/universes", json={
        "name": "Script Test Universe",
        "description": "For testing scripts",
    })
    assert resp.status_code == 200
    return resp.json()["id"]


async def _create_character(client: httpx.AsyncClient, universe_id: str, name: str = "Test Char") -> str:
    resp = await client.post(f"/api/universes/{universe_id}/characters", json={
        "name": name,
        "group_name": "test",
    })
    assert resp.status_code == 200
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_create_script(async_client: httpx.AsyncClient):
    """POST creates a script."""
    universe_id = await _create_universe(async_client)

    resp = await async_client.post(f"/api/universes/{universe_id}/scripts", json={
        "title": "My Script",
        "script_type": "idea",
        "content": "A great idea",
        "character_ids": ["char-1"],
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "My Script"
    assert data["script_type"] == "idea"
    assert data["content"] == "A great idea"
    assert data["status"] == "draft"
    assert data["universe_id"] == universe_id


@pytest.mark.asyncio
async def test_list_scripts(async_client: httpx.AsyncClient):
    """GET returns list of scripts."""
    universe_id = await _create_universe(async_client)

    for i in range(3):
        await async_client.post(f"/api/universes/{universe_id}/scripts", json={
            "title": f"Script {i}",
        })

    resp = await async_client.get(f"/api/universes/{universe_id}/scripts")
    assert resp.status_code == 200
    scripts = resp.json()
    assert len(scripts) == 3


@pytest.mark.asyncio
async def test_get_script(async_client: httpx.AsyncClient):
    """GET by ID returns single script."""
    universe_id = await _create_universe(async_client)

    create_resp = await async_client.post(f"/api/universes/{universe_id}/scripts", json={
        "title": "Get Me",
        "content": "Some content",
    })
    script_id = create_resp.json()["id"]

    resp = await async_client.get(f"/api/universes/{universe_id}/scripts/{script_id}")
    assert resp.status_code == 200
    assert resp.json()["title"] == "Get Me"
    assert resp.json()["content"] == "Some content"


@pytest.mark.asyncio
async def test_update_script(async_client: httpx.AsyncClient):
    """PATCH updates fields."""
    universe_id = await _create_universe(async_client)

    create_resp = await async_client.post(f"/api/universes/{universe_id}/scripts", json={
        "title": "Original",
        "script_type": "idea",
    })
    script_id = create_resp.json()["id"]

    resp = await async_client.patch(f"/api/universes/{universe_id}/scripts/{script_id}", json={
        "title": "Updated",
        "script_type": "outline",
        "content": "New content",
        "status": "review",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Updated"
    assert data["script_type"] == "outline"
    assert data["content"] == "New content"
    assert data["status"] == "review"


@pytest.mark.asyncio
async def test_delete_script(async_client: httpx.AsyncClient):
    """DELETE removes a script."""
    universe_id = await _create_universe(async_client)

    create_resp = await async_client.post(f"/api/universes/{universe_id}/scripts", json={
        "title": "To Delete",
    })
    script_id = create_resp.json()["id"]

    del_resp = await async_client.delete(f"/api/universes/{universe_id}/scripts/{script_id}")
    assert del_resp.status_code == 200
    assert del_resp.json()["deleted"] is True

    # Verify gone
    get_resp = await async_client.get(f"/api/universes/{universe_id}/scripts/{script_id}")
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_filter_by_character(async_client: httpx.AsyncClient):
    """GET with character_id query param filters correctly."""
    universe_id = await _create_universe(async_client)

    await async_client.post(f"/api/universes/{universe_id}/scripts", json={
        "title": "Alice Script",
        "character_ids": ["alice", "bob"],
    })
    await async_client.post(f"/api/universes/{universe_id}/scripts", json={
        "title": "Bob Only",
        "character_ids": ["bob"],
    })
    await async_client.post(f"/api/universes/{universe_id}/scripts", json={
        "title": "Charlie Script",
        "character_ids": ["charlie"],
    })

    # Filter by alice
    resp = await async_client.get(f"/api/universes/{universe_id}/scripts?character_id=alice")
    assert resp.status_code == 200
    scripts = resp.json()
    assert len(scripts) == 1
    assert scripts[0]["title"] == "Alice Script"

    # Filter by bob
    resp = await async_client.get(f"/api/universes/{universe_id}/scripts?character_id=bob")
    assert resp.status_code == 200
    assert len(resp.json()) == 2

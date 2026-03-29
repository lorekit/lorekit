"""Script CRUD endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from lorekit import db

router = APIRouter(prefix="/api/universes/{universe_id}/scripts", tags=["scripts"])


class ScriptCreate(BaseModel):
    title: str
    script_type: str = "idea"  # idea | outline | full_script
    content: str = ""
    character_ids: list[str] = []
    target_duration_seconds: int | None = None
    scene_count: int | None = None


class ScriptUpdate(BaseModel):
    title: str | None = None
    script_type: str | None = None
    content: str | None = None
    character_ids: list[str] | None = None
    target_duration_seconds: int | None = None
    scene_count: int | None = None
    status: str | None = None


@router.post("", status_code=201)
async def create_script(universe_id: str, body: ScriptCreate) -> dict:
    """Create a new script."""
    # Verify universe exists
    uni = await db.get_universe(universe_id)
    if not uni:
        raise HTTPException(status_code=404, detail="Universe not found")

    script_id = uuid.uuid4().hex
    row = await db.create_script(
        script_id=script_id,
        universe_id=universe_id,
        title=body.title,
        script_type=body.script_type,
        content=body.content,
        character_ids=body.character_ids if body.character_ids else None,
        target_duration_seconds=body.target_duration_seconds,
        scene_count=body.scene_count,
    )
    return row


@router.get("")
async def list_scripts(
    universe_id: str,
    character_id: str | None = Query(None),
    script_type: str | None = Query(None),
) -> list[dict]:
    """List scripts in a universe."""
    return await db.list_scripts_by_universe(
        universe_id,
        character_id=character_id,
        script_type=script_type,
    )


@router.get("/{script_id}")
async def get_script(universe_id: str, script_id: str) -> dict:
    """Get a single script."""
    row = await db.get_script(script_id)
    if not row or row["universe_id"] != universe_id:
        raise HTTPException(status_code=404, detail="Script not found")
    return row


@router.patch("/{script_id}")
async def update_script(universe_id: str, script_id: str, body: ScriptUpdate) -> dict:
    """Update a script."""
    existing = await db.get_script(script_id)
    if not existing or existing["universe_id"] != universe_id:
        raise HTTPException(status_code=404, detail="Script not found")

    updates = {}
    for field in ("title", "script_type", "content", "target_duration_seconds", "scene_count", "status"):
        val = getattr(body, field)
        if val is not None:
            updates[field] = val
    if body.character_ids is not None:
        updates["character_ids"] = body.character_ids

    if not updates:
        return existing

    row = await db.update_script(script_id, **updates)
    if not row:
        raise HTTPException(status_code=404, detail="Script not found")
    return row


@router.delete("/{script_id}")
async def delete_script(universe_id: str, script_id: str) -> dict:
    """Delete a script."""
    existing = await db.get_script(script_id)
    if not existing or existing["universe_id"] != universe_id:
        raise HTTPException(status_code=404, detail="Script not found")

    deleted = await db.delete_script(script_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Script not found")
    return {"deleted": True}

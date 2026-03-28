"""Universe CRUD endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from lorekit import db

router = APIRouter(prefix="/api/universes", tags=["universes"])


class UniverseCreate(BaseModel):
    name: str
    description: str = ""


class UniverseUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


@router.get("")
async def list_universes() -> list[dict]:
    """List all universes."""
    return await db.list_universes()


@router.get("/{universe_id}")
async def get_universe(universe_id: str) -> dict:
    """Get a single universe by ID."""
    result = await db.get_universe(universe_id)
    if not result:
        raise HTTPException(status_code=404, detail="Universe not found")
    return result


@router.post("", status_code=201)
async def create_universe(body: UniverseCreate) -> dict:
    """Create a new universe."""
    universe_id = uuid.uuid4().hex[:12]
    return await db.create_universe(universe_id, body.name, body.description)


@router.patch("/{universe_id}")
async def update_universe(universe_id: str, body: UniverseUpdate) -> dict:
    """Update a universe's fields."""
    updates = body.model_dump(exclude_none=True)
    if not updates:
        result = await db.get_universe(universe_id)
        if not result:
            raise HTTPException(status_code=404, detail="Universe not found")
        return result
    result = await db.update_universe(universe_id, **updates)
    if not result:
        raise HTTPException(status_code=404, detail="Universe not found")
    return result


@router.delete("/{universe_id}")
async def delete_universe(universe_id: str) -> dict:
    """Delete a universe."""
    deleted = await db.delete_universe(universe_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Universe not found")
    return {"deleted": True}

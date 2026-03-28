"""Scene template CRUD endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from lorekit import db

router = APIRouter(prefix="/api/templates", tags=["templates"])


class SceneTemplateCreate(BaseModel):
    universe_id: str
    name: str
    description: str = ""
    beats_json: str = "[]"
    min_duration: float = 15.0
    max_duration: float = 60.0
    min_scenes: int = 3
    max_scenes: int = 10


class SceneTemplateUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    beats_json: str | None = None
    min_duration: float | None = None
    max_duration: float | None = None
    min_scenes: int | None = None
    max_scenes: int | None = None


@router.get("")
async def list_scene_templates(
    universe_id: str | None = Query(None),
) -> list[dict]:
    """List scene templates, optionally filtered by universe_id."""
    return await db.list_scene_templates(universe_id=universe_id)


@router.get("/{template_id}")
async def get_scene_template(template_id: str) -> dict:
    """Get a single scene template by ID."""
    result = await db.get_scene_template(template_id)
    if not result:
        raise HTTPException(status_code=404, detail="Scene template not found")
    return result


@router.post("", status_code=201)
async def create_scene_template(body: SceneTemplateCreate) -> dict:
    """Create a new scene template."""
    template_id = uuid.uuid4().hex[:12]
    return await db.create_scene_template(
        template_id=template_id,
        universe_id=body.universe_id,
        name=body.name,
        description=body.description,
        beats_json=body.beats_json,
        min_duration=body.min_duration,
        max_duration=body.max_duration,
        min_scenes=body.min_scenes,
        max_scenes=body.max_scenes,
    )


@router.patch("/{template_id}")
async def update_scene_template(template_id: str, body: SceneTemplateUpdate) -> dict:
    """Update a scene template's fields."""
    updates = body.model_dump(exclude_none=True)
    if not updates:
        result = await db.get_scene_template(template_id)
        if not result:
            raise HTTPException(status_code=404, detail="Scene template not found")
        return result
    result = await db.update_scene_template(template_id, **updates)
    if not result:
        raise HTTPException(status_code=404, detail="Scene template not found")
    return result


@router.delete("/{template_id}")
async def delete_scene_template(template_id: str) -> dict:
    """Delete a scene template."""
    deleted = await db.delete_scene_template(template_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Scene template not found")
    return {"deleted": True}

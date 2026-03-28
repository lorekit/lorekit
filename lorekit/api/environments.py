"""Environment CRUD endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from lorekit import db

router = APIRouter(prefix="/api/environments", tags=["environments"])


class EnvironmentCreate(BaseModel):
    universe_id: str
    name: str
    color_grade_json: str = "{}"
    font: str = ""
    text_color: str = ""
    text_shadow: str = ""
    environment_description: str = ""
    themed_descriptions_json: str = "{}"


class EnvironmentUpdate(BaseModel):
    name: str | None = None
    color_grade_json: str | None = None
    font: str | None = None
    text_color: str | None = None
    text_shadow: str | None = None
    environment_description: str | None = None
    themed_descriptions_json: str | None = None


@router.get("")
async def list_environments(
    universe_id: str | None = Query(None),
) -> list[dict]:
    """List environments, optionally filtered by universe_id."""
    return await db.list_environments(universe_id=universe_id)


@router.get("/{environment_id}")
async def get_environment(environment_id: str) -> dict:
    """Get a single environment by ID."""
    result = await db.get_environment(environment_id)
    if not result:
        raise HTTPException(status_code=404, detail="Environment not found")
    return result


@router.post("", status_code=201)
async def create_environment(body: EnvironmentCreate) -> dict:
    """Create a new environment."""
    environment_id = uuid.uuid4().hex[:12]
    return await db.create_environment(
        environment_id=environment_id,
        universe_id=body.universe_id,
        name=body.name,
        color_grade_json=body.color_grade_json,
        font=body.font,
        text_color=body.text_color,
        text_shadow=body.text_shadow,
        environment_description=body.environment_description,
        themed_descriptions_json=body.themed_descriptions_json,
    )


@router.patch("/{environment_id}")
async def update_environment(environment_id: str, body: EnvironmentUpdate) -> dict:
    """Update an environment's fields."""
    updates = body.model_dump(exclude_none=True)
    if not updates:
        result = await db.get_environment(environment_id)
        if not result:
            raise HTTPException(status_code=404, detail="Environment not found")
        return result
    result = await db.update_environment(environment_id, **updates)
    if not result:
        raise HTTPException(status_code=404, detail="Environment not found")
    return result


@router.delete("/{environment_id}")
async def delete_environment(environment_id: str) -> dict:
    """Delete an environment."""
    deleted = await db.delete_environment(environment_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Environment not found")
    return {"deleted": True}

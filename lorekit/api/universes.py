"""Universe CRUD endpoints."""

from __future__ import annotations

import json
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from lorekit import db

router = APIRouter(prefix="/api/universes", tags=["universes"])


class UniverseCreate(BaseModel):
    name: str
    description: str = ""
    theme: str = ""
    icon: str = ""


class UniverseUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    theme: str | None = None
    icon: str | None = None


@router.get("")
async def list_universes() -> list[dict]:
    """List all universes with character/project counts."""
    return await db.list_universes()


@router.get("/{universe_id}")
async def get_universe(universe_id: str) -> dict:
    """Get a single universe by ID with counts."""
    result = await db.get_universe(universe_id)
    if not result:
        raise HTTPException(status_code=404, detail="Universe not found")
    return result


@router.post("", status_code=201)
async def create_universe(body: UniverseCreate) -> dict:
    """Create a new universe."""
    universe_id = body.name.lower().replace(" ", "_").replace("-", "_")[:32]
    # Ensure uniqueness
    existing = await db.get_universe(universe_id)
    if existing:
        universe_id = f"{universe_id}_{uuid.uuid4().hex[:6]}"
    return await db.create_universe(universe_id, body.name, body.description, body.theme, body.icon)


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
    """Delete a universe and all related data."""
    deleted = await db.delete_universe(universe_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Universe not found")
    return {"deleted": True}


# --- Universe-scoped characters ---

@router.get("/{universe_id}/characters")
async def list_universe_characters(universe_id: str) -> list[dict]:
    """List characters in a universe."""
    uni = await db.get_universe(universe_id)
    if not uni:
        raise HTTPException(status_code=404, detail="Universe not found")
    return await db.list_characters_by_universe(universe_id)


# --- Universe-scoped projects ---

@router.get("/{universe_id}/projects")
async def list_universe_projects(universe_id: str) -> list[dict]:
    """List projects in a universe."""
    uni = await db.get_universe(universe_id)
    if not uni:
        raise HTTPException(status_code=404, detail="Universe not found")
    return await db.list_projects_by_universe(universe_id)


# --- Universe-scoped environments ---

@router.get("/{universe_id}/environments")
async def list_universe_environments(universe_id: str) -> list[dict]:
    """List environments in a universe."""
    return await db.list_environments(universe_id=universe_id)


class EnvironmentCreate(BaseModel):
    name: str
    color_grade: dict | None = None
    font: str = "Cinzel"
    text_color: str = "#FFFFFF"
    text_shadow: str = "warm"
    environment_description: str = ""
    themed_descriptions: dict | None = None


@router.post("/{universe_id}/environments", status_code=201)
async def create_universe_environment(universe_id: str, body: EnvironmentCreate) -> dict:
    """Create an environment in a universe."""
    uni = await db.get_universe(universe_id)
    if not uni:
        raise HTTPException(status_code=404, detail="Universe not found")
    env_id = uuid.uuid4().hex[:12]
    return await db.create_environment(
        environment_id=env_id,
        universe_id=universe_id,
        name=body.name,
        color_grade=body.color_grade,
        font=body.font,
        text_color=body.text_color,
        text_shadow=body.text_shadow,
        environment_description=body.environment_description,
        themed_descriptions=body.themed_descriptions,
    )


class EnvironmentUpdate(BaseModel):
    name: str | None = None
    color_grade: dict | None = None
    font: str | None = None
    text_color: str | None = None
    text_shadow: str | None = None
    environment_description: str | None = None
    themed_descriptions: dict | None = None


@router.patch("/{universe_id}/environments/{environment_id}")
async def update_universe_environment(universe_id: str, environment_id: str, body: EnvironmentUpdate) -> dict:
    """Update an environment."""
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


@router.delete("/{universe_id}/environments/{environment_id}")
async def delete_universe_environment(universe_id: str, environment_id: str) -> dict:
    """Delete an environment."""
    deleted = await db.delete_environment(environment_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Environment not found")
    return {"deleted": True}


# --- Universe-scoped templates ---

@router.get("/{universe_id}/templates")
async def list_universe_templates(universe_id: str) -> list[dict]:
    """List scene templates in a universe."""
    return await db.list_scene_templates(universe_id=universe_id)


class TemplateCreate(BaseModel):
    name: str
    description: str = ""
    beats: list | None = None
    min_duration: float = 30
    max_duration: float = 50
    min_scenes: int = 5
    max_scenes: int = 8


@router.post("/{universe_id}/templates", status_code=201)
async def create_universe_template(universe_id: str, body: TemplateCreate) -> dict:
    """Create a scene template in a universe."""
    uni = await db.get_universe(universe_id)
    if not uni:
        raise HTTPException(status_code=404, detail="Universe not found")
    tmpl_id = uuid.uuid4().hex[:12]
    return await db.create_scene_template(
        template_id=tmpl_id,
        universe_id=universe_id,
        name=body.name,
        description=body.description,
        beats=body.beats,
        min_duration=body.min_duration,
        max_duration=body.max_duration,
        min_scenes=body.min_scenes,
        max_scenes=body.max_scenes,
    )


class TemplateUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    beats: list | None = None
    min_duration: float | None = None
    max_duration: float | None = None
    min_scenes: int | None = None
    max_scenes: int | None = None


@router.patch("/{universe_id}/templates/{template_id}")
async def update_universe_template(universe_id: str, template_id: str, body: TemplateUpdate) -> dict:
    """Update a scene template."""
    updates = body.model_dump(exclude_none=True)
    if not updates:
        result = await db.get_scene_template(template_id)
        if not result:
            raise HTTPException(status_code=404, detail="Template not found")
        return result
    result = await db.update_scene_template(template_id, **updates)
    if not result:
        raise HTTPException(status_code=404, detail="Template not found")
    return result


@router.delete("/{universe_id}/templates/{template_id}")
async def delete_universe_template(universe_id: str, template_id: str) -> dict:
    """Delete a scene template."""
    deleted = await db.delete_scene_template(template_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"deleted": True}

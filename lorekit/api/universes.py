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
    icon: str = ""
    video_vibe_preset: str = "mobile_game"


class UniverseUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    icon: str | None = None
    video_vibe_preset: str | None = None


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


@router.post("")
async def create_universe(body: UniverseCreate) -> dict:
    """Create a new universe."""
    universe_id = uuid.uuid4().hex[:12]
    return await db.create_universe(universe_id, body.name, body.description, body.icon, body.video_vibe_preset)


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


class CharacterCreate(BaseModel):
    name: str
    group_name: str = ""
    era: str = ""
    character_description: str = ""


@router.post("/{universe_id}/characters")
async def create_universe_character(universe_id: str, body: CharacterCreate) -> dict:
    """Create a character in a universe."""
    uni = await db.get_universe(universe_id)
    if not uni:
        raise HTTPException(status_code=404, detail="Universe not found")
    character_id = uuid.uuid4().hex[:12]
    await db.upsert_character(
        character_id=character_id,
        name=body.name,
        group_name=body.group_name,
        era=body.era,
        character_description=body.character_description,
        universe_id=universe_id,
    )
    conn = await db.connect()
    try:
        cursor = await conn.execute("SELECT * FROM characters WHERE id = ?", (character_id,))
        row = await cursor.fetchone()
        return dict(row) if row else {}
    finally:
        await conn.close()


# --- Universe-scoped source items ---

@router.get("/{universe_id}/sources")
async def list_universe_sources(universe_id: str) -> list[dict]:
    """List source items in a universe."""
    uni = await db.get_universe(universe_id)
    if not uni:
        raise HTTPException(status_code=404, detail="Universe not found")
    conn = await db.connect()
    try:
        cursor = await conn.execute(
            "SELECT q.*, c.name as character_name "
            "FROM source_items q JOIN characters c ON q.character_id = c.id "
            "WHERE q.universe_id = ? ORDER BY q.character_id, q.emotional_function",
            (universe_id,),
        )
        return [dict(r) for r in await cursor.fetchall()]
    finally:
        await conn.close()


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
    """List story templates in a universe."""
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

"""Universe CRUD endpoints."""

from __future__ import annotations

import json
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from lorekit import db
from lorekit.auth.user import get_current_user, CurrentUser

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
async def list_universes(user: CurrentUser = Depends(get_current_user)) -> list[dict]:
    """List all universes with character/project counts."""
    return await db.list_universes(org_id=user.org_id)


@router.get("/{universe_id}")
async def get_universe(universe_id: str, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Get a single universe by ID with counts."""
    result = await db.get_universe(universe_id, org_id=user.org_id)
    if not result:
        raise HTTPException(status_code=404, detail="Universe not found")
    return result


@router.post("")
async def create_universe(body: UniverseCreate, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Create a new universe."""
    universe_id = uuid.uuid4().hex[:12]
    return await db.create_universe(
        universe_id, body.name, body.description, body.icon, body.video_vibe_preset,
        organization_id=user.org_id, created_by=user.id,
    )


@router.patch("/{universe_id}")
async def update_universe(universe_id: str, body: UniverseUpdate, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Update a universe's fields."""
    # Verify org ownership before any update
    existing = await db.get_universe(universe_id, org_id=user.org_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Universe not found")
    updates = body.model_dump(exclude_none=True)
    if not updates:
        return existing
    result = await db.update_universe(universe_id, **updates)
    if not result:
        raise HTTPException(status_code=404, detail="Universe not found")
    return result


@router.delete("/{universe_id}")
async def delete_universe(universe_id: str, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Delete a universe and all related data."""
    # Verify org access before deleting
    uni = await db.get_universe(universe_id, org_id=user.org_id)
    if not uni:
        raise HTTPException(status_code=404, detail="Universe not found")
    # Delete associated files (all projects + characters in this universe)
    from lorekit.storage import get_file_store
    store = get_file_store()
    pool = await db.get_pool()
    # Delete project files
    projects = await pool.fetch("SELECT id FROM universe_projects WHERE universe_id = $1", universe_id)
    for p in projects:
        await store.delete_prefix(f"projects/{p['id']}")
    # Delete character files
    chars = await pool.fetch("SELECT id FROM characters WHERE universe_id = $1", universe_id)
    for c in chars:
        await store.delete_prefix(f"characters/{c['id']}")
    # Delete DB records
    deleted = await db.delete_universe(universe_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Universe not found")
    return {"deleted": True}


# --- Universe-scoped characters ---

@router.get("/{universe_id}/characters")
async def list_universe_characters(universe_id: str, user: CurrentUser = Depends(get_current_user)) -> list[dict]:
    """List characters in a universe."""
    uni = await db.get_universe(universe_id, org_id=user.org_id)
    if not uni:
        raise HTTPException(status_code=404, detail="Universe not found")
    return await db.list_characters_by_universe(universe_id)


class CharacterCreate(BaseModel):
    name: str
    group_name: str = ""
    era: str = ""
    character_description: str = ""


@router.post("/{universe_id}/characters")
async def create_universe_character(universe_id: str, body: CharacterCreate, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Create a character in a universe."""
    uni = await db.get_universe(universe_id, org_id=user.org_id)
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
    pool = await db.get_pool()
    row = await pool.fetchrow("SELECT * FROM characters WHERE id = $1", character_id)
    return dict(row) if row else {}


# --- Universe-scoped source items ---

@router.get("/{universe_id}/sources")
async def list_universe_sources(universe_id: str, user: CurrentUser = Depends(get_current_user)) -> list[dict]:
    """List source items in a universe."""
    uni = await db.get_universe(universe_id, org_id=user.org_id)
    if not uni:
        raise HTTPException(status_code=404, detail="Universe not found")
    pool = await db.get_pool()
    rows = await pool.fetch(
        "SELECT q.*, c.name as character_name "
        "FROM source_items q JOIN characters c ON q.character_id = c.id "
        "WHERE q.universe_id = $1 ORDER BY q.character_id, q.emotional_function",
        universe_id,
    )
    return [dict(r) for r in rows]


# --- Universe-scoped projects ---

@router.get("/{universe_id}/projects")
async def list_universe_projects(universe_id: str, user: CurrentUser = Depends(get_current_user)) -> list[dict]:
    """List projects in a universe."""
    uni = await db.get_universe(universe_id, org_id=user.org_id)
    if not uni:
        raise HTTPException(status_code=404, detail="Universe not found")
    return await db.list_projects_by_universe(universe_id)


# --- Universe-scoped environments ---

@router.get("/{universe_id}/environments")
async def list_universe_environments(universe_id: str, user: CurrentUser = Depends(get_current_user)) -> list[dict]:
    """List environments in a universe."""
    uni = await db.get_universe(universe_id, org_id=user.org_id)
    if not uni:
        raise HTTPException(status_code=404, detail="Universe not found")
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
async def create_universe_environment(universe_id: str, body: EnvironmentCreate, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Create an environment in a universe."""
    uni = await db.get_universe(universe_id, org_id=user.org_id)
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
async def update_universe_environment(universe_id: str, environment_id: str, body: EnvironmentUpdate, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Update an environment."""
    # Verify org owns this universe before updating its environment
    uni = await db.get_universe(universe_id, org_id=user.org_id)
    if not uni:
        raise HTTPException(status_code=404, detail="Environment not found")
    # Verify environment belongs to this universe
    env = await db.get_environment(environment_id)
    if not env or env["universe_id"] != universe_id:
        raise HTTPException(status_code=404, detail="Environment not found")
    updates = body.model_dump(exclude_none=True)
    if not updates:
        return env
    result = await db.update_environment(environment_id, **updates)
    if not result:
        raise HTTPException(status_code=404, detail="Environment not found")
    return result


@router.delete("/{universe_id}/environments/{environment_id}")
async def delete_universe_environment(universe_id: str, environment_id: str, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Delete an environment."""
    uni = await db.get_universe(universe_id, org_id=user.org_id)
    if not uni:
        raise HTTPException(status_code=404, detail="Environment not found")
    # Verify environment belongs to this universe
    env = await db.get_environment(environment_id)
    if not env or env["universe_id"] != universe_id:
        raise HTTPException(status_code=404, detail="Environment not found")
    deleted = await db.delete_environment(environment_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Environment not found")
    return {"deleted": True}


# --- Universe-scoped templates ---

@router.get("/{universe_id}/templates")
async def list_universe_templates(universe_id: str, user: CurrentUser = Depends(get_current_user)) -> list[dict]:
    """List story templates in a universe."""
    uni = await db.get_universe(universe_id, org_id=user.org_id)
    if not uni:
        raise HTTPException(status_code=404, detail="Universe not found")
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
async def create_universe_template(universe_id: str, body: TemplateCreate, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Create a scene template in a universe."""
    uni = await db.get_universe(universe_id, org_id=user.org_id)
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
async def update_universe_template(universe_id: str, template_id: str, body: TemplateUpdate, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Update a scene template."""
    # Verify org owns this universe before updating its template
    uni = await db.get_universe(universe_id, org_id=user.org_id)
    if not uni:
        raise HTTPException(status_code=404, detail="Template not found")
    # Verify template belongs to this universe
    tmpl = await db.get_scene_template(template_id)
    if not tmpl or tmpl["universe_id"] != universe_id:
        raise HTTPException(status_code=404, detail="Template not found")
    updates = body.model_dump(exclude_none=True)
    if not updates:
        return tmpl
    result = await db.update_scene_template(template_id, **updates)
    if not result:
        raise HTTPException(status_code=404, detail="Template not found")
    return result


@router.delete("/{universe_id}/templates/{template_id}")
async def delete_universe_template(universe_id: str, template_id: str, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Delete a scene template."""
    uni = await db.get_universe(universe_id, org_id=user.org_id)
    if not uni:
        raise HTTPException(status_code=404, detail="Template not found")
    # Verify template belongs to this universe
    tmpl = await db.get_scene_template(template_id)
    if not tmpl or tmpl["universe_id"] != universe_id:
        raise HTTPException(status_code=404, detail="Template not found")
    deleted = await db.delete_scene_template(template_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"deleted": True}

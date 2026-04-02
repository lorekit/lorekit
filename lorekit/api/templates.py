"""Story template CRUD endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from lorekit import db
from lorekit.auth.user import get_current_user, CurrentUser

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


async def _verify_template_access(template_id: str, user: CurrentUser) -> dict:
    """Get a template and verify the user's org owns its universe."""
    tmpl = await db.get_scene_template(template_id)
    if not tmpl:
        raise HTTPException(status_code=404, detail="Scene template not found")
    uni = await db.get_universe(tmpl["universe_id"], org_id=user.org_id)
    if not uni:
        raise HTTPException(status_code=404, detail="Scene template not found")
    return tmpl


@router.get("")
async def list_scene_templates(
    universe_id: str | None = Query(None),
    user: CurrentUser = Depends(get_current_user),
) -> list[dict]:
    """List scene templates, optionally filtered by universe_id."""
    if universe_id:
        uni = await db.get_universe(universe_id, org_id=user.org_id)
        if not uni:
            return []
        return await db.list_scene_templates(universe_id=universe_id)
    return []


@router.get("/{template_id}")
async def get_scene_template(template_id: str, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Get a single scene template by ID."""
    return await _verify_template_access(template_id, user)


@router.post("", status_code=201)
async def create_scene_template(body: SceneTemplateCreate, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Create a new scene template."""
    uni = await db.get_universe(body.universe_id, org_id=user.org_id)
    if not uni:
        raise HTTPException(status_code=404, detail="Universe not found")
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
async def update_scene_template(template_id: str, body: SceneTemplateUpdate, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Update a scene template's fields."""
    await _verify_template_access(template_id, user)
    updates = body.model_dump(exclude_none=True)
    if not updates:
        return await _verify_template_access(template_id, user)
    result = await db.update_scene_template(template_id, **updates)
    if not result:
        raise HTTPException(status_code=404, detail="Scene template not found")
    return result


@router.delete("/{template_id}")
async def delete_scene_template(template_id: str, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Delete a scene template."""
    await _verify_template_access(template_id, user)
    deleted = await db.delete_scene_template(template_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Scene template not found")
    return {"deleted": True}

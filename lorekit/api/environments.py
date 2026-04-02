"""Environment CRUD endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from lorekit import db
from lorekit.auth.user import get_current_user, CurrentUser

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


async def _verify_environment_access(environment_id: str, user: CurrentUser) -> dict:
    """Get an environment and verify the user's org owns its universe."""
    env = await db.get_environment(environment_id)
    if not env:
        raise HTTPException(status_code=404, detail="Environment not found")
    uni = await db.get_universe(env["universe_id"], org_id=user.org_id)
    if not uni:
        raise HTTPException(status_code=404, detail="Environment not found")
    return env


@router.get("")
async def list_environments(
    universe_id: str | None = Query(None),
    user: CurrentUser = Depends(get_current_user),
) -> list[dict]:
    """List environments, optionally filtered by universe_id."""
    if universe_id:
        uni = await db.get_universe(universe_id, org_id=user.org_id)
        if not uni:
            return []
        return await db.list_environments(universe_id=universe_id)
    # No universe_id — return empty (don't leak cross-org data)
    return []


@router.get("/{environment_id}")
async def get_environment(environment_id: str, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Get a single environment by ID."""
    return await _verify_environment_access(environment_id, user)


@router.post("", status_code=201)
async def create_environment(body: EnvironmentCreate, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Create a new environment."""
    uni = await db.get_universe(body.universe_id, org_id=user.org_id)
    if not uni:
        raise HTTPException(status_code=404, detail="Universe not found")
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
async def update_environment(environment_id: str, body: EnvironmentUpdate, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Update an environment's fields."""
    await _verify_environment_access(environment_id, user)
    updates = body.model_dump(exclude_none=True)
    if not updates:
        return await _verify_environment_access(environment_id, user)
    result = await db.update_environment(environment_id, **updates)
    if not result:
        raise HTTPException(status_code=404, detail="Environment not found")
    return result


@router.delete("/{environment_id}")
async def delete_environment(environment_id: str, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Delete an environment."""
    await _verify_environment_access(environment_id, user)
    deleted = await db.delete_environment(environment_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Environment not found")
    return {"deleted": True}

"""Project effects endpoints — timeline filters, color grading, etc."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from lorekit import db
from lorekit.auth.user import get_current_user, CurrentUser

router = APIRouter(prefix="/api/projects", tags=["effects"])


class CreateEffect(BaseModel):
    effect_type: str = "color_grade"
    name: str = ""
    start_time: float = 0
    end_time: float | None = None
    sort_order: int = 0
    settings_json: str = "{}"


class UpdateEffect(BaseModel):
    name: str | None = None
    start_time: float | None = None
    end_time: float | None = None
    sort_order: int | None = None
    settings_json: str | None = None
    enabled: int | None = None


@router.get("/{project_id}/effects")
async def list_effects(
    project_id: str,
    user: CurrentUser = Depends(get_current_user),
) -> list[dict]:
    project = await db.get_project(project_id, org_id=user.org_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return await db.get_project_effects(project_id, org_id=user.org_id)


@router.post("/{project_id}/effects")
async def create_effect(
    project_id: str,
    body: CreateEffect,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    project = await db.get_project(project_id, org_id=user.org_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return await db.create_project_effect(
        project_id,
        effect_type=body.effect_type,
        name=body.name,
        settings_json=body.settings_json,
        start_time=body.start_time,
        end_time=body.end_time,
        sort_order=body.sort_order,
        org_id=user.org_id,
    )


@router.patch("/{project_id}/effects/{effect_id}")
async def update_effect(
    project_id: str,
    effect_id: str,
    body: UpdateEffect,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    project = await db.get_project(project_id, org_id=user.org_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    effect = await db.get_project_effect(effect_id, org_id=user.org_id)
    if not effect or effect["project_id"] != project_id:
        raise HTTPException(status_code=404, detail="Effect not found")
    updates = body.model_dump(exclude_none=True)
    if updates:
        await db.update_project_effect(effect_id, org_id=user.org_id, **updates)
    return {**effect, **updates}


@router.delete("/{project_id}/effects/{effect_id}")
async def delete_effect(
    project_id: str,
    effect_id: str,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    project = await db.get_project(project_id, org_id=user.org_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    effect = await db.get_project_effect(effect_id, org_id=user.org_id)
    if not effect or effect["project_id"] != project_id:
        raise HTTPException(status_code=404, detail="Effect not found")
    await db.delete_project_effect(effect_id, org_id=user.org_id)
    return {"deleted": effect_id}

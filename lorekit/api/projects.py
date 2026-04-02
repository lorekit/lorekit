"""Project CRUD endpoints."""

from __future__ import annotations

import json
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from lorekit import db
from lorekit.auth.user import get_current_user, CurrentUser

router = APIRouter(prefix="/api/projects", tags=["projects"])


class ProjectCreate(BaseModel):
    character_id: str
    universe_id: str
    name: str = ""
    hook_quote_id: str | None = None
    truth_quote_id: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    status: str | None = None


def _deserialize_project(row: dict) -> dict:
    """Parse JSON fields in a project row."""
    if row.get("story_json"):
        row["story"] = json.loads(row["story_json"])
    else:
        row["story"] = None
    if row.get("clips_json"):
        row["clips"] = json.loads(row["clips_json"])
    else:
        row["clips"] = []
    # Fall back to character image if project doesn't have one
    return row


@router.get("")
async def list_projects(user: CurrentUser = Depends(get_current_user)) -> list[dict]:
    """List all projects."""
    rows = await db.list_projects(org_id=user.org_id)
    return [_deserialize_project(r) for r in rows]


@router.get("/{project_id}")
async def get_project(project_id: str, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Get project detail."""
    row = await db.get_project(project_id, org_id=user.org_id)
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    project = _deserialize_project(row)

    # Fall back to character image
    if not project.get("character_image_url") and project.get("character_id"):
        pool = await db.get_pool()
        char_row = await pool.fetchrow(
            "SELECT character_image_url FROM characters WHERE id = $1",
            project["character_id"],
        )
        if char_row and char_row["character_image_url"]:
            project["character_image_url"] = char_row["character_image_url"]

    return project


@router.post("", status_code=201)
async def create_project(body: ProjectCreate, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Create a new project."""
    # Verify universe belongs to user's org
    uni = await db.get_universe(body.universe_id, org_id=user.org_id)
    if not uni:
        raise HTTPException(status_code=404, detail="Universe not found")
    # Verify character belongs to this universe
    pool = await db.get_pool()
    char = await pool.fetchrow(
        "SELECT id FROM characters WHERE id = $1 AND universe_id = $2",
        body.character_id, body.universe_id,
    )
    if not char:
        raise HTTPException(status_code=404, detail="Character not found in this universe")
    project_id = uuid.uuid4().hex[:12]
    row = await db.create_project(
        project_id=project_id,
        character_id=body.character_id,
        universe_id=body.universe_id,
        name=body.name,
        hook_quote_id=body.hook_quote_id,
        truth_quote_id=body.truth_quote_id,
    )
    return _deserialize_project(row)


@router.delete("/{project_id}")
async def delete_project(project_id: str, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Delete a project."""
    # Verify org ownership before deleting
    project = await db.get_project(project_id, org_id=user.org_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    # Delete associated files
    from lorekit.storage import get_file_store
    store = get_file_store()
    deleted_files = await store.delete_prefix(f"projects/{project_id}")
    # Delete DB record
    deleted = await db.delete_project(project_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"deleted": True, "files_deleted": deleted_files}


@router.patch("/{project_id}")
async def update_project(project_id: str, body: ProjectUpdate, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Update project name or status."""
    existing = await db.get_project(project_id, org_id=user.org_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Project not found")

    updates = body.model_dump(exclude_none=True)
    if not updates:
        return _deserialize_project(existing)

    row = await db.update_project(project_id, **updates)
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    return _deserialize_project(row)

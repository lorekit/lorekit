"""Project CRUD endpoints."""

from __future__ import annotations

import json
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from philosophywise import db

router = APIRouter(prefix="/api/projects", tags=["projects"])


class ProjectCreate(BaseModel):
    philosopher_id: str
    civilization: str = ""
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
    # Fall back to philosopher's character image if project doesn't have one
    return row


@router.get("")
async def list_projects() -> list[dict]:
    """List all projects."""
    rows = await db.list_projects()
    return [_deserialize_project(r) for r in rows]


@router.get("/{project_id}")
async def get_project(project_id: str) -> dict:
    """Get project detail."""
    row = await db.get_project(project_id)
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    project = _deserialize_project(row)

    # Fall back to philosopher's character image
    if not project.get("character_image_url") and project.get("philosopher_id"):
        conn = await db.connect()
        try:
            cursor = await conn.execute(
                "SELECT character_image_url FROM philosophers WHERE id = ?",
                (project["philosopher_id"],),
            )
            phil_row = await cursor.fetchone()
            if phil_row and phil_row[0]:
                project["character_image_url"] = phil_row[0]
        finally:
            await conn.close()

    return project


@router.post("", status_code=201)
async def create_project(body: ProjectCreate) -> dict:
    """Create a new project."""
    project_id = uuid.uuid4().hex[:12]
    row = await db.create_project(
        project_id=project_id,
        philosopher_id=body.philosopher_id,
        civilization=body.civilization,
        name=body.name,
        hook_quote_id=body.hook_quote_id,
        truth_quote_id=body.truth_quote_id,
    )
    return _deserialize_project(row)


@router.delete("/{project_id}")
async def delete_project(project_id: str) -> dict:
    """Delete a project."""
    deleted = await db.delete_project(project_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"deleted": True}


@router.patch("/{project_id}")
async def update_project(project_id: str, body: ProjectUpdate) -> dict:
    """Update project name or status."""
    existing = await db.get_project(project_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Project not found")

    updates = body.model_dump(exclude_none=True)
    if not updates:
        return _deserialize_project(existing)

    row = await db.update_project(project_id, **updates)
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    return _deserialize_project(row)

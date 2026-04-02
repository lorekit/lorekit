"""Job status polling endpoint."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException

from lorekit import db
from lorekit.auth.user import get_current_user, CurrentUser

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.get("/{job_id}")
async def get_job_status(job_id: str, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Poll job status. Returns status, progress, message, and result when complete."""
    job = await db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    # Verify org owns the project this job belongs to
    if job.get("project_id"):
        project = await db.get_project(job["project_id"], org_id=user.org_id)
        if not project:
            raise HTTPException(status_code=404, detail="Job not found")

    result = None
    if job.get("result_json"):
        result = json.loads(job["result_json"])

    return {
        "id": job["id"],
        "project_id": job["project_id"],
        "type": job["type"],
        "status": job["status"],
        "progress": job["progress"],
        "message": job["message"],
        "result": result,
        "created_at": job["created_at"],
        "updated_at": job["updated_at"],
    }

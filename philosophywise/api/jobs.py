"""Job status polling endpoint."""

from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException

from philosophywise import db

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.get("/{job_id}")
async def get_job_status(job_id: str) -> dict:
    """Poll job status. Returns status, progress, message, and result when complete."""
    job = await db.get_job(job_id)
    if not job:
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

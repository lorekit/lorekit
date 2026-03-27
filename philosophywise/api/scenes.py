"""Scene endpoints — view and edit individual scenes within a project."""

from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from philosophywise import db
from philosophywise.models import StoryBreakdown

router = APIRouter(prefix="/api/scenes", tags=["scenes"])


class SceneUpdate(BaseModel):
    visual_description: str | None = None
    camera: str | None = None
    text_overlay: str | None = None
    text_attribution: str | None = None
    duration: float | None = None


class ReorderRequest(BaseModel):
    scene_ids: list[int]


@router.get("/{project_id}")
async def get_scenes(project_id: str) -> dict:
    """Get all scenes for a project with clip URLs."""
    project = await db.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not project.get("story_json"):
        return {"scenes": [], "clips": []}

    story = StoryBreakdown.model_validate_json(project["story_json"])
    clips = json.loads(project.get("clips_json") or "[]")
    clip_map = {c["scene_id"]: c["clip_path"] for c in clips}

    scenes = []
    for scene in story.scenes:
        s = scene.model_dump()
        s["clip_path"] = clip_map.get(scene.scene_id)
        scenes.append(s)

    return {"scenes": scenes, "total_duration": story.total_duration}


@router.patch("/{project_id}/{scene_id}")
async def update_scene(project_id: str, scene_id: int, body: SceneUpdate) -> dict:
    """Update a single scene's editable fields."""
    project = await db.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not project.get("story_json"):
        raise HTTPException(status_code=400, detail="No story generated yet")

    story = StoryBreakdown.model_validate_json(project["story_json"])
    scene = next((s for s in story.scenes if s.scene_id == scene_id), None)
    if not scene:
        raise HTTPException(status_code=404, detail=f"Scene {scene_id} not found")

    updates = body.model_dump(exclude_none=True)
    for key, val in updates.items():
        setattr(scene, key, val)

    # Recalculate total duration
    story.total_duration = sum(s.duration for s in story.scenes)

    await db.update_project(project_id, story_json=story.model_dump_json())
    return scene.model_dump()


@router.post("/{project_id}/reorder")
async def reorder_scenes(project_id: str, body: ReorderRequest) -> dict:
    """Reorder scenes within a project."""
    project = await db.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not project.get("story_json"):
        raise HTTPException(status_code=400, detail="No story generated yet")

    story = StoryBreakdown.model_validate_json(project["story_json"])

    scene_map = {s.scene_id: s for s in story.scenes}
    reordered = []
    for new_idx, sid in enumerate(body.scene_ids, start=1):
        if sid not in scene_map:
            raise HTTPException(status_code=400, detail=f"Scene {sid} not found")
        scene = scene_map[sid]
        scene.scene_id = new_idx
        reordered.append(scene)

    story.scenes = reordered
    await db.update_project(project_id, story_json=story.model_dump_json())

    return {"scenes": [s.model_dump() for s in story.scenes]}

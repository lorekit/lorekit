"""Workflow API — CRUD and execution for workflow graphs."""

from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from lorekit import db
from lorekit.auth.user import get_current_user, CurrentUser
from lorekit.workflow.models import Workflow, WorkflowNode
from lorekit.workflow.registry import list_node_types
from lorekit.workflow.templates import list_templates, create_from_template

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/workflow", tags=["workflow"])


# ── Request models ────────────────────────────────────────────────────────

class CreateWorkflowRequest(BaseModel):
    project_id: str
    template: str | None = None
    template_params: dict[str, Any] = {}
    name: str = ""


class AddNodeRequest(BaseModel):
    workflow_id: str
    type: str
    label: str = ""
    params: dict[str, Any] = {}
    inputs: dict[str, str] = {}
    position: dict[str, float] = {}


class UpdateNodeRequest(BaseModel):
    workflow_id: str
    node_id: str
    params: dict[str, Any] | None = None
    label: str | None = None
    inputs: dict[str, str] | None = None
    position: dict[str, float] | None = None


class ConnectRequest(BaseModel):
    workflow_id: str
    from_node: str
    output_key: str
    to_node: str
    input_key: str


class ExecuteRequest(BaseModel):
    workflow_id: str


class RetryNodeRequest(BaseModel):
    workflow_id: str
    node_id: str


# ── Helpers ───────────────────────────────────────────────────────────────

async def _load_workflow(project_id: str, org_id: str | None = None) -> Workflow | None:
    """Load workflow from project's workflow_json column."""
    project = await db.get_project(project_id, org_id=org_id)
    if not project:
        return None
    raw = project.get("workflow_json")
    if not raw:
        return None
    data = json.loads(raw) if isinstance(raw, str) else raw
    return Workflow.model_validate(data)


async def _save_workflow(workflow: Workflow, org_id: str | None = None) -> None:
    """Save workflow to project's workflow_json column."""
    await db.update_project(
        workflow.project_id,
        org_id=org_id,
        workflow_json=workflow.model_dump_json(),
    )


# ── Endpoints ─────────────────────────────────────────────────────────────

@router.post("")
async def create_workflow(body: CreateWorkflowRequest, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Create a new workflow, optionally from a template."""
    project = await db.get_project(body.project_id, org_id=user.org_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if body.template:
        # Auto-populate template params from project data if not provided
        params = dict(body.template_params)
        if "character_image_url" not in params:
            from lorekit.api.character import get_character_image_url, _load_ref_urls
            character_id = project.get("character_id", "")
            theme = project.get("theme")
            if character_id:
                char_img = await get_character_image_url(character_id, theme=theme)
                if char_img:
                    params["character_image_url"] = char_img
                char_refs = await _load_ref_urls(character_id)
                if char_refs:
                    params["character_ref_urls"] = char_refs

        # Only add prompt for templates that need it
        if "prompt" not in params and body.template in ("ugc_reaction", "face_swap_ugc"):
            params["prompt"] = project.get("name", "Generated scene")

        # For from_story template, auto-load scenes from timeline
        if body.template == "from_story" and "scenes" not in params:
            tl_raw = project.get("timeline_json")
            if tl_raw:
                import json as _json
                tl = _json.loads(tl_raw) if isinstance(tl_raw, str) else tl_raw
                tracks = tl.get("tracks", [])
                if tracks:
                    video_track = tracks[0] if isinstance(tracks, list) else tracks.get("video-main", {})
                    items = video_track.get("items", []) if isinstance(video_track, dict) else []
                    params["scenes"] = [
                        {k: item[k] for k in ["scene_id", "beat", "visual_description", "camera", "duration", "text_overlay", "character_present"] if k in item}
                        for item in items
                        if item.get("type") == "scene"
                    ]

        try:
            wf = create_from_template(
                body.template,
                project_id=body.project_id,
                **params,
            )
        except (TypeError, KeyError) as exc:
            raise HTTPException(status_code=400, detail=f"Template error: {exc}")
        if body.name:
            wf.name = body.name

        # Backfill outputs from existing timeline (if clips already generated)
        if body.template == "from_story":
            tl_raw = project.get("timeline_json")
            if tl_raw:
                import json as _json
                tl = _json.loads(tl_raw) if isinstance(tl_raw, str) else tl_raw
                materials = tl.get("materials", {})
                tracks = tl.get("tracks", [])
                video_track = tracks[0] if isinstance(tracks, list) and tracks else {}
                items = video_track.get("items", []) if isinstance(video_track, dict) else []

                for item in items:
                    if item.get("type") != "scene":
                        continue
                    scene_id = item.get("scene_id")

                    # Find matching scene, keyframe, and clip nodes
                    scene_node = None
                    kf_node = None
                    clip_node = None
                    for n in wf.nodes.values():
                        if n.type == "scene" and n.params.get("scene_id") == scene_id:
                            scene_node = n
                        elif n.type == "kontext_keyframe" and n.label.endswith(str(scene_id)):
                            kf_node = n
                        elif n.type == "kling_v3_pro" and n.label.endswith(str(scene_id)):
                            clip_node = n

                    # Populate keyframe output
                    kf_mat_id = item.get("keyframe_material_id")
                    kf_url = None
                    if kf_mat_id and kf_mat_id in materials:
                        mat = materials[kf_mat_id]
                        kf_url = mat.get("url") or mat.get("path")
                    if not kf_url:
                        kf_url = item.get("keyframe_url") or item.get("keyframe_path")

                    if kf_url and kf_node:
                        kf_node.outputs = {"url": kf_url}
                        kf_node.status = "completed"

                    # Populate clip output
                    clip_mat_id = item.get("clip_material_id")
                    clip_url = None
                    if clip_mat_id and clip_mat_id in materials:
                        mat = materials[clip_mat_id]
                        clip_url = mat.get("url") or mat.get("path")
                    if not clip_url:
                        clip_url = item.get("clip_url") or item.get("clip_path")

                    if clip_url and clip_node:
                        clip_node.outputs = {"url": clip_url}
                        clip_node.status = "completed"

                    # Mark scene as completed if it has a clip
                    if clip_url and scene_node:
                        scene_node.outputs = {
                            "keyframe_url": kf_url or "",
                            "clip_url": clip_url,
                        }
                        scene_node.status = "completed"

    else:
        wf = Workflow(project_id=body.project_id, name=body.name)

    await _save_workflow(wf, org_id=user.org_id)
    return wf.model_dump()


@router.get("/templates")
async def get_templates(user: CurrentUser = Depends(get_current_user)) -> dict:
    """List available workflow templates."""
    return {"templates": list_templates()}


@router.get("/node-types")
async def get_node_types(user: CurrentUser = Depends(get_current_user)) -> dict:
    """List all available node types."""
    return {"node_types": list_node_types()}


@router.get("/{project_id}")
async def get_workflow(project_id: str, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Get the workflow for a project."""
    wf = await _load_workflow(project_id, org_id=user.org_id)
    if not wf:
        raise HTTPException(status_code=404, detail="No workflow found for this project")
    return wf.model_dump()


@router.put("/{project_id}")
async def update_workflow_full(project_id: str, body: dict, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Replace the full workflow (used by React Flow to sync graph state)."""
    project = await db.get_project(project_id, org_id=user.org_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    wf = Workflow.model_validate(body)
    wf.project_id = project_id
    await _save_workflow(wf, org_id=user.org_id)
    return wf.model_dump()


@router.post("/node")
async def add_node(body: AddNodeRequest, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Add a node to a workflow."""
    wf = await _load_workflow(body.workflow_id, org_id=user.org_id)
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")

    node = WorkflowNode(
        type=body.type,
        label=body.label,
        params=body.params,
        inputs=body.inputs,
        position=body.position,
    )
    wf.add_node(node)
    await _save_workflow(wf, org_id=user.org_id)
    return {"node_id": node.id, "workflow": wf.model_dump()}


@router.put("/node")
async def update_node(body: UpdateNodeRequest, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Update a node's params, label, inputs, or position."""
    wf = await _load_workflow(body.workflow_id, org_id=user.org_id)
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")

    node = wf.nodes.get(body.node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    if body.params is not None:
        node.params.update(body.params)
    if body.label is not None:
        node.label = body.label
    if body.inputs is not None:
        node.inputs.update(body.inputs)
    if body.position is not None:
        node.position = body.position

    await _save_workflow(wf, org_id=user.org_id)
    return wf.model_dump()


@router.delete("/node/{workflow_id}/{node_id}")
async def delete_node(workflow_id: str, node_id: str, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Remove a node from a workflow."""
    wf = await _load_workflow(workflow_id, org_id=user.org_id)
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")

    wf.remove_node(node_id)
    await _save_workflow(wf, org_id=user.org_id)
    return wf.model_dump()


@router.post("/connect")
async def connect_nodes(body: ConnectRequest, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Connect one node's output to another node's input."""
    wf = await _load_workflow(body.workflow_id, org_id=user.org_id)
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")

    wf.connect(body.from_node, body.output_key, body.to_node, body.input_key)
    await _save_workflow(wf, org_id=user.org_id)
    return wf.model_dump()


@router.post("/execute")
async def execute_workflow_endpoint(body: ExecuteRequest, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Start executing a workflow. Returns immediately — poll for status."""
    wf = await _load_workflow(body.workflow_id, org_id=user.org_id)
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")

    # Create a job for tracking
    job_id = await db.create_job(wf.project_id + "_wf", wf.project_id, "workflow")

    # Execute in background
    from lorekit.tasks import get_task_runner
    runner = get_task_runner()
    await runner.submit(
        _execute_workflow_task,
        task_type="workflow",
        job_id=job_id,
        project_id=wf.project_id,
        org_id=user.org_id,
    )

    return {"job_id": job_id, "workflow_id": wf.id}


@router.post("/retry")
async def retry_node_endpoint(body: RetryNodeRequest, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Retry a failed node. Resets it to pending and re-executes the workflow."""
    wf = await _load_workflow(body.workflow_id, org_id=user.org_id)
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")

    node = wf.nodes.get(body.node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    node.status = "pending"
    node.error = None
    node.outputs = {}
    await _save_workflow(wf, org_id=user.org_id)

    # Re-execute (will skip completed nodes)
    return await execute_workflow_endpoint(
        ExecuteRequest(workflow_id=body.workflow_id), user=user,
    )


# ── Background task ───────────────────────────────────────────────────────

async def _execute_workflow_task(
    job_id: str,
    project_id: str,
    org_id: str | None = None,
) -> None:
    """Background task: execute a workflow."""
    from lorekit.workflow.engine import execute_workflow
    import lorekit.workflow.nodes  # noqa — register executors

    try:
        wf = await _load_workflow(project_id, org_id=org_id)
        if not wf:
            await db.update_job(job_id, status="failed", message="Workflow not found")
            return

        await db.update_job(job_id, status="running", message="Executing workflow...")

        async def save_fn(w: Workflow) -> None:
            await _save_workflow(w, org_id=org_id)
            completed = sum(1 for n in w.nodes.values() if n.status == "completed")
            total = len(w.nodes)
            progress = (completed / total * 100) if total > 0 else 0
            await db.update_job(
                job_id,
                progress=progress,
                message=f"{completed}/{total} nodes completed",
            )

        await execute_workflow(wf, save_fn=save_fn)

        status = "completed" if wf.status == "completed" else "failed"
        await db.update_job(
            job_id,
            status=status,
            progress=100 if status == "completed" else None,
            message=f"Workflow {wf.status}",
        )

    except Exception as exc:
        logger.exception("Workflow execution failed")
        await db.update_job(job_id, status="failed", message=str(exc)[:500])

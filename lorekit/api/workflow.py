"""Workflow API — CRUD and execution for workflow graphs."""

from __future__ import annotations

import json
import logging
import re
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator

from lorekit import db
from lorekit.auth.user import get_current_user, CurrentUser
from lorekit.models import Timeline, SceneItem, Material
from lorekit.workflow.models import Workflow, WorkflowNode
from lorekit.workflow.registry import list_node_types

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/workflow", tags=["workflow"])


# ── Request models ────────────────────────────────────────────────────────

# Input references must be "node_id.outputs.key" format
_INPUT_REF_RE = re.compile(r"^[a-zA-Z0-9_-]+\.outputs\.\w+$")


def _validate_input_refs(v: dict[str, str]) -> dict[str, str]:
    for key, ref in v.items():
        if "." in ref and not _INPUT_REF_RE.match(ref):
            raise ValueError(
                f"Invalid input reference '{ref}' for '{key}'. "
                f"Must be '<node_id>.outputs.<key>' (e.g. 'abc123.outputs.url')"
            )
    return v


class CreateWorkflowRequest(BaseModel):
    project_id: str
    name: str = ""


class AddNodeRequest(BaseModel):
    workflow_id: str
    type: str
    label: str = ""
    params: dict[str, Any] = {}
    inputs: dict[str, str] = {}
    position: dict[str, float] = {}

    @field_validator("inputs")
    @classmethod
    def check_input_refs(cls, v: dict[str, str]) -> dict[str, str]:
        return _validate_input_refs(v)


class UpdateNodeRequest(BaseModel):
    workflow_id: str
    node_id: str
    params: dict[str, Any] | None = None
    label: str | None = None
    inputs: dict[str, str] | None = None
    position: dict[str, float] | None = None

    @field_validator("inputs")
    @classmethod
    def check_input_refs(cls, v: dict[str, str] | None) -> dict[str, str] | None:
        if v is not None:
            _validate_input_refs(v)
        return v


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


NODE_W = 280   # approximate card width in React Flow pixels
NODE_H = 200   # approximate card height
H_GAP  = 120   # horizontal gutter between cards
V_GAP  =  50   # vertical gutter between cards


def _auto_position(wf: Workflow, inputs: dict[str, str]) -> dict[str, float]:
    """Place a new node to the right of its inputs, avoiding all overlaps."""

    # 1. Ideal anchor position
    if inputs:
        source_ids = {ref.split(".")[0] for ref in inputs.values()}
        sources = [wf.nodes[sid] for sid in source_ids if sid in wf.nodes]
    else:
        sources = []

    if sources:
        x = max(s.position.get("x", 0) for s in sources) + NODE_W + H_GAP
        y = sum(s.position.get("y", 0) for s in sources) / len(sources)
    else:
        all_y = [n.position.get("y", 0) for n in wf.nodes.values()]
        x = 0.0
        y = (max(all_y) + NODE_H + V_GAP) if all_y else 0.0

    # 2. Nudge down until no bounding-box overlap
    others = sorted(wf.nodes.values(), key=lambda n: n.position.get("y", 0))
    for _ in range(len(others) + 1):
        if not any(
            abs(n.position.get("x", 0) - x) < NODE_W + H_GAP
            and abs(n.position.get("y", 0) - y) < NODE_H + V_GAP
            for n in others
        ):
            break
        y += NODE_H + V_GAP

    return {"x": float(x), "y": float(y)}


async def _save_workflow(workflow: Workflow, org_id: str | None = None) -> None:
    """Save workflow to project's workflow_json column."""
    await db.update_project(
        workflow.project_id,
        org_id=org_id,
        workflow_json=workflow.model_dump_json(),
    )


def _load_timeline(project: dict) -> Timeline | None:
    """Load Timeline from project row, or None if no timeline exists."""
    raw = project.get("timeline_json")
    if not raw:
        return None
    data = json.loads(raw) if isinstance(raw, str) else raw
    return Timeline.model_validate(data)


async def _link_node_to_scene(
    node: WorkflowNode, project_id: str, org_id: str | None = None,
) -> None:
    """Auto-link a keyframe/video node to the matching SceneItem.

    If scene_id is in node params, links to that specific scene.
    If no scene_id and only one scene exists, links automatically.
    """
    # Only link image/video generation nodes
    is_keyframe = node.type in ("kontext_keyframe", "kontext_edit", "nano_banana")
    is_video = "kling" in node.type or "wan" in node.type or "minimax" in node.type
    if not is_keyframe and not is_video:
        return

    project = await db.get_project(project_id, org_id=org_id)
    if not project:
        return
    timeline = _load_timeline(project)
    if not timeline:
        return

    scenes = [i for i in timeline.get_video_track().items if isinstance(i, SceneItem)]
    scene_id = node.params.get("scene_id")

    # Auto-detect: if no scene_id and only one scene, use it
    if scene_id is None and len(scenes) == 1:
        scene_id = scenes[0].scene_id
        node.params["scene_id"] = scene_id

    if scene_id is None:
        return

    for item in scenes:
        if item.scene_id != scene_id:
            continue
        if is_keyframe:
            item.keyframe_node_id = node.id
        elif is_video:
            item.clip_node_id = node.id
        await db.update_project(
            project_id, org_id=org_id,
            timeline_json=json.dumps(timeline.model_dump()),
        )
        break


# ── Endpoints ─────────────────────────────────────────────────────────────

@router.post("")
async def create_workflow(body: CreateWorkflowRequest, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Create a workflow for a project.

    If the project already has scenes with clips/keyframes, auto-creates
    completed nodes for them so the canvas reflects the current state.
    """
    project = await db.get_project(body.project_id, org_id=user.org_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    wf = Workflow(project_id=body.project_id, name=body.name)
    timeline = _load_timeline(project)

    if timeline:
        scene_items = [i for i in timeline.get_video_track().items if isinstance(i, SceneItem)]
        for idx, s in enumerate(scene_items):
            y = idx * 250

            # Keyframe node
            kf = WorkflowNode(
                type="kontext_keyframe",
                label=f"Scene {s.scene_id}",
                params={"scene_id": s.scene_id},
                position={"x": 100, "y": y},
            )
            kf_mat = timeline.materials.get(s.keyframe_material_id or "")
            if kf_mat and (kf_mat.path or kf_mat.url):
                kf.outputs = {"url": kf_mat.path or kf_mat.url}
                kf.status = "completed"
            wf.add_node(kf)
            s.keyframe_node_id = kf.id

            # Clip node
            clip = WorkflowNode(
                type="kling_v3_pro",
                label=f"Clip {s.scene_id}",
                params={"scene_id": s.scene_id, "duration": s.duration},
                inputs={"start_image": f"{kf.id}.outputs.url"},
                position={"x": 500, "y": y},
            )
            clip_mat = timeline.materials.get(s.clip_material_id or "")
            if clip_mat and (clip_mat.path or clip_mat.url):
                clip.outputs = {"url": clip_mat.path or clip_mat.url}
                clip.status = "completed"
            wf.add_node(clip)
            s.clip_node_id = clip.id

        await db.update_project(
            body.project_id, org_id=user.org_id,
            timeline_json=json.dumps(timeline.model_dump()),
        )

    await _save_workflow(wf, org_id=user.org_id)
    return wf.model_dump()


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


@router.delete("/{project_id}")
async def delete_workflow(project_id: str, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Delete a workflow so it can be rebuilt fresh."""
    project = await db.get_project(project_id, org_id=user.org_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.update_project(project_id, org_id=user.org_id, workflow_json=None)
    return {"ok": True}


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
    """Add a node to a workflow. Auto-links to SceneItem if params include scene_id."""
    wf = await _load_workflow(body.workflow_id, org_id=user.org_id)
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")

    position = body.position
    if not position:
        # Auto-layout: place node in a column based on dependency depth
        position = _auto_position(wf, body.inputs)

    node = WorkflowNode(
        type=body.type,
        label=body.label,
        params=body.params,
        inputs=body.inputs,
        position=position,
    )
    wf.add_node(node)
    await _save_workflow(wf, org_id=user.org_id)

    # Auto-link to timeline scene if node has scene_id
    await _link_node_to_scene(node, body.workflow_id, org_id=user.org_id)

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

    job_id = f"{wf.project_id}_wf_{uuid.uuid4().hex[:8]}"
    await db.create_job(job_id, wf.project_id, "workflow")

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

    return await execute_workflow_endpoint(
        ExecuteRequest(workflow_id=body.workflow_id), user=user,
    )


# ── Workflow → Timeline sync ──────────────────────────────────────────────

async def _sync_workflow_to_timeline(
    wf: Workflow, project_id: str, org_id: str | None = None,
) -> None:
    """After workflow execution, download completed node outputs and create
    Materials on the timeline. Uses stored node IDs on each SceneItem."""
    from lorekit.storage import get_file_store, project_clip_path, project_keyframe_path
    from lorekit.video.generator import _download_clip, _download_image
    from lorekit.config import get_settings

    project = await db.get_project(project_id, org_id=org_id)
    if not project:
        return
    timeline = _load_timeline(project)
    if not timeline:
        return

    store = get_file_store()
    fal_key = get_settings().fal_key
    changed = False

    for item in timeline.get_video_track().items:
        if not isinstance(item, SceneItem):
            continue

        # Sync keyframe — remote URL means new/retried generation to download
        kf_node = wf.nodes.get(item.keyframe_node_id or "")
        if kf_node and kf_node.status == "completed" and kf_node.outputs.get("url"):
            output_url = kf_node.outputs["url"]
            if output_url.startswith("http"):
                try:
                    kf_path = project_keyframe_path(project_id, item.scene_id)
                    await _download_image(output_url, store, kf_path)
                    # Preserve previous generation in history
                    if item.keyframe_material_id:
                        item.keyframe_history.append(item.keyframe_material_id)
                    local_url = f"/files/{kf_path}"
                    mat = Material(type="image", path=kf_path, url=local_url,
                                   name=f"scene_{item.scene_id}_keyframe")
                    timeline.add_material(mat)
                    item.keyframe_material_id = mat.id
                    kf_node.outputs["url"] = local_url
                    changed = True
                except Exception as exc:
                    logger.warning("Failed to download keyframe for scene %d: %s", item.scene_id, exc)

        # Sync clip — remote URL means new/retried generation to download
        clip_node = wf.nodes.get(item.clip_node_id or "")
        if clip_node and clip_node.status == "completed" and clip_node.outputs.get("url"):
            output_url = clip_node.outputs["url"]
            if output_url.startswith("http"):
                try:
                    clip_path = project_clip_path(project_id, item.scene_id)
                    await _download_clip(output_url, store, clip_path, fal_key)
                    local_url = f"/files/{clip_path}"
                    mat = Material(type="video", path=clip_path,
                                   name=f"scene_{item.scene_id}_clip")
                    timeline.add_material(mat)
                    item.clip_material_id = mat.id
                    clip_node.outputs["url"] = local_url
                    changed = True
                except Exception as exc:
                    logger.warning("Failed to download clip for scene %d: %s", item.scene_id, exc)

    if changed:
        await db.update_project(project_id, org_id=org_id,
                                timeline_json=json.dumps(timeline.model_dump()))
        await _save_workflow(wf, org_id=org_id)
        logger.info("Synced workflow outputs to timeline for project %s", project_id)


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
            await db.update_job(job_id, progress=progress,
                                message=f"{completed}/{total} nodes completed")

        await execute_workflow(wf, save_fn=save_fn)
        await _sync_workflow_to_timeline(wf, project_id, org_id)

        status = "completed" if wf.status == "completed" else "failed"
        await db.update_job(
            job_id, status=status,
            progress=100.0 if status == "completed" else 0.0,
            message=f"Workflow {wf.status}",
        )

    except Exception as exc:
        logger.exception("Workflow execution failed")
        await db.update_job(job_id, status="failed", message=str(exc)[:500])

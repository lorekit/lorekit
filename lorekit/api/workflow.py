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
        wf = create_from_template(
            body.template,
            project_id=body.project_id,
            **body.template_params,
        )
        if body.name:
            wf.name = body.name
    else:
        wf = Workflow(project_id=body.project_id, name=body.name)

    await _save_workflow(wf, org_id=user.org_id)
    return wf.model_dump()


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


@router.get("/templates")
async def get_templates(user: CurrentUser = Depends(get_current_user)) -> dict:
    """List available workflow templates."""
    return {"templates": list_templates()}


@router.get("/node-types")
async def get_node_types(user: CurrentUser = Depends(get_current_user)) -> dict:
    """List all available node types."""
    return {"node_types": list_node_types()}


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

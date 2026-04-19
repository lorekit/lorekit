"""Workflow execution engine — runs a DAG of nodes in parallel waves.

The engine:
1. Topologically sorts nodes into dependency layers (waves)
2. Executes each wave in parallel via asyncio.gather
3. Resolves input references from completed upstream outputs
4. Saves progress after each wave
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any, Callable, Awaitable

from lorekit.workflow.models import Workflow, WorkflowNode

logger = logging.getLogger(__name__)

# Type for node executor functions
NodeExecutor = Callable[[WorkflowNode, dict[str, Any]], Awaitable[dict[str, Any]]]

# Registry of executor functions — populated by node modules
_executors: dict[str, NodeExecutor] = {}


def register_executor(node_type: str, executor: NodeExecutor) -> None:
    """Register an executor function for a node type."""
    _executors[node_type] = executor


def get_executor(node_type: str) -> NodeExecutor:
    """Get the executor function for a node type."""
    if node_type not in _executors:
        raise KeyError(f"No executor registered for node type {node_type!r}")
    return _executors[node_type]


def topological_waves(workflow: Workflow) -> list[list[str]]:
    """Sort nodes into dependency waves for parallel execution.

    Returns a list of waves, where each wave is a list of node IDs that
    can execute in parallel (all their dependencies are in earlier waves).
    """
    nodes = workflow.nodes
    if not nodes:
        return []

    # Build dependency map
    deps: dict[str, set[str]] = {}
    for nid in nodes:
        deps[nid] = workflow.get_upstream_ids(nid)

    waves: list[list[str]] = []
    remaining = set(nodes.keys())
    resolved: set[str] = set()

    while remaining:
        # Find nodes whose dependencies are all resolved
        wave = [
            nid for nid in remaining
            if deps[nid].issubset(resolved)
        ]

        if not wave:
            # Circular dependency or broken refs
            unresolved = {
                nid: deps[nid] - resolved
                for nid in remaining
            }
            raise ValueError(f"Circular dependency or missing nodes: {unresolved}")

        waves.append(wave)
        resolved.update(wave)
        remaining -= set(wave)

    return waves


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def execute_node(
    workflow: Workflow,
    node_id: str,
) -> None:
    """Execute a single node — resolve inputs, call executor, store outputs."""
    node = workflow.nodes[node_id]

    if node.status == "completed":
        logger.info("Node %s already completed, skipping", node_id)
        return

    if node.status == "failed":
        logger.info("Node %s previously failed, skipping", node_id)
        return

    node.status = "running"
    node.started_at = _now()
    node.error = None

    try:
        # Resolve all input references from upstream outputs
        completed = workflow.get_completed_nodes()
        resolved_inputs: dict[str, Any] = {}

        for key in list(node.inputs.keys()) + list(node.params.keys()):
            if key in node.inputs:
                resolved_inputs[key] = node.resolve_input(key, completed)
            elif key in node.params:
                resolved_inputs[key] = node.params[key]

        # Also include any params not referenced in inputs
        for key, val in node.params.items():
            if key not in resolved_inputs:
                resolved_inputs[key] = val

        # Inject project_id so executors can look up timeline scene data
        resolved_inputs["_project_id"] = workflow.project_id

        # Get and call the executor
        executor = get_executor(node.type)
        logger.info("Executing node %s (type=%s, label=%s)", node_id, node.type, node.label)

        outputs = await executor(node, resolved_inputs)

        node.outputs = outputs
        node.status = "completed"
        node.completed_at = _now()
        logger.info("Node %s completed: %s", node_id, list(outputs.keys()))

    except Exception as exc:
        node.status = "failed"
        node.error = str(exc)[:500]
        node.completed_at = _now()
        logger.error("Node %s failed: %s", node_id, exc)
        raise


async def execute_workflow(
    workflow: Workflow,
    save_fn: Callable[[Workflow], Awaitable[None]] | None = None,
    on_node_complete: Callable[[Workflow, str], Awaitable[None]] | None = None,
) -> Workflow:
    """Execute all pending nodes in the workflow, respecting dependencies.

    Args:
        workflow: The workflow to execute.
        save_fn: Optional async function to persist workflow state after each wave.
        on_node_complete: Optional callback after each node completes (for progress updates).

    Returns the updated workflow.
    """
    workflow.status = "running"
    workflow.started_at = _now()

    if save_fn:
        await save_fn(workflow)

    try:
        waves = topological_waves(workflow)
        total_nodes = sum(len(w) for w in waves)
        completed_count = 0

        for wave_idx, wave in enumerate(waves):
            # Filter to only pending nodes in this wave
            pending = [nid for nid in wave if workflow.nodes[nid].status == "pending"]

            if not pending:
                completed_count += len(wave)
                continue

            logger.info(
                "Wave %d/%d: executing %d nodes (%s)",
                wave_idx + 1, len(waves), len(pending),
                [workflow.nodes[nid].label or nid for nid in pending],
            )

            # Execute all nodes in this wave in parallel
            tasks = [execute_node(workflow, nid) for nid in pending]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Check for failures
            failures = []
            for nid, result in zip(pending, results):
                if isinstance(result, BaseException):
                    failures.append((nid, result))
                else:
                    completed_count += 1
                    if on_node_complete:
                        await on_node_complete(workflow, nid)

            # Save after each wave
            if save_fn:
                await save_fn(workflow)

            # If any node in this wave failed, mark workflow as partial and stop
            if failures:
                failed_labels = [
                    workflow.nodes[nid].label or nid for nid, _ in failures
                ]
                logger.error("Wave %d had %d failures: %s", wave_idx + 1, len(failures), failed_labels)
                workflow.status = "partial"
                workflow.completed_at = _now()
                if save_fn:
                    await save_fn(workflow)
                return workflow

        workflow.status = "completed"
        workflow.completed_at = _now()

        if save_fn:
            await save_fn(workflow)

        logger.info("Workflow %s completed (%d nodes)", workflow.id, total_nodes)

    except Exception as exc:
        workflow.status = "failed"
        workflow.completed_at = _now()
        logger.error("Workflow %s failed: %s", workflow.id, exc)
        if save_fn:
            await save_fn(workflow)
        raise

    return workflow

"""Workflow graph models — the production plan for generating video assets.

A Workflow is a DAG of WorkflowNodes. Each node represents one operation
(a fal.ai API call or a local ffmpeg/download step). Nodes connect via
input references: a node's input can reference another node's output.

The workflow is the HOW (production plan). The timeline is the WHAT
(final output). When a workflow executes, its outputs populate the
project's timeline as materials.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field


def _new_id() -> str:
    return uuid.uuid4().hex[:12]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class WorkflowNode(BaseModel):
    """A single operation in the workflow DAG."""

    id: str = Field(default_factory=_new_id)
    type: str                              # registry key: "kontext_keyframe", "kling_v3_pro", etc.
    label: str = ""                        # human-readable name for UI
    params: dict[str, Any] = {}            # model-specific parameters (prompt, duration, cfg_scale...)
    inputs: dict[str, str] = {}            # refs to upstream outputs: {"image": "node_abc.outputs.url"}
    outputs: dict[str, Any] = {}           # populated after execution: {"url": "https://..."}
    status: str = "pending"                # pending | running | completed | failed | skipped
    error: str | None = None               # error message if failed
    cost: float = 0.0                      # actual cost after completion
    position: dict[str, float] = {}        # {x, y} for React Flow layout
    created_at: str = Field(default_factory=_now)
    started_at: str | None = None
    completed_at: str | None = None

    def resolve_input(self, key: str, completed_nodes: dict[str, WorkflowNode]) -> Any:
        """Resolve an input reference like 'node_abc.outputs.url' to its actual value."""
        ref = self.inputs.get(key)
        if ref is None:
            return self.params.get(key)

        # Direct value (not a reference)
        if "." not in ref:
            return ref

        parts = ref.split(".", 2)
        if len(parts) < 3:
            return ref

        node_id, section, field = parts
        if section != "outputs":
            return ref

        upstream = completed_nodes.get(node_id)
        if not upstream:
            raise ValueError(f"Input {key}={ref}: upstream node {node_id} not found or not completed")

        value = upstream.outputs.get(field)
        if value is None:
            raise ValueError(f"Input {key}={ref}: upstream node {node_id} has no output '{field}'")

        return value


class Workflow(BaseModel):
    """A directed acyclic graph of operations that produces video assets."""

    id: str = Field(default_factory=_new_id)
    project_id: str = ""
    name: str = ""
    nodes: dict[str, WorkflowNode] = {}
    status: str = "draft"                  # draft | running | completed | failed | partial
    created_at: str = Field(default_factory=_now)
    started_at: str | None = None
    completed_at: str | None = None

    def add_node(self, node: WorkflowNode) -> WorkflowNode:
        """Add a node to the workflow. Returns the node (with its ID)."""
        self.nodes[node.id] = node
        return node

    def remove_node(self, node_id: str) -> None:
        """Remove a node and any references to it from other nodes' inputs."""
        self.nodes.pop(node_id, None)
        # Clean up dangling references
        for node in self.nodes.values():
            to_remove = [k for k, v in node.inputs.items() if v.startswith(f"{node_id}.")]
            for k in to_remove:
                del node.inputs[k]

    def connect(
        self, from_node_id: str, output_key: str, to_node_id: str, input_key: str
    ) -> None:
        """Connect one node's output to another node's input."""
        if from_node_id not in self.nodes:
            raise ValueError(f"Source node {from_node_id} not found")
        if to_node_id not in self.nodes:
            raise ValueError(f"Target node {to_node_id} not found")
        self.nodes[to_node_id].inputs[input_key] = f"{from_node_id}.outputs.{output_key}"

    def get_upstream_ids(self, node_id: str) -> set[str]:
        """Return IDs of all nodes that this node depends on."""
        node = self.nodes.get(node_id)
        if not node:
            return set()
        upstream = set()
        for ref in node.inputs.values():
            if "." in ref:
                upstream_id = ref.split(".")[0]
                if upstream_id in self.nodes:
                    upstream.add(upstream_id)
        return upstream

    def get_completed_nodes(self) -> dict[str, WorkflowNode]:
        """Return all completed nodes (for input resolution)."""
        return {nid: n for nid, n in self.nodes.items() if n.status == "completed"}

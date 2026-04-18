"""Workflow MCP tool functions.

Plain async functions called by @mcp.tool handlers in server.py.
Same pattern as tools.py — no direct mcp import to avoid circular imports.
"""

from __future__ import annotations

import json
from typing import Any

from lorekit.mcp.tools import _request, _fmt


async def workflow_create(project_id: str, name: str = "") -> str:
    return _fmt(await _request("POST", "/api/workflow", json_body={"project_id": project_id, "name": name}))


async def workflow_get(project_id: str) -> str:
    return _fmt(await _request("GET", f"/api/workflow/{project_id}"))


async def workflow_add_node(
    project_id: str, type: str, label: str = "", params: str = "{}", inputs: str = "{}",
) -> str:
    body = {
        "workflow_id": project_id, "type": type, "label": label,
        "params": json.loads(params) if params else {},
        "inputs": json.loads(inputs) if inputs else {},
    }
    return _fmt(await _request("POST", "/api/workflow/node", json_body=body))


async def workflow_update_node(
    project_id: str, node_id: str, params: str | None = None, label: str | None = None, inputs: str | None = None,
) -> str:
    body: dict[str, Any] = {"workflow_id": project_id, "node_id": node_id}
    if params:
        body["params"] = json.loads(params)
    if label:
        body["label"] = label
    if inputs:
        body["inputs"] = json.loads(inputs)
    return _fmt(await _request("PUT", "/api/workflow/node", json_body=body))


async def workflow_remove_node(project_id: str, node_id: str) -> str:
    return _fmt(await _request("DELETE", f"/api/workflow/node/{project_id}/{node_id}"))


async def workflow_connect(
    project_id: str, from_node: str, output_key: str, to_node: str, input_key: str,
) -> str:
    body = {
        "workflow_id": project_id, "from_node": from_node, "output_key": output_key,
        "to_node": to_node, "input_key": input_key,
    }
    return _fmt(await _request("POST", "/api/workflow/connect", json_body=body))


async def workflow_execute(project_id: str) -> str:
    return _fmt(await _request("POST", "/api/workflow/execute", json_body={"workflow_id": project_id}))


async def workflow_retry_node(project_id: str, node_id: str) -> str:
    return _fmt(await _request("POST", "/api/workflow/retry", json_body={"workflow_id": project_id, "node_id": node_id}))


async def workflow_node_types() -> str:
    return _fmt(await _request("GET", "/api/workflow/node-types"))

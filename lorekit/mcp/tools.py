"""Shared MCP tool functions for LoreKit.

All functions use httpx to call the running LoreKit API (localhost:8001 by
default). In cloud mode, the caller's Bearer token is propagated from the
MCP session to ensure API requests execute with the correct user identity
and org scope.

Every function returns a human-readable string suitable for an LLM response.
"""

from __future__ import annotations

import json
import logging
import os
import urllib.parse
from typing import Any

import httpx

logger = logging.getLogger(__name__)

API_URL = os.environ.get("LOREKIT_API_URL", "http://localhost:8001")

# Validate API URL — in cloud mode, refuse to send tokens to non-localhost
_parsed_url = urllib.parse.urlparse(API_URL)
_SAFE_HOSTS = {"localhost", "127.0.0.1", "::1"}
if _parsed_url.hostname not in _SAFE_HOSTS and _parsed_url.hostname is not None:
    if os.environ.get("BETTER_AUTH_SECRET"):
        raise RuntimeError(
            f"SECURITY: LOREKIT_API_URL ({API_URL}) is not localhost. "
            f"Refusing to forward Bearer tokens to external host in cloud mode."
        )
    logger.warning(
        "SECURITY: LOREKIT_API_URL (%s) is not localhost. "
        "Bearer tokens would be sent to this host if auth is enabled.", API_URL,
    )

# Shared client — reused across tool calls
_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(base_url=API_URL, timeout=120.0)
    return _client


def _get_bearer_token() -> str | None:
    """Retrieve the current MCP session's Bearer token for propagation.

    Uses FastMCP's get_access_token() which reads from the request context
    set by the auth middleware after TokenVerifier.verify_token().

    Returns None in open-source mode (no auth) or when called outside
    an MCP request context (e.g., standalone script).
    """
    try:
        from fastmcp.server.dependencies import get_access_token
        token = get_access_token()
        if token is not None:
            return token.token  # raw Bearer token string
    except (RuntimeError, LookupError, ImportError):
        pass  # Not in MCP request context or fastmcp not available
    return None


async def _request(
    method: str, path: str, *, json_body: dict | None = None, params: dict | None = None,
) -> dict | list | str:
    """Make an API request, propagating the MCP caller's auth token."""
    client = _get_client()
    headers: dict[str, str] = {}

    # Forward Bearer token from MCP session to API (cloud mode)
    bearer = _get_bearer_token()
    if bearer:
        headers["Authorization"] = f"Bearer {bearer}"

    try:
        resp = await client.request(method, path, json=json_body, params=params, headers=headers)
        if resp.status_code >= 500:
            logger.error("API returned %s for %s %s", resp.status_code, method, path)
            return "Internal server error. Please try again."
        if resp.status_code == 401:
            return "Authentication failed. Please check your credentials."
        if resp.status_code == 404:
            return "Resource not found."
        if resp.status_code >= 400:
            logger.warning("API returned %s for %s %s", resp.status_code, method, path)
            return f"Request failed (error {resp.status_code})."
        if resp.headers.get("content-type", "").startswith("application/json"):
            return resp.json()
        return resp.text
    except httpx.HTTPError as e:
        return f"HTTP error: {e}"


def _fmt(data: Any) -> str:
    """Format response data as readable string for LLM."""
    if isinstance(data, str):
        return data
    return json.dumps(data, indent=2, default=str)


# ---------------------------------------------------------------------------
# Universes
# ---------------------------------------------------------------------------

async def universe_list() -> str:
    """List all universes."""
    data = await _request("GET", "/api/universes")
    if isinstance(data, list):
        lines = [f"- {u['name']} (id={u['id']}, icon={u.get('icon', '')})" for u in data]
        return f"Found {len(data)} universes:\n" + "\n".join(lines) if lines else "No universes found."
    return _fmt(data)


async def universe_get(universe_id: str) -> str:
    """Get details of a universe."""
    data = await _request("GET", f"/api/universes/{universe_id}")
    return _fmt(data)


async def universe_create(
    name: str,
    description: str = "",
    icon: str = "",
    video_vibe_preset: str = "mobile_game",
) -> str:
    """Create a new universe."""
    data = await _request("POST", "/api/universes", json_body={
        "name": name, "description": description, "icon": icon,
        "video_vibe_preset": video_vibe_preset,
    })
    if isinstance(data, dict) and "id" in data:
        return f"Universe created: {data['name']} (id={data['id']})"
    return _fmt(data)


async def universe_update(universe_id: str, **fields: Any) -> str:
    """Update a universe. Pass only fields to change."""
    data = await _request("PATCH", f"/api/universes/{universe_id}", json_body=fields)
    return _fmt(data)


async def universe_delete(universe_id: str) -> str:
    """Delete a universe and all its contents."""
    data = await _request("DELETE", f"/api/universes/{universe_id}")
    return _fmt(data)


# ---------------------------------------------------------------------------
# Characters
# ---------------------------------------------------------------------------

async def character_list(universe_id: str) -> str:
    """List characters in a universe."""
    data = await _request("GET", f"/api/universes/{universe_id}/characters")
    if isinstance(data, list):
        lines = [f"- {c['name']} (id={c['id']})" for c in data]
        return f"Found {len(data)} characters:\n" + "\n".join(lines) if lines else "No characters."
    return _fmt(data)


async def character_get(character_id: str) -> str:
    """Get character details."""
    data = await _request("GET", f"/api/characters/{character_id}")
    return _fmt(data)


async def character_create(
    universe_id: str,
    name: str,
    group_name: str = "",
    era: str = "",
    character_description: str = "",
) -> str:
    """Create a new character in a universe."""
    data = await _request("POST", f"/api/universes/{universe_id}/characters", json_body={
        "name": name, "group_name": group_name, "era": era,
        "character_description": character_description,
    })
    if isinstance(data, dict) and "id" in data:
        return f"Character created: {data['name']} (id={data['id']})"
    return _fmt(data)


async def character_update(character_id: str, **fields: Any) -> str:
    """Update a character. Pass only fields to change."""
    data = await _request("PATCH", f"/api/characters/{character_id}", json_body=fields)
    return _fmt(data)


# ---------------------------------------------------------------------------
# Character Images
# ---------------------------------------------------------------------------

async def character_image_generate(character_id: str, theme: str = "", custom_description: str = "") -> str:
    """Generate a character portrait image."""
    body: dict[str, Any] = {"character_id": character_id}
    if theme:
        body["theme"] = theme
    if custom_description:
        body["custom_description"] = custom_description
    data = await _request("POST", "/api/character/generate-for-character", json_body=body)
    return _fmt(data)


async def character_image_list(character_id: str) -> str:
    """List all generated images for a character."""
    data = await _request("GET", f"/api/character/images/{character_id}")
    return _fmt(data)


# ---------------------------------------------------------------------------
# Character Reference Images
# ---------------------------------------------------------------------------

async def character_reference_image_upload(character_id: str, url: str) -> str:
    """Upload a reference image for a character from a URL or local file path.

    The reference image anchors the character's visual identity — when
    generating portraits, the system will preserve the likeness of the
    reference while applying the selected video style/theme.
    """
    data = await _request(
        "POST", f"/api/character/reference-images/{character_id}/from-url",
        json_body={"url": url},
    )
    if isinstance(data, dict) and "urls" in data:
        n = len(data["urls"])
        return f"Reference image added. Character now has {n} reference image(s)."
    return _fmt(data)


async def character_reference_image_list(character_id: str) -> str:
    """List all reference images for a character."""
    data = await _request("GET", f"/api/character/reference-images/{character_id}")
    if isinstance(data, dict) and "urls" in data:
        urls = data["urls"]
        if not urls:
            return "No reference images for this character."
        lines = [f"- {u}" for u in urls]
        return f"Found {len(urls)} reference image(s):\n" + "\n".join(lines)
    return _fmt(data)


async def character_reference_image_delete(character_id: str, url: str) -> str:
    """Delete a reference image from a character."""
    data = await _request(
        "DELETE", f"/api/character/reference-images/{character_id}",
        json_body={"url": url},
    )
    if isinstance(data, dict) and "urls" in data:
        n = len(data["urls"])
        return f"Reference image removed. Character now has {n} reference image(s)."
    return _fmt(data)


# ---------------------------------------------------------------------------
# Source Items
# ---------------------------------------------------------------------------

async def source_list(universe_id: str, character_id: str | None = None) -> str:
    """List source items in a universe, optionally filtered by character."""
    params: dict[str, str] = {}
    if character_id:
        params["character"] = character_id
    data = await _request("GET", f"/api/universes/{universe_id}/sources", params=params)
    if isinstance(data, list):
        lines = [f"- [{s.get('emotional_function', '?')}] {s['text'][:80]}... (id={s['id']})" for s in data]
        return f"Found {len(data)} sources:\n" + "\n".join(lines) if lines else "No source items."
    return _fmt(data)


async def source_create(
    character_id: str,
    text: str,
    theme: str,
    emotional_function: str = "truth",
) -> str:
    """Create a new source item for a character."""
    data = await _request("POST", "/api/sources", json_body={
        "character_id": character_id, "text": text, "theme": theme,
        "emotional_function": emotional_function,
    })
    if isinstance(data, dict) and "id" in data:
        return f"Source created (id={data['id']}, function={emotional_function})"
    return _fmt(data)


async def source_update(item_id: str, **fields: Any) -> str:
    """Update a source item."""
    data = await _request("PATCH", f"/api/sources/{item_id}", json_body=fields)
    return _fmt(data)


async def source_delete(item_id: str) -> str:
    """Delete a source item."""
    data = await _request("DELETE", f"/api/sources/{item_id}")
    return _fmt(data)


# ---------------------------------------------------------------------------
# Scripts
# ---------------------------------------------------------------------------

async def script_list(universe_id: str) -> str:
    """List scripts in a universe."""
    data = await _request("GET", f"/api/universes/{universe_id}/scripts")
    if isinstance(data, list):
        lines = [f"- {s['title']} (id={s['id']}, type={s.get('script_type', '?')})" for s in data]
        return f"Found {len(data)} scripts:\n" + "\n".join(lines) if lines else "No scripts."
    return _fmt(data)


async def script_create(
    universe_id: str,
    title: str,
    content: str = "",
    script_type: str = "short",
    character_ids: list[str] | None = None,
    target_duration_seconds: int | None = None,
    scene_count: int | None = None,
) -> str:
    """Create a new script."""
    body: dict[str, Any] = {"title": title, "content": content, "script_type": script_type}
    if character_ids:
        body["character_ids"] = character_ids
    if target_duration_seconds is not None:
        body["target_duration_seconds"] = target_duration_seconds
    if scene_count is not None:
        body["scene_count"] = scene_count
    data = await _request("POST", f"/api/universes/{universe_id}/scripts", json_body=body)
    if isinstance(data, dict) and "id" in data:
        return f"Script created: {data.get('title', '')} (id={data['id']})"
    return _fmt(data)


async def script_get(universe_id: str, script_id: str) -> str:
    """Get a script's full content."""
    data = await _request("GET", f"/api/universes/{universe_id}/scripts/{script_id}")
    return _fmt(data)


async def script_update(universe_id: str, script_id: str, **fields: Any) -> str:
    """Update a script."""
    data = await _request("PATCH", f"/api/universes/{universe_id}/scripts/{script_id}", json_body=fields)
    return _fmt(data)


async def script_delete(universe_id: str, script_id: str) -> str:
    """Delete a script."""
    data = await _request("DELETE", f"/api/universes/{universe_id}/scripts/{script_id}")
    return _fmt(data)


# ---------------------------------------------------------------------------
# Environments
# ---------------------------------------------------------------------------

async def environment_list(universe_id: str) -> str:
    """List environments in a universe."""
    data = await _request("GET", f"/api/universes/{universe_id}/environments")
    if isinstance(data, list):
        lines = [f"- {e['name']} (id={e['id']})" for e in data]
        return f"Found {len(data)} environments:\n" + "\n".join(lines) if lines else "No environments."
    return _fmt(data)


async def environment_create(universe_id: str, name: str, **fields: Any) -> str:
    """Create a new environment."""
    body = {"name": name, **fields}
    data = await _request("POST", f"/api/universes/{universe_id}/environments", json_body=body)
    if isinstance(data, dict) and "id" in data:
        return f"Environment created: {data['name']} (id={data['id']})"
    return _fmt(data)


async def environment_update(universe_id: str, environment_id: str, **fields: Any) -> str:
    """Update an environment."""
    data = await _request(
        "PATCH", f"/api/universes/{universe_id}/environments/{environment_id}", json_body=fields,
    )
    return _fmt(data)


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------

async def project_list(universe_id: str | None = None) -> str:
    """List projects, optionally filtered by universe."""
    if universe_id:
        data = await _request("GET", f"/api/universes/{universe_id}/projects")
    else:
        data = await _request("GET", "/api/projects")
    if isinstance(data, list):
        lines = [
            f"- {p.get('name', '?')} (id={p['id']}, status={p.get('status', '?')})"
            for p in data
        ]
        return f"Found {len(data)} projects:\n" + "\n".join(lines) if lines else "No projects."
    return _fmt(data)


async def project_get(project_id: str) -> str:
    """Get full project details including story and clips."""
    data = await _request("GET", f"/api/projects/{project_id}")
    return _fmt(data)


async def project_delete(project_id: str) -> str:
    """Delete a project and its files."""
    data = await _request("DELETE", f"/api/projects/{project_id}")
    return _fmt(data)


# ---------------------------------------------------------------------------
# Generation Pipeline
# ---------------------------------------------------------------------------

async def generate_story(
    character_id: str,
    universe_id: str,
    target_duration: int = 35,
    theme: str | None = None,
    arc_template: str | None = None,
    aspect_ratio: str = "9:16",
    quote_ids: list[str] | None = None,
) -> str:
    """Generate a story breakdown for a new video project.

    Returns the project_id and story structure. This is the first step in
    creating a video — it generates the scene-by-scene story using the LLM.
    """
    body: dict[str, Any] = {
        "character_id": character_id,
        "universe_id": universe_id,
        "target_duration": target_duration,
        "aspect_ratio": aspect_ratio,
    }
    if theme:
        body["theme"] = theme
    if arc_template:
        body["arc_template"] = arc_template
    if quote_ids:
        body["quote_ids"] = quote_ids
    data = await _request("POST", "/api/generate/story", json_body=body)
    if isinstance(data, dict) and "project_id" in data:
        story = data.get("story", {})
        scenes = story.get("scenes", [])
        return (
            f"Story generated! Project ID: {data['project_id']}\n"
            f"Title: {story.get('title', '')}\n"
            f"Scenes: {len(scenes)}\n"
            + "\n".join(f"  {s['scene_id']}. [{s.get('beat', '')}] {s.get('visual_description', '')[:100]}" for s in scenes)
        )
    return _fmt(data)


async def generate_clips(project_id: str) -> str:
    """Start generating video clips for all scenes in a project.

    Returns a job_id for tracking progress. Poll with job_status().
    """
    data = await _request("POST", "/api/generate/clips", json_body={"project_id": project_id})
    if isinstance(data, dict) and "job_id" in data:
        return f"Clips generation started. Job ID: {data['job_id']}\nPoll status with job_status('{data['job_id']}')"
    return _fmt(data)


async def generate_clip(project_id: str, scene_id: int) -> str:
    """Regenerate a single scene's video clip."""
    data = await _request("POST", "/api/generate/clip", json_body={
        "project_id": project_id, "scene_id": scene_id,
    })
    if isinstance(data, dict) and "job_id" in data:
        return f"Single clip generation started for scene {scene_id}. Job ID: {data['job_id']}"
    return _fmt(data)


async def generate_keyframe(project_id: str, scene_id: int) -> str:
    """Generate a preview keyframe image for a scene (faster than full video)."""
    data = await _request("POST", "/api/generate/keyframe", json_body={
        "project_id": project_id, "scene_id": scene_id,
    })
    if isinstance(data, dict) and "job_id" in data:
        return f"Keyframe generation started for scene {scene_id}. Job ID: {data['job_id']}"
    return _fmt(data)


async def generate_render(
    project_id: str,
    raw: bool = False,
    text_overlays: bool = True,
    color_grade: bool = True,
    audio: bool = True,
) -> str:
    """Assemble the final video from generated clips.

    Set raw=True for a quick concat without effects.
    """
    data = await _request("POST", "/api/generate/render", json_body={
        "project_id": project_id, "raw": raw,
        "text_overlays": text_overlays, "color_grade": color_grade, "audio": audio,
    })
    if isinstance(data, dict) and "job_id" in data:
        return f"Render started. Job ID: {data['job_id']}\nPoll status with job_status('{data['job_id']}')"
    return _fmt(data)


async def job_status(job_id: str) -> str:
    """Check the status of a background job (clips, render, keyframe)."""
    data = await _request("GET", f"/api/jobs/{job_id}")
    if isinstance(data, dict):
        status = data.get("status", "unknown")
        progress = data.get("progress", 0)
        message = data.get("message", "")
        result = f"Job {job_id}: {status} ({progress:.0f}%)"
        if message:
            result += f" — {message}"
        return result
    return _fmt(data)


# ---------------------------------------------------------------------------
# Scenes (edit individual scenes within a project)
# ---------------------------------------------------------------------------

async def scene_list(project_id: str) -> str:
    """List all scenes in a project."""
    data = await _request("GET", f"/api/scenes/{project_id}")
    return _fmt(data)


async def scene_update(project_id: str, scene_id: int, **fields: Any) -> str:
    """Update a scene's properties (visual_description, camera, duration, etc)."""
    data = await _request("PATCH", f"/api/scenes/{project_id}/{scene_id}", json_body=fields)
    return _fmt(data)


# ---------------------------------------------------------------------------
# Documents
# ---------------------------------------------------------------------------

async def document_list(universe_id: str, character_id: str) -> str:
    """List documents for a character."""
    data = await _request("GET", f"/api/universes/{universe_id}/characters/{character_id}/documents/")
    if isinstance(data, list):
        lines = [f"- {d.get('name', '?')} (id={d['id']}, type={d.get('doc_type', '?')})" for d in data]
        return f"Found {len(data)} documents:\n" + "\n".join(lines) if lines else "No documents."
    return _fmt(data)


async def document_create(
    universe_id: str, character_id: str, name: str, content: str, doc_type: str = "text",
) -> str:
    """Create a document for a character (used as source material)."""
    data = await _request(
        "POST", f"/api/universes/{universe_id}/characters/{character_id}/documents/",
        json_body={"name": name, "content": content, "doc_type": doc_type},
    )
    if isinstance(data, dict) and "id" in data:
        return f"Document created: {data.get('name', '')} (id={data['id']})"
    return _fmt(data)


async def document_process(universe_id: str, character_id: str, document_id: str) -> str:
    """Process a document — extract source items and generate embeddings."""
    data = await _request(
        "POST", f"/api/universes/{universe_id}/characters/{character_id}/documents/{document_id}/process",
    )
    return _fmt(data)


# ---------------------------------------------------------------------------
# Voices
# ---------------------------------------------------------------------------

async def voice_get(universe_id: str, character_id: str) -> str:
    """Get voice settings for a character."""
    data = await _request("GET", f"/api/universes/{universe_id}/characters/{character_id}/voice")
    return _fmt(data)


async def voice_set(
    universe_id: str, character_id: str,
    tts_model: str | None = None,
    voice_id: str | None = None,
    voice_name: str | None = None,
) -> str:
    """Set voice settings for a character."""
    body: dict[str, Any] = {}
    if tts_model:
        body["tts_model"] = tts_model
    if voice_id:
        body["voice_id"] = voice_id
    if voice_name:
        body["voice_name"] = voice_name
    data = await _request("PUT", f"/api/universes/{universe_id}/characters/{character_id}/voice", json_body=body)
    return _fmt(data)


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

async def settings_get() -> str:
    """Get current LoreKit settings (API keys masked)."""
    data = await _request("GET", "/api/settings")
    return _fmt(data)


async def vibe_presets() -> str:
    """List available video vibe presets (visual styles)."""
    data = await _request("GET", "/api/settings/vibe-presets")
    return _fmt(data)


async def arc_templates() -> str:
    """List available story arc templates."""
    data = await _request("GET", "/api/settings/arc-templates")
    return _fmt(data)


async def tts_models() -> str:
    """List available text-to-speech models."""
    data = await _request("GET", "/api/tts-models")
    return _fmt(data)

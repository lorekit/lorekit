"""Settings endpoints — view and update configuration.

Open-source mode: Users manage their own API keys via .env.
Cloud mode: Platform manages API keys. Settings endpoint is read-only
for non-admin users and API key fields are hidden entirely.
"""

from __future__ import annotations

import os
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from lorekit.auth.user import get_current_user, CurrentUser
from lorekit.config import get_settings
from lorekit import db

router = APIRouter(prefix="/api/settings", tags=["settings"])


def _redact(key: str) -> str:
    """Show only last 4 chars of API keys."""
    if not key:
        return ""
    if len(key) <= 4:
        return "****"
    return "****" + key[-4:]


def _is_cloud_mode() -> bool:
    """Check if running in cloud mode (Better Auth configured)."""
    return bool(os.environ.get("BETTER_AUTH_SECRET"))


class SettingsUpdate(BaseModel):
    anthropic_api_key: str | None = None
    openai_api_key: str | None = None
    fal_key: str | None = None
    llm_provider: str | None = None
    llm_model: str | None = None


@router.get("")
async def get_current_settings(user: CurrentUser = Depends(get_current_user)) -> dict:
    """Return current config.

    Open-source: shows redacted API keys so users know what's configured.
    Cloud: hides API keys entirely (platform-managed).
    """
    s = get_settings()
    result: dict = {
        "llm_provider": s.llm_provider,
        "llm_model": s.llm_model,
    }
    # Only expose API key status in self-hosted mode
    if not _is_cloud_mode():
        result["openai_api_key"] = _redact(s.openai_api_key)
        result["anthropic_api_key"] = _redact(s.anthropic_api_key)
        result["fal_key"] = _redact(s.fal_key)
    return result


@router.get("/vibe-presets")
async def get_vibe_presets(user: CurrentUser = Depends(get_current_user)) -> dict:
    """Return available vibe presets from DB. Seeds built-in styles on first call."""
    await db.seed_builtin_video_styles()
    styles = await db.list_video_styles(organization_id=user.org_id)
    # Return in legacy format for backward compat + new list format
    presets = {}
    for s in styles:
        presets[s["id"]] = {
            "name": s["name"],
            "description": s["description"],
            "prompt": s["prompt"],
            "character_prompt": s.get("character_prompt", ""),
            "is_builtin": bool(s.get("is_builtin")),
        }
    return {"presets": presets, "styles": styles}


# --- Video Style CRUD ---


class VideoStyleCreate(BaseModel):
    name: str
    description: str = ""
    prompt: str
    character_prompt: str = ""
    image_model: str = "kontext"  # "kontext" or "nano_banana_2"


class VideoStyleUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    prompt: str | None = None
    character_prompt: str | None = None
    image_model: str | None = None


@router.get("/video-styles")
async def list_video_styles(user: CurrentUser = Depends(get_current_user)) -> dict:
    """List all video styles (built-in + custom)."""
    await db.seed_builtin_video_styles()
    styles = await db.list_video_styles(organization_id=user.org_id)
    return {"styles": styles}


@router.post("/video-styles")
async def create_video_style(body: VideoStyleCreate, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Create a custom video style."""
    style_id = uuid.uuid4().hex[:12]
    style = await db.create_video_style(
        style_id=style_id,
        name=body.name,
        description=body.description,
        prompt=body.prompt,
        character_prompt=body.character_prompt,
        image_model=body.image_model,
        is_builtin=0,
        organization_id=user.org_id or "local",
    )
    return style


@router.patch("/video-styles/{style_id}")
async def update_video_style(style_id: str, body: VideoStyleUpdate, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Update a custom video style. Built-in styles cannot be edited."""
    existing = await db.get_video_style(style_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Style not found")
    if existing.get("is_builtin"):
        raise HTTPException(status_code=403, detail="Built-in styles cannot be edited. Duplicate to create a custom variant.")
    updates = body.model_dump(exclude_none=True)
    if not updates:
        return existing
    result = await db.update_video_style(style_id, **updates)
    return result or existing


@router.delete("/video-styles/{style_id}")
async def delete_video_style(style_id: str, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Delete a custom video style. Built-in styles cannot be deleted."""
    existing = await db.get_video_style(style_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Style not found")
    if existing.get("is_builtin"):
        raise HTTPException(status_code=403, detail="Built-in styles cannot be deleted")
    deleted = await db.delete_video_style(style_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Style not found")
    return {"deleted": True}


@router.post("/video-styles/{style_id}/duplicate")
async def duplicate_video_style(style_id: str, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Duplicate a video style (built-in or custom) to create a new custom variant."""
    existing = await db.get_video_style(style_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Style not found")
    new_id = uuid.uuid4().hex[:12]
    style = await db.create_video_style(
        style_id=new_id,
        name=f"{existing['name']} (Copy)",
        description=existing.get("description", ""),
        prompt=existing.get("prompt", ""),
        character_prompt=existing.get("character_prompt", ""),
        is_builtin=0,
        organization_id=user.org_id or "local",
    )
    return style


# --- Arc Template CRUD ---


class ArcTemplateCreate(BaseModel):
    name: str
    description: str = ""
    beats_json: str = "[]"
    optional_beats_json: str = "[]"
    min_duration: float = 30
    max_duration: float = 50
    min_scenes: int = 5
    max_scenes: int = 8
    max_scene_duration: float = 8
    system_prompt_fragment: str = ""


class ArcTemplateUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    beats_json: str | None = None
    optional_beats_json: str | None = None
    min_duration: float | None = None
    max_duration: float | None = None
    min_scenes: int | None = None
    max_scenes: int | None = None
    max_scene_duration: float | None = None
    system_prompt_fragment: str | None = None


@router.get("/arc-templates")
async def get_arc_templates(user: CurrentUser = Depends(get_current_user)) -> dict:
    """Return available arc templates (built-in + custom). Seeds builtins on first call."""
    await db.seed_builtin_arc_templates()
    templates = await db.list_arc_templates(organization_id=user.org_id)
    # Return both the legacy dict format and the full list
    result = {}
    for t in templates:
        result[t["id"]] = {
            "id": t["id"],
            "name": t["name"],
            "description": t.get("description", ""),
            "min_duration": t.get("min_duration", 30),
            "max_duration": t.get("max_duration", 50),
            "min_scenes": t.get("min_scenes", 5),
            "max_scenes": t.get("max_scenes", 8),
            "is_builtin": bool(t.get("is_builtin")),
        }
    return {"templates": result}


@router.post("/arc-templates")
async def create_arc_template(body: ArcTemplateCreate, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Create a custom arc template."""
    template_id = uuid.uuid4().hex[:12]
    template = await db.create_arc_template(
        template_id=template_id,
        name=body.name,
        description=body.description,
        beats_json=body.beats_json,
        optional_beats_json=body.optional_beats_json,
        min_duration=body.min_duration,
        max_duration=body.max_duration,
        min_scenes=body.min_scenes,
        max_scenes=body.max_scenes,
        max_scene_duration=body.max_scene_duration,
        system_prompt_fragment=body.system_prompt_fragment,
        is_builtin=0,
        organization_id=user.org_id or "local",
    )
    return template


@router.patch("/arc-templates/{template_id}")
async def update_arc_template(template_id: str, body: ArcTemplateUpdate, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Update a custom arc template. Built-in templates cannot be edited."""
    existing = await db.get_arc_template_db(template_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Template not found")
    if existing.get("is_builtin"):
        raise HTTPException(status_code=403, detail="Built-in templates cannot be edited. Duplicate to create a custom variant.")
    updates = body.model_dump(exclude_none=True)
    if not updates:
        return existing
    result = await db.update_arc_template(template_id, **updates)
    return result or existing


@router.delete("/arc-templates/{template_id}")
async def delete_arc_template(template_id: str, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Delete a custom arc template. Built-in templates cannot be deleted."""
    existing = await db.get_arc_template_db(template_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Template not found")
    if existing.get("is_builtin"):
        raise HTTPException(status_code=403, detail="Built-in templates cannot be deleted")
    deleted = await db.delete_arc_template(template_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"deleted": True}


@router.post("/arc-templates/{template_id}/duplicate")
async def duplicate_arc_template(template_id: str, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Duplicate an arc template (built-in or custom) to create a new custom variant."""
    existing = await db.get_arc_template_db(template_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Template not found")
    new_id = uuid.uuid4().hex[:12]
    template = await db.create_arc_template(
        template_id=new_id,
        name=f"{existing['name']} (Copy)",
        description=existing.get("description", ""),
        beats_json=existing.get("beats_json", "[]"),
        optional_beats_json=existing.get("optional_beats_json", "[]"),
        min_duration=existing.get("min_duration", 30),
        max_duration=existing.get("max_duration", 50),
        min_scenes=existing.get("min_scenes", 5),
        max_scenes=existing.get("max_scenes", 8),
        max_scene_duration=existing.get("max_scene_duration", 8),
        system_prompt_fragment=existing.get("system_prompt_fragment", ""),
        is_builtin=0,
        organization_id=user.org_id or "local",
    )
    return template


# --- Story Context Presets CRUD ---


class ContextPresetCreate(BaseModel):
    name: str
    context: str
    description: str = ""
    category: str = "general"


@router.get("/context-presets")
async def list_context_presets(user: CurrentUser = Depends(get_current_user), category: str | None = None) -> dict:
    """List story context presets (built-in + custom). Optionally filter by category."""
    await db.seed_builtin_context_presets()
    presets = await db.list_story_context_presets(organization_id=user.org_id, category=category)
    return {"presets": presets}


@router.post("/context-presets")
async def create_context_preset(body: ContextPresetCreate, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Create a custom story context preset."""
    preset_id = uuid.uuid4().hex[:12]
    return await db.create_story_context_preset(
        preset_id=preset_id,
        name=body.name,
        context=body.context,
        description=body.description,
        category=body.category,
        is_builtin=0,
        organization_id=user.org_id or "local",
    )


@router.delete("/context-presets/{preset_id}")
async def delete_context_preset(preset_id: str, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Delete a custom context preset. Built-in presets cannot be deleted."""
    deleted = await db.delete_story_context_preset(preset_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Preset not found or is built-in")
    return {"deleted": True}


@router.patch("")
async def update_settings(body: SettingsUpdate, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Update settings. Writes to .env file for persistence.

    Open-source: owner/admin can update API keys and LLM config.
    Cloud: API key changes are blocked (platform-managed). LLM config may
    be allowed for admins in the future.
    """
    if user.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    # In cloud mode, block API key changes — platform manages keys
    if _is_cloud_mode():
        if body.anthropic_api_key or body.openai_api_key or body.fal_key:
            raise HTTPException(
                status_code=403,
                detail="API keys are managed by the platform in cloud mode",
            )

    from pathlib import Path

    env_path = Path(".env")
    env_lines: dict[str, str] = {}

    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env_lines[k.strip()] = v.strip()

    updates = body.model_dump(exclude_none=True)

    # Sanitize — reject characters that could inject additional env vars
    for field, value in updates.items():
        if isinstance(value, str) and any(c in value for c in ("\n", "\r", "\0")):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid characters in field '{field}'",
            )

    field_to_env = {
        "anthropic_api_key": "ANTHROPIC_API_KEY",
        "openai_api_key": "OPENAI_API_KEY",
        "fal_key": "FAL_KEY",
        "llm_provider": "LLM_PROVIDER",
        "llm_model": "LLM_MODEL",
    }

    for field, value in updates.items():
        env_key = field_to_env.get(field, field.upper())
        env_lines[env_key] = value

    content = "\n".join(f"{k}={v}" for k, v in sorted(env_lines.items()))
    env_path.write_text(content + "\n")

    return {"updated": list(updates.keys())}

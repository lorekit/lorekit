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
from lorekit.config import VIBE_PRESETS, get_settings
from lorekit import db
from lorekit.story.templates import ARC_TEMPLATES

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


@router.get("/arc-templates")
async def get_arc_templates(user: CurrentUser = Depends(get_current_user)) -> dict:
    """Return available arc (video format) templates."""
    return {
        "templates": {
            tid: {
                "id": t.id,
                "name": t.name,
                "description": t.description,
                "min_duration": t.min_duration,
                "max_duration": t.max_duration,
                "min_scenes": t.min_scenes,
                "max_scenes": t.max_scenes,
            }
            for tid, t in ARC_TEMPLATES.items()
        }
    }


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

"""Settings endpoints — view and update configuration."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from lorekit.config import VIBE_PRESETS, get_settings
from lorekit.story.templates import ARC_TEMPLATES

router = APIRouter(prefix="/api/settings", tags=["settings"])


def _redact(key: str) -> str:
    """Show only last 4 chars of API keys."""
    if not key:
        return ""
    if len(key) <= 4:
        return "****"
    return "****" + key[-4:]


class SettingsUpdate(BaseModel):
    anthropic_api_key: str | None = None
    openai_api_key: str | None = None
    fal_key: str | None = None
    llm_provider: str | None = None
    llm_model: str | None = None
    video_vibe: str | None = None
    video_vibe_preset: str | None = None


@router.get("")
async def get_current_settings() -> dict:
    """Return current config with redacted API keys."""
    s = get_settings()
    return {
        "anthropic_api_key": _redact(s.anthropic_api_key),
        "openai_api_key": _redact(s.openai_api_key),
        "fal_key": _redact(s.fal_key),
        "llm_provider": s.llm_provider,
        "llm_model": s.llm_model,
        "db_path": str(s.db_path),
        "output_dir": str(s.output_dir),
        "clips_dir": str(s.clips_dir),
        "video_vibe": s.video_vibe,
        "video_vibe_preset": s.video_vibe_preset,
    }


@router.get("/vibe-presets")
async def get_vibe_presets() -> dict:
    """Return available vibe presets."""
    return {"presets": VIBE_PRESETS}


@router.get("/arc-templates")
async def get_arc_templates() -> dict:
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
async def update_settings(body: SettingsUpdate) -> dict:
    """Update settings. Writes to .env file for persistence."""
    from pathlib import Path

    env_path = Path(".env")
    env_lines: dict[str, str] = {}

    # Read existing .env
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env_lines[k.strip()] = v.strip()

    # Apply updates
    updates = body.model_dump(exclude_none=True)

    # When a non-custom preset is selected, also update video_vibe to its prompt
    if "video_vibe_preset" in updates:
        preset_key = updates["video_vibe_preset"]
        if preset_key != "custom" and preset_key in VIBE_PRESETS:
            updates["video_vibe"] = VIBE_PRESETS[preset_key]["prompt"]

    field_to_env = {
        "anthropic_api_key": "ANTHROPIC_API_KEY",
        "openai_api_key": "OPENAI_API_KEY",
        "fal_key": "FAL_KEY",
        "llm_provider": "LLM_PROVIDER",
        "llm_model": "LLM_MODEL",
        "video_vibe": "VIDEO_VIBE",
        "video_vibe_preset": "VIDEO_VIBE_PRESET",
    }

    for field, value in updates.items():
        env_key = field_to_env.get(field, field.upper())
        env_lines[env_key] = value

    # Write .env
    content = "\n".join(f"{k}={v}" for k, v in sorted(env_lines.items()))
    env_path.write_text(content + "\n")

    # Clear settings cache by creating fresh instance
    # (pydantic-settings re-reads .env on next get_settings() call)

    return {"updated": list(updates.keys())}

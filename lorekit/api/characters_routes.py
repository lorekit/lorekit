"""Character endpoints."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from lorekit import db
from lorekit.auth.user import get_current_user, CurrentUser

router = APIRouter(prefix="/api/characters", tags=["characters"])
legacy_router = APIRouter(prefix="/api/philosophers", tags=["characters"])


class CharacterUpdate(BaseModel):
    name: str | None = None
    era: str | None = None
    group: str | None = None
    character_description: str | None = None
    character_styles_json: dict[str, dict] | None = None  # per-theme: {"theme": {"description": "...", "image_url": "...", ...}}


@router.get("")
async def list_characters(user: CurrentUser = Depends(get_current_user)) -> list[dict]:
    """List all characters with source item counts."""
    pool = await db.get_pool()
    rows = await pool.fetch(
        """SELECT p.id, p.name, p.group_name, p.era, p.character_description, p.character_image_url, p.character_styles_json, p.character_ref_urls,
                  COUNT(q.id) as quote_count,
                  SUM(CASE WHEN q.emotional_function = 'hook' THEN 1 ELSE 0 END) as hook_count,
                  SUM(CASE WHEN q.emotional_function = 'truth' THEN 1 ELSE 0 END) as truth_count,
                  SUM(CASE WHEN q.emotional_function = 'conflict' THEN 1 ELSE 0 END) as conflict_count
           FROM characters p
           JOIN universes u ON p.universe_id = u.id
           LEFT JOIN source_items q ON p.id = q.character_id
           WHERE u.organization_id = $1
           GROUP BY p.id
           ORDER BY p.group_name, p.name""",
        user.org_id,
    )
    return [dict(r) for r in rows]


@router.get("/{character_id}")
async def get_character(character_id: str, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Get character detail with source item breakdown."""
    pool = await db.get_pool()
    row = await pool.fetchrow(
        """SELECT characters.* FROM characters
           JOIN universes u ON characters.universe_id = u.id
           WHERE characters.id = $1 AND u.organization_id = $2""",
        character_id, user.org_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Character not found")

    char = dict(row)

    # Get source items grouped by function
    quotes = await pool.fetch(
        """SELECT id, text, short_version, theme, emotional_function,
                  word_count, read_time_seconds, pair_with_visual, used_count
           FROM source_items WHERE character_id = $1
           ORDER BY emotional_function, used_count ASC""",
        character_id,
    )
    char["quotes"] = [dict(r) for r in quotes]
    return char


@router.patch("/{character_id}")
async def update_character(character_id: str, body: CharacterUpdate, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Update character fields."""
    ALLOWED_COLUMNS = {"name", "era", "group_name", "character_description", "character_styles_json"}

    pool = await db.get_pool()
    row = await pool.fetchrow(
        """SELECT characters.* FROM characters
           JOIN universes u ON characters.universe_id = u.id
           WHERE characters.id = $1 AND u.organization_id = $2""",
        character_id, user.org_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Character not found")

    updates = body.model_dump(exclude_none=True)
    if not updates:
        return dict(row)

    # Map 'group' field to 'group_name' column
    if "group" in updates:
        updates["group_name"] = updates.pop("group")

    # Serialize JSON fields
    if "character_styles_json" in updates:
        updates["character_styles_json"] = json.dumps(updates["character_styles_json"])

    # Validate column names against allowlist to prevent SQL injection
    for col in updates:
        if col not in ALLOWED_COLUMNS:
            raise HTTPException(status_code=400, detail=f"Invalid field: {col}")

    sets = ", ".join(f"{k} = ${i}" for i, k in enumerate(updates, 1))
    params = list(updates.values()) + [character_id, user.org_id]
    await pool.execute(
        f"""UPDATE characters SET {sets}
            FROM universes u
            WHERE characters.universe_id = u.id
              AND characters.id = ${len(params) - 1}
              AND u.organization_id = ${len(params)}""",
        *params,
    )

    updated = await pool.fetchrow(
        """SELECT characters.* FROM characters
           JOIN universes u ON characters.universe_id = u.id
           WHERE characters.id = $1 AND u.organization_id = $2""",
        character_id, user.org_id,
    )
    return dict(updated)


# --- Backward-compatible legacy router (delegates to same handlers) ---

@legacy_router.get("")
async def list_characters_legacy(user: CurrentUser = Depends(get_current_user)) -> list[dict]:
    """Legacy endpoint: list all characters."""
    return await list_characters(user=user)


@legacy_router.get("/{character_id}")
async def get_character_legacy(character_id: str, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Legacy endpoint: get character detail."""
    return await get_character(character_id, user=user)


@legacy_router.patch("/{character_id}")
async def update_character_legacy(character_id: str, body: CharacterUpdate, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Legacy endpoint: update character."""
    return await update_character(character_id, body, user=user)

"""Character endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from lorekit import db

router = APIRouter(prefix="/api/characters", tags=["characters"])
legacy_router = APIRouter(prefix="/api/philosophers", tags=["characters"])


class CharacterUpdate(BaseModel):
    name: str | None = None
    era: str | None = None
    group: str | None = None
    character_description: str | None = None


@router.get("")
async def list_characters() -> list[dict]:
    """List all characters with source item counts."""
    conn = await db.connect()
    try:
        cursor = await conn.execute(
            """SELECT p.id, p.name, p.group_name, p.era, p.character_description, p.character_image_url, p.character_ref_urls,
                      COUNT(q.id) as quote_count,
                      SUM(CASE WHEN q.emotional_function = 'hook' THEN 1 ELSE 0 END) as hook_count,
                      SUM(CASE WHEN q.emotional_function = 'truth' THEN 1 ELSE 0 END) as truth_count,
                      SUM(CASE WHEN q.emotional_function = 'conflict' THEN 1 ELSE 0 END) as conflict_count
               FROM characters p
               LEFT JOIN source_items q ON p.id = q.character_id
               GROUP BY p.id
               ORDER BY p.group_name, p.name"""
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        await conn.close()


@router.get("/{character_id}")
async def get_character(character_id: str) -> dict:
    """Get character detail with source item breakdown."""
    conn = await db.connect()
    try:
        cursor = await conn.execute(
            "SELECT * FROM characters WHERE id = ?", (character_id,)
        )
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Character not found")

        char = dict(row)

        # Get source items grouped by function
        cursor = await conn.execute(
            """SELECT id, text, short_version, theme, emotional_function,
                      word_count, read_time_seconds, pair_with_visual, used_count
               FROM source_items WHERE character_id = ?
               ORDER BY emotional_function, used_count ASC""",
            (character_id,),
        )
        char["quotes"] = [dict(r) for r in await cursor.fetchall()]
        return char
    finally:
        await conn.close()


@router.patch("/{character_id}")
async def update_character(character_id: str, body: CharacterUpdate) -> dict:
    """Update character fields."""
    conn = await db.connect()
    try:
        cursor = await conn.execute(
            "SELECT * FROM characters WHERE id = ?", (character_id,)
        )
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Character not found")

        updates = body.model_dump(exclude_none=True)
        if not updates:
            return dict(row)

        # Map 'group' field to 'group_name' column
        if "group" in updates:
            updates["group_name"] = updates.pop("group")

        sets = ", ".join(f"{k} = ?" for k in updates)
        params = list(updates.values()) + [character_id]
        await conn.execute(
            f"UPDATE characters SET {sets} WHERE id = ?", params
        )
        await conn.commit()

        cursor = await conn.execute(
            "SELECT * FROM characters WHERE id = ?", (character_id,)
        )
        return dict(await cursor.fetchone())
    finally:
        await conn.close()


# --- Backward-compatible legacy router (delegates to same handlers) ---

@legacy_router.get("")
async def list_characters_legacy() -> list[dict]:
    """Legacy endpoint: list all characters."""
    return await list_characters()


@legacy_router.get("/{character_id}")
async def get_character_legacy(character_id: str) -> dict:
    """Legacy endpoint: get character detail."""
    return await get_character(character_id)


@legacy_router.patch("/{character_id}")
async def update_character_legacy(character_id: str, body: CharacterUpdate) -> dict:
    """Legacy endpoint: update character."""
    return await update_character(character_id, body)

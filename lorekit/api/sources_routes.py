"""Source item endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from lorekit import db
from lorekit.auth.user import get_current_user, CurrentUser

router = APIRouter(prefix="/api/sources", tags=["sources"])


class SourceItemCreate(BaseModel):
    character_id: str
    text: str
    theme: str
    emotional_function: str


class SourceItemUpdate(BaseModel):
    text: str | None = None
    theme: str | None = None
    emotional_function: str | None = None
    pair_with_visual: str | None = None


@router.get("")
async def list_source_items(
    character: str | None = Query(None),
    function: str | None = Query(None, alias="function"),
    limit: int = Query(50, ge=1, le=500),
    user: CurrentUser = Depends(get_current_user),
) -> list[dict]:
    """List source items with optional filters."""
    pool = await db.get_pool()
    sql = (
        "SELECT q.*, p.name as character_name "
        "FROM source_items q "
        "JOIN characters p ON q.character_id = p.id "
        "JOIN universes u ON q.universe_id = u.id "
        "WHERE u.organization_id = $1"
    )
    params: list = [user.org_id]
    param_idx = 2
    if character:
        sql += f" AND q.character_id = ${param_idx}"
        params.append(character)
        param_idx += 1
    if function:
        sql += f" AND q.emotional_function = ${param_idx}"
        params.append(function)
        param_idx += 1
    sql += f" ORDER BY q.character_id, q.emotional_function, q.used_count ASC LIMIT ${param_idx}"
    params.append(limit)
    rows = await pool.fetch(sql, *params)
    return [dict(r) for r in rows]


@router.get("/stats")
async def source_item_stats(user: CurrentUser = Depends(get_current_user)) -> dict:
    """Per-character source item usage stats."""
    pool = await db.get_pool()
    rows = await pool.fetch(
        """SELECT p.id, p.name, p.group_name,
                  COUNT(q.id) as total_quotes,
                  COALESCE(SUM(q.used_count), 0) as total_uses,
                  COALESCE(AVG(q.used_count), 0) as avg_uses,
                  SUM(CASE WHEN q.emotional_function = 'hook' THEN 1 ELSE 0 END) as hooks,
                  SUM(CASE WHEN q.emotional_function = 'truth' THEN 1 ELSE 0 END) as truths
           FROM characters p
           JOIN universes u ON p.universe_id = u.id
           LEFT JOIN source_items q ON p.id = q.character_id
           WHERE u.organization_id = $1
           GROUP BY p.id
           ORDER BY total_uses DESC""",
        user.org_id,
    )
    return {"characters": [dict(r) for r in rows]}


@router.post("")
async def create_source_item(body: SourceItemCreate, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Create a new source item."""
    pool = await db.get_pool()
    # Verify character exists and belongs to user's org
    char_row = await pool.fetchrow(
        """SELECT c.id, c.universe_id FROM characters c
           JOIN universes u ON c.universe_id = u.id
           WHERE c.id = $1 AND u.organization_id = $2""",
        body.character_id, user.org_id,
    )
    if not char_row:
        raise HTTPException(status_code=404, detail="Character not found")

    item_id = uuid.uuid4().hex[:12]
    word_count = len(body.text.split())
    read_time_seconds = round(word_count / 2.5, 2)

    await pool.execute(
        """INSERT INTO source_items
           (id, character_id, universe_id, text, theme, emotional_function,
            word_count, read_time_seconds, pair_with_visual, used_count)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '', 0)""",
        item_id, body.character_id, char_row["universe_id"], body.text, body.theme,
        body.emotional_function, word_count, read_time_seconds,
    )

    row = await pool.fetchrow("SELECT * FROM source_items WHERE id = $1", item_id)
    return dict(row)


@router.patch("/{item_id}")
async def update_source_item(item_id: str, body: SourceItemUpdate, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Update a source item's fields."""
    pool = await db.get_pool()
    # Verify source item belongs to user's org
    row = await pool.fetchrow(
        """SELECT q.* FROM source_items q
           JOIN universes u ON q.universe_id = u.id
           WHERE q.id = $1 AND u.organization_id = $2""",
        item_id, user.org_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Source item not found")

    ALLOWED_COLUMNS = {"text", "theme", "emotional_function", "pair_with_visual"}
    updates = {
        k: v for k, v in body.model_dump(exclude_none=True).items()
        if k in ALLOWED_COLUMNS
    }
    if not updates:
        return dict(row)

    # Recalculate word_count and read_time if text changed
    if "text" in updates:
        word_count = len(updates["text"].split())
        updates["word_count"] = word_count
        updates["read_time_seconds"] = round(word_count / 2.5, 2)

    sets = ", ".join(f"{k} = ${i}" for i, k in enumerate(updates, 1))
    params = list(updates.values()) + [item_id]
    await pool.execute(f"UPDATE source_items SET {sets} WHERE id = ${len(params)}", *params)

    updated = await pool.fetchrow("SELECT * FROM source_items WHERE id = $1", item_id)
    return dict(updated)


@router.delete("/{item_id}")
async def delete_source_item(item_id: str, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Delete a source item."""
    pool = await db.get_pool()
    # Verify source item belongs to user's org before deleting
    row = await pool.fetchrow(
        """SELECT q.id FROM source_items q
           JOIN universes u ON q.universe_id = u.id
           WHERE q.id = $1 AND u.organization_id = $2""",
        item_id, user.org_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Source item not found")
    await pool.execute("DELETE FROM source_items WHERE id = $1", item_id)
    return {"deleted": True}

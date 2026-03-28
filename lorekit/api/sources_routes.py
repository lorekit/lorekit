"""Source item endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from lorekit import db

router = APIRouter(prefix="/api/sources", tags=["sources"])
legacy_router = APIRouter(prefix="/api/quotes", tags=["sources"])


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
) -> list[dict]:
    """List source items with optional filters."""
    conn = await db.connect()
    try:
        sql = (
            "SELECT q.*, p.name as character_name "
            "FROM source_items q JOIN characters p ON q.character_id = p.id WHERE 1=1"
        )
        params: list = []
        if character:
            sql += " AND q.character_id = ?"
            params.append(character)
        if function:
            sql += " AND q.emotional_function = ?"
            params.append(function)
        sql += " ORDER BY q.character_id, q.emotional_function, q.used_count ASC LIMIT ?"
        params.append(limit)
        cursor = await conn.execute(sql, params)
        return [dict(r) for r in await cursor.fetchall()]
    finally:
        await conn.close()


@router.get("/stats")
async def source_item_stats() -> dict:
    """Per-character source item usage stats."""
    conn = await db.connect()
    try:
        cursor = await conn.execute(
            """SELECT p.id, p.name, p.group_name,
                      COUNT(q.id) as total_quotes,
                      COALESCE(SUM(q.used_count), 0) as total_uses,
                      COALESCE(AVG(q.used_count), 0) as avg_uses,
                      SUM(CASE WHEN q.emotional_function = 'hook' THEN 1 ELSE 0 END) as hooks,
                      SUM(CASE WHEN q.emotional_function = 'truth' THEN 1 ELSE 0 END) as truths
               FROM characters p
               LEFT JOIN source_items q ON p.id = q.character_id
               GROUP BY p.id
               ORDER BY total_uses DESC"""
        )
        rows = [dict(r) for r in await cursor.fetchall()]
        return {"characters": rows}
    finally:
        await conn.close()


@router.post("")
async def create_source_item(body: SourceItemCreate) -> dict:
    """Create a new source item."""
    conn = await db.connect()
    try:
        # Verify character exists
        cursor = await conn.execute(
            "SELECT id FROM characters WHERE id = ?", (body.character_id,)
        )
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail="Character not found")

        item_id = uuid.uuid4().hex[:12]
        word_count = len(body.text.split())
        read_time_seconds = round(word_count / 2.5, 2)

        await conn.execute(
            """INSERT INTO source_items
               (id, character_id, text, theme, emotional_function,
                word_count, read_time_seconds, pair_with_visual, used_count)
               VALUES (?, ?, ?, ?, ?, ?, ?, '', 0)""",
            (item_id, body.character_id, body.text, body.theme,
             body.emotional_function, word_count, read_time_seconds),
        )
        await conn.commit()

        cursor = await conn.execute("SELECT * FROM source_items WHERE id = ?", (item_id,))
        return dict(await cursor.fetchone())
    finally:
        await conn.close()


@router.patch("/{item_id}")
async def update_source_item(item_id: str, body: SourceItemUpdate) -> dict:
    """Update a source item's fields."""
    conn = await db.connect()
    try:
        cursor = await conn.execute("SELECT * FROM source_items WHERE id = ?", (item_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Source item not found")

        updates = body.model_dump(exclude_none=True)
        if not updates:
            return dict(row)

        # Recalculate word_count and read_time if text changed
        if "text" in updates:
            word_count = len(updates["text"].split())
            updates["word_count"] = word_count
            updates["read_time_seconds"] = round(word_count / 2.5, 2)

        sets = ", ".join(f"{k} = ?" for k in updates)
        params = list(updates.values()) + [item_id]
        await conn.execute(f"UPDATE source_items SET {sets} WHERE id = ?", params)
        await conn.commit()

        cursor = await conn.execute("SELECT * FROM source_items WHERE id = ?", (item_id,))
        return dict(await cursor.fetchone())
    finally:
        await conn.close()


@router.delete("/{item_id}")
async def delete_source_item(item_id: str) -> dict:
    """Delete a source item."""
    conn = await db.connect()
    try:
        cursor = await conn.execute("DELETE FROM source_items WHERE id = ?", (item_id,))
        await conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Source item not found")
        return {"deleted": True}
    finally:
        await conn.close()


# --- Backward-compatible legacy router (delegates to same handlers) ---

@legacy_router.get("")
async def list_source_items_legacy(
    philosopher: str | None = Query(None),
    function: str | None = Query(None, alias="function"),
    limit: int = Query(50, ge=1, le=500),
) -> list[dict]:
    """Legacy endpoint: list source items."""
    return await list_source_items(character=philosopher, function=function, limit=limit)


@legacy_router.get("/stats")
async def source_item_stats_legacy() -> dict:
    """Legacy endpoint: source item stats."""
    return await source_item_stats()


@legacy_router.post("")
async def create_source_item_legacy(body: SourceItemCreate) -> dict:
    """Legacy endpoint: create source item."""
    return await create_source_item(body)


@legacy_router.patch("/{item_id}")
async def update_source_item_legacy(item_id: str, body: SourceItemUpdate) -> dict:
    """Legacy endpoint: update source item."""
    return await update_source_item(item_id, body)


@legacy_router.delete("/{item_id}")
async def delete_source_item_legacy(item_id: str) -> dict:
    """Legacy endpoint: delete source item."""
    return await delete_source_item(item_id)

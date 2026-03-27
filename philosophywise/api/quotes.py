"""Quote endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from philosophywise import db

router = APIRouter(prefix="/api/quotes", tags=["quotes"])


class QuoteCreate(BaseModel):
    philosopher_id: str
    text: str
    theme: str
    emotional_function: str


class QuoteUpdate(BaseModel):
    text: str | None = None
    theme: str | None = None
    emotional_function: str | None = None
    pair_with_visual: str | None = None


@router.get("")
async def list_quotes(
    philosopher: str | None = Query(None),
    function: str | None = Query(None, alias="function"),
    limit: int = Query(50, ge=1, le=500),
) -> list[dict]:
    """List quotes with optional filters."""
    conn = await db.connect()
    try:
        sql = (
            "SELECT q.*, p.name as philosopher_name "
            "FROM quotes q JOIN philosophers p ON q.philosopher_id = p.id WHERE 1=1"
        )
        params: list = []
        if philosopher:
            sql += " AND q.philosopher_id = ?"
            params.append(philosopher)
        if function:
            sql += " AND q.emotional_function = ?"
            params.append(function)
        sql += " ORDER BY q.philosopher_id, q.emotional_function, q.used_count ASC LIMIT ?"
        params.append(limit)
        cursor = await conn.execute(sql, params)
        return [dict(r) for r in await cursor.fetchall()]
    finally:
        await conn.close()


@router.get("/stats")
async def quote_stats() -> dict:
    """Per-philosopher quote usage stats."""
    conn = await db.connect()
    try:
        cursor = await conn.execute(
            """SELECT p.id, p.name, p.civilization,
                      COUNT(q.id) as total_quotes,
                      COALESCE(SUM(q.used_count), 0) as total_uses,
                      COALESCE(AVG(q.used_count), 0) as avg_uses,
                      SUM(CASE WHEN q.emotional_function = 'hook' THEN 1 ELSE 0 END) as hooks,
                      SUM(CASE WHEN q.emotional_function = 'truth' THEN 1 ELSE 0 END) as truths
               FROM philosophers p
               LEFT JOIN quotes q ON p.id = q.philosopher_id
               GROUP BY p.id
               ORDER BY total_uses DESC"""
        )
        rows = [dict(r) for r in await cursor.fetchall()]
        return {"philosophers": rows}
    finally:
        await conn.close()


@router.post("")
async def create_quote(body: QuoteCreate) -> dict:
    """Create a new quote."""
    conn = await db.connect()
    try:
        # Verify philosopher exists
        cursor = await conn.execute(
            "SELECT id FROM philosophers WHERE id = ?", (body.philosopher_id,)
        )
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail="Philosopher not found")

        quote_id = uuid.uuid4().hex[:12]
        word_count = len(body.text.split())
        read_time_seconds = round(word_count / 2.5, 2)

        await conn.execute(
            """INSERT INTO quotes
               (id, philosopher_id, text, theme, emotional_function,
                word_count, read_time_seconds, pair_with_visual, used_count)
               VALUES (?, ?, ?, ?, ?, ?, ?, '', 0)""",
            (quote_id, body.philosopher_id, body.text, body.theme,
             body.emotional_function, word_count, read_time_seconds),
        )
        await conn.commit()

        cursor = await conn.execute("SELECT * FROM quotes WHERE id = ?", (quote_id,))
        return dict(await cursor.fetchone())
    finally:
        await conn.close()


@router.patch("/{quote_id}")
async def update_quote(quote_id: str, body: QuoteUpdate) -> dict:
    """Update a quote's fields."""
    conn = await db.connect()
    try:
        cursor = await conn.execute("SELECT * FROM quotes WHERE id = ?", (quote_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Quote not found")

        updates = body.model_dump(exclude_none=True)
        if not updates:
            return dict(row)

        # Recalculate word_count and read_time if text changed
        if "text" in updates:
            word_count = len(updates["text"].split())
            updates["word_count"] = word_count
            updates["read_time_seconds"] = round(word_count / 2.5, 2)

        sets = ", ".join(f"{k} = ?" for k in updates)
        params = list(updates.values()) + [quote_id]
        await conn.execute(f"UPDATE quotes SET {sets} WHERE id = ?", params)
        await conn.commit()

        cursor = await conn.execute("SELECT * FROM quotes WHERE id = ?", (quote_id,))
        return dict(await cursor.fetchone())
    finally:
        await conn.close()


@router.delete("/{quote_id}")
async def delete_quote(quote_id: str) -> dict:
    """Delete a quote."""
    conn = await db.connect()
    try:
        cursor = await conn.execute("DELETE FROM quotes WHERE id = ?", (quote_id,))
        await conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Quote not found")
        return {"deleted": True}
    finally:
        await conn.close()

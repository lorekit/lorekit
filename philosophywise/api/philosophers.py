"""Philosopher endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from philosophywise import db

router = APIRouter(prefix="/api/philosophers", tags=["philosophers"])


class PhilosopherUpdate(BaseModel):
    name: str | None = None
    era: str | None = None
    civilization: str | None = None
    character_description: str | None = None


@router.get("")
async def list_philosophers() -> list[dict]:
    """List all philosophers with quote counts."""
    conn = await db.connect()
    try:
        cursor = await conn.execute(
            """SELECT p.id, p.name, p.civilization, p.era, p.character_description, p.character_image_url, p.character_ref_urls,
                      COUNT(q.id) as quote_count,
                      SUM(CASE WHEN q.emotional_function = 'hook' THEN 1 ELSE 0 END) as hook_count,
                      SUM(CASE WHEN q.emotional_function = 'truth' THEN 1 ELSE 0 END) as truth_count,
                      SUM(CASE WHEN q.emotional_function = 'conflict' THEN 1 ELSE 0 END) as conflict_count
               FROM philosophers p
               LEFT JOIN quotes q ON p.id = q.philosopher_id
               GROUP BY p.id
               ORDER BY p.civilization, p.name"""
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        await conn.close()


@router.get("/{philosopher_id}")
async def get_philosopher(philosopher_id: str) -> dict:
    """Get philosopher detail with quote breakdown."""
    conn = await db.connect()
    try:
        cursor = await conn.execute(
            "SELECT * FROM philosophers WHERE id = ?", (philosopher_id,)
        )
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Philosopher not found")

        phil = dict(row)

        # Get quotes grouped by function
        cursor = await conn.execute(
            """SELECT id, text, short_version, theme, emotional_function,
                      word_count, read_time_seconds, pair_with_visual, used_count
               FROM quotes WHERE philosopher_id = ?
               ORDER BY emotional_function, used_count ASC""",
            (philosopher_id,),
        )
        phil["quotes"] = [dict(r) for r in await cursor.fetchall()]
        return phil
    finally:
        await conn.close()


@router.patch("/{philosopher_id}")
async def update_philosopher(philosopher_id: str, body: PhilosopherUpdate) -> dict:
    """Update philosopher fields."""
    conn = await db.connect()
    try:
        cursor = await conn.execute(
            "SELECT * FROM philosophers WHERE id = ?", (philosopher_id,)
        )
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Philosopher not found")

        updates = body.model_dump(exclude_none=True)
        if not updates:
            return dict(row)

        sets = ", ".join(f"{k} = ?" for k in updates)
        params = list(updates.values()) + [philosopher_id]
        await conn.execute(
            f"UPDATE philosophers SET {sets} WHERE id = ?", params
        )
        await conn.commit()

        cursor = await conn.execute(
            "SELECT * FROM philosophers WHERE id = ?", (philosopher_id,)
        )
        return dict(await cursor.fetchone())
    finally:
        await conn.close()

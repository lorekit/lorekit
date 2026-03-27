"""Quote CRUD — load, import, select, and manage philosopher quotes."""

from __future__ import annotations

import json
import random
from pathlib import Path
from typing import Any

import aiosqlite

from philosophywise.models import Philosopher, Quote
from philosophywise.quotes.selector import find_compatible_truth, pick_quote_for_function

SOURCES_DIR = Path(__file__).parent / "sources"


def _parse_quote(raw: dict[str, Any]) -> Quote:
    """Parse a raw quote dict from JSON into a Quote model."""
    text = raw["text"]
    word_count = len(text.split())
    # ~150 wpm average reading speed → seconds
    read_time = round(word_count / 2.5, 1)

    return Quote(
        text=text,
        short_version=raw.get("short_version"),
        theme=raw["theme"],
        emotional_function=raw["emotional_function"],
        word_count=word_count,
        read_time_seconds=read_time,
        pair_with_visual=raw.get("pair_with_visual", ""),
    )


def _parse_philosopher(data: dict[str, Any]) -> Philosopher:
    """Parse a full philosopher JSON file into a Philosopher model."""
    phil = data["philosopher"]
    quotes = [_parse_quote(q) for q in data["quotes"]]

    return Philosopher(
        id=phil["id"],
        name=phil["name"],
        civilization=phil["civilization"],
        era=phil["era"],
        character_description=phil["character_description"],
        environment_description=phil.get("environment_description", ""),
        source_texts=phil["source_texts"],
        quotes=quotes,
    )


def get_available_philosophers() -> list[str]:
    """List all philosopher IDs from JSON files on disk."""
    ids: list[str] = []
    for path in SOURCES_DIR.glob("*.json"):
        if path.stem != ".gitkeep":
            ids.append(path.stem)
    return sorted(ids)


async def load_all_quotes(db: aiosqlite.Connection) -> dict[str, Philosopher]:
    """Load all philosophers and quotes from JSON files into DB if not already loaded."""
    philosophers: dict[str, Philosopher] = {}

    for path in SOURCES_DIR.glob("*.json"):
        if path.stem == ".gitkeep":
            continue
        philosopher = await import_quotes_from_json(db, str(path))
        if philosopher:
            philosophers[philosopher.id] = philosopher

    return philosophers


async def import_quotes_from_json(
    db: aiosqlite.Connection, json_path: str
) -> Philosopher | None:
    """Import a single philosopher's quotes from JSON.

    Inserts into the database if not already present. Returns the parsed Philosopher.
    """
    path = Path(json_path)
    if not path.exists():
        return None

    with open(path) as f:
        data = json.load(f)

    philosopher = _parse_philosopher(data)

    # Upsert philosopher
    await db.execute(
        """INSERT INTO philosophers (id, name, civilization, character_description)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
               name = excluded.name,
               civilization = excluded.civilization,
               character_description = excluded.character_description""",
        (
            philosopher.id,
            philosopher.name,
            philosopher.civilization,
            philosopher.character_description,
        ),
    )

    # Insert quotes (skip duplicates based on text)
    for quote in philosopher.quotes:
        await db.execute(
            """INSERT OR IGNORE INTO quotes
               (philosopher_id, text, short_version, theme, emotional_function,
                word_count, read_time_seconds, pair_with_visual, used_count)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)""",
            (
                philosopher.id,
                quote.text,
                quote.short_version,
                quote.theme,
                quote.emotional_function,
                quote.word_count,
                quote.read_time_seconds,
                quote.pair_with_visual,
            ),
        )

    await db.commit()
    return philosopher


async def get_random_philosopher(
    db: aiosqlite.Connection, exclude_recent: int = 3
) -> str:
    """Pick a philosopher that hasn't been used in the last N videos."""
    # Get recently used philosopher IDs
    cursor = await db.execute(
        """SELECT DISTINCT philosopher_id FROM videos
           ORDER BY created_at DESC LIMIT ?""",
        (exclude_recent,),
    )
    recent_rows = await cursor.fetchall()
    recent_ids = {row[0] for row in recent_rows}

    # Get all available philosophers
    available = get_available_philosophers()
    candidates = [pid for pid in available if pid not in recent_ids]

    # Fallback to all if every philosopher is recent
    if not candidates:
        candidates = available

    if not candidates:
        raise RuntimeError("No philosopher JSON files found in sources/")

    return random.choice(candidates)


async def select_quote_pair(
    db: aiosqlite.Connection, philosopher_id: str
) -> tuple[Quote, Quote]:
    """Select a hook + truth quote pair. Prefers least-used quotes.

    Ensures the pair makes thematic sense (same theme family).
    """
    # Get least-used hook quotes
    cursor = await db.execute(
        """SELECT text, short_version, theme, emotional_function,
                  word_count, read_time_seconds, pair_with_visual
           FROM quotes
           WHERE philosopher_id = ? AND emotional_function = 'hook'
           ORDER BY used_count ASC, RANDOM()
           LIMIT 10""",
        (philosopher_id,),
    )
    hook_rows = await cursor.fetchall()

    # Get least-used truth quotes
    cursor = await db.execute(
        """SELECT text, short_version, theme, emotional_function,
                  word_count, read_time_seconds, pair_with_visual
           FROM quotes
           WHERE philosopher_id = ? AND emotional_function = 'truth'
           ORDER BY used_count ASC, RANDOM()
           LIMIT 10""",
        (philosopher_id,),
    )
    truth_rows = await cursor.fetchall()

    if not hook_rows or not truth_rows:
        raise ValueError(
            f"Not enough quotes for {philosopher_id}: "
            f"{len(hook_rows)} hooks, {len(truth_rows)} truths"
        )

    def _row_to_quote(row: tuple) -> Quote:
        return Quote(
            text=row[0],
            short_version=row[1],
            theme=row[2],
            emotional_function=row[3],
            word_count=row[4],
            read_time_seconds=row[5],
            pair_with_visual=row[6] or "",
        )

    hooks = [_row_to_quote(r) for r in hook_rows]
    truths = [_row_to_quote(r) for r in truth_rows]

    # Try to find a thematically compatible pair
    hook = pick_quote_for_function(hooks, "hook")
    if hook is None:
        hook = hooks[0]

    truth = find_compatible_truth(hook, truths)
    if truth is None:
        truth = truths[0]

    return hook, truth


async def get_philosopher(
    db: aiosqlite.Connection, philosopher_id: str
) -> Philosopher:
    """Get full philosopher data including character/environment descriptions."""
    # Try loading from JSON first (authoritative source)
    json_path = SOURCES_DIR / f"{philosopher_id}.json"
    if json_path.exists():
        with open(json_path) as f:
            data = json.load(f)
        return _parse_philosopher(data)

    # Fallback to DB
    cursor = await db.execute(
        "SELECT id, name, civilization, character_description FROM philosophers WHERE id = ?",
        (philosopher_id,),
    )
    row = await cursor.fetchone()
    if not row:
        raise ValueError(f"Philosopher not found: {philosopher_id}")

    cursor = await db.execute(
        """SELECT text, short_version, theme, emotional_function,
                  word_count, read_time_seconds, pair_with_visual
           FROM quotes WHERE philosopher_id = ?""",
        (philosopher_id,),
    )
    quote_rows = await cursor.fetchall()
    quotes = [
        Quote(
            text=r[0],
            short_version=r[1],
            theme=r[2],
            emotional_function=r[3],
            word_count=r[4],
            read_time_seconds=r[5],
            pair_with_visual=r[6] or "",
        )
        for r in quote_rows
    ]

    return Philosopher(
        id=row[0],
        name=row[1],
        civilization=row[2],
        era="",
        character_description=row[3],
        environment_description="",
        source_texts=[],
        quotes=quotes,
    )

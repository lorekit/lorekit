"""Source item CRUD — load, import, select, and manage character source items."""

from __future__ import annotations

import json
import random
from pathlib import Path
from typing import Any

import aiosqlite

from lorekit.models import Character, SourceItem
from lorekit.sources.selector import find_compatible_truth, pick_source_for_function

SOURCES_DIR = Path(__file__).parent / "data"


def _parse_source_item(raw: dict[str, Any]) -> SourceItem:
    """Parse a raw source item dict from JSON into a SourceItem model."""
    text = raw["text"]
    word_count = len(text.split())
    # ~150 wpm average reading speed → seconds
    read_time = round(word_count / 2.5, 1)

    return SourceItem(
        text=text,
        short_version=raw.get("short_version"),
        theme=raw["theme"],
        emotional_function=raw["emotional_function"],
        word_count=word_count,
        read_time_seconds=read_time,
        pair_with_visual=raw.get("pair_with_visual", ""),
    )


def _parse_character(data: dict[str, Any]) -> Character:
    """Parse a full character JSON file into a Character model."""
    phil = data["philosopher"]
    source_items = [_parse_source_item(q) for q in data["quotes"]]

    return Character(
        id=phil["id"],
        name=phil["name"],
        group=phil["civilization"],
        era=phil["era"],
        character_description=phil["character_description"],
        environment_description=phil.get("environment_description", ""),
        source_texts=phil["source_texts"],
        quotes=source_items,
    )


def get_available_characters() -> list[str]:
    """List all character IDs from JSON files on disk."""
    ids: list[str] = []
    for path in SOURCES_DIR.glob("*.json"):
        if path.stem != ".gitkeep":
            ids.append(path.stem)
    return sorted(ids)


async def load_all_sources(db: aiosqlite.Connection) -> dict[str, Character]:
    """Load all characters and source items from JSON files into DB if not already loaded."""
    characters: dict[str, Character] = {}

    for path in SOURCES_DIR.glob("*.json"):
        if path.stem == ".gitkeep":
            continue
        character = await import_sources_from_json(db, str(path))
        if character:
            characters[character.id] = character

    return characters


async def import_sources_from_json(
    db: aiosqlite.Connection, json_path: str
) -> Character | None:
    """Import a single character's source items from JSON.

    Inserts into the database if not already present. Returns the parsed Character.
    """
    path = Path(json_path)
    if not path.exists():
        return None

    with open(path) as f:
        data = json.load(f)

    character = _parse_character(data)

    # Upsert character
    await db.execute(
        """INSERT INTO characters (id, name, group_name, character_description)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
               name = excluded.name,
               group_name = excluded.group_name,
               character_description = excluded.character_description""",
        (
            character.id,
            character.name,
            character.group,
            character.character_description,
        ),
    )

    # Insert source items (skip duplicates based on text)
    for item in character.quotes:
        await db.execute(
            """INSERT OR IGNORE INTO source_items
               (character_id, text, short_version, theme, emotional_function,
                word_count, read_time_seconds, pair_with_visual, used_count)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)""",
            (
                character.id,
                item.text,
                item.short_version,
                item.theme,
                item.emotional_function,
                item.word_count,
                item.read_time_seconds,
                item.pair_with_visual,
            ),
        )

    await db.commit()
    return character


async def get_random_character(
    db: aiosqlite.Connection, exclude_recent: int = 3
) -> str:
    """Pick a character that hasn't been used in the last N videos."""
    # Get recently used character IDs
    cursor = await db.execute(
        """SELECT DISTINCT character_id FROM videos
           ORDER BY created_at DESC LIMIT ?""",
        (exclude_recent,),
    )
    recent_rows = await cursor.fetchall()
    recent_ids = {row[0] for row in recent_rows}

    # Get all available characters
    available = get_available_characters()
    candidates = [cid for cid in available if cid not in recent_ids]

    # Fallback to all if every character is recent
    if not candidates:
        candidates = available

    if not candidates:
        raise RuntimeError("No character JSON files found in sources/data/")

    return random.choice(candidates)


async def select_source_pair(
    db: aiosqlite.Connection, character_id: str
) -> tuple[SourceItem, SourceItem]:
    """Select a hook + truth source item pair. Prefers least-used items.

    Ensures the pair makes thematic sense (same theme family).
    """
    # Get least-used hook source items
    cursor = await db.execute(
        """SELECT text, short_version, theme, emotional_function,
                  word_count, read_time_seconds, pair_with_visual
           FROM source_items
           WHERE character_id = ? AND emotional_function = 'hook'
           ORDER BY used_count ASC, RANDOM()
           LIMIT 10""",
        (character_id,),
    )
    hook_rows = await cursor.fetchall()

    # Get least-used truth source items
    cursor = await db.execute(
        """SELECT text, short_version, theme, emotional_function,
                  word_count, read_time_seconds, pair_with_visual
           FROM source_items
           WHERE character_id = ? AND emotional_function = 'truth'
           ORDER BY used_count ASC, RANDOM()
           LIMIT 10""",
        (character_id,),
    )
    truth_rows = await cursor.fetchall()

    if not hook_rows or not truth_rows:
        raise ValueError(
            f"Not enough source items for {character_id}: "
            f"{len(hook_rows)} hooks, {len(truth_rows)} truths"
        )

    def _row_to_source_item(row: tuple) -> SourceItem:
        return SourceItem(
            text=row[0],
            short_version=row[1],
            theme=row[2],
            emotional_function=row[3],
            word_count=row[4],
            read_time_seconds=row[5],
            pair_with_visual=row[6] or "",
        )

    hooks = [_row_to_source_item(r) for r in hook_rows]
    truths = [_row_to_source_item(r) for r in truth_rows]

    # Try to find a thematically compatible pair
    hook = pick_source_for_function(hooks, "hook")
    if hook is None:
        hook = hooks[0]

    truth = find_compatible_truth(hook, truths)
    if truth is None:
        truth = truths[0]

    return hook, truth


async def get_character(
    db: aiosqlite.Connection, character_id: str
) -> Character:
    """Get full character data including character/environment descriptions."""
    # Try loading from JSON first (authoritative source)
    json_path = SOURCES_DIR / f"{character_id}.json"
    if json_path.exists():
        with open(json_path) as f:
            data = json.load(f)
        return _parse_character(data)

    # Fallback to DB
    cursor = await db.execute(
        "SELECT id, name, group_name, character_description FROM characters WHERE id = ?",
        (character_id,),
    )
    row = await cursor.fetchone()
    if not row:
        raise ValueError(f"Character not found: {character_id}")

    cursor = await db.execute(
        """SELECT text, short_version, theme, emotional_function,
                  word_count, read_time_seconds, pair_with_visual
           FROM source_items WHERE character_id = ?""",
        (character_id,),
    )
    item_rows = await cursor.fetchall()
    source_items = [
        SourceItem(
            text=r[0],
            short_version=r[1],
            theme=r[2],
            emotional_function=r[3],
            word_count=r[4],
            read_time_seconds=r[5],
            pair_with_visual=r[6] or "",
        )
        for r in item_rows
    ]

    return Character(
        id=row[0],
        name=row[1],
        group=row[2],
        era="",
        character_description=row[3],
        environment_description="",
        source_texts=[],
        quotes=source_items,
    )

"""Source item CRUD — load, import, select, and manage character source items."""

from __future__ import annotations

import json
import random
import uuid
from pathlib import Path
from typing import Any

import asyncpg

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


async def load_all_sources(pool: asyncpg.Pool, universe_id: str | None = None) -> dict[str, Character]:
    """Load all characters and source items from JSON files into DB if not already loaded.

    Requires universe_id to properly scope the imported data.
    """
    if not universe_id:
        raise ValueError("universe_id is required for load_all_sources")
    characters: dict[str, Character] = {}

    for path in SOURCES_DIR.glob("*.json"):
        if path.stem == ".gitkeep":
            continue
        character = await import_sources_from_json(pool, str(path), universe_id=universe_id)
        if character:
            characters[character.id] = character

    return characters


async def import_sources_from_json(
    pool: asyncpg.Pool, json_path: str, universe_id: str | None = None
) -> Character | None:
    """Import a single character's source items from JSON.

    Inserts into the database if not already present. Returns the parsed Character.
    Requires universe_id for proper data scoping.
    """
    path = Path(json_path)
    if not path.exists():
        return None

    with open(path) as f:
        data = json.load(f)

    character = _parse_character(data)

    if not universe_id:
        raise ValueError("universe_id is required for import_sources_from_json")

    async with pool.acquire() as conn:
        async with conn.transaction():
            # Upsert character
            await conn.execute(
                """INSERT INTO characters (id, universe_id, name, group_name, character_description)
                   VALUES ($1, $2, $3, $4, $5)
                   ON CONFLICT(id) DO UPDATE SET
                       name = EXCLUDED.name,
                       group_name = EXCLUDED.group_name,
                       character_description = EXCLUDED.character_description""",
                character.id, universe_id, character.name,
                character.group, character.character_description,
            )

            # Insert source items (skip duplicates based on text)
            for item in character.quotes:
                item_id = uuid.uuid4().hex[:12]
                await conn.execute(
                    """INSERT INTO source_items
                       (id, character_id, universe_id, text, short_version, theme, emotional_function,
                        word_count, read_time_seconds, pair_with_visual, used_count)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0)
                       ON CONFLICT DO NOTHING""",
                    item_id, character.id, universe_id, item.text,
                    item.short_version, item.theme, item.emotional_function,
                    item.word_count, item.read_time_seconds, item.pair_with_visual,
                )

    return character


async def get_random_character(
    pool: asyncpg.Pool, exclude_recent: int = 3
) -> str:
    """Pick a character that hasn't been used in the last N videos."""
    rows = await pool.fetch(
        """SELECT DISTINCT character_id FROM universe_projects
           ORDER BY created_at DESC LIMIT $1""",
        exclude_recent,
    )
    recent_ids = {row["character_id"] for row in rows}

    available = get_available_characters()
    candidates = [cid for cid in available if cid not in recent_ids]

    if not candidates:
        candidates = available

    if not candidates:
        raise RuntimeError("No character JSON files found in sources/data/")

    return random.choice(candidates)


async def select_source_pair(
    pool: asyncpg.Pool, character_id: str, org_id: str | None = None,
) -> tuple[SourceItem, SourceItem]:
    """Select a hook + truth source item pair. Prefers least-used items.

    When org_id is provided, source items are scoped to that organization's
    universes to prevent cross-tenant data leaks.
    """
    if org_id and org_id != "local":
        hook_rows = await pool.fetch(
            """SELECT q.text, q.short_version, q.theme, q.emotional_function,
                      q.word_count, q.read_time_seconds, q.pair_with_visual
               FROM source_items q
               JOIN universes u ON q.universe_id = u.id
               WHERE q.character_id = $1 AND q.emotional_function = 'hook'
                 AND u.organization_id = $2
               ORDER BY q.used_count ASC, RANDOM()
               LIMIT 10""",
            character_id, org_id,
        )
        truth_rows = await pool.fetch(
            """SELECT q.text, q.short_version, q.theme, q.emotional_function,
                      q.word_count, q.read_time_seconds, q.pair_with_visual
               FROM source_items q
               JOIN universes u ON q.universe_id = u.id
               WHERE q.character_id = $1 AND q.emotional_function = 'truth'
                 AND u.organization_id = $2
               ORDER BY q.used_count ASC, RANDOM()
               LIMIT 10""",
            character_id, org_id,
        )
    else:
        hook_rows = await pool.fetch(
            """SELECT text, short_version, theme, emotional_function,
                      word_count, read_time_seconds, pair_with_visual
               FROM source_items
               WHERE character_id = $1 AND emotional_function = 'hook'
               ORDER BY used_count ASC, RANDOM()
               LIMIT 10""",
            character_id,
        )
        truth_rows = await pool.fetch(
            """SELECT text, short_version, theme, emotional_function,
                      word_count, read_time_seconds, pair_with_visual
               FROM source_items
               WHERE character_id = $1 AND emotional_function = 'truth'
               ORDER BY used_count ASC, RANDOM()
               LIMIT 10""",
            character_id,
        )

    if not hook_rows or not truth_rows:
        raise ValueError(
            f"Not enough source items for {character_id}: "
            f"{len(hook_rows)} hooks, {len(truth_rows)} truths"
        )

    def _row_to_source_item(row: asyncpg.Record) -> SourceItem:
        return SourceItem(
            text=row["text"],
            short_version=row["short_version"],
            theme=row["theme"],
            emotional_function=row["emotional_function"],
            word_count=row["word_count"],
            read_time_seconds=row["read_time_seconds"],
            pair_with_visual=row["pair_with_visual"] or "",
        )

    hooks = [_row_to_source_item(r) for r in hook_rows]
    truths = [_row_to_source_item(r) for r in truth_rows]

    hook = pick_source_for_function(hooks, "hook")
    if hook is None:
        hook = hooks[0]

    truth = find_compatible_truth(hook, truths)
    if truth is None:
        truth = truths[0]

    return hook, truth


async def get_character(
    pool: asyncpg.Pool, character_id: str
) -> Character:
    """Get full character data including character/environment descriptions."""
    # Try loading from JSON first (authoritative source)
    json_path = SOURCES_DIR / f"{character_id}.json"
    if json_path.exists():
        with open(json_path) as f:
            data = json.load(f)
        return _parse_character(data)

    # Fallback to DB
    row = await pool.fetchrow(
        "SELECT id, name, group_name, character_description, character_styles_json FROM characters WHERE id = $1",
        character_id,
    )
    if not row:
        raise ValueError(f"Character not found: {character_id}")

    item_rows = await pool.fetch(
        """SELECT text, short_version, theme, emotional_function,
                  word_count, read_time_seconds, pair_with_visual
           FROM source_items WHERE character_id = $1""",
        character_id,
    )
    source_items = [
        SourceItem(
            text=r["text"],
            short_version=r["short_version"],
            theme=r["theme"],
            emotional_function=r["emotional_function"],
            word_count=r["word_count"],
            read_time_seconds=r["read_time_seconds"],
            pair_with_visual=r["pair_with_visual"] or "",
        )
        for r in item_rows
    ]

    # Parse per-style character descriptions from character_styles_json
    char_descs: dict[str, str] = {}
    if row["character_styles_json"]:
        try:
            styles = json.loads(row["character_styles_json"])
            char_descs = {
                theme: data["description"]
                for theme, data in styles.items()
                if isinstance(data, dict) and data.get("description")
            }
        except (json.JSONDecodeError, TypeError):
            pass

    return Character(
        id=row["id"],
        name=row["name"],
        group=row["group_name"],
        era="",
        character_description=row["character_description"],
        character_descriptions=char_descs,
        environment_description="",
        source_texts=[],
        quotes=source_items,
    )

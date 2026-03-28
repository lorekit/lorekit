"""SQLite database layer using aiosqlite."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import aiosqlite

from lorekit.config import get_settings

_SCHEMA = """
CREATE TABLE IF NOT EXISTS universes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS environments (
    id TEXT PRIMARY KEY,
    universe_id TEXT NOT NULL REFERENCES universes(id),
    name TEXT NOT NULL,
    color_grade_json TEXT,
    font TEXT NOT NULL DEFAULT 'Cinzel',
    text_color TEXT NOT NULL DEFAULT '#FFFFFF',
    text_shadow TEXT NOT NULL DEFAULT 'warm',
    environment_description TEXT NOT NULL DEFAULT '',
    themed_descriptions_json TEXT
);

CREATE TABLE IF NOT EXISTS scene_templates (
    id TEXT PRIMARY KEY,
    universe_id TEXT NOT NULL REFERENCES universes(id),
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    beats_json TEXT,
    min_duration REAL NOT NULL DEFAULT 30,
    max_duration REAL NOT NULL DEFAULT 50,
    min_scenes INTEGER NOT NULL DEFAULT 5,
    max_scenes INTEGER NOT NULL DEFAULT 8
);

CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    universe_id TEXT NOT NULL DEFAULT 'philosophywise',
    name TEXT NOT NULL,
    group_name TEXT NOT NULL,
    era TEXT NOT NULL DEFAULT '',
    character_description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS source_items (
    id TEXT PRIMARY KEY,
    universe_id TEXT NOT NULL DEFAULT 'philosophywise',
    character_id TEXT NOT NULL REFERENCES characters(id),
    text TEXT NOT NULL,
    short_version TEXT,
    theme TEXT NOT NULL,
    emotional_function TEXT NOT NULL,
    word_count INTEGER NOT NULL DEFAULT 0,
    read_time_seconds REAL NOT NULL DEFAULT 0.0,
    pair_with_visual TEXT NOT NULL DEFAULT '',
    used_count INTEGER NOT NULL DEFAULT 0,
    last_used_at TEXT
);

CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY,
    universe_id TEXT NOT NULL DEFAULT 'philosophywise',
    character_id TEXT NOT NULL REFERENCES characters(id),
    hook_quote_id TEXT REFERENCES source_items(id),
    truth_quote_id TEXT REFERENCES source_items(id),
    status TEXT NOT NULL DEFAULT 'queued',
    output_path TEXT,
    youtube_id TEXT,
    youtube_title TEXT,
    cost_usd REAL NOT NULL DEFAULT 0.0,
    views INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    published_at TEXT
);

CREATE TABLE IF NOT EXISTS costs (
    id TEXT PRIMARY KEY,
    video_id TEXT NOT NULL REFERENCES videos(id),
    component TEXT NOT NULL,
    amount_usd REAL NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    universe_id TEXT NOT NULL DEFAULT 'philosophywise',
    name TEXT NOT NULL DEFAULT '',
    character_id TEXT NOT NULL,
    civilization TEXT NOT NULL DEFAULT '',
    hook_quote_id TEXT,
    truth_quote_id TEXT,
    story_json TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    clips_json TEXT,
    output_path TEXT,
    youtube_id TEXT,
    youtube_title TEXT,
    cost_usd REAL NOT NULL DEFAULT 0.0,
    character_image_url TEXT,
    character_image_path TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    progress REAL NOT NULL DEFAULT 0.0,
    message TEXT NOT NULL DEFAULT '',
    result_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
"""


async def _get_db_path() -> Path:
    settings = get_settings()
    settings.ensure_dirs()
    return settings.db_path


async def connect(db_path: Path | None = None) -> aiosqlite.Connection:
    """Open a connection to the database."""
    path = db_path or await _get_db_path()
    db = await aiosqlite.connect(str(path))
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA foreign_keys=ON")
    return db


async def migrate_schema(db_path: Path | None = None) -> None:
    """Migrate from old PhilosophyWise schema to LoreKit schema.

    If old ``philosophers`` table exists, renames tables and adds new columns.
    Otherwise creates a fresh schema with the new names.
    """
    db = await connect(db_path)
    try:
        # Check if the old 'philosophers' table exists
        cursor = await db.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='philosophers'"
        )
        old_exists = await cursor.fetchone()

        if old_exists:
            # Create the new universe / environment / scene_template tables first
            await db.executescript("""
                CREATE TABLE IF NOT EXISTS universes (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS environments (
                    id TEXT PRIMARY KEY,
                    universe_id TEXT NOT NULL REFERENCES universes(id),
                    name TEXT NOT NULL,
                    color_grade_json TEXT,
                    font TEXT NOT NULL DEFAULT 'Cinzel',
                    text_color TEXT NOT NULL DEFAULT '#FFFFFF',
                    text_shadow TEXT NOT NULL DEFAULT 'warm',
                    environment_description TEXT NOT NULL DEFAULT '',
                    themed_descriptions_json TEXT
                );
                CREATE TABLE IF NOT EXISTS scene_templates (
                    id TEXT PRIMARY KEY,
                    universe_id TEXT NOT NULL REFERENCES universes(id),
                    name TEXT NOT NULL,
                    description TEXT NOT NULL DEFAULT '',
                    beats_json TEXT,
                    min_duration REAL NOT NULL DEFAULT 30,
                    max_duration REAL NOT NULL DEFAULT 50,
                    min_scenes INTEGER NOT NULL DEFAULT 5,
                    max_scenes INTEGER NOT NULL DEFAULT 8
                );
            """)

            # Create the default 'philosophywise' universe
            now = datetime.now(timezone.utc).isoformat()
            await db.execute(
                "INSERT OR IGNORE INTO universes (id, name, description, created_at) VALUES (?, ?, ?, ?)",
                ("philosophywise", "PhilosophyWise", "Default universe migrated from PhilosophyWise", now),
            )

            # Rename philosophers -> characters
            await db.execute("ALTER TABLE philosophers RENAME TO characters")
            # Add universe_id column
            try:
                await db.execute("ALTER TABLE characters ADD COLUMN universe_id TEXT NOT NULL DEFAULT 'philosophywise'")
            except Exception:
                pass
            # Rename civilization -> group_name
            try:
                await db.execute("ALTER TABLE characters RENAME COLUMN civilization TO group_name")
            except Exception:
                pass

            # Rename quotes -> source_items
            await db.execute("ALTER TABLE quotes RENAME TO source_items")
            # Add universe_id column
            try:
                await db.execute("ALTER TABLE source_items ADD COLUMN universe_id TEXT NOT NULL DEFAULT 'philosophywise'")
            except Exception:
                pass
            # Rename philosopher_id -> character_id
            try:
                await db.execute("ALTER TABLE source_items RENAME COLUMN philosopher_id TO character_id")
            except Exception:
                pass

            # Add universe_id to videos
            try:
                await db.execute("ALTER TABLE videos ADD COLUMN universe_id TEXT NOT NULL DEFAULT 'philosophywise'")
            except Exception:
                pass
            # Rename philosopher_id -> character_id in videos
            try:
                await db.execute("ALTER TABLE videos RENAME COLUMN philosopher_id TO character_id")
            except Exception:
                pass

            # Add universe_id to projects
            try:
                await db.execute("ALTER TABLE projects ADD COLUMN universe_id TEXT NOT NULL DEFAULT 'philosophywise'")
            except Exception:
                pass
            # Rename philosopher_id -> character_id in projects
            try:
                await db.execute("ALTER TABLE projects RENAME COLUMN philosopher_id TO character_id")
            except Exception:
                pass

            await db.commit()
        else:
            # Fresh install — use new schema directly
            await db.executescript(_SCHEMA)
            await db.commit()
    finally:
        await db.close()


async def init_db(db_path: Path | None = None) -> None:
    """Create all tables if they don't exist."""
    db = await connect(db_path)
    try:
        await db.executescript(_SCHEMA)
        # Migrate: add character image columns if missing (existing DBs)
        for col in ("character_image_url TEXT", "character_image_path TEXT"):
            try:
                await db.execute(f"ALTER TABLE projects ADD COLUMN {col}")
            except Exception:
                pass  # column already exists
        # Migrate: add character columns to characters table
        for col in ("character_image_url TEXT", "character_ref_urls TEXT", "character_images_json TEXT"):
            try:
                await db.execute(f"ALTER TABLE characters ADD COLUMN {col}")
            except Exception:
                pass  # column already exists
        await db.commit()
    finally:
        await db.close()


async def get_unused_source_items(
    character_id: str,
    function: str | None = None,
    limit: int = 5,
    db_path: Path | None = None,
    *,
    philosopher_id: str | None = None,
) -> list[dict[str, Any]]:
    """Return source items sorted by least used, optionally filtered by emotional_function."""
    cid = character_id or philosopher_id
    db = await connect(db_path)
    try:
        sql = "SELECT * FROM source_items WHERE character_id = ?"
        params: list[Any] = [cid]
        if function:
            sql += " AND emotional_function = ?"
            params.append(function)
        sql += " ORDER BY used_count ASC, last_used_at ASC NULLS FIRST LIMIT ?"
        params.append(limit)
        cursor = await db.execute(sql, params)
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]
    finally:
        await db.close()


# Backward compatibility alias
get_unused_quotes = get_unused_source_items


async def mark_source_item_used(
    quote_id: str,
    video_id: str,
    db_path: Path | None = None,
) -> None:
    """Increment used_count and set last_used_at for a source item."""
    db = await connect(db_path)
    try:
        now = datetime.now(timezone.utc).isoformat()
        await db.execute(
            "UPDATE source_items SET used_count = used_count + 1, last_used_at = ? WHERE id = ?",
            (now, quote_id),
        )
        await db.commit()
    finally:
        await db.close()


# Backward compatibility alias
mark_quote_used = mark_source_item_used


async def create_video_record(
    project_id: str,
    character_id: str,
    hook_quote_id: str | None = None,
    truth_quote_id: str | None = None,
    status: str = "queued",
    db_path: Path | None = None,
    *,
    philosopher_id: str | None = None,
) -> str:
    """Insert a new video record and return its id."""
    cid = character_id or philosopher_id
    db = await connect(db_path)
    try:
        now = datetime.now(timezone.utc).isoformat()
        await db.execute(
            """INSERT INTO videos (id, character_id, hook_quote_id, truth_quote_id, status, created_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (project_id, cid, hook_quote_id, truth_quote_id, status, now),
        )
        await db.commit()
        return project_id
    finally:
        await db.close()


async def update_video_status(
    video_id: str,
    status: str,
    db_path: Path | None = None,
    **kwargs: Any,
) -> None:
    """Update a video's status and optional fields (output_path, youtube_id, cost_usd, etc.)."""
    db = await connect(db_path)
    try:
        sets = ["status = ?"]
        params: list[Any] = [status]
        allowed = {"output_path", "youtube_id", "youtube_title", "cost_usd", "views", "published_at"}
        for key, val in kwargs.items():
            if key in allowed:
                sets.append(f"{key} = ?")
                params.append(val)
        params.append(video_id)
        await db.execute(f"UPDATE videos SET {', '.join(sets)} WHERE id = ?", params)
        await db.commit()
    finally:
        await db.close()


async def log_cost(
    video_id: str,
    component: str,
    amount: float,
    db_path: Path | None = None,
) -> None:
    """Record a cost entry for a pipeline component."""
    db = await connect(db_path)
    try:
        cost_id = uuid.uuid4().hex[:12]
        now = datetime.now(timezone.utc).isoformat()
        await db.execute(
            "INSERT INTO costs (id, video_id, component, amount_usd, created_at) VALUES (?, ?, ?, ?, ?)",
            (cost_id, video_id, component, amount, now),
        )
        # Also update the video's total cost
        await db.execute(
            "UPDATE videos SET cost_usd = cost_usd + ? WHERE id = ?",
            (amount, video_id),
        )
        await db.commit()
    finally:
        await db.close()


async def get_stats(db_path: Path | None = None) -> dict[str, Any]:
    """Return aggregate stats: total videos, total cost, avg cost, source item usage."""
    db = await connect(db_path)
    try:
        cursor = await db.execute(
            "SELECT COUNT(*) as total, COALESCE(SUM(cost_usd), 0) as total_cost, "
            "COALESCE(AVG(cost_usd), 0) as avg_cost FROM videos"
        )
        row = await cursor.fetchone()
        video_stats = dict(row) if row else {"total": 0, "total_cost": 0.0, "avg_cost": 0.0}

        cursor = await db.execute(
            "SELECT COUNT(*) as total_quotes, "
            "COALESCE(SUM(used_count), 0) as total_uses, "
            "COALESCE(AVG(used_count), 0) as avg_uses FROM source_items"
        )
        row = await cursor.fetchone()
        quote_stats = dict(row) if row else {"total_quotes": 0, "total_uses": 0, "avg_uses": 0.0}

        cursor = await db.execute(
            "SELECT component, COALESCE(SUM(amount_usd), 0) as total "
            "FROM costs GROUP BY component ORDER BY total DESC"
        )
        cost_breakdown = [dict(r) for r in await cursor.fetchall()]

        return {
            "videos": video_stats,
            "quotes": quote_stats,
            "cost_breakdown": cost_breakdown,
        }
    finally:
        await db.close()


# --- Character / source item import helpers ---


async def upsert_character(
    character_id: str,
    name: str,
    group_name: str,
    era: str = "",
    character_description: str = "",
    db_path: Path | None = None,
    *,
    philosopher_id: str | None = None,
    civilization: str | None = None,
) -> None:
    """Insert or update a character record."""
    cid = character_id or philosopher_id
    gname = group_name or civilization or ""
    db = await connect(db_path)
    try:
        await db.execute(
            """INSERT INTO characters (id, name, group_name, era, character_description)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                   name=excluded.name,
                   group_name=excluded.group_name,
                   era=excluded.era,
                   character_description=excluded.character_description""",
            (cid, name, gname, era, character_description),
        )
        await db.commit()
    finally:
        await db.close()


# Backward compatibility alias
upsert_philosopher = upsert_character


async def insert_source_item(
    character_id: str,
    text: str,
    theme: str,
    emotional_function: str,
    short_version: str | None = None,
    word_count: int = 0,
    read_time_seconds: float = 0.0,
    pair_with_visual: str = "",
    db_path: Path | None = None,
    *,
    philosopher_id: str | None = None,
) -> str:
    """Insert a source item and return its id."""
    cid = character_id or philosopher_id
    db = await connect(db_path)
    try:
        item_id = uuid.uuid4().hex[:12]
        await db.execute(
            """INSERT INTO source_items
               (id, character_id, text, short_version, theme, emotional_function,
                word_count, read_time_seconds, pair_with_visual)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (item_id, cid, text, short_version, theme, emotional_function,
             word_count, read_time_seconds, pair_with_visual),
        )
        await db.commit()
        return item_id
    finally:
        await db.close()


# Backward compatibility alias
insert_quote = insert_source_item


async def list_source_items(
    character_id: str | None = None,
    function: str | None = None,
    db_path: Path | None = None,
    *,
    philosopher_id: str | None = None,
) -> list[dict[str, Any]]:
    """List source items with optional filters."""
    cid = character_id or philosopher_id
    db = await connect(db_path)
    try:
        sql = (
            "SELECT q.*, c.name as character_name "
            "FROM source_items q JOIN characters c ON q.character_id = c.id WHERE 1=1"
        )
        params: list[Any] = []
        if cid:
            sql += " AND q.character_id = ?"
            params.append(cid)
        if function:
            sql += " AND q.emotional_function = ?"
            params.append(function)
        sql += " ORDER BY q.character_id, q.emotional_function, q.used_count ASC"
        cursor = await db.execute(sql, params)
        return [dict(r) for r in await cursor.fetchall()]
    finally:
        await db.close()


# Backward compatibility alias
list_quotes = list_source_items


async def list_videos(
    status: str | None = None,
    limit: int = 20,
    db_path: Path | None = None,
) -> list[dict[str, Any]]:
    """List recent videos."""
    db = await connect(db_path)
    try:
        sql = "SELECT * FROM videos WHERE 1=1"
        params: list[Any] = []
        if status:
            sql += " AND status = ?"
            params.append(status)
        sql += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)
        cursor = await db.execute(sql, params)
        return [dict(r) for r in await cursor.fetchall()]
    finally:
        await db.close()


# --- Project CRUD ---


async def create_project(
    project_id: str,
    character_id: str,
    civilization: str = "",
    name: str = "",
    hook_quote_id: str | None = None,
    truth_quote_id: str | None = None,
    db_path: Path | None = None,
    *,
    philosopher_id: str | None = None,
) -> dict[str, Any]:
    """Create a new project and return it."""
    cid = character_id or philosopher_id
    db = await connect(db_path)
    try:
        now = datetime.now(timezone.utc).isoformat()
        await db.execute(
            """INSERT INTO projects
               (id, name, character_id, civilization, hook_quote_id, truth_quote_id,
                status, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?)""",
            (project_id, name, cid, civilization,
             hook_quote_id, truth_quote_id, now, now),
        )
        await db.commit()
        cursor = await db.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
        row = await cursor.fetchone()
        return dict(row) if row else {}
    finally:
        await db.close()


async def get_project(project_id: str, db_path: Path | None = None) -> dict[str, Any] | None:
    """Get a single project by ID."""
    db = await connect(db_path)
    try:
        cursor = await db.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None
    finally:
        await db.close()


async def list_projects(
    status: str | None = None,
    limit: int = 50,
    db_path: Path | None = None,
) -> list[dict[str, Any]]:
    """List projects, optionally filtered by status."""
    db = await connect(db_path)
    try:
        sql = "SELECT * FROM projects WHERE 1=1"
        params: list[Any] = []
        if status:
            sql += " AND status = ?"
            params.append(status)
        sql += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)
        cursor = await db.execute(sql, params)
        return [dict(r) for r in await cursor.fetchall()]
    finally:
        await db.close()


async def update_project(
    project_id: str,
    db_path: Path | None = None,
    **kwargs: Any,
) -> dict[str, Any] | None:
    """Update project fields. Returns updated project."""
    db = await connect(db_path)
    try:
        allowed = {
            "name", "status", "story_json", "clips_json", "output_path",
            "youtube_id", "youtube_title", "cost_usd",
            "hook_quote_id", "truth_quote_id",
            "character_image_url", "character_image_path",
        }
        sets = ["updated_at = ?"]
        params: list[Any] = [datetime.now(timezone.utc).isoformat()]
        for key, val in kwargs.items():
            if key in allowed:
                sets.append(f"{key} = ?")
                params.append(val)
        params.append(project_id)
        await db.execute(f"UPDATE projects SET {', '.join(sets)} WHERE id = ?", params)
        await db.commit()
        cursor = await db.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None
    finally:
        await db.close()


async def delete_project(project_id: str, db_path: Path | None = None) -> bool:
    """Delete a project. Returns True if deleted."""
    db = await connect(db_path)
    try:
        cursor = await db.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        await db.commit()
        return cursor.rowcount > 0
    finally:
        await db.close()


# --- Job tracking ---


async def create_job(
    job_id: str,
    project_id: str,
    job_type: str,
    db_path: Path | None = None,
) -> dict[str, Any]:
    """Create a new job record."""
    db = await connect(db_path)
    try:
        now = datetime.now(timezone.utc).isoformat()
        await db.execute(
            """INSERT INTO jobs (id, project_id, type, status, progress, message, created_at, updated_at)
               VALUES (?, ?, ?, 'pending', 0.0, '', ?, ?)""",
            (job_id, project_id, job_type, now, now),
        )
        await db.commit()
        cursor = await db.execute("SELECT * FROM jobs WHERE id = ?", (job_id,))
        row = await cursor.fetchone()
        return dict(row) if row else {}
    finally:
        await db.close()


async def get_job(job_id: str, db_path: Path | None = None) -> dict[str, Any] | None:
    """Get a job by ID."""
    db = await connect(db_path)
    try:
        cursor = await db.execute("SELECT * FROM jobs WHERE id = ?", (job_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None
    finally:
        await db.close()


async def update_job(
    job_id: str,
    db_path: Path | None = None,
    **kwargs: Any,
) -> None:
    """Update job fields (status, progress, message, result_json)."""
    db = await connect(db_path)
    try:
        allowed = {"status", "progress", "message", "result_json"}
        sets = ["updated_at = ?"]
        params: list[Any] = [datetime.now(timezone.utc).isoformat()]
        for key, val in kwargs.items():
            if key in allowed:
                sets.append(f"{key} = ?")
                params.append(val)
        params.append(job_id)
        await db.execute(f"UPDATE jobs SET {', '.join(sets)} WHERE id = ?", params)
        await db.commit()
    finally:
        await db.close()


# --- Universe CRUD ---


async def create_universe(
    universe_id: str,
    name: str,
    description: str = "",
    db_path: Path | None = None,
) -> dict[str, Any]:
    """Create a new universe and return it."""
    db = await connect(db_path)
    try:
        now = datetime.now(timezone.utc).isoformat()
        await db.execute(
            "INSERT INTO universes (id, name, description, created_at) VALUES (?, ?, ?, ?)",
            (universe_id, name, description, now),
        )
        await db.commit()
        cursor = await db.execute("SELECT * FROM universes WHERE id = ?", (universe_id,))
        row = await cursor.fetchone()
        return dict(row) if row else {}
    finally:
        await db.close()


async def get_universe(universe_id: str, db_path: Path | None = None) -> dict[str, Any] | None:
    """Get a universe by ID."""
    db = await connect(db_path)
    try:
        cursor = await db.execute("SELECT * FROM universes WHERE id = ?", (universe_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None
    finally:
        await db.close()


async def list_universes(db_path: Path | None = None) -> list[dict[str, Any]]:
    """List all universes."""
    db = await connect(db_path)
    try:
        cursor = await db.execute("SELECT * FROM universes ORDER BY created_at DESC")
        return [dict(r) for r in await cursor.fetchall()]
    finally:
        await db.close()


async def update_universe(
    universe_id: str,
    db_path: Path | None = None,
    **kwargs: Any,
) -> dict[str, Any] | None:
    """Update universe fields. Returns updated universe."""
    db = await connect(db_path)
    try:
        allowed = {"name", "description"}
        sets: list[str] = []
        params: list[Any] = []
        for key, val in kwargs.items():
            if key in allowed:
                sets.append(f"{key} = ?")
                params.append(val)
        if not sets:
            cursor = await db.execute("SELECT * FROM universes WHERE id = ?", (universe_id,))
            row = await cursor.fetchone()
            return dict(row) if row else None
        params.append(universe_id)
        await db.execute(f"UPDATE universes SET {', '.join(sets)} WHERE id = ?", params)
        await db.commit()
        cursor = await db.execute("SELECT * FROM universes WHERE id = ?", (universe_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None
    finally:
        await db.close()


async def delete_universe(universe_id: str, db_path: Path | None = None) -> bool:
    """Delete a universe. Returns True if deleted."""
    db = await connect(db_path)
    try:
        cursor = await db.execute("DELETE FROM universes WHERE id = ?", (universe_id,))
        await db.commit()
        return cursor.rowcount > 0
    finally:
        await db.close()


# --- Environment CRUD ---


async def create_environment(
    environment_id: str,
    universe_id: str,
    name: str,
    color_grade: dict | None = None,
    font: str = "Cinzel",
    text_color: str = "#FFFFFF",
    text_shadow: str = "warm",
    environment_description: str = "",
    themed_descriptions: dict | None = None,
    db_path: Path | None = None,
) -> dict[str, Any]:
    """Create a new environment and return it."""
    db = await connect(db_path)
    try:
        await db.execute(
            """INSERT INTO environments
               (id, universe_id, name, color_grade_json, font, text_color, text_shadow,
                environment_description, themed_descriptions_json)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (environment_id, universe_id, name,
             json.dumps(color_grade) if color_grade else None,
             font, text_color, text_shadow, environment_description,
             json.dumps(themed_descriptions) if themed_descriptions else None),
        )
        await db.commit()
        cursor = await db.execute("SELECT * FROM environments WHERE id = ?", (environment_id,))
        row = await cursor.fetchone()
        return dict(row) if row else {}
    finally:
        await db.close()


async def get_environment(environment_id: str, db_path: Path | None = None) -> dict[str, Any] | None:
    """Get an environment by ID."""
    db = await connect(db_path)
    try:
        cursor = await db.execute("SELECT * FROM environments WHERE id = ?", (environment_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None
    finally:
        await db.close()


async def list_environments(
    universe_id: str | None = None,
    db_path: Path | None = None,
) -> list[dict[str, Any]]:
    """List environments, optionally filtered by universe."""
    db = await connect(db_path)
    try:
        if universe_id:
            cursor = await db.execute(
                "SELECT * FROM environments WHERE universe_id = ? ORDER BY name",
                (universe_id,),
            )
        else:
            cursor = await db.execute("SELECT * FROM environments ORDER BY name")
        return [dict(r) for r in await cursor.fetchall()]
    finally:
        await db.close()


async def update_environment(
    environment_id: str,
    db_path: Path | None = None,
    **kwargs: Any,
) -> dict[str, Any] | None:
    """Update environment fields. Returns updated environment."""
    db = await connect(db_path)
    try:
        allowed = {
            "name", "font", "text_color", "text_shadow",
            "environment_description",
        }
        sets: list[str] = []
        params: list[Any] = []
        for key, val in kwargs.items():
            if key in allowed:
                sets.append(f"{key} = ?")
                params.append(val)
            elif key == "color_grade":
                sets.append("color_grade_json = ?")
                params.append(json.dumps(val) if val else None)
            elif key == "themed_descriptions":
                sets.append("themed_descriptions_json = ?")
                params.append(json.dumps(val) if val else None)
        if not sets:
            cursor = await db.execute("SELECT * FROM environments WHERE id = ?", (environment_id,))
            row = await cursor.fetchone()
            return dict(row) if row else None
        params.append(environment_id)
        await db.execute(f"UPDATE environments SET {', '.join(sets)} WHERE id = ?", params)
        await db.commit()
        cursor = await db.execute("SELECT * FROM environments WHERE id = ?", (environment_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None
    finally:
        await db.close()


async def delete_environment(environment_id: str, db_path: Path | None = None) -> bool:
    """Delete an environment. Returns True if deleted."""
    db = await connect(db_path)
    try:
        cursor = await db.execute("DELETE FROM environments WHERE id = ?", (environment_id,))
        await db.commit()
        return cursor.rowcount > 0
    finally:
        await db.close()


# --- Scene Template CRUD ---


async def create_scene_template(
    template_id: str,
    universe_id: str,
    name: str,
    description: str = "",
    beats: list | None = None,
    min_duration: float = 30,
    max_duration: float = 50,
    min_scenes: int = 5,
    max_scenes: int = 8,
    db_path: Path | None = None,
) -> dict[str, Any]:
    """Create a new scene template and return it."""
    db = await connect(db_path)
    try:
        await db.execute(
            """INSERT INTO scene_templates
               (id, universe_id, name, description, beats_json,
                min_duration, max_duration, min_scenes, max_scenes)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (template_id, universe_id, name, description,
             json.dumps(beats) if beats else None,
             min_duration, max_duration, min_scenes, max_scenes),
        )
        await db.commit()
        cursor = await db.execute("SELECT * FROM scene_templates WHERE id = ?", (template_id,))
        row = await cursor.fetchone()
        return dict(row) if row else {}
    finally:
        await db.close()


async def get_scene_template(template_id: str, db_path: Path | None = None) -> dict[str, Any] | None:
    """Get a scene template by ID."""
    db = await connect(db_path)
    try:
        cursor = await db.execute("SELECT * FROM scene_templates WHERE id = ?", (template_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None
    finally:
        await db.close()


async def list_scene_templates(
    universe_id: str | None = None,
    db_path: Path | None = None,
) -> list[dict[str, Any]]:
    """List scene templates, optionally filtered by universe."""
    db = await connect(db_path)
    try:
        if universe_id:
            cursor = await db.execute(
                "SELECT * FROM scene_templates WHERE universe_id = ? ORDER BY name",
                (universe_id,),
            )
        else:
            cursor = await db.execute("SELECT * FROM scene_templates ORDER BY name")
        return [dict(r) for r in await cursor.fetchall()]
    finally:
        await db.close()


async def update_scene_template(
    template_id: str,
    db_path: Path | None = None,
    **kwargs: Any,
) -> dict[str, Any] | None:
    """Update scene template fields. Returns updated template."""
    db = await connect(db_path)
    try:
        allowed = {"name", "description", "min_duration", "max_duration", "min_scenes", "max_scenes"}
        sets: list[str] = []
        params: list[Any] = []
        for key, val in kwargs.items():
            if key in allowed:
                sets.append(f"{key} = ?")
                params.append(val)
            elif key == "beats":
                sets.append("beats_json = ?")
                params.append(json.dumps(val) if val else None)
        if not sets:
            cursor = await db.execute("SELECT * FROM scene_templates WHERE id = ?", (template_id,))
            row = await cursor.fetchone()
            return dict(row) if row else None
        params.append(template_id)
        await db.execute(f"UPDATE scene_templates SET {', '.join(sets)} WHERE id = ?", params)
        await db.commit()
        cursor = await db.execute("SELECT * FROM scene_templates WHERE id = ?", (template_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None
    finally:
        await db.close()


async def delete_scene_template(template_id: str, db_path: Path | None = None) -> bool:
    """Delete a scene template. Returns True if deleted."""
    db = await connect(db_path)
    try:
        cursor = await db.execute("DELETE FROM scene_templates WHERE id = ?", (template_id,))
        await db.commit()
        return cursor.rowcount > 0
    finally:
        await db.close()

"""SQLite database layer using aiosqlite."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import aiosqlite

from philosophywise.config import get_settings

_SCHEMA = """
CREATE TABLE IF NOT EXISTS philosophers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    civilization TEXT NOT NULL,
    era TEXT NOT NULL DEFAULT '',
    character_description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS quotes (
    id TEXT PRIMARY KEY,
    philosopher_id TEXT NOT NULL REFERENCES philosophers(id),
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
    philosopher_id TEXT NOT NULL REFERENCES philosophers(id),
    hook_quote_id TEXT REFERENCES quotes(id),
    truth_quote_id TEXT REFERENCES quotes(id),
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
    name TEXT NOT NULL DEFAULT '',
    philosopher_id TEXT NOT NULL,
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
        # Migrate: add character columns to philosophers
        for col in ("character_image_url TEXT", "character_ref_urls TEXT"):
            try:
                await db.execute(f"ALTER TABLE philosophers ADD COLUMN {col}")
            except Exception:
                pass  # column already exists
        await db.commit()
    finally:
        await db.close()


async def get_unused_quotes(
    philosopher_id: str,
    function: str | None = None,
    limit: int = 5,
    db_path: Path | None = None,
) -> list[dict[str, Any]]:
    """Return quotes sorted by least used, optionally filtered by emotional_function."""
    db = await connect(db_path)
    try:
        sql = "SELECT * FROM quotes WHERE philosopher_id = ?"
        params: list[Any] = [philosopher_id]
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


async def mark_quote_used(
    quote_id: str,
    video_id: str,
    db_path: Path | None = None,
) -> None:
    """Increment used_count and set last_used_at for a quote."""
    db = await connect(db_path)
    try:
        now = datetime.now(timezone.utc).isoformat()
        await db.execute(
            "UPDATE quotes SET used_count = used_count + 1, last_used_at = ? WHERE id = ?",
            (now, quote_id),
        )
        await db.commit()
    finally:
        await db.close()


async def create_video_record(
    project_id: str,
    philosopher_id: str,
    hook_quote_id: str | None = None,
    truth_quote_id: str | None = None,
    status: str = "queued",
    db_path: Path | None = None,
) -> str:
    """Insert a new video record and return its id."""
    db = await connect(db_path)
    try:
        now = datetime.now(timezone.utc).isoformat()
        await db.execute(
            """INSERT INTO videos (id, philosopher_id, hook_quote_id, truth_quote_id, status, created_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (project_id, philosopher_id, hook_quote_id, truth_quote_id, status, now),
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
    """Return aggregate stats: total videos, total cost, avg cost, quote usage."""
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
            "COALESCE(AVG(used_count), 0) as avg_uses FROM quotes"
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


# --- Philosopher / quote import helpers ---


async def upsert_philosopher(
    philosopher_id: str,
    name: str,
    civilization: str,
    era: str = "",
    character_description: str = "",
    db_path: Path | None = None,
) -> None:
    """Insert or update a philosopher record."""
    db = await connect(db_path)
    try:
        await db.execute(
            """INSERT INTO philosophers (id, name, civilization, era, character_description)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                   name=excluded.name,
                   civilization=excluded.civilization,
                   era=excluded.era,
                   character_description=excluded.character_description""",
            (philosopher_id, name, civilization, era, character_description),
        )
        await db.commit()
    finally:
        await db.close()


async def insert_quote(
    philosopher_id: str,
    text: str,
    theme: str,
    emotional_function: str,
    short_version: str | None = None,
    word_count: int = 0,
    read_time_seconds: float = 0.0,
    pair_with_visual: str = "",
    db_path: Path | None = None,
) -> str:
    """Insert a quote and return its id."""
    db = await connect(db_path)
    try:
        quote_id = uuid.uuid4().hex[:12]
        await db.execute(
            """INSERT INTO quotes
               (id, philosopher_id, text, short_version, theme, emotional_function,
                word_count, read_time_seconds, pair_with_visual)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (quote_id, philosopher_id, text, short_version, theme, emotional_function,
             word_count, read_time_seconds, pair_with_visual),
        )
        await db.commit()
        return quote_id
    finally:
        await db.close()


async def list_quotes(
    philosopher_id: str | None = None,
    function: str | None = None,
    db_path: Path | None = None,
) -> list[dict[str, Any]]:
    """List quotes with optional filters."""
    db = await connect(db_path)
    try:
        sql = "SELECT q.*, p.name as philosopher_name FROM quotes q JOIN philosophers p ON q.philosopher_id = p.id WHERE 1=1"
        params: list[Any] = []
        if philosopher_id:
            sql += " AND q.philosopher_id = ?"
            params.append(philosopher_id)
        if function:
            sql += " AND q.emotional_function = ?"
            params.append(function)
        sql += " ORDER BY q.philosopher_id, q.emotional_function, q.used_count ASC"
        cursor = await db.execute(sql, params)
        return [dict(r) for r in await cursor.fetchall()]
    finally:
        await db.close()


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
    philosopher_id: str,
    civilization: str = "",
    name: str = "",
    hook_quote_id: str | None = None,
    truth_quote_id: str | None = None,
    db_path: Path | None = None,
) -> dict[str, Any]:
    """Create a new project and return it."""
    db = await connect(db_path)
    try:
        now = datetime.now(timezone.utc).isoformat()
        await db.execute(
            """INSERT INTO projects
               (id, name, philosopher_id, civilization, hook_quote_id, truth_quote_id,
                status, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?)""",
            (project_id, name, philosopher_id, civilization,
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

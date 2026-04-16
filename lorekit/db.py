"""PostgreSQL database layer using asyncpg with connection pooling.

Schema is managed by Drizzle ORM (web/drizzle/schema.ts).
This module handles runtime queries only.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

import asyncpg

from lorekit.config import get_settings

# Module-level connection pool
_pool: asyncpg.Pool | None = None


async def init_pool() -> asyncpg.Pool:
    """Create the global connection pool. Called once at startup."""
    global _pool
    settings = get_settings()
    _pool = await asyncpg.create_pool(
        settings.database_url,
        min_size=2,
        max_size=10,
    )
    return _pool


async def close_pool() -> None:
    """Shutdown the connection pool. Called at app shutdown."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


async def get_pool() -> asyncpg.Pool:
    """Return the pool, creating it if needed."""
    if _pool is None:
        await init_pool()
    assert _pool is not None
    return _pool


def _row_to_dict(row: asyncpg.Record | None) -> dict[str, Any] | None:
    """Convert an asyncpg Record to a dict, or None if row is None."""
    return dict(row) if row else None


def _rows_to_dicts(rows: list[asyncpg.Record]) -> list[dict[str, Any]]:
    """Convert a list of asyncpg Records to list of dicts."""
    return [dict(r) for r in rows]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# --- Source item helpers ---


async def get_unused_source_items(
    character_id: str,
    function: str | None = None,
    limit: int = 5,
) -> list[dict[str, Any]]:
    """Return source items sorted by least used, optionally filtered by emotional_function."""
    cid = character_id
    pool = await get_pool()
    sql = "SELECT * FROM source_items WHERE character_id = $1"
    params: list[Any] = [cid]
    idx = 2
    if function:
        sql += f" AND emotional_function = ${idx}"
        params.append(function)
        idx += 1
    sql += f" ORDER BY used_count ASC, last_used_at ASC NULLS FIRST LIMIT ${idx}"
    params.append(limit)
    rows = await pool.fetch(sql, *params)
    return _rows_to_dicts(rows)


# Backward compatibility alias
get_unused_quotes = get_unused_source_items


async def mark_source_item_used(
    quote_id: str,
    video_id: str,
) -> None:
    """Increment used_count and set last_used_at for a source item."""
    pool = await get_pool()
    now = _now()
    await pool.execute(
        "UPDATE source_items SET used_count = used_count + 1, last_used_at = $1 WHERE id = $2",
        now, quote_id,
    )


# Backward compatibility alias
mark_quote_used = mark_source_item_used


async def log_cost(
    video_id: str,
    component: str,
    amount: float,
) -> None:
    """Record a cost entry for a pipeline component."""
    pool = await get_pool()
    cost_id = uuid.uuid4().hex[:12]
    now = _now()
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                "INSERT INTO costs (id, video_id, component, amount_usd, created_at) VALUES ($1, $2, $3, $4, $5)",
                cost_id, video_id, component, amount, now,
            )
            await conn.execute(
                "UPDATE universe_projects SET cost_usd = cost_usd + $1 WHERE id = $2",
                amount, video_id,
            )


async def get_stats(org_id: str | None = None) -> dict[str, Any]:
    """Return aggregate stats, scoped to org if provided."""
    pool = await get_pool()

    if org_id:
        row = await pool.fetchrow(
            """SELECT COUNT(*) as total, COALESCE(SUM(p.cost_usd), 0) as total_cost,
                      COALESCE(AVG(p.cost_usd), 0) as avg_cost
               FROM universe_projects p JOIN universes u ON p.universe_id = u.id
               WHERE u.organization_id = $1""", org_id,
        )
        quote_row = await pool.fetchrow(
            """SELECT COUNT(*) as total_quotes,
                      COALESCE(SUM(q.used_count), 0) as total_uses,
                      COALESCE(AVG(q.used_count), 0) as avg_uses
               FROM source_items q JOIN universes u ON q.universe_id = u.id
               WHERE u.organization_id = $1""", org_id,
        )
        cost_rows = await pool.fetch(
            """SELECT c.component, COALESCE(SUM(c.amount_usd), 0) as total
               FROM costs c JOIN universe_projects p ON c.video_id = p.id
               JOIN universes u ON p.universe_id = u.id
               WHERE u.organization_id = $1
               GROUP BY c.component ORDER BY total DESC""", org_id,
        )
    else:
        row = await pool.fetchrow(
            "SELECT COUNT(*) as total, COALESCE(SUM(cost_usd), 0) as total_cost, "
            "COALESCE(AVG(cost_usd), 0) as avg_cost FROM universe_projects"
        )
        quote_row = await pool.fetchrow(
            "SELECT COUNT(*) as total_quotes, "
            "COALESCE(SUM(used_count), 0) as total_uses, "
            "COALESCE(AVG(used_count), 0) as avg_uses FROM source_items"
        )
        cost_rows = await pool.fetch(
            "SELECT component, COALESCE(SUM(amount_usd), 0) as total "
            "FROM costs GROUP BY component ORDER BY total DESC"
        )

    video_stats = dict(row) if row else {"total": 0, "total_cost": 0.0, "avg_cost": 0.0}
    quote_stats = dict(quote_row) if quote_row else {"total_quotes": 0, "total_uses": 0, "avg_uses": 0.0}
    cost_breakdown = _rows_to_dicts(cost_rows)

    return {
        "videos": video_stats,
        "quotes": quote_stats,
        "cost_breakdown": cost_breakdown,
    }


# --- Character / source item import helpers ---


async def upsert_character(
    character_id: str,
    name: str,
    group_name: str,
    era: str = "",
    character_description: str = "",
    target_audience: str = "",
    performance_notes: str = "",
    universe_id: str | None = None,
) -> None:
    """Insert or update a character record."""
    if not universe_id:
        raise ValueError("universe_id is required when creating a character")
    pool = await get_pool()
    await pool.execute(
        """INSERT INTO characters (id, universe_id, name, group_name, era, character_description, target_audience, performance_notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT(id) DO UPDATE SET
               name=EXCLUDED.name,
               group_name=EXCLUDED.group_name,
               era=EXCLUDED.era,
               character_description=EXCLUDED.character_description,
               target_audience=EXCLUDED.target_audience,
               performance_notes=EXCLUDED.performance_notes""",
        character_id, universe_id, name, group_name, era, character_description, target_audience, performance_notes,
    )


async def insert_source_item(
    character_id: str,
    text: str,
    theme: str,
    emotional_function: str,
    universe_id: str | None = None,
    short_version: str | None = None,
    word_count: int = 0,
    read_time_seconds: float = 0.0,
    pair_with_visual: str = "",
) -> str:
    """Insert a source item and return its id."""
    cid = character_id
    pool = await get_pool()
    item_id = uuid.uuid4().hex[:12]
    await pool.execute(
        """INSERT INTO source_items
           (id, character_id, universe_id, text, short_version, theme, emotional_function,
            word_count, read_time_seconds, pair_with_visual)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)""",
        item_id, cid, universe_id, text, short_version, theme, emotional_function,
        word_count, read_time_seconds, pair_with_visual,
    )
    return item_id


# Backward compatibility alias
insert_quote = insert_source_item


async def list_source_items(
    character_id: str | None = None,
    function: str | None = None,
) -> list[dict[str, Any]]:
    """List source items with optional filters."""
    cid = character_id
    pool = await get_pool()
    sql = (
        "SELECT q.*, c.name as character_name "
        "FROM source_items q JOIN characters c ON q.character_id = c.id WHERE 1=1"
    )
    params: list[Any] = []
    idx = 1
    if cid:
        sql += f" AND q.character_id = ${idx}"
        params.append(cid)
        idx += 1
    if function:
        sql += f" AND q.emotional_function = ${idx}"
        params.append(function)
        idx += 1
    sql += " ORDER BY q.character_id, q.emotional_function, q.used_count ASC"
    rows = await pool.fetch(sql, *params)
    return _rows_to_dicts(rows)


# Backward compatibility alias
list_quotes = list_source_items


# --- Project CRUD ---


async def create_project(
    project_id: str,
    character_id: str,
    name: str = "",
    universe_id: str | None = None,
    hook_quote_id: str | None = None,
    truth_quote_id: str | None = None,
    source_type: str = "quote",
    script_id: str | None = None,
    character_ids_json: str | None = None,
) -> dict[str, Any]:
    """Create a new project and return it."""
    cid = character_id
    pool = await get_pool()
    now = _now()
    await pool.execute(
        """INSERT INTO universe_projects
           (id, universe_id, name, character_id, hook_quote_id, truth_quote_id,
            source_type, script_id, character_ids_json,
            status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft', $10, $11)""",
        project_id, universe_id, name, cid,
        hook_quote_id, truth_quote_id,
        source_type, script_id, character_ids_json,
        now, now,
    )
    row = await pool.fetchrow("SELECT * FROM universe_projects WHERE id = $1", project_id)
    return dict(row) if row else {}


async def get_project(
    project_id: str,
    org_id: str | None = None,
) -> dict[str, Any] | None:
    """Get a single project by ID, optionally scoped to org."""
    pool = await get_pool()
    if org_id:
        row = await pool.fetchrow(
            """SELECT p.* FROM universe_projects p
               JOIN universes u ON p.universe_id = u.id
               WHERE p.id = $1 AND u.organization_id = $2""",
            project_id, org_id,
        )
    else:
        row = await pool.fetchrow("SELECT * FROM universe_projects WHERE id = $1", project_id)
    return _row_to_dict(row)


async def list_projects(
    status: str | None = None,
    limit: int = 50,
    org_id: str | None = None,
) -> list[dict[str, Any]]:
    """List projects, optionally filtered by status and org."""
    pool = await get_pool()
    params: list[Any] = []
    idx = 1
    if org_id:
        sql = """SELECT p.* FROM universe_projects p
                 JOIN universes u ON p.universe_id = u.id
                 WHERE u.organization_id = $1"""
        params.append(org_id)
        idx += 1
    else:
        sql = "SELECT * FROM universe_projects WHERE 1=1"
    if status:
        sql += f" AND status = ${idx}"
        params.append(status)
        idx += 1
    sql += f" ORDER BY created_at DESC LIMIT ${idx}"
    params.append(limit)
    rows = await pool.fetch(sql, *params)
    return _rows_to_dicts(rows)


async def update_project(
    project_id: str,
    *,
    org_id: str | None = None,
    **kwargs: Any,
) -> dict[str, Any] | None:
    """Update project fields. Returns updated project.

    When ``org_id`` is provided the UPDATE joins on ``universes`` to verify
    that the project belongs to the given organisation, preventing cross-tenant
    writes.
    """
    pool = await get_pool()
    allowed = {
        "name", "status", "timeline_json", "workflow_json", "output_path",
        "youtube_id", "youtube_title", "cost_usd",
        "hook_quote_id", "truth_quote_id",
        "character_image_url", "character_image_path",
        "source_type", "script_id", "character_ids_json",
        "audio_mode", "uploaded_audio_path", "aspect_ratio",
        "theme",
    }
    sets = ["updated_at = $1"]
    params: list[Any] = [_now()]
    idx = 2
    for key, val in kwargs.items():
        if key in allowed:
            sets.append(f"{key} = ${idx}")
            params.append(val)
            idx += 1
    params.append(project_id)
    if org_id:
        params.append(org_id)
        await pool.execute(
            f"UPDATE universe_projects p SET {', '.join(sets)} "
            f"FROM universes u "
            f"WHERE p.universe_id = u.id AND p.id = ${idx} AND u.organization_id = ${idx + 1}",
            *params,
        )
    else:
        await pool.execute(
            f"UPDATE universe_projects SET {', '.join(sets)} WHERE id = ${idx}",
            *params,
        )
    row = await pool.fetchrow("SELECT * FROM universe_projects WHERE id = $1", project_id)
    return _row_to_dict(row)


async def delete_project(project_id: str) -> bool:
    """Delete a project. Returns True if deleted."""
    pool = await get_pool()
    result = await pool.execute("DELETE FROM universe_projects WHERE id = $1", project_id)
    return result == "DELETE 1"


# --- Job tracking ---


async def create_job(
    job_id: str,
    project_id: str,
    job_type: str,
) -> dict[str, Any]:
    """Create a new job record."""
    pool = await get_pool()
    now = _now()
    await pool.execute(
        """INSERT INTO jobs (id, project_id, type, status, progress, message, created_at, updated_at)
           VALUES ($1, $2, $3, 'pending', 0.0, '', $4, $5)""",
        job_id, project_id, job_type, now, now,
    )
    row = await pool.fetchrow("SELECT * FROM jobs WHERE id = $1", job_id)
    return dict(row) if row else {}


async def get_job(job_id: str) -> dict[str, Any] | None:
    """Get a job by ID."""
    pool = await get_pool()
    row = await pool.fetchrow("SELECT * FROM jobs WHERE id = $1", job_id)
    return _row_to_dict(row)


async def update_job(
    job_id: str,
    **kwargs: Any,
) -> None:
    """Update job fields (status, progress, message, result_json)."""
    pool = await get_pool()
    allowed = {"status", "progress", "message", "result_json"}
    sets = ["updated_at = $1"]
    params: list[Any] = [_now()]
    idx = 2
    for key, val in kwargs.items():
        if key in allowed:
            sets.append(f"{key} = ${idx}")
            params.append(val)
            idx += 1
    params.append(job_id)
    await pool.execute(
        f"UPDATE jobs SET {', '.join(sets)} WHERE id = ${idx}",
        *params,
    )


async def delete_job(job_id: str) -> None:
    """Delete a job by ID."""
    pool = await get_pool()
    await pool.execute("DELETE FROM jobs WHERE id = $1", job_id)


# --- Universe CRUD ---


async def create_universe(
    universe_id: str,
    name: str,
    description: str = "",
    icon: str = "",
    video_vibe_preset: str = "mobile_game",
    organization_id: str = "local",
    created_by: str = "local",
) -> dict[str, Any]:
    """Create a new universe and return it."""
    pool = await get_pool()
    now = _now()
    await pool.execute(
        """INSERT INTO universes
           (id, name, description, icon, video_vibe_preset, organization_id, created_by, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)""",
        universe_id, name, description, icon, video_vibe_preset, organization_id, created_by, now,
    )
    row = await pool.fetchrow("SELECT * FROM universes WHERE id = $1", universe_id)
    return dict(row) if row else {}


async def get_universe(
    universe_id: str,
    org_id: str | None = None,
) -> dict[str, Any] | None:
    """Get a universe by ID with character and project counts."""
    pool = await get_pool()
    sql = """
        SELECT u.*,
               (SELECT COUNT(*) FROM characters c WHERE c.universe_id = u.id) as character_count,
               (SELECT COUNT(*) FROM universe_projects p WHERE p.universe_id = u.id) as project_count
        FROM universes u WHERE u.id = $1
    """
    params: list[Any] = [universe_id]
    if org_id:
        sql += " AND u.organization_id = $2"
        params.append(org_id)
    row = await pool.fetchrow(sql, *params)
    return _row_to_dict(row)


async def list_universes(
    org_id: str | None = None,
) -> list[dict[str, Any]]:
    """List universes with character and project counts."""
    pool = await get_pool()
    if org_id:
        rows = await pool.fetch(
            """SELECT u.*,
                      (SELECT COUNT(*) FROM characters c WHERE c.universe_id = u.id) as character_count,
                      (SELECT COUNT(*) FROM universe_projects p WHERE p.universe_id = u.id) as project_count
               FROM universes u WHERE u.organization_id = $1 ORDER BY u.created_at DESC""",
            org_id,
        )
    else:
        rows = await pool.fetch(
            """SELECT u.*,
                      (SELECT COUNT(*) FROM characters c WHERE c.universe_id = u.id) as character_count,
                      (SELECT COUNT(*) FROM universe_projects p WHERE p.universe_id = u.id) as project_count
               FROM universes u ORDER BY u.created_at DESC"""
        )
    return _rows_to_dicts(rows)


async def update_universe(
    universe_id: str,
    **kwargs: Any,
) -> dict[str, Any] | None:
    """Update universe fields. Returns updated universe."""
    pool = await get_pool()
    allowed = {"name", "description", "icon", "video_vibe_preset"}
    sets: list[str] = []
    params: list[Any] = []
    idx = 1
    for key, val in kwargs.items():
        if key in allowed:
            sets.append(f"{key} = ${idx}")
            params.append(val)
            idx += 1
    if not sets:
        return await get_universe(universe_id)
    params.append(universe_id)
    await pool.execute(
        f"UPDATE universes SET {', '.join(sets)} WHERE id = ${idx}",
        *params,
    )
    row = await pool.fetchrow("SELECT * FROM universes WHERE id = $1", universe_id)
    return _row_to_dict(row)


async def delete_universe(universe_id: str) -> bool:
    """Delete a universe and all related data. Returns True if deleted."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow("SELECT id FROM universes WHERE id = $1", universe_id)
            if not row:
                return False
            await conn.execute("DELETE FROM scripts WHERE universe_id = $1", universe_id)
            await conn.execute("DELETE FROM character_voices WHERE character_id IN (SELECT id FROM characters WHERE universe_id = $1)", universe_id)
            await conn.execute("DELETE FROM project_audio_assets WHERE project_id IN (SELECT id FROM universe_projects WHERE universe_id = $1)", universe_id)
            await conn.execute("DELETE FROM document_chunks WHERE character_id IN (SELECT id FROM characters WHERE universe_id = $1)", universe_id)
            await conn.execute("DELETE FROM character_documents WHERE universe_id = $1", universe_id)
            await conn.execute("DELETE FROM scene_templates WHERE universe_id = $1", universe_id)
            await conn.execute("DELETE FROM environments WHERE universe_id = $1", universe_id)
            await conn.execute("DELETE FROM source_items WHERE universe_id = $1", universe_id)
            await conn.execute("DELETE FROM jobs WHERE project_id IN (SELECT id FROM universe_projects WHERE universe_id = $1)", universe_id)
            await conn.execute("DELETE FROM costs WHERE video_id IN (SELECT id FROM universe_projects WHERE universe_id = $1)", universe_id)
            await conn.execute("DELETE FROM universe_projects WHERE universe_id = $1", universe_id)
            await conn.execute("DELETE FROM characters WHERE universe_id = $1", universe_id)
            await conn.execute("DELETE FROM universes WHERE id = $1", universe_id)
            return True


async def list_characters_by_universe(
    universe_id: str,
) -> list[dict[str, Any]]:
    """List characters in a universe with source item counts."""
    pool = await get_pool()
    rows = await pool.fetch("""
        SELECT c.*,
               (SELECT COUNT(*) FROM source_items q WHERE q.character_id = c.id) as quote_count,
               (SELECT COUNT(*) FROM source_items q WHERE q.character_id = c.id AND q.emotional_function = 'hook') as hook_count,
               (SELECT COUNT(*) FROM source_items q WHERE q.character_id = c.id AND q.emotional_function = 'truth') as truth_count
        FROM characters c WHERE c.universe_id = $1 ORDER BY c.name
    """, universe_id)
    return _rows_to_dicts(rows)


async def list_projects_by_universe(
    universe_id: str,
    status: str | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """List projects in a universe."""
    pool = await get_pool()
    params: list[Any] = [universe_id]
    idx = 2
    sql = "SELECT * FROM universe_projects WHERE universe_id = $1"
    if status:
        sql += f" AND status = ${idx}"
        params.append(status)
        idx += 1
    sql += f" ORDER BY created_at DESC LIMIT ${idx}"
    params.append(limit)
    rows = await pool.fetch(sql, *params)
    return _rows_to_dicts(rows)


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
) -> dict[str, Any]:
    """Create a new environment and return it."""
    pool = await get_pool()
    await pool.execute(
        """INSERT INTO environments
           (id, universe_id, name, color_grade_json, font, text_color, text_shadow,
            environment_description, themed_descriptions_json)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)""",
        environment_id, universe_id, name,
        json.dumps(color_grade) if color_grade else None,
        font, text_color, text_shadow, environment_description,
        json.dumps(themed_descriptions) if themed_descriptions else None,
    )
    row = await pool.fetchrow("SELECT * FROM environments WHERE id = $1", environment_id)
    return dict(row) if row else {}


async def get_environment(environment_id: str) -> dict[str, Any] | None:
    """Get an environment by ID."""
    pool = await get_pool()
    row = await pool.fetchrow("SELECT * FROM environments WHERE id = $1", environment_id)
    return _row_to_dict(row)


async def list_environments(
    universe_id: str | None = None,
) -> list[dict[str, Any]]:
    """List environments, optionally filtered by universe."""
    pool = await get_pool()
    if universe_id:
        rows = await pool.fetch(
            "SELECT * FROM environments WHERE universe_id = $1 ORDER BY name",
            universe_id,
        )
    else:
        rows = await pool.fetch("SELECT * FROM environments ORDER BY name")
    return _rows_to_dicts(rows)


async def update_environment(
    environment_id: str,
    **kwargs: Any,
) -> dict[str, Any] | None:
    """Update environment fields. Returns updated environment."""
    pool = await get_pool()
    allowed = {
        "name", "font", "text_color", "text_shadow",
        "environment_description",
    }
    sets: list[str] = []
    params: list[Any] = []
    idx = 1
    for key, val in kwargs.items():
        if key in allowed:
            sets.append(f"{key} = ${idx}")
            params.append(val)
            idx += 1
        elif key == "color_grade":
            sets.append(f"color_grade_json = ${idx}")
            params.append(json.dumps(val) if val else None)
            idx += 1
        elif key == "themed_descriptions":
            sets.append(f"themed_descriptions_json = ${idx}")
            params.append(json.dumps(val) if val else None)
            idx += 1
    if not sets:
        row = await pool.fetchrow("SELECT * FROM environments WHERE id = $1", environment_id)
        return _row_to_dict(row)
    params.append(environment_id)
    await pool.execute(
        f"UPDATE environments SET {', '.join(sets)} WHERE id = ${idx}",
        *params,
    )
    row = await pool.fetchrow("SELECT * FROM environments WHERE id = $1", environment_id)
    return _row_to_dict(row)


async def delete_environment(environment_id: str) -> bool:
    """Delete an environment. Returns True if deleted."""
    pool = await get_pool()
    result = await pool.execute("DELETE FROM environments WHERE id = $1", environment_id)
    return result == "DELETE 1"


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
) -> dict[str, Any]:
    """Create a new scene template and return it."""
    pool = await get_pool()
    await pool.execute(
        """INSERT INTO scene_templates
           (id, universe_id, name, description, beats_json,
            min_duration, max_duration, min_scenes, max_scenes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)""",
        template_id, universe_id, name, description,
        json.dumps(beats) if beats else None,
        min_duration, max_duration, min_scenes, max_scenes,
    )
    row = await pool.fetchrow("SELECT * FROM scene_templates WHERE id = $1", template_id)
    return dict(row) if row else {}


async def get_scene_template(template_id: str) -> dict[str, Any] | None:
    """Get a scene template by ID."""
    pool = await get_pool()
    row = await pool.fetchrow("SELECT * FROM scene_templates WHERE id = $1", template_id)
    return _row_to_dict(row)


async def list_scene_templates(
    universe_id: str | None = None,
) -> list[dict[str, Any]]:
    """List scene templates, optionally filtered by universe."""
    pool = await get_pool()
    if universe_id:
        rows = await pool.fetch(
            "SELECT * FROM scene_templates WHERE universe_id = $1 ORDER BY name",
            universe_id,
        )
    else:
        rows = await pool.fetch("SELECT * FROM scene_templates ORDER BY name")
    return _rows_to_dicts(rows)


async def update_scene_template(
    template_id: str,
    **kwargs: Any,
) -> dict[str, Any] | None:
    """Update scene template fields. Returns updated template."""
    pool = await get_pool()
    allowed = {"name", "description", "min_duration", "max_duration", "min_scenes", "max_scenes"}
    sets: list[str] = []
    params: list[Any] = []
    idx = 1
    for key, val in kwargs.items():
        if key in allowed:
            sets.append(f"{key} = ${idx}")
            params.append(val)
            idx += 1
        elif key == "beats":
            sets.append(f"beats_json = ${idx}")
            params.append(json.dumps(val) if val else None)
            idx += 1
    if not sets:
        row = await pool.fetchrow("SELECT * FROM scene_templates WHERE id = $1", template_id)
        return _row_to_dict(row)
    params.append(template_id)
    await pool.execute(
        f"UPDATE scene_templates SET {', '.join(sets)} WHERE id = ${idx}",
        *params,
    )
    row = await pool.fetchrow("SELECT * FROM scene_templates WHERE id = $1", template_id)
    return _row_to_dict(row)


async def delete_scene_template(template_id: str) -> bool:
    """Delete a scene template. Returns True if deleted."""
    pool = await get_pool()
    result = await pool.execute("DELETE FROM scene_templates WHERE id = $1", template_id)
    return result == "DELETE 1"


# --- Character Document CRUD ---


async def create_document(
    doc_id: str,
    character_id: str,
    universe_id: str,
    name: str,
    doc_type: str = "text",
    content: str | None = None,
    file_path: str | None = None,
    file_size_bytes: int = 0,
    metadata_json: str | None = None,
) -> dict[str, Any]:
    """Create a new character document and return it."""
    pool = await get_pool()
    now = _now()
    await pool.execute(
        """INSERT INTO character_documents
           (id, character_id, universe_id, name, doc_type, content,
            file_path, file_size_bytes, chunk_count, status, metadata_json,
            created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, 'pending', $9, $10, $11)""",
        doc_id, character_id, universe_id, name, doc_type, content,
        file_path, file_size_bytes, metadata_json, now, now,
    )
    row = await pool.fetchrow("SELECT * FROM character_documents WHERE id = $1", doc_id)
    return dict(row) if row else {}


async def get_document(doc_id: str) -> dict[str, Any] | None:
    """Get a document by ID."""
    pool = await get_pool()
    row = await pool.fetchrow("SELECT * FROM character_documents WHERE id = $1", doc_id)
    return _row_to_dict(row)


async def list_documents_by_character(
    character_id: str,
) -> list[dict[str, Any]]:
    """List documents for a character."""
    pool = await get_pool()
    rows = await pool.fetch(
        "SELECT * FROM character_documents WHERE character_id = $1 ORDER BY created_at DESC",
        character_id,
    )
    return _rows_to_dicts(rows)


async def delete_document(doc_id: str) -> bool:
    """Delete a document AND its chunks. Returns True if deleted."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute("DELETE FROM document_chunks WHERE document_id = $1", doc_id)
            result = await conn.execute("DELETE FROM character_documents WHERE id = $1", doc_id)
            return result == "DELETE 1"


async def update_document(
    doc_id: str,
    **kwargs: Any,
) -> dict[str, Any] | None:
    """Update document fields (status, chunk_count, etc.). Returns updated document."""
    pool = await get_pool()
    allowed = {"status", "chunk_count", "content", "file_path", "file_size_bytes", "metadata_json", "name", "doc_type"}
    sets = ["updated_at = $1"]
    params: list[Any] = [_now()]
    idx = 2
    for key, val in kwargs.items():
        if key in allowed:
            sets.append(f"{key} = ${idx}")
            params.append(val)
            idx += 1
    params.append(doc_id)
    await pool.execute(
        f"UPDATE character_documents SET {', '.join(sets)} WHERE id = ${idx}",
        *params,
    )
    row = await pool.fetchrow("SELECT * FROM character_documents WHERE id = $1", doc_id)
    return _row_to_dict(row)


async def create_chunk(
    chunk_id: str,
    document_id: str,
    character_id: str,
    chunk_index: int,
    content: str,
    token_count: int = 0,
) -> dict[str, Any]:
    """Create a document chunk and return it."""
    pool = await get_pool()
    now = _now()
    await pool.execute(
        """INSERT INTO document_chunks
           (id, document_id, character_id, chunk_index, content, token_count, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)""",
        chunk_id, document_id, character_id, chunk_index, content, token_count, now,
    )
    row = await pool.fetchrow("SELECT * FROM document_chunks WHERE id = $1", chunk_id)
    return dict(row) if row else {}


async def list_chunks_by_document(
    document_id: str,
) -> list[dict[str, Any]]:
    """List chunks for a document, ordered by chunk_index."""
    pool = await get_pool()
    rows = await pool.fetch(
        "SELECT * FROM document_chunks WHERE document_id = $1 ORDER BY chunk_index",
        document_id,
    )
    return _rows_to_dicts(rows)


async def delete_chunks_by_document(
    document_id: str,
) -> None:
    """Delete all chunks for a document."""
    pool = await get_pool()
    await pool.execute("DELETE FROM document_chunks WHERE document_id = $1", document_id)


# --- Script CRUD ---


async def create_script(
    script_id: str,
    universe_id: str,
    title: str,
    script_type: str = "idea",
    content: str = "",
    character_ids: list[str] | None = None,
    target_duration_seconds: int | None = None,
    scene_count: int | None = None,
    metadata: dict | None = None,
) -> dict[str, Any]:
    """Create a new script and return it."""
    pool = await get_pool()
    now = _now()
    await pool.execute(
        """INSERT INTO scripts
           (id, universe_id, title, script_type, content,
            character_ids_json, target_duration_seconds, scene_count,
            status, metadata_json, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', $9, $10, $11)""",
        script_id, universe_id, title, script_type, content,
        json.dumps(character_ids) if character_ids else None,
        target_duration_seconds, scene_count,
        json.dumps(metadata) if metadata else None,
        now, now,
    )
    row = await pool.fetchrow("SELECT * FROM scripts WHERE id = $1", script_id)
    return dict(row) if row else {}


async def get_script(script_id: str) -> dict[str, Any] | None:
    """Get a script by ID."""
    pool = await get_pool()
    row = await pool.fetchrow("SELECT * FROM scripts WHERE id = $1", script_id)
    return _row_to_dict(row)


async def list_scripts_by_universe(
    universe_id: str,
    character_id: str | None = None,
    script_type: str | None = None,
) -> list[dict[str, Any]]:
    """List scripts in a universe with optional filters."""
    pool = await get_pool()
    sql = "SELECT * FROM scripts WHERE universe_id = $1"
    params: list[Any] = [universe_id]
    idx = 2
    if character_id:
        sql += f" AND character_ids_json LIKE ${idx}"
        params.append(f"%{character_id}%")
        idx += 1
    if script_type:
        sql += f" AND script_type = ${idx}"
        params.append(script_type)
        idx += 1
    sql += " ORDER BY created_at DESC"
    rows = await pool.fetch(sql, *params)
    return _rows_to_dicts(rows)


async def update_script(
    script_id: str,
    **kwargs: Any,
) -> dict[str, Any] | None:
    """Update script fields. Returns updated script."""
    pool = await get_pool()
    allowed = {
        "title", "content", "script_type", "status",
        "target_duration_seconds", "scene_count",
    }
    sets = ["updated_at = $1"]
    params: list[Any] = [_now()]
    idx = 2
    for key, val in kwargs.items():
        if key in allowed:
            sets.append(f"{key} = ${idx}")
            params.append(val)
            idx += 1
        elif key == "character_ids":
            sets.append(f"character_ids_json = ${idx}")
            params.append(json.dumps(val) if val else None)
            idx += 1
        elif key == "metadata":
            sets.append(f"metadata_json = ${idx}")
            params.append(json.dumps(val) if val else None)
            idx += 1
    params.append(script_id)
    await pool.execute(
        f"UPDATE scripts SET {', '.join(sets)} WHERE id = ${idx}",
        *params,
    )
    row = await pool.fetchrow("SELECT * FROM scripts WHERE id = $1", script_id)
    return _row_to_dict(row)


async def delete_script(script_id: str) -> bool:
    """Delete a script. Returns True if deleted."""
    pool = await get_pool()
    result = await pool.execute("DELETE FROM scripts WHERE id = $1", script_id)
    return result == "DELETE 1"


# --- Character Voice CRUD ---


async def create_character_voice(
    voice_id: str,
    character_id: str,
    tts_model: str = "fal-ai/minimax/speech-2.6-turbo",
    voice_id_str: str | None = None,
    voice_name: str = "Default",
    reference_audio_path: str | None = None,
    settings_json: str | None = None,
) -> dict[str, Any]:
    """Create a character voice profile and return it."""
    pool = await get_pool()
    now = _now()
    await pool.execute(
        """INSERT INTO character_voices
           (id, character_id, tts_model, voice_id, voice_name,
            reference_audio_path, settings_json, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)""",
        voice_id, character_id, tts_model, voice_id_str, voice_name,
        reference_audio_path, settings_json, now, now,
    )
    row = await pool.fetchrow("SELECT * FROM character_voices WHERE id = $1", voice_id)
    return dict(row) if row else {}


async def get_character_voice(
    character_id: str,
) -> dict[str, Any] | None:
    """Get the voice profile for a character."""
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT * FROM character_voices WHERE character_id = $1 LIMIT 1",
        character_id,
    )
    return _row_to_dict(row)


async def update_character_voice(
    voice_id: str,
    **kwargs: Any,
) -> dict[str, Any] | None:
    """Update character voice fields. Returns updated voice."""
    pool = await get_pool()
    allowed = {"tts_model", "voice_id", "voice_name", "reference_audio_path", "settings_json"}
    sets = ["updated_at = $1"]
    params: list[Any] = [_now()]
    idx = 2
    for key, val in kwargs.items():
        if key in allowed:
            sets.append(f"{key} = ${idx}")
            params.append(val)
            idx += 1
    params.append(voice_id)
    await pool.execute(
        f"UPDATE character_voices SET {', '.join(sets)} WHERE id = ${idx}",
        *params,
    )
    row = await pool.fetchrow("SELECT * FROM character_voices WHERE id = $1", voice_id)
    return _row_to_dict(row)


async def delete_character_voice(
    voice_id: str,
) -> bool:
    """Delete a character voice profile. Returns True if deleted."""
    pool = await get_pool()
    result = await pool.execute("DELETE FROM character_voices WHERE id = $1", voice_id)
    return result == "DELETE 1"


# --- Project Audio Asset CRUD ---


async def create_audio_asset(
    asset_id: str,
    project_id: str,
    asset_type: str = "music",
    name: str = "",
    file_path: str = "",
    duration_seconds: float | None = None,
    metadata_json: str | None = None,
) -> dict[str, Any]:
    """Create a project audio asset and return it."""
    pool = await get_pool()
    now = _now()
    await pool.execute(
        """INSERT INTO project_audio_assets
           (id, project_id, asset_type, name, file_path, duration_seconds, metadata_json, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)""",
        asset_id, project_id, asset_type, name, file_path, duration_seconds, metadata_json, now,
    )
    row = await pool.fetchrow("SELECT * FROM project_audio_assets WHERE id = $1", asset_id)
    return dict(row) if row else {}


async def list_audio_assets(
    project_id: str,
) -> list[dict[str, Any]]:
    """List audio assets for a project."""
    pool = await get_pool()
    rows = await pool.fetch(
        "SELECT * FROM project_audio_assets WHERE project_id = $1 ORDER BY created_at DESC",
        project_id,
    )
    return _rows_to_dicts(rows)


async def delete_audio_asset(
    asset_id: str,
) -> bool:
    """Delete an audio asset. Returns True if deleted."""
    pool = await get_pool()
    result = await pool.execute("DELETE FROM project_audio_assets WHERE id = $1", asset_id)
    return result == "DELETE 1"


# --- Video Style CRUD ---


async def create_video_style(
    style_id: str,
    name: str,
    prompt: str,
    description: str = "",
    character_prompt: str = "",
    image_model: str = "kontext",
    is_builtin: int = 0,
    organization_id: str = "local",
) -> dict[str, Any]:
    """Create a video style and return it."""
    pool = await get_pool()
    now = datetime.now(timezone.utc).isoformat()
    await pool.execute(
        """INSERT INTO video_styles
           (id, name, description, prompt, character_prompt, image_model, is_builtin, organization_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO NOTHING""",
        style_id, name, description, prompt, character_prompt, image_model, is_builtin, organization_id, now,
    )
    row = await pool.fetchrow("SELECT * FROM video_styles WHERE id = $1", style_id)
    return dict(row) if row else {}


async def get_video_style(style_id: str) -> dict[str, Any] | None:
    """Get a video style by ID."""
    pool = await get_pool()
    row = await pool.fetchrow("SELECT * FROM video_styles WHERE id = $1", style_id)
    return _row_to_dict(row)


async def list_video_styles(
    organization_id: str | None = None,
) -> list[dict[str, Any]]:
    """List video styles (built-in + org-specific)."""
    pool = await get_pool()
    if organization_id:
        rows = await pool.fetch(
            "SELECT * FROM video_styles WHERE is_builtin = 1 OR organization_id = $1 ORDER BY is_builtin DESC, name",
            organization_id,
        )
    else:
        rows = await pool.fetch("SELECT * FROM video_styles ORDER BY is_builtin DESC, name")
    return _rows_to_dicts(rows)


async def update_video_style(
    style_id: str,
    **kwargs: Any,
) -> dict[str, Any] | None:
    """Update video style fields. Returns updated style. Cannot update built-in styles."""
    pool = await get_pool()
    allowed = {"name", "description", "prompt", "character_prompt", "image_model"}
    sets: list[str] = []
    params: list[Any] = []
    idx = 1
    for key, val in kwargs.items():
        if key in allowed:
            sets.append(f"{key} = ${idx}")
            params.append(val)
            idx += 1
    if not sets:
        row = await pool.fetchrow("SELECT * FROM video_styles WHERE id = $1", style_id)
        return _row_to_dict(row)
    params.append(style_id)
    await pool.execute(
        f"UPDATE video_styles SET {', '.join(sets)} WHERE id = ${idx} AND is_builtin = 0",
        *params,
    )
    row = await pool.fetchrow("SELECT * FROM video_styles WHERE id = $1", style_id)
    return _row_to_dict(row)


async def delete_video_style(style_id: str) -> bool:
    """Delete a video style. Only non-builtin styles can be deleted."""
    pool = await get_pool()
    result = await pool.execute(
        "DELETE FROM video_styles WHERE id = $1 AND is_builtin = 0", style_id
    )
    return result == "DELETE 1"


async def seed_builtin_video_styles() -> None:
    """Seed built-in video styles from VIBE_PRESETS if they don't exist."""
    from lorekit.config import VIBE_PRESETS

    # Model assignment per style — nano_banana_2 for photorealistic, kontext for stylized
    _STYLE_MODELS: dict[str, str] = {
        "dark_masculine": "kontext",
        "mobile_game": "kontext",
        "stylized_cinematic": "kontext",
        "cinematic": "nano_banana_2",
        "ugc_selfie": "nano_banana_2",
    }

    pool = await get_pool()
    now = datetime.now(timezone.utc).isoformat()
    for key, preset in VIBE_PRESETS.items():
        if key == "custom":
            continue
        image_model = _STYLE_MODELS.get(key, "kontext")
        existing = await pool.fetchrow("SELECT id FROM video_styles WHERE id = $1", key)
        if not existing:
            await pool.execute(
                """INSERT INTO video_styles
                   (id, name, description, prompt, character_prompt, image_model, is_builtin, organization_id, created_at)
                   VALUES ($1, $2, $3, $4, $5, $6, 1, 'local', $7)""",
                key,
                preset.get("name", key),
                preset.get("description", ""),
                preset.get("prompt", ""),
                preset.get("character_prompt", ""),
                image_model,
                now,
            )



# ---------------------------------------------------------------------------
# Arc Templates
# ---------------------------------------------------------------------------

async def create_arc_template(
    template_id: str,
    name: str,
    description: str = "",
    beats_json: str = "[]",
    optional_beats_json: str = "[]",
    min_duration: float = 30,
    max_duration: float = 50,
    min_scenes: int = 5,
    max_scenes: int = 8,
    max_scene_duration: float = 8,
    system_prompt_fragment: str = "",
    is_builtin: int = 0,
    organization_id: str = "local",
) -> dict[str, Any]:
    """Create an arc template and return it."""
    pool = await get_pool()
    now = datetime.now(timezone.utc).isoformat()
    await pool.execute(
        """INSERT INTO arc_templates
           (id, name, description, beats_json, optional_beats_json,
            min_duration, max_duration, min_scenes, max_scenes, max_scene_duration,
            system_prompt_fragment, is_builtin, organization_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           ON CONFLICT (id) DO NOTHING""",
        template_id, name, description, beats_json, optional_beats_json,
        min_duration, max_duration, min_scenes, max_scenes, max_scene_duration,
        system_prompt_fragment, is_builtin, organization_id, now,
    )
    row = await pool.fetchrow("SELECT * FROM arc_templates WHERE id = $1", template_id)
    return dict(row) if row else {}


async def get_arc_template_db(template_id: str) -> dict[str, Any] | None:
    """Get an arc template by ID from the database."""
    pool = await get_pool()
    row = await pool.fetchrow("SELECT * FROM arc_templates WHERE id = $1", template_id)
    return _row_to_dict(row)


async def list_arc_templates(
    organization_id: str | None = None,
) -> list[dict[str, Any]]:
    """List arc templates (built-in + org-specific)."""
    pool = await get_pool()
    if organization_id:
        rows = await pool.fetch(
            "SELECT * FROM arc_templates WHERE is_builtin = 1 OR organization_id = $1 ORDER BY is_builtin DESC, name",
            organization_id,
        )
    else:
        rows = await pool.fetch("SELECT * FROM arc_templates ORDER BY is_builtin DESC, name")
    return _rows_to_dicts(rows)


async def update_arc_template(
    template_id: str,
    **kwargs: Any,
) -> dict[str, Any] | None:
    """Update arc template fields. Cannot update built-in templates."""
    pool = await get_pool()
    allowed = {"name", "description", "beats_json", "optional_beats_json",
               "min_duration", "max_duration", "min_scenes", "max_scenes",
               "max_scene_duration", "system_prompt_fragment"}
    sets: list[str] = []
    params: list[Any] = []
    idx = 1
    for key, val in kwargs.items():
        if key in allowed:
            sets.append(f"{key} = ${idx}")
            params.append(val)
            idx += 1
    if not sets:
        row = await pool.fetchrow("SELECT * FROM arc_templates WHERE id = $1", template_id)
        return _row_to_dict(row)
    params.append(template_id)
    await pool.execute(
        f"UPDATE arc_templates SET {', '.join(sets)} WHERE id = ${idx} AND is_builtin = 0",
        *params,
    )
    row = await pool.fetchrow("SELECT * FROM arc_templates WHERE id = $1", template_id)
    return _row_to_dict(row)


async def delete_arc_template(template_id: str) -> bool:
    """Delete an arc template. Only non-builtin templates can be deleted."""
    pool = await get_pool()
    result = await pool.execute(
        "DELETE FROM arc_templates WHERE id = $1 AND is_builtin = 0", template_id
    )
    return result == "DELETE 1"


async def seed_builtin_arc_templates() -> None:
    """Seed built-in arc templates from hardcoded ARC_TEMPLATES if they don't exist."""
    import json as _json
    from lorekit.story.templates import ARC_TEMPLATES

    pool = await get_pool()
    now = datetime.now(timezone.utc).isoformat()
    for key, tmpl in ARC_TEMPLATES.items():
        existing = await pool.fetchrow("SELECT id FROM arc_templates WHERE id = $1", key)
        if not existing:
            await pool.execute(
                """INSERT INTO arc_templates
                   (id, name, description, beats_json, optional_beats_json,
                    min_duration, max_duration, min_scenes, max_scenes, max_scene_duration,
                    system_prompt_fragment, is_builtin, organization_id, created_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 1, 'local', $12)""",
                key, tmpl.name, tmpl.description,
                _json.dumps(tmpl.beats), _json.dumps(tmpl.optional_beats),
                tmpl.min_duration, tmpl.max_duration,
                tmpl.min_scenes, tmpl.max_scenes, tmpl.max_scene_duration,
                tmpl.system_prompt_fragment,
                now,
            )


# ---------------------------------------------------------------------------
# Story Context Presets
# ---------------------------------------------------------------------------

async def create_story_context_preset(
    preset_id: str,
    name: str,
    context: str,
    description: str = "",
    category: str = "general",
    is_builtin: int = 0,
    organization_id: str = "local",
) -> dict[str, Any]:
    pool = await get_pool()
    now = datetime.now(timezone.utc).isoformat()
    await pool.execute(
        """INSERT INTO story_context_presets
           (id, name, description, context, category, is_builtin, organization_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO NOTHING""",
        preset_id, name, description, context, category, is_builtin, organization_id, now,
    )
    row = await pool.fetchrow("SELECT * FROM story_context_presets WHERE id = $1", preset_id)
    return dict(row) if row else {}


async def list_story_context_presets(
    organization_id: str | None = None,
    category: str | None = None,
) -> list[dict[str, Any]]:
    pool = await get_pool()
    if organization_id and category:
        rows = await pool.fetch(
            "SELECT * FROM story_context_presets WHERE (is_builtin = 1 OR organization_id = $1) AND category = $2 ORDER BY is_builtin DESC, category, name",
            organization_id, category,
        )
    elif organization_id:
        rows = await pool.fetch(
            "SELECT * FROM story_context_presets WHERE is_builtin = 1 OR organization_id = $1 ORDER BY is_builtin DESC, category, name",
            organization_id,
        )
    else:
        rows = await pool.fetch("SELECT * FROM story_context_presets ORDER BY is_builtin DESC, category, name")
    return _rows_to_dicts(rows)


async def delete_story_context_preset(preset_id: str) -> bool:
    pool = await get_pool()
    result = await pool.execute(
        "DELETE FROM story_context_presets WHERE id = $1 AND is_builtin = 0", preset_id
    )
    return result == "DELETE 1"


_BUILTIN_CONTEXT_PRESETS = [
    # UGC Reactions
    {"id": "ugc_skeptical_convinced", "name": "Skeptical → Convinced", "category": "ugc",
     "description": "Starts doubtful, slowly won over",
     "context": "Person is scrolling with a bored, skeptical expression. They read something, squint doubtfully, then slowly nod with raised eyebrows — quietly impressed. Understated genuine reaction, not theatrical."},
    {"id": "ugc_shocked_discovery", "name": "Shocked Discovery", "category": "ugc",
     "description": "Casual scrolling then jaw-drop moment",
     "context": "Person is casually scrolling, relaxed. They suddenly freeze — eyes go wide, jaw drops, they lean toward the camera in genuine disbelief. The shock is real and immediate."},
    {"id": "ugc_emotional_relief", "name": "Emotional Relief", "category": "ugc",
     "description": "Stressed → relieved smile",
     "context": "Person looks stressed and tired, rubbing their temples or sighing. They see something on screen, expression softens, they exhale with visible relief and break into a gentle, genuine smile. Eyes might glisten slightly."},
    {"id": "ugc_excited_share", "name": "Excited Share", "category": "ugc",
     "description": "Gasps then tells a friend",
     "context": "Person reads something, gasps, then excitedly points at the camera as if grabbing a friend's attention. Mouths something emphatic like 'you NEED this' with big energy. Head shaking in disbelief."},
    {"id": "ugc_silent_nod", "name": "Silent Nod", "category": "ugc",
     "description": "Quiet understanding, knowing smirk",
     "context": "Person reads carefully, expression shifts from neutral to slow understanding. A single deliberate nod, then a knowing smirk — like they just found a secret weapon. Minimal, confident, no theatrics."},
    {"id": "ugc_double_take", "name": "Double Take", "category": "ugc",
     "description": "Re-reads in disbelief, laughs",
     "context": "Person is scrolling casually, does a sharp double-take — head jerks back, eyes dart back to screen. Re-reads with intensity, then breaks into a surprised laugh with mouth wide open. Authentic 'wait WHAT' energy."},
    {"id": "ugc_mind_blown", "name": "Mind Blown", "category": "ugc",
     "description": "Slow realization, hands on head",
     "context": "Person stares at screen processing information. Slow zoom of realization crosses their face — eyebrows climbing, mouth gradually opening. They bring both hands to the sides of their head in a 'mind blown' gesture."},
    {"id": "ugc_angry_then_impressed", "name": "Angry → Impressed", "category": "ugc",
     "description": "Why didn't I know about this sooner",
     "context": "Person looks frustrated or annoyed while reading — furrowed brows, tight lips, shaking head. Then expression shifts to reluctant admiration. They point at camera with a 'why am I just now finding this' energy."},
    # Cinematic
    {"id": "cin_resilience", "name": "Theme: Resilience", "category": "cinematic",
     "description": "Overcoming adversity, rising from ashes",
     "context": "Focus on the theme of resilience and perseverance. Show the character facing overwhelming odds, a moment of doubt or defeat, then rising with renewed determination. The visual journey should move from darkness to light."},
    {"id": "cin_solitude_wisdom", "name": "Theme: Solitude & Wisdom", "category": "cinematic",
     "description": "Quiet contemplation, deep insight",
     "context": "Focus on solitude as the path to wisdom. Show the character alone in contemplation — writing, walking, observing nature. The atmosphere should be meditative, unhurried. Wisdom emerges from stillness, not action."},
    {"id": "cin_duty_vs_freedom", "name": "Theme: Duty vs Freedom", "category": "cinematic",
     "description": "Tension between obligation and desire",
     "context": "Explore the tension between duty and personal freedom. The character is pulled between what they must do and what they desire. Show this conflict through contrasting environments — structured vs wild, confined vs open."},
    # Product / General
    {"id": "prod_reveal", "name": "Product Reveal", "category": "product",
     "description": "Anticipation building to dramatic reveal",
     "context": "Build anticipation with close-up details, shadows, and partial reveals. The product emerges dramatically — hero lighting, slow rotation, key features highlighted one by one. End with the full product in its best light."},
    {"id": "prod_before_after", "name": "Before / After", "category": "product",
     "description": "Problem state then transformation",
     "context": "Show the 'before' state — the problem, frustration, mess. Quick transition to the 'after' — clean, solved, satisfying. The contrast should be dramatic and immediate. The product is the turning point."},
]


async def seed_builtin_context_presets() -> None:
    """Seed built-in story context presets."""
    pool = await get_pool()
    now = datetime.now(timezone.utc).isoformat()
    for p in _BUILTIN_CONTEXT_PRESETS:
        existing = await pool.fetchrow("SELECT id FROM story_context_presets WHERE id = $1", p["id"])
        if not existing:
            await pool.execute(
                """INSERT INTO story_context_presets
                   (id, name, description, context, category, is_builtin, organization_id, created_at)
                   VALUES ($1, $2, $3, $4, $5, 1, 'local', $6)""",
                p["id"], p["name"], p.get("description", ""), p["context"], p["category"], now,
            )


# ---------------------------------------------------------------------------
# Project Effects
# ---------------------------------------------------------------------------

async def get_project_effects(project_id: str, *, org_id: str | None = None) -> list[dict[str, Any]]:
    pool = await get_pool()
    rows = await pool.fetch(
        "SELECT * FROM project_effects WHERE project_id = $1 ORDER BY sort_order, created_at",
        project_id,
    )
    return [dict(r) for r in rows]


async def get_project_effect(effect_id: str, *, org_id: str | None = None) -> dict[str, Any] | None:
    pool = await get_pool()
    row = await pool.fetchrow("SELECT * FROM project_effects WHERE id = $1", effect_id)
    return dict(row) if row else None


async def create_project_effect(
    project_id: str,
    effect_type: str = "color_grade",
    name: str = "",
    settings_json: str = "{}",
    start_time: float = 0,
    end_time: float | None = None,
    sort_order: int = 0,
    *,
    org_id: str | None = None,
) -> dict[str, Any]:
    pool = await get_pool()
    eid = uuid.uuid4().hex[:12]
    now = _now()
    await pool.execute(
        """INSERT INTO project_effects
           (id, project_id, effect_type, name, start_time, end_time, sort_order, settings_json, enabled, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,1,$9,$9)""",
        eid, project_id, effect_type, name, start_time, end_time, sort_order, settings_json, now,
    )
    return {"id": eid, "project_id": project_id, "effect_type": effect_type, "name": name,
            "start_time": start_time, "end_time": end_time, "sort_order": sort_order,
            "settings_json": settings_json, "enabled": 1, "created_at": now, "updated_at": now}


async def update_project_effect(effect_id: str, *, org_id: str | None = None, **kwargs: Any) -> None:
    pool = await get_pool()
    allowed = {"name", "start_time", "end_time", "sort_order", "settings_json", "enabled"}
    updates = {k: v for k, v in kwargs.items() if k in allowed}
    if not updates:
        return
    updates["updated_at"] = _now()
    sets = ", ".join(f"{k} = ${i+2}" for i, k in enumerate(updates))
    vals = list(updates.values())
    await pool.execute(f"UPDATE project_effects SET {sets} WHERE id = $1", effect_id, *vals)


async def delete_project_effect(effect_id: str, *, org_id: str | None = None) -> None:
    pool = await get_pool()
    await pool.execute("DELETE FROM project_effects WHERE id = $1", effect_id)

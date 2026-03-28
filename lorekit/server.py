"""FastAPI application for LoreKit."""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from lorekit import db
from lorekit.config import get_settings
from lorekit.api.characters_routes import router as characters_router, legacy_router as philosophers_router
from lorekit.api.sources_routes import router as sources_router, legacy_router as quotes_router
from lorekit.api.projects import router as projects_router
from lorekit.api.generate import router as generate_router
from lorekit.api.scenes import router as scenes_router
from lorekit.api.jobs import router as jobs_router
from lorekit.api.settings_routes import router as settings_router
from lorekit.api.character import router as character_router

from lorekit.api.universes import router as universes_router
from lorekit.api.environments import router as environments_router
from lorekit.api.templates import router as templates_router


async def _auto_import_sources():
    """Import all character JSON files into the DB if empty."""
    conn = await db.connect()
    try:
        cursor = await conn.execute("SELECT COUNT(*) FROM characters")
        row = await cursor.fetchone()
        if row and row[0] > 0:
            return  # Already populated

        import json
        import logging
        logger = logging.getLogger(__name__)

        # Create default 'philosophywise' universe
        try:
            await db.create_universe(
                universe_id="philosophywise",
                name="PhilosophyWise",
                description="Default universe — ancient philosophy wisdom shorts",
            )
        except Exception:
            pass  # Already exists

        sources_dir = Path(__file__).parent / "sources" / "data"
        if not sources_dir.exists():
            # Fallback to old path for backward compatibility
            sources_dir = Path(__file__).parent / "quotes" / "sources"
            if not sources_dir.exists():
                return

        total_items = 0
        for json_file in sorted(sources_dir.glob("*.json")):
            data = json.loads(json_file.read_text())
            phil = data.get("philosopher", data.get("character", {}))

            await db.upsert_character(
                character_id=phil["id"],
                name=phil["name"],
                group_name=phil.get("civilization", phil.get("group", "")),
                era=phil.get("era", ""),
                character_description=phil.get("character_description", ""),
            )

            for q in data.get("quotes", data.get("source_items", [])):
                await db.insert_source_item(
                    character_id=phil["id"],
                    text=q["text"],
                    theme=q["theme"],
                    emotional_function=q["emotional_function"],
                    short_version=q.get("short_version"),
                    word_count=q.get("word_count", len(q["text"].split())),
                    read_time_seconds=q.get("read_time_seconds", len(q["text"].split()) / 2.5),
                    pair_with_visual=q.get("pair_with_visual", ""),
                )
                total_items += 1

        logger.info("Auto-imported %d source items from %d character files", total_items, len(list(sources_dir.glob("*.json"))))
    finally:
        await conn.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize DB, auto-import sources, ensure directories on startup."""
    settings = get_settings()
    settings.ensure_dirs()
    await db.init_db()
    await _auto_import_sources()
    yield


app = FastAPI(title="LoreKit", lifespan=lifespan)

# CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static file mounts for generated assets
clips_dir = Path("clips")
output_dir = Path("output")
chars_dir = Path("characters")
clips_dir.mkdir(exist_ok=True)
output_dir.mkdir(exist_ok=True)
chars_dir.mkdir(exist_ok=True)
app.mount("/clips", StaticFiles(directory=str(clips_dir)), name="clips")
app.mount("/output", StaticFiles(directory=str(output_dir)), name="output")
app.mount("/characters", StaticFiles(directory=str(chars_dir)), name="characters")

# Register API routers
app.include_router(characters_router)
app.include_router(sources_router)
app.include_router(projects_router)
app.include_router(generate_router)
app.include_router(scenes_router)
app.include_router(jobs_router)
app.include_router(settings_router)
app.include_router(character_router)

app.include_router(universes_router)
app.include_router(environments_router)
app.include_router(templates_router)


@app.get("/api/health")
async def health() -> dict:
    """Health check."""
    return {"status": "ok"}


@app.get("/api/stats")
async def stats() -> dict:
    """Aggregate stats: videos, sources, costs."""
    return await db.get_stats()

"""FastAPI application for PhilosophyWise."""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from philosophywise import db
from philosophywise.config import get_settings
from philosophywise.api.philosophers import router as philosophers_router
from philosophywise.api.quotes import router as quotes_router
from philosophywise.api.projects import router as projects_router
from philosophywise.api.generate import router as generate_router
from philosophywise.api.scenes import router as scenes_router
from philosophywise.api.jobs import router as jobs_router
from philosophywise.api.settings_routes import router as settings_router
from philosophywise.api.character import router as character_router


async def _auto_import_quotes():
    """Import all philosopher JSON files into the DB if empty."""
    conn = await db.connect()
    try:
        cursor = await conn.execute("SELECT COUNT(*) FROM philosophers")
        row = await cursor.fetchone()
        if row and row[0] > 0:
            return  # Already populated

        import json
        import logging
        logger = logging.getLogger(__name__)

        sources_dir = Path(__file__).parent / "quotes" / "sources"
        if not sources_dir.exists():
            return

        total_quotes = 0
        for json_file in sorted(sources_dir.glob("*.json")):
            data = json.loads(json_file.read_text())
            phil = data["philosopher"]

            await db.upsert_philosopher(
                philosopher_id=phil["id"],
                name=phil["name"],
                civilization=phil["civilization"],
                era=phil.get("era", ""),
                character_description=phil.get("character_description", ""),
            )

            for q in data["quotes"]:
                await db.insert_quote(
                    philosopher_id=phil["id"],
                    text=q["text"],
                    theme=q["theme"],
                    emotional_function=q["emotional_function"],
                    short_version=q.get("short_version"),
                    word_count=q.get("word_count", len(q["text"].split())),
                    read_time_seconds=q.get("read_time_seconds", len(q["text"].split()) / 2.5),
                    pair_with_visual=q.get("pair_with_visual", ""),
                )
                total_quotes += 1

        logger.info("Auto-imported %d quotes from %d philosopher files", total_quotes, len(list(sources_dir.glob("*.json"))))
    finally:
        await conn.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize DB, auto-import quotes, ensure directories on startup."""
    settings = get_settings()
    settings.ensure_dirs()
    await db.init_db()
    await _auto_import_quotes()
    yield


app = FastAPI(title="PhilosophyWise", lifespan=lifespan)

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
app.include_router(philosophers_router)
app.include_router(quotes_router)
app.include_router(projects_router)
app.include_router(generate_router)
app.include_router(scenes_router)
app.include_router(jobs_router)
app.include_router(settings_router)
app.include_router(character_router)


@app.get("/api/health")
async def health() -> dict:
    """Health check."""
    return {"status": "ok"}


@app.get("/api/stats")
async def stats() -> dict:
    """Aggregate stats: videos, quotes, costs."""
    return await db.get_stats()

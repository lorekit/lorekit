"""Shared test fixtures for LoreKit."""

from __future__ import annotations

import uuid
from pathlib import Path

import pytest
import pytest_asyncio
import httpx

from lorekit import db


@pytest.fixture
def tmp_db_path(tmp_path: Path) -> Path:
    """Return a temp SQLite file path per test."""
    return tmp_path / "test_lorekit.db"


@pytest_asyncio.fixture
async def initialized_db(tmp_db_path: Path) -> Path:
    """Initialize the DB schema and return the path."""
    await db.init_db(tmp_db_path)
    return tmp_db_path


@pytest_asyncio.fixture
async def sample_universe(initialized_db: Path) -> str:
    """Create a test universe and return its ID."""
    universe_id = f"test-universe-{uuid.uuid4().hex[:8]}"
    await db.create_universe(
        universe_id=universe_id,
        name="Test Universe",
        description="A test universe",
        db_path=initialized_db,
    )
    return universe_id


@pytest_asyncio.fixture
async def sample_character(initialized_db: Path, sample_universe: str) -> str:
    """Create a test character in the sample universe and return its ID."""
    character_id = f"test-char-{uuid.uuid4().hex[:8]}"
    conn = await db.connect(initialized_db)
    try:
        await conn.execute(
            "INSERT INTO characters (id, universe_id, name, group_name, era) VALUES (?, ?, ?, ?, ?)",
            (character_id, sample_universe, "Test Character", "test_group", "Modern"),
        )
        await conn.commit()
    finally:
        await conn.close()
    return character_id


@pytest_asyncio.fixture
async def async_client(tmp_db_path: Path, monkeypatch: pytest.MonkeyPatch):
    """Create an httpx.AsyncClient for testing the FastAPI app with a temp DB."""
    # Monkeypatch the DB path so the app uses a temp database
    async def _fake_db_path() -> Path:
        tmp_db_path.parent.mkdir(parents=True, exist_ok=True)
        return tmp_db_path

    monkeypatch.setattr(db, "_get_db_path", _fake_db_path)

    # Initialize the temp DB before the app starts
    await db.init_db(tmp_db_path)

    from lorekit.server import app

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client

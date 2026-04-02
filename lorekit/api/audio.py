"""Audio upload and analysis API endpoints."""

from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException

from lorekit.audio.analyzer import analyze_audio
from lorekit.auth.user import get_current_user, CurrentUser
from lorekit.storage import get_file_store, audio_upload_path

router = APIRouter(prefix="/api/audio", tags=["audio"])


def _resolve_audio_path(storage_path: str) -> str:
    """Resolve a storage-relative path to an absolute filesystem path for ffmpeg."""
    store = get_file_store()
    if hasattr(store, "base_dir"):
        return str(store.base_dir / storage_path)
    return storage_path


@router.post("/upload")
async def upload_audio(file: UploadFile = File(...), user: CurrentUser = Depends(get_current_user)) -> dict:
    """Upload an audio file, analyze it, and return analysis results."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    # Validate extension
    allowed_extensions = {".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac"}
    ext = Path(file.filename).suffix.lower()
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Allowed: {', '.join(allowed_extensions)}",
        )

    # Save with unique name via the file store
    store = get_file_store()
    unique_name = f"{uuid.uuid4().hex[:12]}{ext}"
    storage_path = audio_upload_path(unique_name)

    MAX_UPLOAD_SIZE = 50 * 1024 * 1024  # 50MB
    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum 50MB.")
    await store.write(storage_path, content)

    # Resolve to absolute path for ffmpeg-based analysis
    abs_path = _resolve_audio_path(storage_path)

    # Analyze the uploaded file (auto-selects beats_per_cut based on duration)
    analysis = await analyze_audio(abs_path)

    return {
        "filename": unique_name,
        "file_path": storage_path,
        "original_name": file.filename,
        **analysis,
    }


@router.get("/transitions")
async def get_transitions(user: CurrentUser = Depends(get_current_user)) -> dict:
    """Return all available transition types grouped by category."""
    from lorekit.assembly.transitions import TRANSITION_TYPES
    return {"transitions": TRANSITION_TYPES}


@router.get("/transitions/flat")
async def get_transitions_flat(user: CurrentUser = Depends(get_current_user)) -> dict:
    """Return flat lookup of all available transitions."""
    from lorekit.assembly.transitions import TRANSITION_LOOKUP
    return {"transitions": TRANSITION_LOOKUP}


@router.get("/analyze/{filename}")
async def analyze_uploaded_audio(filename: str, beats_per_cut: int = 4, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Re-analyze a previously uploaded audio file."""
    store = get_file_store()
    storage_path = audio_upload_path(filename)

    if not await store.exists(storage_path):
        raise HTTPException(status_code=404, detail="Audio file not found")

    # Resolve to absolute path for ffmpeg-based analysis
    abs_path = _resolve_audio_path(storage_path)

    analysis = await analyze_audio(abs_path, beats_per_cut=beats_per_cut)
    return {
        "filename": filename,
        "file_path": storage_path,
        **analysis,
    }

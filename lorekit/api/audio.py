"""Audio upload and analysis API endpoints."""

from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException

from lorekit.audio.analyzer import analyze_audio

router = APIRouter(prefix="/api/audio", tags=["audio"])

# Store uploaded audio files here
UPLOAD_DIR = Path("output/audio/uploads")


@router.post("/upload")
async def upload_audio(file: UploadFile = File(...)) -> dict:
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

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    # Save with unique name
    unique_name = f"{uuid.uuid4().hex[:12]}{ext}"
    file_path = UPLOAD_DIR / unique_name
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    # Analyze the uploaded file (auto-selects beats_per_cut based on duration)
    analysis = await analyze_audio(str(file_path))

    return {
        "filename": unique_name,
        "file_path": str(file_path),
        "original_name": file.filename,
        **analysis,
    }


@router.get("/transitions")
async def get_transitions() -> dict:
    """Return all available transition types grouped by category."""
    from lorekit.assembly.transitions import TRANSITION_TYPES
    return {"transitions": TRANSITION_TYPES}


@router.get("/transitions/flat")
async def get_transitions_flat() -> dict:
    """Return flat lookup of all available transitions."""
    from lorekit.assembly.transitions import TRANSITION_LOOKUP
    return {"transitions": TRANSITION_LOOKUP}


@router.get("/analyze/{filename}")
async def analyze_uploaded_audio(filename: str, beats_per_cut: int = 4) -> dict:
    """Re-analyze a previously uploaded audio file."""
    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")

    analysis = await analyze_audio(str(file_path), beats_per_cut=beats_per_cut)
    return {
        "filename": filename,
        "file_path": str(file_path),
        **analysis,
    }

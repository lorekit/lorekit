"""Audio asset index and scanner.

Scans the audio assets directory and builds a structured index
of music beds and SFX organized by civilization and category.
"""

from __future__ import annotations

import logging
from pathlib import Path

logger = logging.getLogger(__name__)

AUDIO_EXTENSIONS = {".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a"}


def scan_audio_assets(assets_dir: str) -> dict:
    """Scan the audio assets directory and build an index.

    Expected directory structure:
        assets/
        ├── music/
        │   ├── roman/
        │   │   ├── epic/
        │   │   ├── intimate/
        │   │   └── ambient/
        │   ├── chinese/
        │   │   ├── strategic/
        │   │   ├── contemplative/
        │   │   └── war/
        │   ├── greek/
        │   └── japanese/
        └── sfx/
            ├── transitions/
            ├── battle/
            ├── ambient/
            ├── text_reveal/
            └── emotional/

    Returns:
    {
        "music": {
            "roman": {"epic": [...], "intimate": [...], "ambient": [...]},
            "chinese": {"strategic": [...], "contemplative": [...], "war": [...]},
            ...
        },
        "sfx": {
            "transitions": [...],
            "battle": [...],
            "ambient": [...],
            "text_reveal": [...],
            "emotional": [...],
        }
    }
    """
    base = Path(assets_dir)
    index: dict = {"music": {}, "sfx": {}}

    # Scan music directory
    music_dir = base / "music"
    if music_dir.is_dir():
        for civ_dir in music_dir.iterdir():
            if not civ_dir.is_dir():
                continue
            civ_name = civ_dir.name
            index["music"][civ_name] = {}

            for mood_dir in civ_dir.iterdir():
                if not mood_dir.is_dir():
                    # Files directly in the civilization dir
                    if mood_dir.suffix.lower() in AUDIO_EXTENSIONS:
                        index["music"][civ_name].setdefault("general", []).append(
                            str(mood_dir)
                        )
                    continue

                mood_name = mood_dir.name
                files = _scan_audio_files(mood_dir)
                if files:
                    index["music"][civ_name][mood_name] = files

    # Scan SFX directory
    sfx_dir = base / "sfx"
    if sfx_dir.is_dir():
        for category_dir in sfx_dir.iterdir():
            if not category_dir.is_dir():
                if category_dir.suffix.lower() in AUDIO_EXTENSIONS:
                    index["sfx"].setdefault("general", []).append(str(category_dir))
                continue

            category_name = category_dir.name
            files = _scan_audio_files(category_dir)
            if files:
                index["sfx"][category_name] = files

    _log_index_summary(index)
    return index


def get_music_for_mood(index: dict, civilization: str, mood: str) -> str | None:
    """Get a music file path for the given civilization and mood.

    Falls back through:
    1. Exact civilization + mood match
    2. Civilization + "general" category
    3. None

    Returns None if no matching asset found.
    """
    music = index.get("music", {})
    civ_music = music.get(civilization, {})

    # Exact match
    if mood in civ_music and civ_music[mood]:
        return civ_music[mood][0]

    # Try general category for this civilization
    if "general" in civ_music and civ_music["general"]:
        return civ_music["general"][0]

    return None


def get_sfx(index: dict, category: str, name: str) -> str | None:
    """Get an SFX file path.

    Looks for an exact filename match (stem) within the category,
    then falls back to the first file in the category.
    """
    sfx = index.get("sfx", {})
    category_files = sfx.get(category, [])

    if not category_files:
        return None

    # Try exact name match (by stem)
    for filepath in category_files:
        if Path(filepath).stem.lower() == name.lower():
            return filepath

    # Try partial name match
    for filepath in category_files:
        if name.lower() in Path(filepath).stem.lower():
            return filepath

    return None


def _scan_audio_files(directory: Path) -> list[str]:
    """Recursively scan a directory for audio files."""
    files: list[str] = []
    if not directory.is_dir():
        return files

    for path in sorted(directory.rglob("*")):
        if path.is_file() and path.suffix.lower() in AUDIO_EXTENSIONS:
            files.append(str(path))

    return files


def _log_index_summary(index: dict) -> None:
    """Log a summary of the scanned audio assets."""
    music_count = sum(
        len(files)
        for civ_moods in index.get("music", {}).values()
        for files in civ_moods.values()
    )
    sfx_count = sum(
        len(files)
        for files in index.get("sfx", {}).values()
    )
    logger.info("Audio index: %d music files, %d SFX files", music_count, sfx_count)

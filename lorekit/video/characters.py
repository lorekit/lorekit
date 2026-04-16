"""Character and environment description resolution.

Loads character descriptions from the database. All hardcoded data has been
removed — the DB is the single source of truth for character and environment
descriptions.

Supports per-theme character descriptions: each character can have a
different visual identity depending on the active vibe preset (e.g.
``mobile_game``, ``cinematic``, ``dark_masculine``, ``ugc_selfie``).
"""

from __future__ import annotations

import json
import logging

logger = logging.getLogger(__name__)

_GENERIC_CHARACTER_FALLBACK = "A character in their natural setting."
_GENERIC_ENVIRONMENT_FALLBACK = "A setting appropriate to the story."


def get_character_description(
    character_id: str,
    theme: str | None = None,
    db_descriptions_json: str | None = None,
    db_base_description: str | None = None,
) -> str:
    """Get a character description, optionally themed.

    Resolution order:
    1. DB character_descriptions_json[theme] (user-edited, authoritative)
    2. DB character_description (base)
    3. Generic fallback
    """
    # 1. Check DB themed descriptions first (user-editable, authoritative)
    if theme and db_descriptions_json:
        try:
            db_descs = json.loads(db_descriptions_json) if isinstance(db_descriptions_json, str) else db_descriptions_json
            if theme in db_descs and db_descs[theme]:
                return db_descs[theme]
        except (json.JSONDecodeError, TypeError):
            pass

    # 2. DB base description
    if db_base_description:
        return db_base_description

    logger.warning("No character description for %s, using generic", character_id)
    return _GENERIC_CHARACTER_FALLBACK


def get_all_themed_characters(character_id: str) -> dict[str, str]:
    """Return all available character descriptions for a character, keyed by theme.

    Always includes a ``"default"`` key with the base description.
    """
    return {
        "default": get_character_description(character_id),
    }


def get_environment_description(
    environment_key: str,
    theme: str | None = None,
    db_description: str | None = None,
    db_themed_json: str | None = None,
) -> str:
    """Get an environment description, optionally themed.

    Resolution order:
    1. DB themed_descriptions_json[theme]
    2. DB environment_description
    3. Generic fallback
    """
    # 1. Check themed
    if theme and db_themed_json:
        try:
            themed = json.loads(db_themed_json) if isinstance(db_themed_json, str) else db_themed_json
            if theme in themed and themed[theme]:
                return themed[theme]
        except (json.JSONDecodeError, TypeError):
            pass

    # 2. DB description
    if db_description:
        return db_description

    logger.warning("No environment description for %r, using generic", environment_key)
    return _GENERIC_ENVIRONMENT_FALLBACK

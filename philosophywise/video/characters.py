"""Character and environment template loading.

Loads character descriptions from philosopher JSON files and provides
environment descriptions for each civilization.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from philosophywise.config import CIVILIZATIONS

logger = logging.getLogger(__name__)

# Default character descriptions when philosopher JSON is unavailable
_DEFAULT_CHARACTERS: dict[str, str] = {
    "marcus_aurelius": (
        "A Roman emperor in his 50s with a short grey beard, wearing a simple "
        "white toga with a purple border. Weathered, wise face with deep-set eyes. "
        "Military bearing softened by philosophical contemplation."
    ),
    "seneca": (
        "A Roman statesman in his 60s, bald with a fringe of white hair. "
        "Wearing a senatorial toga. Sharp, intelligent eyes. "
        "Expressive hands used for emphasis while speaking."
    ),
    "epictetus": (
        "A formerly enslaved Greek philosopher with a slight limp. Dressed simply "
        "in a coarse wool cloak. Intense, penetrating gaze. "
        "Lean physique, animated expression when teaching."
    ),
    "sun_tzu": (
        "A Chinese military strategist in traditional armor and robes. "
        "Black hair tied in a topknot. Calm, calculating expression. "
        "Carries bamboo scrolls. Sharp, observant eyes."
    ),
    "confucius": (
        "An elderly Chinese sage with a long white beard, wearing flowing silk robes. "
        "Gentle, wise expression. Carries himself with dignity and grace. "
        "Often gesturing to nature while teaching."
    ),
    "lao_tzu": (
        "An ancient Chinese philosopher with flowing white hair and beard. "
        "Simple, unadorned robes. Serene, almost otherworldly expression. "
        "Seems at one with the natural surroundings."
    ),
    "miyamoto_musashi": (
        "A Japanese swordsman with wild hair and intense eyes. "
        "Wearing a worn kimono, carrying two swords. Scarred hands. "
        "Powerful, disciplined movements. Alert, warrior's gaze."
    ),
    "socrates": (
        "A stocky Greek man with a snub nose, bulging eyes, and unkempt appearance. "
        "Wearing a simple chiton. Barefoot. Animated and curious expression. "
        "Gesticulates while questioning others."
    ),
    "plato": (
        "A broad-shouldered Greek man with a noble bearing. "
        "Wearing a fine chiton and himation. Well-groomed beard. "
        "Thoughtful, far-seeing expression. Often gazing upward."
    ),
    "aristotle": (
        "A Greek philosopher in his prime, neatly dressed in a chiton. "
        "Short beard, intelligent eyes. Holding a stylus and wax tablet. "
        "Methodical, precise gestures. Observant of surroundings."
    ),
}

_ENVIRONMENT_DESCRIPTIONS: dict[str, str] = {
    "roman": (
        "The Roman Empire at its height. Marble forums, colonnaded streets, "
        "warm Mediterranean light filtering through columns. Torchlit interiors "
        "with frescoed walls. The Tiber flowing through the eternal city."
    ),
    "greek": (
        "Classical Athens in the age of philosophy. The Acropolis gleaming white "
        "against an azure sky. The Agora bustling with discourse. "
        "Olive trees and clear light. Columned stoas casting geometric shadows."
    ),
    "chinese": (
        "Ancient China during the Warring States period. Misty mountain peaks, "
        "winding rivers through bamboo forests. Palatial courts with red pillars "
        "and curved tile roofs. Ink-wash landscapes come to life."
    ),
    "japanese": (
        "Feudal Japan in the age of the samurai. Zen temple gardens with "
        "raked sand and moss-covered stones. Cherry blossoms drifting. "
        "Paper lanterns glowing at dusk. Minimalist beauty in every detail."
    ),
}


def get_character_description(philosopher_id: str) -> str:
    """Get a character description for a philosopher.

    Tries to load from the philosopher's JSON source file first,
    falls back to built-in defaults.
    """
    # Try loading from source JSON
    sources_dir = Path(__file__).parent.parent / "quotes" / "sources"
    json_path = sources_dir / f"{philosopher_id}.json"

    if json_path.exists():
        try:
            data = json.loads(json_path.read_text(encoding="utf-8"))
            if desc := data.get("character_description"):
                return desc
        except (json.JSONDecodeError, KeyError) as exc:
            logger.warning(
                "Failed to load character from %s: %s", json_path, exc
            )

    # Fall back to defaults
    if philosopher_id in _DEFAULT_CHARACTERS:
        return _DEFAULT_CHARACTERS[philosopher_id]

    logger.warning("No character description for %s, using generic", philosopher_id)
    return "An ancient philosopher in period-appropriate clothing, thoughtful expression."


def get_environment_description(civilization: str) -> str:
    """Get an environment description for a civilization.

    Validates against known civilizations and returns a rich
    description for video prompt construction.
    """
    if civilization not in CIVILIZATIONS:
        logger.warning("Unknown civilization %r, using generic environment", civilization)
        return "An ancient civilization. Grand architecture, natural beauty, historical atmosphere."

    return _ENVIRONMENT_DESCRIPTIONS.get(
        civilization,
        "An ancient civilization. Grand architecture, natural beauty, historical atmosphere.",
    )

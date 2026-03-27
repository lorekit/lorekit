"""Character and environment template loading.

Loads character descriptions from philosopher JSON files and provides
environment descriptions for each civilization.

Supports per-theme character descriptions: each philosopher can have a
different visual identity depending on the active vibe preset (e.g.
``mobile_game``, ``cinematic``, ``dark_masculine``).
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from philosophywise.config import CIVILIZATIONS

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Default character descriptions — base (no theme)
# ---------------------------------------------------------------------------

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

# ---------------------------------------------------------------------------
# Per-theme character overrides
# Keys: theme -> philosopher_id -> description
# ---------------------------------------------------------------------------

_THEMED_CHARACTERS: dict[str, dict[str, str]] = {
    "dark_masculine": {
        "marcus_aurelius": (
            "A godlike warrior-emperor carved from dark marble. Massively built, "
            "mythic proportions. Cracked obsidian skin revealing veins of molten ember. "
            "Wearing battle-scarred black iron breastplate with a tattered crimson cloak. "
            "Eyes glow faintly like dying coals. Face is a mask of cold, absolute authority — "
            "a dark god-king who has conquered death itself. Smoke and ash drift from his form."
        ),
        "seneca": (
            "A gaunt, skeletal figure of terrifying intellect. Skin like pale weathered stone, "
            "deep hollow eye sockets with piercing white-blue eyes. Draped in heavy black robes "
            "that seem to absorb light. Veined hands like marble claws gripping a dark iron staff. "
            "An aura of cold wisdom — a philosopher who has stared into the void and speaks from it."
        ),
        "epictetus": (
            "A scarred, sinewy figure forged by suffering. Dark skin textured like cracked earth, "
            "one leg visibly damaged but stance unbroken. Bare-chested with a heavy chain still "
            "hanging from one wrist. Eyes burn with defiant fire. Lean, stripped-down, dangerous — "
            "a freed slave who could break you with words or hands. Surrounded by shattered chains."
        ),
        "sun_tzu": (
            "A shadow general in full dark lacquered armor, faceless behind a demon war mask. "
            "Ornate but terrifying — spikes, dark iron, silk ribbons blackened with age. "
            "Stands in perfect stillness like a predator. Eyes visible through the mask glow "
            "with cold calculation. Mist and smoke coil around him. An army of shadows at his back."
        ),
        "confucius": (
            "An ancient colossus — an enormous bearded figure carved from dark mountain stone. "
            "Flowing robes like cascading obsidian. Eyes are deep voids that radiate ancient knowing. "
            "His beard flows like dark water. Towering, monumental, more mountain than man. "
            "Cracks in his stone form reveal a faint inner glow. Seated on a throne of roots and rock."
        ),
        "lao_tzu": (
            "A spectral figure dissolving into smoke and void. Barely corporeal — his form shifts "
            "between solid and mist. White hair streams upward like flame in zero gravity. "
            "Eyes are empty white voids of pure awareness. His robes are made of darkness itself, "
            "flowing into the surrounding void. He IS the darkness — formless, infinite, terrifying "
            "in his absolute serenity."
        ),
        "miyamoto_musashi": (
            "A blood-soaked ronin of nightmarish intensity. Massive, scarred, feral. "
            "Wild mane of dark hair whipping in storm wind. Two katanas — one drawn and dripping. "
            "Torn black hakama, bare muscular torso covered in old battle scars. "
            "Eyes of a predator — no mercy, no hesitation. Stands atop a pile of broken swords. "
            "Rain and blood mix on dark skin. A demon of the blade given human form."
        ),
        "tsunetomo_yamamoto": (
            "A death-obsessed samurai in full dark yoroi armor, face hidden behind a bone-white "
            "death mask. Kneeling in perfect stillness. A single katana laid across his knees. "
            "Cherry blossoms fall around him but turn to ash before they touch the ground. "
            "The embodiment of bushido's darkest teaching — already dead, therefore fearless."
        ),
        "socrates": (
            "A hulking, grotesque figure of terrifying charisma. Barrel-chested, bald, "
            "with a face like a cracked stone gargoyle — bulging eyes that see through lies. "
            "Barefoot on broken marble. Wearing a tattered dark chiton that exposes massive arms. "
            "Holds an empty hemlock cup like a trophy. A philosophical monster who destroys "
            "your certainty with a smile that belongs on a skull."
        ),
        "aristotle": (
            "An armored scholar-titan in dark bronze plate. Face half-hidden by shadow, "
            "one eye catching cold light. Massive frame draped in a black philosopher's cloak "
            "over battle armor. Holds a dark iron astrolabe in one hand, a sword in the other. "
            "The original polymath as dark knight — knowledge as weapon, logic as blade. "
            "Surrounded by floating geometric shapes dissolving into shadow."
        ),
        "heraclitus": (
            "A fire-born figure wreathed in dark flame. His body is cracked volcanic rock "
            "with rivers of magma visible beneath. Wild burning hair and beard of actual fire. "
            "Eyes are twin infernos. Stands in a river of liquid obsidian. "
            "Everything around him is in flux — melting, burning, reforming. "
            "The weeping philosopher reimagined as an elemental force of destruction and rebirth."
        ),
        "leonidas": (
            "A dark Spartan god of war. Massive, blood-streaked, scarred from a hundred battles. "
            "Black and crimson Spartan armor, crested helmet casting his face in shadow — only "
            "burning eyes visible. Shield battered and dented but held firm. Spear raised like "
            "a lightning bolt. Stands alone against an ocean of darkness. 300 ghosts at his back. "
            "Death incarnate, smiling."
        ),
        "alexander": (
            "A young dark conqueror-god with the beauty of a fallen angel. Perfect classical features "
            "twisted by ambition into something inhuman. Dark Macedonian armor gilded with tarnished "
            "gold. A sword that burns with black fire. Wind-blown hair and a cloak of shadow. "
            "Mounted on a monstrous dark warhorse with ember eyes. The world burns behind him "
            "and he does not look back."
        ),
    },
}

# ---------------------------------------------------------------------------
# Environment descriptions — base (per-civilization)
# ---------------------------------------------------------------------------

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

# Per-theme environment overrides
_THEMED_ENVIRONMENTS: dict[str, dict[str, str]] = {
    "dark_masculine": {
        "roman": (
            "Rome as a dark empire. Black marble forums lit by dying torches. "
            "Colosseum shrouded in storm clouds. Crumbling aqueducts over volcanic plains. "
            "Smoke-filled war camps. The eternal city as an iron fortress in perpetual twilight."
        ),
        "greek": (
            "Greece as a shattered myth. The Parthenon in darkness, columns broken, "
            "lit by lightning. The Aegean black and storm-tossed. "
            "Statues of gods cracked and weathered. Thermopylae as a narrow gate to hell."
        ),
        "chinese": (
            "China as a shadow empire. Mountains swallowed by black fog. "
            "Fortresses of dark stone on volcanic ridges. The Great Wall stretching "
            "into an endless void. Bamboo forests at night, ink-black and silent."
        ),
        "japanese": (
            "Japan as a realm of shadow. Burning temples at midnight. "
            "Cherry blossoms falling as black ash. Zen gardens of dark stone "
            "under blood-red moons. Dojo floors stained dark. Storm-lit castle keeps."
        ),
    },
}


def get_character_description(
    philosopher_id: str,
    theme: str | None = None,
) -> str:
    """Get a character description for a philosopher, optionally themed.

    Resolution order:
    1. Theme-specific override (``_THEMED_CHARACTERS[theme][philosopher_id]``)
    2. Philosopher JSON source file (``character_descriptions[theme]`` then ``character_description``)
    3. Default character (``_DEFAULT_CHARACTERS[philosopher_id]``)
    4. Generic fallback
    """
    # 1. Check in-memory themed overrides first
    if theme and theme in _THEMED_CHARACTERS:
        themed = _THEMED_CHARACTERS[theme]
        if philosopher_id in themed:
            return themed[philosopher_id]

    # 2. Try loading from source JSON (supports both base & themed)
    sources_dir = Path(__file__).parent.parent / "quotes" / "sources"
    json_path = sources_dir / f"{philosopher_id}.json"

    if json_path.exists():
        try:
            data = json.loads(json_path.read_text(encoding="utf-8"))
            phil = data.get("philosopher", data)

            # Check for theme-specific description in JSON
            if theme:
                themed_descs = phil.get("character_descriptions", {})
                if theme in themed_descs:
                    return themed_descs[theme]

            # Fall back to base description from JSON
            if desc := phil.get("character_description"):
                return desc
        except (json.JSONDecodeError, KeyError) as exc:
            logger.warning(
                "Failed to load character from %s: %s", json_path, exc
            )

    # 3. Fall back to in-memory defaults
    if philosopher_id in _DEFAULT_CHARACTERS:
        return _DEFAULT_CHARACTERS[philosopher_id]

    logger.warning("No character description for %s, using generic", philosopher_id)
    return "An ancient philosopher in period-appropriate clothing, thoughtful expression."


def get_all_themed_characters(philosopher_id: str) -> dict[str, str]:
    """Return all available character descriptions for a philosopher, keyed by theme.

    Always includes a ``"default"`` key with the base description.
    """
    result: dict[str, str] = {
        "default": get_character_description(philosopher_id),
    }
    for theme_key in _THEMED_CHARACTERS:
        desc = get_character_description(philosopher_id, theme=theme_key)
        if desc != result["default"]:
            result[theme_key] = desc
    return result


def get_environment_description(
    civilization: str,
    theme: str | None = None,
) -> str:
    """Get an environment description for a civilization, optionally themed.

    Checks theme-specific overrides first, then falls back to base descriptions.
    """
    # Check theme override
    if theme and theme in _THEMED_ENVIRONMENTS:
        themed_envs = _THEMED_ENVIRONMENTS[theme]
        if civilization in themed_envs:
            return themed_envs[civilization]

    if civilization not in CIVILIZATIONS:
        logger.warning("Unknown civilization %r, using generic environment", civilization)
        return "An ancient civilization. Grand architecture, natural beauty, historical atmosphere."

    return _ENVIRONMENT_DESCRIPTIONS.get(
        civilization,
        "An ancient civilization. Grand architecture, natural beauty, historical atmosphere.",
    )

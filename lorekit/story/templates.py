"""Arc templates — selectable story structures for video generation.

Each ``ArcTemplate`` defines:
- A sequence of beats (the story structure)
- Duration / scene-count constraints
- Validation rules
- A system-prompt fragment that tells the LLM how to use this arc

Two built-in templates ship today:

* **story** — the original 30-50 s narrative arc (hook → world → conflict →
  stillness → truth → loop).
* **rapid_montage** — a 10-15 s rapid-fire montage of intense imagery with a
  single word or short phrase per cut, inspired by viral TikTok quote clips.
"""

from __future__ import annotations

import sys

if sys.version_info >= (3, 12):
    from typing import TypedDict
else:
    from typing_extensions import TypedDict

from pydantic import BaseModel


# ── Low-level beat definition (unchanged from before) ─────────────────────

class BeatTemplate(TypedDict):
    beat: str
    duration_range: list[int]
    purpose: str


# ── Arc template model ────────────────────────────────────────────────────

class ArcTemplate(BaseModel):
    """A complete arc template that drives story generation."""

    id: str                         # unique key (e.g. "story", "rapid_montage")
    name: str                       # human-readable label
    description: str                # shown in UI / CLI
    beats: list[BeatTemplate]
    optional_beats: list[BeatTemplate] = []
    min_duration: float             # seconds
    max_duration: float
    min_scenes: int
    max_scenes: int
    max_scene_duration: float       # hard cap per-scene
    system_prompt_fragment: str     # injected into the LLM system prompt


# ── Story Arc (original) ─────────────────────────────────────────────────

_STORY_BEATS: list[BeatTemplate] = [
    {
        "beat": "hook",
        "duration_range": [2, 4],
        "purpose": "Stop the scroll. Most striking quote + powerful opening image.",
    },
    {
        "beat": "world",
        "duration_range": [4, 6],
        "purpose": "Establish the ancient world. Transport the viewer. Create awe.",
    },
    {
        "beat": "conflict",
        "duration_range": [5, 8],
        "purpose": "Show chaos, war, struggle. Emotional intensity.",
    },
    {
        "beat": "stillness",
        "duration_range": [4, 7],
        "purpose": "Philosopher alone. Writing, thinking, teaching. Contrast with chaos.",
    },
    {
        "beat": "truth",
        "duration_range": [5, 8],
        "purpose": "Deepest quote over culminating visual. The payoff.",
    },
    {
        "beat": "loop",
        "duration_range": [2, 4],
        "purpose": "Return to opening image. Seamless loop point.",
    },
]

_STORY_OPTIONAL_BEATS: list[BeatTemplate] = [
    {
        "beat": "conflict_peak",
        "duration_range": [3, 5],
        "purpose": (
            "Overhead/wide shot of aftermath. "
            "Transition from action to reflection."
        ),
    },
]

STORY_ARC = ArcTemplate(
    id="story",
    name="Full Story",
    description="30-50 s narrative arc with hook, world-building, conflict, truth, and loop",
    beats=_STORY_BEATS,
    optional_beats=_STORY_OPTIONAL_BEATS,
    min_duration=30,
    max_duration=50,
    min_scenes=5,
    max_scenes=8,
    max_scene_duration=8,
    system_prompt_fragment="""\
STORY ARC:
{arc_description}

OPTIONAL BEATS (insert between conflict and stillness if needed):
{optional_description}

RULES:
1. Total duration MUST be {min_duration}-{max_duration} seconds, {min_scenes}-{max_scenes} scenes, no scene exceeds {max_scene_duration} seconds
2. Something visually new every 3 seconds
3. EVERY scene MUST have a text_overlay — this is narration that tells the story throughout the video. The text should flow as a continuous narrative across all scenes, like a voiceover script broken into scene-sized pieces.
4. The HOOK scene text should grab attention with the hook quote or a compelling opening line
5. The TRUTH scene text should deliver the main quote / wisdom payoff
6. Other scenes should have short narration (1-2 sentences) that bridges the story — describing what's happening, adding context, building toward the truth. Think of it as a storyteller guiding the viewer through the journey.
7. The LOOP scene text can echo the hook or leave a final thought
8. The LOOP scene must mirror the HOOK scene visually for seamless replay
9. Camera movements: slow push-in, orbital, crane, tracking shots""",
)


# ── Rapid Montage Arc ─────────────────────────────────────────────────────

_MONTAGE_BEATS: list[BeatTemplate] = [
    {
        "beat": "impact",
        "duration_range": [1, 2],
        "purpose": (
            "A single intense image with ONE word or very short phrase "
            "(1-3 words max) as text overlay. Every cut should hit like a punch. "
            "Think: dark statue, warrior silhouette, stormy sky, muscular figure, "
            "crumbling throne, burning temple, marble god."
        ),
    },
]

RAPID_MONTAGE_ARC = ArcTemplate(
    id="rapid_montage",
    name="Rapid Montage",
    description=(
        "10-15 s rapid-fire cuts — intense imagery with a single word/phrase per cut. "
        "Viral TikTok quote style."
    ),
    beats=_MONTAGE_BEATS,
    optional_beats=[],
    min_duration=8,
    max_duration=18,
    min_scenes=6,
    max_scenes=14,
    max_scene_duration=2.5,
    system_prompt_fragment="""\
FORMAT: RAPID MONTAGE — fast cuts of intense imagery with minimal text.

RULES:
1. Total duration MUST be {min_duration}-{max_duration} seconds
2. {min_scenes}-{max_scenes} scenes, each {max_scene_duration} seconds or less
3. EVERY scene is an "impact" beat — a single powerful image
4. text_overlay for each scene is ONE WORD or a very short phrase (1-3 words MAX)
   - The words across all scenes should form a complete quote or message when read in sequence
   - Example: scene 1 "discipline.", scene 2 "is", scene 3 "freedom."
   - Or repeat a single powerful word: scene 1 "power.", scene 2 "power.", scene 3 "power."
   - Punctuation matters — end words with periods for impact
5. Visual descriptions should be INTENSE and VARIED:
   - Classical statues, dark warriors, stormy skies, volcanic landscapes
   - Muscular figures, crumbling architecture, burning temples, marble gods
   - Renaissance paintings, dark fantasy armor, lightning strikes, ocean storms
   - Close-ups of clenched fists, intense eyes, cracked stone, forge fire
6. Each scene should cut to a COMPLETELY DIFFERENT image — maximum visual variety
7. Camera: static or very slow push-in. NO complex movements — the CUT is the movement
8. character_present should be true for ~half the scenes (alternating character/environment)
9. The FIRST scene and LAST scene should be visually similar for seamless looping
10. NO CTA scenes — set cta_scene to false for all scenes

The overall effect should feel like a heartbeat — rhythmic, intense, hypnotic.
Think: dark sculpture photography slideshow set to heavy bass.""",
)


# ── Template Registry ─────────────────────────────────────────────────────

ARC_TEMPLATES: dict[str, ArcTemplate] = {
    t.id: t for t in [STORY_ARC, RAPID_MONTAGE_ARC]
}

DEFAULT_ARC_TEMPLATE = "story"


def get_arc_template(template_id: str) -> ArcTemplate:
    """Look up an arc template by ID. Raises KeyError if not found."""
    if template_id not in ARC_TEMPLATES:
        raise KeyError(
            f"Unknown arc template {template_id!r}. "
            f"Choose from: {list(ARC_TEMPLATES)}"
        )
    return ARC_TEMPLATES[template_id]


# ── Backwards-compatible exports ──────────────────────────────────────────
# Existing code imports these names — keep them working, pointing at the
# default "story" arc.

UNIVERSAL_ARC: list[BeatTemplate] = _STORY_BEATS
OPTIONAL_BEATS: list[BeatTemplate] = _STORY_OPTIONAL_BEATS

VALID_BEATS: set[str] = set()
BEAT_DURATION_RANGES: dict[str, tuple[int, int]] = {}

# Aggregate from ALL templates so the validator can handle any template's beats
for _tmpl in ARC_TEMPLATES.values():
    for _b in _tmpl.beats + _tmpl.optional_beats:
        VALID_BEATS.add(_b["beat"])
        BEAT_DURATION_RANGES[_b["beat"]] = (
            _b["duration_range"][0],
            _b["duration_range"][1],
        )

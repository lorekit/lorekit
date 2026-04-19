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
        "duration_range": [3, 5],
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
        "purpose": "Character alone. Writing, thinking, teaching. Contrast with chaos.",
    },
    {
        "beat": "truth",
        "duration_range": [5, 8],
        "purpose": "Deepest quote over culminating visual. The payoff.",
    },
    {
        "beat": "loop",
        "duration_range": [3, 5],
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
3. EVERY scene MUST have a narration — this is narration that tells the story throughout the video. The text should flow as a continuous narrative across all scenes, like a voiceover script broken into scene-sized pieces.
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
        "duration_range": [3, 5],
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
    min_duration=18,
    max_duration=45,
    min_scenes=6,
    max_scenes=10,
    max_scene_duration=5,
    system_prompt_fragment="""\
FORMAT: RAPID MONTAGE — fast cuts of intense imagery with minimal text.

RULES:
1. Total duration MUST be {min_duration}-{max_duration} seconds
2. {min_scenes}-{max_scenes} scenes, each {max_scene_duration} seconds or less
3. EVERY scene is an "impact" beat — a single powerful image
4. narration for each scene is ONE WORD or a very short phrase (1-3 words MAX)
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


# ── UGC Reaction Arc ─────────────────────────────────────────────────────

_UGC_REACTION_BEATS: list[BeatTemplate] = [
    {
        "beat": "reaction",
        "duration_range": [3, 5],
        "purpose": (
            "A selfie reaction clip. Person reacting naturally — subtle shifts "
            "in expression, not exaggerated cartoon faces. "
            "One continuous take from a fixed selfie camera angle."
        ),
    },
    {
        "beat": "callout",
        "duration_range": [3, 5],
        "purpose": (
            "Optional: person gestures toward a specific area of the frame "
            "(points up, glances to the side, nods toward camera) to direct "
            "attention where text/graphics will be placed in post-production. "
            "Subtle, natural gesture — not exaggerated pointing."
        ),
    },
    {
        "beat": "lifestyle",
        "duration_range": [3, 5],
        "purpose": (
            "Optional: person in a different setting/outfit that shows their "
            "lifestyle — gym, car, kitchen, walking outside. Same selfie angle. "
            "Can be a different environment and clothing than earlier scenes."
        ),
    },
    {
        "beat": "closer",
        "duration_range": [3, 5],
        "purpose": (
            "Optional: final moment — person gives a knowing look, subtle nod, "
            "or slight smile directly into camera. The 'trust me' beat."
        ),
    },
]

UGC_REACTION_ARC = ArcTemplate(
    id="ugc_reaction",
    name="UGC Reaction",
    description="1-4 scene selfie reaction clips for ad hooks",
    beats=_UGC_REACTION_BEATS,
    optional_beats=[],
    min_duration=3,
    max_duration=20,
    min_scenes=1,
    max_scenes=4,
    max_scene_duration=5,
    system_prompt_fragment="""\
FORMAT: UGC REACTION — selfie-style reaction clips for ad hooks.

RULES:
1. 1 to 4 scenes, each {min_duration}-5 seconds. Use beats: "reaction", "callout", "lifestyle", "closer" in any order as directed by the story_context.
2. character_present MUST be true
3. Camera: STATIC selfie angle — phone held at arm's length, slightly above eye level. NO camera movement. Steady shot, no shake.
4. NATURAL, SUBTLE reactions only. Think real person, not actor. Small shifts: a slight eyebrow raise, a knowing smirk, a slow nod, eyes narrowing then relaxing, a quiet "huh" expression. Do NOT write exaggerated reactions like jaw dropping, eyes popping wide, mouth hanging open, lunging at camera — those read as fake AI content. Match the energy to the character's personality.
5. visual_description MUST describe ONLY: the person's facial expression, body language, and their immediate real-world environment (room, car, desk, etc). DO NOT describe what they are reacting to. DO NOT put text, words, screens, apps, notifications, pop-ups, or UI elements in the visual description. The reaction content will be added separately by the user in their video editor.
6. narration MUST be empty string ""
7. Environment should feel like a real place — bedroom, living room, car, office, gym, balcony. Simple background, nothing distracting.
8. DO NOT describe cinematic elements — this is raw iPhone selfie footage
9. cta_scene MUST be false
10. NO props in hands. The person is NOT holding a phone. Their hands may gesture but no objects.
11. For "callout" scenes: the person gestures naturally toward an area of the frame (glances up, points up casually, nods toward one side) to direct viewer attention where text will be placed in post-production. One arm extended toward camera holding the phone steady. Keep it subtle.
12. For "lifestyle" scenes: the person can be in a completely different setting and outfit. Describe the new environment and clothing explicitly. Same selfie framing.
13. Each scene is a SEPARATE continuous shot. Do NOT describe scene changes within a single scene.""",
)


# ── Template Registry ─────────────────────────────────────────────────────

ARC_TEMPLATES: dict[str, ArcTemplate] = {
    t.id: t for t in [STORY_ARC, RAPID_MONTAGE_ARC, UGC_REACTION_ARC]
}

DEFAULT_ARC_TEMPLATE = "story"


async def get_arc_template(template_id: str) -> ArcTemplate:
    """Look up an arc template by ID.

    Checks hardcoded builtins first, then falls back to the database
    for user-created custom templates. Raises KeyError if not found.
    """
    if template_id in ARC_TEMPLATES:
        return ARC_TEMPLATES[template_id]

    # Fall back to DB for custom templates
    import json as _json
    from lorekit import db

    row = await db.get_arc_template_db(template_id)
    if not row:
        raise KeyError(
            f"Unknown arc template {template_id!r}. "
            f"Choose from: {list(ARC_TEMPLATES)} + custom templates in DB"
        )

    beats = _json.loads(row.get("beats_json") or "[]")
    optional_beats = _json.loads(row.get("optional_beats_json") or "[]")

    # Register beats so the validator accepts them
    for b in beats + optional_beats:
        VALID_BEATS.add(b["beat"])
        BEAT_DURATION_RANGES[b["beat"]] = (
            b["duration_range"][0],
            b["duration_range"][1],
        )

    return ArcTemplate(
        id=row["id"],
        name=row["name"],
        description=row.get("description", ""),
        beats=beats,
        optional_beats=optional_beats,
        min_duration=row.get("min_duration", 30),
        max_duration=row.get("max_duration", 50),
        min_scenes=row.get("min_scenes", 5),
        max_scenes=row.get("max_scenes", 8),
        max_scene_duration=row.get("max_scene_duration", 8),
        system_prompt_fragment=row.get("system_prompt_fragment") or _default_system_prompt_fragment(row),
    )


def _default_system_prompt_fragment(row: dict) -> str:
    """Auto-generate a system prompt fragment for custom templates without one."""
    import json as _json
    beats = _json.loads(row.get("beats_json") or "[]")
    beat_desc = "\n".join(
        f"- {b['beat']}: {b['purpose']} ({b['duration_range'][0]}-{b['duration_range'][1]}s)"
        for b in beats
    )
    return f"""\
STORY ARC:
{beat_desc}

RULES:
1. Total duration MUST be {row.get('min_duration', 30)}-{row.get('max_duration', 50)} seconds, {row.get('min_scenes', 5)}-{row.get('max_scenes', 8)} scenes, no scene exceeds {row.get('max_scene_duration', 8)} seconds
2. Something visually new every 3 seconds
3. EVERY scene MUST have a narration
4. Camera movements: slow push-in, orbital, crane, tracking shots"""


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

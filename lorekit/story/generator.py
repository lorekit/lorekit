"""Claude-powered story generation — turns quotes into scene-by-scene breakdowns."""

from __future__ import annotations

import json
import logging
from typing import Any

import anthropic
import openai

from lorekit.config import get_settings
from lorekit.models import (
    AudioSpec,
    Character,
    SourceItem,
    Scene,
    StoryBreakdown,
)
from lorekit.story.templates import (
    ArcTemplate,
    UNIVERSAL_ARC,
    OPTIONAL_BEATS,
    get_arc_template,
    DEFAULT_ARC_TEMPLATE,
)
from lorekit.story.prompts.roman import ROMAN_STORY_CONTEXT
from lorekit.story.prompts.chinese import CHINESE_STORY_CONTEXT
from lorekit.story.prompts.japanese import JAPANESE_STORY_CONTEXT
from lorekit.story.prompts.greek import GREEK_STORY_CONTEXT
from lorekit.story.prompts.dark_masculine import DARK_MASCULINE_STORY_CONTEXT
from lorekit.story.validator import validate_story

logger = logging.getLogger(__name__)

CIVILIZATION_CONTEXTS: dict[str, str] = {
    "roman": ROMAN_STORY_CONTEXT,
    "chinese": CHINESE_STORY_CONTEXT,
    "japanese": JAPANESE_STORY_CONTEXT,
    "greek": GREEK_STORY_CONTEXT,
}

# Theme-specific context overrides. When a theme key is present here,
# its context replaces (or supplements) the civilization context.
THEME_CONTEXTS: dict[str, str] = {
    "dark_masculine": DARK_MASCULINE_STORY_CONTEXT,
}


# ── Prompt construction ──────────────────────────────────────────────────


def _format_arc_description(arc: ArcTemplate) -> str:
    """Build the beat list section for an arc template's system prompt."""
    return "\n".join(
        f"  {i+1}. {beat['beat'].upper()} "
        f"({beat['duration_range'][0]}-{beat['duration_range'][1]}s): "
        f"{beat['purpose']}"
        for i, beat in enumerate(arc.beats)
    )


def _format_optional_description(arc: ArcTemplate) -> str:
    """Build the optional-beats section for an arc template's system prompt."""
    if not arc.optional_beats:
        return ""
    return "\n".join(
        f"  - {beat['beat'].upper()} "
        f"({beat['duration_range'][0]}-{beat['duration_range'][1]}s): "
        f"{beat['purpose']}"
        for beat in arc.optional_beats
    )


def _build_system_prompt(
    character: Character,
    civilization_context: str,
    vibe: str,
    arc: ArcTemplate,
) -> str:
    """Build the system prompt for LLM story generation.

    The arc template's ``system_prompt_fragment`` is formatted with the
    arc's own constraints and injected into the prompt.
    """
    arc_description = _format_arc_description(arc)
    optional_description = _format_optional_description(arc)

    # Format the template-specific rules section
    arc_rules = arc.system_prompt_fragment.format(
        arc_description=arc_description,
        optional_description=optional_description,
        min_duration=int(arc.min_duration),
        max_duration=int(arc.max_duration),
        min_scenes=arc.min_scenes,
        max_scenes=arc.max_scenes,
        max_scene_duration=arc.max_scene_duration,
    )

    return f"""You are a cinematic story director creating scene-by-scene breakdowns for vertical philosophy videos (9:16).

PHILOSOPHER: {character.name} ({character.era})
CIVILIZATION: {civilization_context}

{arc_rules}

IMPORTANT — WHAT TO INCLUDE vs WHAT TO LEAVE OUT:

DO describe in visual_description:
- The SETTING and ENVIRONMENT (where is this scene? what does the location look like?)
- The ACTION (what is happening? what is the character doing?)
- The EMOTION and MOOD (what feeling does this scene convey?)
- PROPS and DETAILS (what objects, architectural elements, nature elements are present?)
- When the character changes clothes (e.g., "now wearing armor" vs "wearing toga")

DO NOT include in visual_description:
- The character's physical appearance (face, hair, beard, body type) — this is handled separately by the character reference system. Just say "{character.name}" or "the philosopher" when they appear.
- Art style or rendering instructions (no "mobile game style", "colorful illustrated", "chunky 3D", etc.) — this is handled by global style settings.
- Technical quality directives (no "8K", "photorealistic", "high quality", etc.)

CHARACTER PRESENCE: Set "character_present": true when the philosopher physically appears in the scene (speaking, walking, gesturing, etc.). Set "character_present": false for environment-only scenes (establishing shots, landscapes, abstract concepts, close-ups of objects).

Keep scene descriptions focused and concise (2-4 sentences each). The video generation system will layer the character appearance and art style on top of your scene descriptions automatically."""


def _build_user_prompt(
    hook_quote: SourceItem,
    truth_quote: SourceItem,
    target_duration: int,
    arc: ArcTemplate,
) -> str:
    """Build the user message requesting the story breakdown.

    For rapid_montage, the prompt focuses on breaking a quote into
    individual word/phrase cuts rather than a narrative arc.
    """
    # For montage templates, use a simpler beat name in the schema example
    example_beat = arc.beats[0]["beat"] if arc.beats else "hook"

    # Montage-specific instructions for how to use the quotes
    if arc.id == "rapid_montage":
        quote_instruction = f"""Break one or both of these quotes into individual WORDS or SHORT PHRASES (1-3 words each), one per scene.

QUOTE 1: "{hook_quote.text}"
- Theme: {hook_quote.theme}
- Suggested visual: {hook_quote.pair_with_visual}

QUOTE 2: "{truth_quote.text}"
- Theme: {truth_quote.theme}
- Suggested visual: {truth_quote.pair_with_visual}

You can use one quote broken into words, combine key words from both, or repeat a single powerful word. Each scene's text_overlay should be 1-3 words MAX."""
    else:
        quote_instruction = f"""HOOK QUOTE (displayed in scene 1): "{hook_quote.text}"
- Theme: {hook_quote.theme}
- Suggested visual: {hook_quote.pair_with_visual}

TRUTH QUOTE (displayed in truth scene): "{truth_quote.text}"
- Theme: {truth_quote.theme}
- Suggested visual: {truth_quote.pair_with_visual}"""

    return f"""Create a scene-by-scene breakdown for a {target_duration}-second video.

{quote_instruction}

Return ONLY valid JSON matching this exact schema — no markdown, no commentary:
{{
    "scenes": [
        {{
            "scene_id": 1,
            "beat": "{example_beat}",
            "duration": {arc.beats[0]['duration_range'][1]}.0,
            "visual_description": "detailed description of what the viewer sees",
            "camera": "camera movement description",
            "text_overlay": "text for this scene (REQUIRED for every scene)",
            "text_attribution": "— Philosopher Name (only for scenes with direct quotes, null otherwise)",
            "character_present": true,
            "cta_scene": false,
            "audio": {{
                "mood": "emotional tone of the music/sound",
                "intensity": "low|medium|high"
            }}
        }}
    ],
    "music_theme": "overall musical theme description"
}}"""


def _parse_scene(raw: dict[str, Any], character_name: str) -> Scene:
    """Parse a raw scene dict from Claude's response into a Scene model."""
    audio_raw = raw.get("audio", {})
    mood = audio_raw.get("mood", "ambient")
    intensity = audio_raw.get("intensity", "medium")

    audio = AudioSpec(
        music_bed=f"{mood}_{intensity}",
        music_volume={"low": 0.5, "medium": 0.7, "high": 0.9}.get(intensity, 0.7),
    )

    text_attr = raw.get("text_attribution")
    if text_attr is None and raw.get("text_overlay"):
        text_attr = f"\u2014 {character_name}"

    return Scene(
        scene_id=raw["scene_id"],
        beat=raw["beat"],
        duration=float(raw["duration"]),
        visual_description=raw["visual_description"],
        camera=raw["camera"],
        text_overlay=raw.get("text_overlay"),
        text_attribution=text_attr,
        audio=audio,
        character_present=raw.get("character_present", False),
        cta_scene=raw.get("cta_scene", False),
    )


# ── LLM calling ──────────────────────────────────────────────────────────


async def _call_anthropic(system_prompt: str, user_prompt: str, model: str) -> str:
    """Call Anthropic API and return the response text."""
    settings = get_settings()
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    message = await client.messages.create(
        model=model,
        max_tokens=4096,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )
    return message.content[0].text  # type: ignore[union-attr]


async def _call_openai(system_prompt: str, user_prompt: str, model: str) -> str:
    """Call OpenAI API and return the response text."""
    settings = get_settings()
    client = openai.AsyncOpenAI(api_key=settings.openai_api_key)
    response = await client.chat.completions.create(
        model=model,
        max_completion_tokens=4096,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    return response.choices[0].message.content or ""


async def _call_llm(system_prompt: str, user_prompt: str) -> str:
    """Route to the configured LLM provider."""
    settings = get_settings()
    if settings.llm_provider == "openai":
        return await _call_openai(system_prompt, user_prompt, settings.llm_model)
    return await _call_anthropic(system_prompt, user_prompt, settings.llm_model)


def _strip_code_fences(text: str) -> str:
    """Strip markdown code fences from LLM response."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
    if text.endswith("```"):
        text = text.rsplit("```", 1)[0]
    return text.strip()


# ── Main entry point ─────────────────────────────────────────────────────


async def generate_story(
    character: Character,
    hook_quote: SourceItem,
    truth_quote: SourceItem,
    target_duration: int = 35,
    max_retries: int = 2,
    theme: str | None = None,
    arc_template: str | None = None,
) -> StoryBreakdown:
    """Generate a full scene-by-scene breakdown using the configured LLM.

    Supports both Anthropic (Claude) and OpenAI providers.
    Returns validated StoryBreakdown.

    Args:
        theme: Vibe preset key (e.g. "dark_masculine"). When a theme-specific
            story context exists, it replaces the default civilization context.
        arc_template: Arc template ID (e.g. "story", "rapid_montage").
            Defaults to ``DEFAULT_ARC_TEMPLATE``.
    """
    settings = get_settings()
    vibe = settings.video_vibe

    # Resolve arc template
    arc = get_arc_template(arc_template or DEFAULT_ARC_TEMPLATE)

    # Override target_duration to the arc's midpoint if the caller used the
    # default (35 s), which only makes sense for the "story" arc.
    if target_duration == 35 and arc.id != "story":
        target_duration = int((arc.min_duration + arc.max_duration) / 2)

    # Use theme-specific context if available, otherwise fall back to civilization
    if theme and theme in THEME_CONTEXTS:
        civ_context = THEME_CONTEXTS[theme]
    else:
        civ_context = CIVILIZATION_CONTEXTS.get(
            character.group, ROMAN_STORY_CONTEXT
        )

    system_prompt = _build_system_prompt(character, civ_context, vibe, arc)
    user_prompt = _build_user_prompt(hook_quote, truth_quote, target_duration, arc)

    last_error: Exception | None = None
    for attempt in range(max_retries + 1):
        try:
            response_text = await _call_llm(system_prompt, user_prompt)
            text = _strip_code_fences(response_text)

            data = json.loads(text)
            scenes = [
                _parse_scene(s, character.name) for s in data["scenes"]
            ]
            total_dur = sum(s.duration for s in scenes)

            story = StoryBreakdown(
                character_id=character.id,
                civilization=character.group,
                theme=theme or "",
                arc_template=arc.id,
                hook_quote=hook_quote,
                truth_quote=truth_quote,
                scenes=scenes,
                total_duration=total_dur,
                music_theme=data.get("music_theme", "cinematic orchestral"),
            )

            issues = validate_story(story, arc=arc)
            if issues:
                logger.warning(
                    "Story validation issues (attempt %d/%d): %s",
                    attempt + 1,
                    max_retries + 1,
                    issues,
                )
                if attempt < max_retries:
                    user_prompt += (
                        f"\n\nYour previous response had these issues: {issues}. "
                        "Please fix them."
                    )
                    continue

            return story

        except (json.JSONDecodeError, KeyError, IndexError) as exc:
            last_error = exc
            logger.warning(
                "Failed to parse LLM response (attempt %d/%d): %s",
                attempt + 1,
                max_retries + 1,
                exc,
            )
            if attempt >= max_retries:
                break

    raise RuntimeError(
        f"Story generation failed after {max_retries + 1} attempts: {last_error}"
    )

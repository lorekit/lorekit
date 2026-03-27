"""Claude-powered story generation — turns quotes into scene-by-scene breakdowns."""

from __future__ import annotations

import json
import logging
from typing import Any

import anthropic
import openai

from philosophywise.config import get_settings
from philosophywise.models import (
    AudioSpec,
    Philosopher,
    Quote,
    Scene,
    StoryBreakdown,
)
from philosophywise.story.templates import UNIVERSAL_ARC, OPTIONAL_BEATS
from philosophywise.story.prompts.roman import ROMAN_STORY_CONTEXT
from philosophywise.story.prompts.chinese import CHINESE_STORY_CONTEXT
from philosophywise.story.prompts.japanese import JAPANESE_STORY_CONTEXT
from philosophywise.story.prompts.greek import GREEK_STORY_CONTEXT
from philosophywise.story.validator import validate_story

logger = logging.getLogger(__name__)

CIVILIZATION_CONTEXTS: dict[str, str] = {
    "roman": ROMAN_STORY_CONTEXT,
    "chinese": CHINESE_STORY_CONTEXT,
    "japanese": JAPANESE_STORY_CONTEXT,
    "greek": GREEK_STORY_CONTEXT,
}

_ARC_DESCRIPTION = "\n".join(
    f"  {i+1}. {beat['beat'].upper()} ({beat['duration_range'][0]}-{beat['duration_range'][1]}s): {beat['purpose']}"
    for i, beat in enumerate(UNIVERSAL_ARC)
)

_OPTIONAL_DESCRIPTION = "\n".join(
    f"  - {beat['beat'].upper()} ({beat['duration_range'][0]}-{beat['duration_range'][1]}s): {beat['purpose']}"
    for beat in OPTIONAL_BEATS
)


def _build_system_prompt(
    philosopher: Philosopher,
    civilization_context: str,
    vibe: str,
) -> str:
    """Build the system prompt for Claude story generation."""
    return f"""You are a cinematic story director creating scene-by-scene breakdowns for 30-50 second vertical philosophy videos (9:16).

PHILOSOPHER: {philosopher.name} ({philosopher.era})
CIVILIZATION: {civilization_context}

STORY ARC:
{_ARC_DESCRIPTION}

OPTIONAL BEATS (insert between conflict and stillness if needed):
{_OPTIONAL_DESCRIPTION}

RULES:
1. Total duration MUST be 30-50 seconds, 6-8 scenes, no scene exceeds 8 seconds
2. Something visually new every 3 seconds
3. EVERY scene MUST have a text_overlay — this is narration that tells the story throughout the video. The text should flow as a continuous narrative across all scenes, like a voiceover script broken into scene-sized pieces.
4. The HOOK scene text should grab attention with the hook quote or a compelling opening line
5. The TRUTH scene text should deliver the main quote / wisdom payoff
6. Other scenes should have short narration (1-2 sentences) that bridges the story — describing what's happening, adding context, building toward the truth. Think of it as a storyteller guiding the viewer through the journey.
7. The LOOP scene text can echo the hook or leave a final thought
8. The LOOP scene must mirror the HOOK scene visually for seamless replay
9. Camera movements: slow push-in, orbital, crane, tracking shots

IMPORTANT — WHAT TO INCLUDE vs WHAT TO LEAVE OUT:

DO describe in visual_description:
- The SETTING and ENVIRONMENT (where is this scene? what does the location look like?)
- The ACTION (what is happening? what is the character doing?)
- The EMOTION and MOOD (what feeling does this scene convey?)
- PROPS and DETAILS (what objects, architectural elements, nature elements are present?)
- When the character changes clothes (e.g., "now wearing armor" vs "wearing toga")

DO NOT include in visual_description:
- The character's physical appearance (face, hair, beard, body type) — this is handled separately by the character reference system. Just say "Marcus Aurelius" or "the philosopher" when they appear.
- Art style or rendering instructions (no "mobile game style", "colorful illustrated", "chunky 3D", etc.) — this is handled by global style settings.
- Technical quality directives (no "8K", "photorealistic", "high quality", etc.)

CHARACTER PRESENCE: Set "character_present": true when the philosopher physically appears in the scene (speaking, walking, gesturing, etc.). Set "character_present": false for environment-only scenes (establishing shots, landscapes, abstract concepts, close-ups of objects).

CTA: In ONE scene (preferably truth or loop beat), describe a visual element where the word "{{{{CTA}}}}" appears naturally carved into stone, written on a scroll, or etched into marble. Mark this scene with "cta_scene": true.

Keep scene descriptions focused and concise (2-4 sentences each). The video generation system will layer the character appearance and art style on top of your scene descriptions automatically."""


def _build_user_prompt(
    hook_quote: Quote,
    truth_quote: Quote,
    target_duration: int,
) -> str:
    """Build the user message requesting the story breakdown."""
    return f"""Create a scene-by-scene breakdown for a {target_duration}-second video.

HOOK QUOTE (displayed in scene 1): "{hook_quote.text}"
- Theme: {hook_quote.theme}
- Suggested visual: {hook_quote.pair_with_visual}

TRUTH QUOTE (displayed in truth scene): "{truth_quote.text}"
- Theme: {truth_quote.theme}
- Suggested visual: {truth_quote.pair_with_visual}

Return ONLY valid JSON matching this exact schema — no markdown, no commentary:
{{
    "scenes": [
        {{
            "scene_id": 1,
            "beat": "hook",
            "duration": 3.0,
            "visual_description": "detailed description of what the viewer sees",
            "camera": "camera movement description",
            "text_overlay": "narration text for this scene (REQUIRED for every scene)",
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


def _parse_scene(raw: dict[str, Any], philosopher_name: str) -> Scene:
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
        text_attr = f"\u2014 {philosopher_name}"

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


async def generate_story(
    philosopher: Philosopher,
    hook_quote: Quote,
    truth_quote: Quote,
    target_duration: int = 35,
    max_retries: int = 2,
) -> StoryBreakdown:
    """Generate a full scene-by-scene breakdown using the configured LLM.

    Supports both Anthropic (Claude) and OpenAI providers.
    Returns validated StoryBreakdown.
    """
    settings = get_settings()
    vibe = settings.video_vibe

    civ_context = CIVILIZATION_CONTEXTS.get(
        philosopher.civilization, ROMAN_STORY_CONTEXT
    )

    system_prompt = _build_system_prompt(philosopher, civ_context, vibe)
    user_prompt = _build_user_prompt(hook_quote, truth_quote, target_duration)

    last_error: Exception | None = None
    for attempt in range(max_retries + 1):
        try:
            response_text = await _call_llm(system_prompt, user_prompt)
            text = _strip_code_fences(response_text)

            data = json.loads(text)
            scenes = [
                _parse_scene(s, philosopher.name) for s in data["scenes"]
            ]
            total_dur = sum(s.duration for s in scenes)

            story = StoryBreakdown(
                philosopher_id=philosopher.id,
                civilization=philosopher.civilization,
                hook_quote=hook_quote,
                truth_quote=truth_quote,
                scenes=scenes,
                total_duration=total_dur,
                music_theme=data.get("music_theme", "cinematic orchestral"),
            )

            issues = validate_story(story)
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

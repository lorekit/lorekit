"""Claude-powered story generation — turns quotes into scene-by-scene breakdowns."""

from __future__ import annotations

import json
import logging
from typing import Any

import anthropic
import openai

from lorekit.config import get_settings
from lorekit.models import (
    Character,
    SourceItem,
    SceneItem,
    TransitionItem,
    Timeline,
)
from lorekit.story.templates import (
    ArcTemplate,
    get_arc_template,
    DEFAULT_ARC_TEMPLATE,
)
from lorekit.story.prompts.dark_masculine import DARK_MASCULINE_STORY_CONTEXT
from lorekit.story.prompts.ugc_selfie import UGC_SELFIE_STORY_CONTEXT
from lorekit.story.validator import validate_scenes

logger = logging.getLogger(__name__)

# Theme-specific story context overrides.
THEME_CONTEXTS: dict[str, str] = {
    "dark_masculine": DARK_MASCULINE_STORY_CONTEXT,
    "ugc_selfie": UGC_SELFIE_STORY_CONTEXT,
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
    story_context: str,
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

    character_label = character.name
    if character.era:
        character_label += f" ({character.era})"

    return f"""You are a story director creating scene-by-scene breakdowns for vertical videos (9:16).

CHARACTER: {character_label}
WORLD: {story_context}

{arc_rules}

IMPORTANT — WHAT TO INCLUDE vs WHAT TO LEAVE OUT:

DO describe in visual_description:
- The SETTING and ENVIRONMENT (where is this scene? what does the location look like?)
- The ACTION (what is happening? what is the character doing?)
- The EMOTION and MOOD (what feeling does this scene convey?)
- PROPS and DETAILS (what objects, architectural elements, nature elements are present?)
- When the character changes clothes or outfits

DO NOT include in visual_description:
- The character's physical appearance (face, hair, body type) — this is handled separately by the character reference system. Just say "{character.name}" or "the character" when they appear.
- Art style or rendering instructions (no "mobile game style", "colorful illustrated", "chunky 3D", etc.) — this is handled by global style settings.
- Technical quality directives (no "8K", "photorealistic", "high quality", etc.)

CHARACTER PRESENCE: Set "character_present": true when the character physically appears in the scene (speaking, walking, gesturing, etc.). Set "character_present": false for environment-only scenes (establishing shots, landscapes, abstract concepts, close-ups of objects).

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
            "text_attribution": "— Character Name (only for scenes with direct quotes, null otherwise)",
            "character_present": true,
            "cta_scene": false,
            "audio": {{
                "mood": "emotional tone of the music/sound",
                "intensity": "low|medium|high"
            }}
        }}
    ],
    "transitions": [
        {{
            "from_scene_id": 1,
            "to_scene_id": 2,
            "prompt": "Cinematic description of how the camera/visual morphs from scene 1 to scene 2"
        }}
    ],
    "music_theme": "overall musical theme description"
}}

TRANSITION RULES:
- Include one transition object for each pair of adjacent scenes (N-1 transitions for N scenes)
- Each transition prompt describes the visual morph/movement between scenes
- Think cinematically: camera pushes, dissolves through smoke, light shifts, focus pulls
- Keep prompts under 200 characters
- These will be used to generate AI video transitions between clips"""


FPS = 30


def _seconds_to_frames(seconds: float) -> int:
    return round(seconds * FPS)


def _parse_scene(raw: dict[str, Any], character_name: str) -> SceneItem:
    """Parse a raw scene dict from Claude's response into a SceneItem."""
    text_attr = raw.get("text_attribution")
    if text_attr is None and raw.get("text_overlay"):
        text_attr = f"\u2014 {character_name}"

    duration_sec = float(raw["duration"])
    duration_sec = max(3.0, min(15.0, duration_sec))

    return SceneItem(
        scene_id=raw["scene_id"],
        beat=raw["beat"],
        duration_frames=_seconds_to_frames(duration_sec),
        visual_description=raw["visual_description"],
        camera=raw["camera"],
        text_overlay=raw.get("text_overlay") or "",
        text_attribution=text_attr,
        character_present=raw.get("character_present", False),
    )


# ── LLM calling ──────────────────────────────────────────────────────────


async def _call_anthropic(system_prompt: str, user_prompt: str, model: str) -> tuple[str, dict]:
    """Call Anthropic API and return (text, usage_metadata)."""
    settings = get_settings()
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    message = await client.messages.create(
        model=model,
        max_tokens=4096,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )
    usage = {
        "model": model,
        "provider": "anthropic",
        "input_tokens": getattr(message.usage, "input_tokens", 0),
        "output_tokens": getattr(message.usage, "output_tokens", 0),
    }
    return message.content[0].text, usage  # type: ignore[union-attr]


async def _call_openai(system_prompt: str, user_prompt: str, model: str) -> tuple[str, dict]:
    """Call OpenAI API and return (text, usage_metadata)."""
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
    usage = {
        "model": model,
        "provider": "openai",
        "prompt_tokens": getattr(response.usage, "prompt_tokens", 0) if response.usage else 0,
        "completion_tokens": getattr(response.usage, "completion_tokens", 0) if response.usage else 0,
    }
    return response.choices[0].message.content or "", usage


async def _call_llm(system_prompt: str, user_prompt: str) -> tuple[str, dict]:
    """Route to the configured LLM provider. Returns (text, usage_metadata)."""
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
    story_context: str | None = None,
) -> Timeline:
    """Generate a full scene-by-scene breakdown using the configured LLM.

    Supports both Anthropic (Claude) and OpenAI providers.
    Returns a validated Timeline document.

    Args:
        theme: Vibe preset key (e.g. "dark_masculine", "ugc_selfie").
        arc_template: Arc template ID (e.g. "story", "rapid_montage", "ugc_reaction").
            Defaults to ``DEFAULT_ARC_TEMPLATE``.
        story_context: Free-text world/story context for the LLM. When provided,
            takes priority over theme-based contexts.
    """
    vibe = ""

    # Resolve arc template
    arc = await get_arc_template(arc_template or DEFAULT_ARC_TEMPLATE)

    # Override target_duration to the arc's midpoint if the caller used the
    # default (35 s), which only makes sense for the "story" arc.
    if target_duration == 35 and arc.id != "story":
        target_duration = int((arc.min_duration + arc.max_duration) / 2)

    # Resolve story context: explicit > theme > generic default
    if story_context:
        resolved_context = story_context
    elif theme and theme in THEME_CONTEXTS:
        resolved_context = THEME_CONTEXTS[theme]
    else:
        resolved_context = (
            f"Create scenes appropriate to {character.name}'s world and story."
        )

    system_prompt = _build_system_prompt(character, resolved_context, vibe, arc)
    user_prompt = _build_user_prompt(hook_quote, truth_quote, target_duration, arc)

    last_error: Exception | None = None
    for attempt in range(max_retries + 1):
        try:
            response_text, llm_usage = await _call_llm(system_prompt, user_prompt)
            text = _strip_code_fences(response_text)

            data = json.loads(text)
            scenes = [
                _parse_scene(s, character.name) for s in data["scenes"]
            ]

            # Parse transition prompts from LLM
            raw_transitions = data.get("transitions", [])
            trans_prompts: dict[tuple[int, int], str] = {}
            for t in raw_transitions:
                try:
                    trans_prompts[(t["from_scene_id"], t["to_scene_id"])] = t["prompt"]
                except (KeyError, TypeError):
                    continue

            # Build Timeline with interleaved scenes + transitions on video track
            timeline = Timeline(
                metadata={
                    "arc_template": arc.id,
                    "music_theme": data.get("music_theme", "cinematic orchestral"),
                },
            )
            video_track = timeline.get_video_track()

            current_frame = 0
            for i, scene in enumerate(scenes):
                scene.from_frame = current_frame
                video_track.items.append(scene)
                current_frame += scene.duration_frames

                # Insert transition between this scene and the next
                if i < len(scenes) - 1:
                    next_scene = scenes[i + 1]
                    prompt = trans_prompts.get(
                        (scene.scene_id, next_scene.scene_id),
                        "Smooth cinematic transition with fluid camera motion",
                    )
                    trans_item = TransitionItem(
                        prompt=prompt,
                        from_frame=current_frame,
                        duration_frames=_seconds_to_frames(3.0),
                    )
                    video_track.items.append(trans_item)
                    current_frame += trans_item.duration_frames

            timeline.duration_frames = current_frame

            # Store LLM usage metadata for credit metering
            timeline.metadata["llm_usage"] = llm_usage

            # SceneItem has .duration property — validate directly
            issues = validate_scenes(scenes, arc=arc)
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
                else:
                    logger.warning("Returning timeline with validation issues after %d attempts", max_retries + 1)

            return timeline

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

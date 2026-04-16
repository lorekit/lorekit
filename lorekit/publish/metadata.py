"""LLM-powered YouTube title/description generation."""

from __future__ import annotations

import json
import logging

import anthropic
import openai

from lorekit.config import get_settings
from lorekit.models import Character, SourceItem, Timeline

logger = logging.getLogger(__name__)

METADATA_SYSTEM_PROMPT = """\
You are a YouTube Shorts metadata specialist.
Generate metadata optimized for discovery and engagement on YouTube Shorts.

Rules:
- Title MUST be under 60 characters
- Title MUST include the character's name
- Title MUST include an emotional hook
- Title MUST end with #shorts
- Description should include the full quote, character bio context, and a call to action
- Tags should include: shorts, the character's name (no spaces), \
the content theme, relevant topics
- Hashtags go at the end of the description

Respond with valid JSON only, no markdown formatting."""

METADATA_USER_TEMPLATE = """\
Generate YouTube Shorts metadata for this video:

Character: {character_name} ({group}, {era})
Hook Quote: "{hook_quote}"
Truth Quote: "{truth_quote}"
Story Theme: {music_theme}
Total Duration: {total_duration}s
Number of Scenes: {scene_count}

Generate a JSON object with keys: title, description, tags, hashtags"""


async def _call_metadata_llm(system_prompt: str, user_message: str) -> str:
    """Route metadata generation to configured LLM provider."""
    settings = get_settings()
    if settings.llm_provider == "openai":
        client = openai.AsyncOpenAI(api_key=settings.openai_api_key)
        response = await client.chat.completions.create(
            model=settings.llm_model,
            max_tokens=1024,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
        )
        return response.choices[0].message.content or ""
    else:
        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        response = await client.messages.create(
            model=settings.llm_model,
            max_tokens=1024,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        )
        return response.content[0].text.strip()  # type: ignore[union-attr]


async def generate_metadata(
    character: Character,
    hook_quote: SourceItem,
    truth_quote: SourceItem,
    story: object,  # Timeline or legacy StoryBreakdown
) -> dict:
    """Generate YouTube-optimized metadata using the configured LLM."""
    user_message = METADATA_USER_TEMPLATE.format(
        character_name=character.name,
        group=character.group,
        era=character.era,
        hook_quote=hook_quote.text,
        truth_quote=truth_quote.text,
        music_theme=story.music_theme,
        total_duration=story.total_duration,
        scene_count=len(story.scenes),
    )

    raw_text = await _call_metadata_llm(METADATA_SYSTEM_PROMPT, user_message)

    # Parse JSON, stripping markdown fences if present
    if raw_text.startswith("```"):
        raw_text = raw_text.split("\n", 1)[1]
        if raw_text.endswith("```"):
            raw_text = raw_text[: raw_text.rfind("```")]

    try:
        metadata = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        logger.error("Failed to parse metadata JSON: %s\nRaw: %s", exc, raw_text)
        metadata = _fallback_metadata(character, hook_quote, truth_quote, story)

    metadata = _validate_metadata(metadata, character)

    logger.info("Generated metadata — title: %s", metadata.get("title"))
    return metadata


def _validate_metadata(metadata: dict, character: Character) -> dict:
    """Ensure metadata meets YouTube Shorts requirements."""
    title = metadata.get("title", "")

    # Ensure title ends with #shorts
    if not title.lower().endswith("#shorts"):
        title = title.rstrip() + " #shorts"

    # Truncate if over 60 chars
    if len(title) > 60:
        base = title.replace(" #shorts", "").replace("#shorts", "")
        max_base = 60 - len(" #shorts")
        if len(base) > max_base:
            base = base[:max_base].rstrip()
        title = f"{base} #shorts"

    metadata["title"] = title

    # Ensure tags is a list
    if not isinstance(metadata.get("tags"), list):
        metadata["tags"] = ["shorts", character.name.lower().replace(" ", "")]

    # Ensure required tags
    required_tags = {"shorts"}
    existing_tags = {t.lower() for t in metadata["tags"]}
    for tag in required_tags:
        if tag not in existing_tags:
            metadata["tags"].append(tag)

    return metadata


def _fallback_metadata(
    character: Character,
    hook_quote: SourceItem,
    truth_quote: SourceItem,
    story: object,
) -> dict:
    """Generate fallback metadata when LLM API fails."""
    character_tag = character.name.lower().replace(" ", "")
    group_tag = character.group.lower()

    title = f"{character.name} #shorts"

    description = (
        f'"{hook_quote.text}"\n\n'
        f"\u2014 {character.name}, {character.era}\n\n"
        f'"{truth_quote.text}"\n\n'
        f"Follow for more content.\n\n"
        f"#shorts #{character_tag} #{group_tag}"
    )

    return {
        "title": title,
        "description": description,
        "tags": [
            "shorts", character_tag, group_tag, hook_quote.theme,
        ],
        "hashtags": f"#shorts #{character_tag} #{group_tag}",
    }

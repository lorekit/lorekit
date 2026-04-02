"""Shared FastMCP server instance with all LoreKit tools.

Imported by:
  - lorekit/server.py       (mounted on FastAPI at /mcp for streamable HTTP)
"""

from __future__ import annotations

from fastmcp import FastMCP

from lorekit.mcp import tools

mcp = FastMCP(
    "lorekit",
    instructions=(
        "LoreKit is an AI video generation platform. You can create universes "
        "(story worlds), add characters with source material, generate stories, "
        "produce video clips, and render final videos. The typical workflow is:\n"
        "1. Create a universe\n"
        "2. Add characters with descriptions\n"
        "3. Add source items (quotes/text) for characters\n"
        "4. Generate a story (creates a project with scene breakdown)\n"
        "5. Generate clips (produces video for each scene)\n"
        "6. Render the final video (assembles clips with audio/effects)\n\n"
        "Use lorekit_job_status() to poll long-running operations (clips, render)."
    ),
)


# ---------------------------------------------------------------------------
# Universes
# ---------------------------------------------------------------------------

@mcp.tool
async def lorekit_universe_list() -> str:
    """List all universes (story worlds) in LoreKit."""
    return await tools.universe_list()


@mcp.tool
async def lorekit_universe_get(universe_id: str) -> str:
    """Get details of a universe including its vibe preset and description."""
    return await tools.universe_get(universe_id)


@mcp.tool
async def lorekit_universe_create(
    name: str,
    description: str = "",
    icon: str = "",
    video_vibe_preset: str = "mobile_game",
) -> str:
    """Create a new universe (story world). A universe contains characters, sources, and projects."""
    return await tools.universe_create(name, description, icon, video_vibe_preset)


@mcp.tool
async def lorekit_universe_update(
    universe_id: str,
    name: str | None = None,
    description: str | None = None,
    icon: str | None = None,
    video_vibe_preset: str | None = None,
) -> str:
    """Update a universe's properties."""
    fields = {k: v for k, v in {"name": name, "description": description, "icon": icon, "video_vibe_preset": video_vibe_preset}.items() if v is not None}
    return await tools.universe_update(universe_id, **fields)


@mcp.tool
async def lorekit_universe_delete(universe_id: str) -> str:
    """Delete a universe and all its characters, sources, projects, and files."""
    return await tools.universe_delete(universe_id)


# ---------------------------------------------------------------------------
# Characters
# ---------------------------------------------------------------------------

@mcp.tool
async def lorekit_character_list(universe_id: str) -> str:
    """List all characters in a universe."""
    return await tools.character_list(universe_id)


@mcp.tool
async def lorekit_character_get(character_id: str) -> str:
    """Get full details of a character including description and source texts."""
    return await tools.character_get(character_id)


@mcp.tool
async def lorekit_character_create(
    universe_id: str,
    name: str,
    character_description: str = "",
    group_name: str = "",
    era: str = "",
) -> str:
    """Create a new character in a universe. Provide a rich character_description for best video results."""
    return await tools.character_create(universe_id, name, group_name, era, character_description)


@mcp.tool
async def lorekit_character_update(
    character_id: str,
    name: str | None = None,
    character_description: str | None = None,
    era: str | None = None,
    group: str | None = None,
) -> str:
    """Update a character's properties."""
    fields = {k: v for k, v in {"name": name, "character_description": character_description, "era": era, "group": group}.items() if v is not None}
    return await tools.character_update(character_id, **fields)


# ---------------------------------------------------------------------------
# Character Images
# ---------------------------------------------------------------------------

@mcp.tool
async def lorekit_character_image_generate(
    character_id: str,
    theme: str = "",
    custom_description: str = "",
) -> str:
    """Generate a portrait image for a character. Optionally specify a theme (e.g. 'dark_masculine')."""
    return await tools.character_image_generate(character_id, theme, custom_description)


@mcp.tool
async def lorekit_character_image_list(character_id: str) -> str:
    """List all generated portrait images for a character."""
    return await tools.character_image_list(character_id)


# ---------------------------------------------------------------------------
# Character Reference Images
# ---------------------------------------------------------------------------

@mcp.tool
async def lorekit_character_reference_image_upload(character_id: str, url: str) -> str:
    """Upload a reference image for a character from a URL or local file path.

    The reference image anchors the character's visual identity. When generating
    portraits, the system preserves the likeness of the reference while applying
    the selected video style/theme. Accepts HTTP(S) URLs or local file paths.
    """
    return await tools.character_reference_image_upload(character_id, url)


@mcp.tool
async def lorekit_character_reference_image_list(character_id: str) -> str:
    """List all reference images for a character."""
    return await tools.character_reference_image_list(character_id)


@mcp.tool
async def lorekit_character_reference_image_delete(character_id: str, url: str) -> str:
    """Delete a reference image from a character."""
    return await tools.character_reference_image_delete(character_id, url)


# ---------------------------------------------------------------------------
# Source Items
# ---------------------------------------------------------------------------

@mcp.tool
async def lorekit_source_list(universe_id: str, character_id: str | None = None) -> str:
    """List source items (quotes, texts) in a universe. Optionally filter by character."""
    return await tools.source_list(universe_id, character_id)


@mcp.tool
async def lorekit_source_create(
    character_id: str,
    text: str,
    theme: str,
    emotional_function: str = "truth",
) -> str:
    """Create a source item for a character. emotional_function: 'hook' (attention-grabbing) or 'truth' (deeper insight)."""
    return await tools.source_create(character_id, text, theme, emotional_function)


@mcp.tool
async def lorekit_source_update(
    item_id: str,
    text: str | None = None,
    theme: str | None = None,
    emotional_function: str | None = None,
) -> str:
    """Update a source item."""
    fields = {k: v for k, v in {"text": text, "theme": theme, "emotional_function": emotional_function}.items() if v is not None}
    return await tools.source_update(item_id, **fields)


@mcp.tool
async def lorekit_source_delete(item_id: str) -> str:
    """Delete a source item."""
    return await tools.source_delete(item_id)


# ---------------------------------------------------------------------------
# Scripts
# ---------------------------------------------------------------------------

@mcp.tool
async def lorekit_script_list(universe_id: str) -> str:
    """List all scripts in a universe."""
    return await tools.script_list(universe_id)


@mcp.tool
async def lorekit_script_create(
    universe_id: str,
    title: str,
    content: str = "",
    script_type: str = "short",
    character_ids: list[str] | None = None,
    target_duration_seconds: int | None = None,
    scene_count: int | None = None,
) -> str:
    """Create a new script in a universe. script_type: 'short', 'long', 'series'."""
    return await tools.script_create(
        universe_id, title, content, script_type, character_ids,
        target_duration_seconds, scene_count,
    )


@mcp.tool
async def lorekit_script_get(universe_id: str, script_id: str) -> str:
    """Get a script's full content and metadata."""
    return await tools.script_get(universe_id, script_id)


@mcp.tool
async def lorekit_script_update(
    universe_id: str,
    script_id: str,
    title: str | None = None,
    content: str | None = None,
    script_type: str | None = None,
    status: str | None = None,
) -> str:
    """Update a script's properties."""
    fields = {k: v for k, v in {"title": title, "content": content, "script_type": script_type, "status": status}.items() if v is not None}
    return await tools.script_update(universe_id, script_id, **fields)


@mcp.tool
async def lorekit_script_delete(universe_id: str, script_id: str) -> str:
    """Delete a script."""
    return await tools.script_delete(universe_id, script_id)


# ---------------------------------------------------------------------------
# Environments
# ---------------------------------------------------------------------------

@mcp.tool
async def lorekit_environment_list(universe_id: str) -> str:
    """List visual environments in a universe (color grades, fonts, etc)."""
    return await tools.environment_list(universe_id)


@mcp.tool
async def lorekit_environment_create(
    universe_id: str,
    name: str,
    environment_description: str = "",
    font: str | None = None,
    text_color: str | None = None,
) -> str:
    """Create a visual environment (defines color grading, fonts, text styling)."""
    fields: dict = {}
    if environment_description:
        fields["environment_description"] = environment_description
    if font:
        fields["font"] = font
    if text_color:
        fields["text_color"] = text_color
    return await tools.environment_create(universe_id, name, **fields)


@mcp.tool
async def lorekit_environment_update(
    universe_id: str,
    environment_id: str,
    name: str | None = None,
    environment_description: str | None = None,
    font: str | None = None,
    text_color: str | None = None,
) -> str:
    """Update a visual environment."""
    fields = {k: v for k, v in {"name": name, "environment_description": environment_description, "font": font, "text_color": text_color}.items() if v is not None}
    return await tools.environment_update(universe_id, environment_id, **fields)


# ---------------------------------------------------------------------------
# Projects & Generation
# ---------------------------------------------------------------------------

@mcp.tool
async def lorekit_project_list(universe_id: str | None = None) -> str:
    """List video projects. Optionally filter by universe."""
    return await tools.project_list(universe_id)


@mcp.tool
async def lorekit_project_get(project_id: str) -> str:
    """Get full project details: story, scenes, clips, render status."""
    return await tools.project_get(project_id)


@mcp.tool
async def lorekit_project_delete(project_id: str) -> str:
    """Delete a project and all its generated files."""
    return await tools.project_delete(project_id)


@mcp.tool
async def lorekit_generate_story(
    character_id: str,
    universe_id: str,
    target_duration: int = 35,
    theme: str | None = None,
    arc_template: str | None = None,
    aspect_ratio: str = "9:16",
    quote_ids: list[str] | None = None,
) -> str:
    """Generate a story breakdown for a new video. Creates a project with scene-by-scene plan.

    This is step 1 of video creation. After this, use generate_clips() then generate_render().
    aspect_ratio: '9:16' for YouTube Shorts/TikTok, '16:9' for landscape.
    """
    return await tools.generate_story(
        character_id, universe_id, target_duration, theme, arc_template, aspect_ratio, quote_ids,
    )


@mcp.tool
async def lorekit_generate_clips(project_id: str) -> str:
    """Generate video clips for all scenes in a project (step 2). Returns job_id -- poll with lorekit_job_status()."""
    return await tools.generate_clips(project_id)


@mcp.tool
async def lorekit_generate_clip(project_id: str, scene_id: int) -> str:
    """Regenerate a single scene's video clip."""
    return await tools.generate_clip(project_id, scene_id)


@mcp.tool
async def lorekit_generate_keyframe(project_id: str, scene_id: int) -> str:
    """Generate a preview keyframe image for a scene (faster than full video clip)."""
    return await tools.generate_keyframe(project_id, scene_id)


@mcp.tool
async def lorekit_generate_render(
    project_id: str,
    raw: bool = False,
    text_overlays: bool = True,
    color_grade: bool = True,
    audio: bool = True,
) -> str:
    """Render the final assembled video (step 3). Set raw=True for quick preview without effects. Returns job_id."""
    return await tools.generate_render(project_id, raw, text_overlays, color_grade, audio)


@mcp.tool
async def lorekit_job_status(job_id: str) -> str:
    """Check the status of a background job (clips generation, render, keyframe). Returns status, progress %, and message."""
    return await tools.job_status(job_id)


# ---------------------------------------------------------------------------
# Scenes
# ---------------------------------------------------------------------------

@mcp.tool
async def lorekit_scene_list(project_id: str) -> str:
    """List all scenes in a project with their visual descriptions and settings."""
    return await tools.scene_list(project_id)


@mcp.tool
async def lorekit_scene_update(
    project_id: str,
    scene_id: int,
    visual_description: str | None = None,
    camera: str | None = None,
    text_overlay: str | None = None,
    duration: float | None = None,
) -> str:
    """Edit a scene's visual description, camera angle, text overlay, or duration."""
    fields = {k: v for k, v in {"visual_description": visual_description, "camera": camera, "text_overlay": text_overlay, "duration": duration}.items() if v is not None}
    return await tools.scene_update(project_id, scene_id, **fields)


# ---------------------------------------------------------------------------
# Documents
# ---------------------------------------------------------------------------

@mcp.tool
async def lorekit_document_list(universe_id: str, character_id: str) -> str:
    """List documents attached to a character (used as source material for stories)."""
    return await tools.document_list(universe_id, character_id)


@mcp.tool
async def lorekit_document_create(
    universe_id: str,
    character_id: str,
    name: str,
    content: str,
    doc_type: str = "text",
) -> str:
    """Upload a document for a character. After creating, call lorekit_document_process() to extract source items."""
    return await tools.document_create(universe_id, character_id, name, content, doc_type)


@mcp.tool
async def lorekit_document_process(universe_id: str, character_id: str, document_id: str) -> str:
    """Process a document -- extract source items and generate vector embeddings for retrieval."""
    return await tools.document_process(universe_id, character_id, document_id)


# ---------------------------------------------------------------------------
# Voices
# ---------------------------------------------------------------------------

@mcp.tool
async def lorekit_voice_get(universe_id: str, character_id: str) -> str:
    """Get voice/TTS settings for a character."""
    return await tools.voice_get(universe_id, character_id)


@mcp.tool
async def lorekit_voice_set(
    universe_id: str,
    character_id: str,
    tts_model: str | None = None,
    voice_id: str | None = None,
    voice_name: str | None = None,
) -> str:
    """Set voice/TTS settings for a character. Use lorekit_tts_models() to see available models."""
    return await tools.voice_set(universe_id, character_id, tts_model, voice_id, voice_name)


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

@mcp.tool
async def lorekit_settings() -> str:
    """Get current LoreKit settings (API provider, model, etc)."""
    return await tools.settings_get()


@mcp.tool
async def lorekit_vibe_presets() -> str:
    """List available video vibe presets (visual styles like 'dark_masculine', 'mobile_game', etc)."""
    return await tools.vibe_presets()


@mcp.tool
async def lorekit_arc_templates() -> str:
    """List available story arc templates (narrative structures like 'story', 'rapid_montage', etc)."""
    return await tools.arc_templates()


@mcp.tool
async def lorekit_tts_models() -> str:
    """List available text-to-speech models and voices."""
    return await tools.tts_models()

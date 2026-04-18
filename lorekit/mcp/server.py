"""Shared FastMCP server instance with all LoreKit tools.

Imported by:
  - lorekit/server.py       (mounted on FastAPI at /mcp for streamable HTTP)
"""

from __future__ import annotations

from fastmcp import FastMCP

from lorekit.mcp import tools  # noqa: F401
from lorekit.mcp import workflow_tools as wf_tools

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
    target_audience: str = "",
    performance_notes: str = "",
    group_name: str = "",
    era: str = "",
) -> str:
    """Create a new character in a universe.

    character_description: Physical appearance only (face, hair, build, clothing).
    target_audience: Who this character represents / speaks to.
    performance_notes: Reaction choreography, mannerisms, acting direction for video.
    """
    return await tools.character_create(universe_id, name, group_name, era, character_description, target_audience, performance_notes)


@mcp.tool
async def lorekit_character_update(
    character_id: str,
    name: str | None = None,
    character_description: str | None = None,
    era: str | None = None,
    group: str | None = None,
    target_audience: str | None = None,
    performance_notes: str | None = None,
) -> str:
    """Update a character's properties.

    performance_notes: Reaction choreography, mannerisms, acting direction for video.
    target_audience: Who this character represents / speaks to.
    """
    fields = {k: v for k, v in {"name": name, "character_description": character_description, "era": era, "group": group, "target_audience": target_audience, "performance_notes": performance_notes}.items() if v is not None}
    return await tools.character_update(character_id, **fields)


# ---------------------------------------------------------------------------
# Character Images
# ---------------------------------------------------------------------------

@mcp.tool
async def lorekit_character_image_generate(
    character_id: str,
    theme: str = "",
    custom_description: str = "",
    view: str = "",
) -> str:
    """Generate a portrait image for a character. Optionally specify a theme (e.g. 'dark_masculine').

    Use 'view' to generate additional images of the same character in different
    settings or angles (e.g. 'work_truck', 'apartment_balcony', 'gym').
    Each view is stored separately — the default portrait is not overwritten.
    Pass 'custom_description' to control the scene/setting for the view.
    """
    return await tools.character_image_generate(character_id, theme, custom_description, view)


@mcp.tool
async def lorekit_character_image_list(character_id: str) -> str:
    """List all generated portrait images for a character."""
    return await tools.character_image_list(character_id)


@mcp.tool
async def lorekit_character_image_delete(character_id: str, theme: str, index: int) -> str:
    """Delete a character image by theme and index. Use lorekit_character_image_list to see indices."""
    return await tools.character_image_delete(character_id, theme, index)


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
    story_context: str = "",
) -> str:
    """Generate a story breakdown for a new video. Creates a project with scene-by-scene plan.

    This is step 1 of video creation. After this, use generate_clips() then generate_render().
    aspect_ratio: '9:16' for YouTube Shorts/TikTok, '16:9' for landscape.
    story_context: Free-text creative direction for the LLM. Describe the mood, reaction style,
    scenario, or any specific direction. Character performance_notes are auto-injected.
    Examples:
    - UGC: 'Person discovers a finance app. Starts skeptical, slowly becomes convinced.'
    - Cartoon: 'Whimsical adventure through a candy factory. Bright colors, exaggerated physics.'
    - Product: 'Sleek product reveal with dramatic lighting and hero shots.'
    """
    return await tools.generate_story(
        character_id, universe_id, target_duration, theme, arc_template, aspect_ratio, quote_ids, story_context,
    )


@mcp.tool
async def lorekit_generate_clips(project_id: str) -> str:
    """Generate video clips for all scenes in a project (step 2). Returns job_id -- poll with lorekit_job_status()."""
    return await tools.generate_clips(project_id)


@mcp.tool
async def lorekit_generate_clip(project_id: str, scene_id: int, character_image_url: str | None = None) -> str:
    """Regenerate a single scene's video clip.

    character_image_url: Override the character portrait for this clip (e.g., gym view).
    Use character_image_list() to find available views.
    """
    return await tools.generate_clip(project_id, scene_id, character_image_url=character_image_url)


@mcp.tool
async def lorekit_project_character_image(
    project_id: str,
    custom_description: str,
    label: str = "variation",
    scene_id: int | None = None,
) -> str:
    """Generate a character variation for this project (e.g., gym outfit, different setting).

    Edits the base portrait using Kontext Max — changes clothing/background while keeping face identical.
    Stored as a project material (visible in Media Gallery), NOT on the character.
    Pass scene_id to auto-set as reference image on that scene.
    Use the returned image_url as character_image_url in generate_clip().
    """
    return await tools.project_character_image(project_id, custom_description, label, scene_id)


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


@mcp.tool
async def lorekit_scene_add(
    project_id: str,
    visual_description: str = "",
    camera: str = "",
    beat: str = "reaction",
    duration: float = 5.0,
    character_present: bool = True,
    text_overlay: str = "",
    after_scene_id: int | None = None,
) -> str:
    """Add a new scene to a project. Inserts after after_scene_id (or appends at end).

    Auto-adds transitions between scenes. Use generate_clip() after to produce video.
    """
    fields: dict = {
        "visual_description": visual_description,
        "camera": camera,
        "beat": beat,
        "duration": duration,
        "character_present": character_present,
        "text_overlay": text_overlay,
    }
    if after_scene_id is not None:
        fields["after_scene_id"] = after_scene_id
    return await tools.scene_add(project_id, **fields)


@mcp.tool
async def lorekit_scene_delete(project_id: str, scene_id: int) -> str:
    """Delete a scene and its adjacent transitions. Renumbers remaining scenes."""
    return await tools.scene_delete(project_id, scene_id)


@mcp.tool
async def lorekit_scene_reorder(project_id: str, scene_ids: list[int]) -> str:
    """Reorder scenes. Pass all scene_ids in desired order."""
    return await tools.scene_reorder(project_id, scene_ids)


# ---------------------------------------------------------------------------
# Text Overlays
# ---------------------------------------------------------------------------

@mcp.tool
async def lorekit_text_list(project_id: str) -> str:
    """List all text overlays in a project."""
    return await tools.text_list(project_id)


@mcp.tool
async def lorekit_text_add(
    project_id: str,
    text: str,
    from_frame: int = 0,
    duration_frames: int = 150,
    font_family: str = "Cinzel",
    font_size: int = 48,
    color: str = "#FFFFFF",
    position_x: float = 0.5,
    position_y: float = 0.5,
    width: float = 0.8,
) -> str:
    """Add a text overlay to a project timeline.

    Position: x/y are normalized 0-1 (0.5 = center). Duration in frames (30fps, so 150 = 5s).
    """
    return await tools.text_add(project_id, text=text, from_frame=from_frame,
        duration_frames=duration_frames, font_family=font_family,
        font_size=font_size, color=color,
        position={"x": position_x, "y": position_y}, width=width)


@mcp.tool
async def lorekit_text_update(
    project_id: str,
    text_id: str,
    text: str | None = None,
    font_family: str | None = None,
    font_size: int | None = None,
    color: str | None = None,
    from_frame: int | None = None,
    duration_frames: int | None = None,
    position_x: float | None = None,
    position_y: float | None = None,
    width: float | None = None,
    enabled: bool | None = None,
) -> str:
    """Update a text overlay's properties."""
    fields: dict = {k: v for k, v in {
        "text": text, "font_family": font_family, "font_size": font_size,
        "color": color, "from_frame": from_frame, "duration_frames": duration_frames,
        "width": width, "enabled": enabled,
    }.items() if v is not None}
    if position_x is not None or position_y is not None:
        fields["position"] = {"x": position_x or 0.5, "y": position_y or 0.5}
    return await tools.text_update(project_id, text_id, **fields)


@mcp.tool
async def lorekit_text_delete(project_id: str, text_id: str) -> str:
    """Delete a text overlay from a project."""
    return await tools.text_delete(project_id, text_id)


# ---------------------------------------------------------------------------
# Transitions
# ---------------------------------------------------------------------------

@mcp.tool
async def lorekit_transition_update(
    project_id: str,
    from_scene_id: int,
    to_scene_id: int,
    transition_type: str | None = None,
    prompt: str | None = None,
    duration: float | None = None,
    speed: float | None = None,
) -> str:
    """Update or create a transition between two scenes."""
    fields = {k: v for k, v in {
        "transition_type": transition_type, "prompt": prompt,
        "duration": duration, "speed": speed,
    }.items() if v is not None}
    return await tools.transition_update(project_id, from_scene_id, to_scene_id, **fields)


@mcp.tool
async def lorekit_transition_delete(project_id: str, from_scene_id: int, to_scene_id: int) -> str:
    """Delete a transition between two scenes (becomes hard cut)."""
    return await tools.transition_delete(project_id, from_scene_id, to_scene_id)


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
    """List available story arc templates (narrative structures like 'story', 'rapid_montage', etc).
    Includes both built-in and custom templates."""
    return await tools.arc_templates()


@mcp.tool
async def lorekit_arc_template_create(
    name: str,
    description: str = "",
    beats_json: str = "[]",
    optional_beats_json: str = "[]",
    min_duration: float = 30,
    max_duration: float = 50,
    min_scenes: int = 5,
    max_scenes: int = 8,
    max_scene_duration: float = 8,
    system_prompt_fragment: str = "",
) -> str:
    """Create a custom arc template (narrative structure for video generation).

    beats_json: JSON array of beat definitions, e.g. [{"beat": "hook", "duration_range": [3, 5], "purpose": "Stop the scroll"}]
    system_prompt_fragment: Optional LLM prompt fragment injected during story generation. Auto-generated if empty.
    """
    return await tools.arc_template_create(
        name, description, beats_json, optional_beats_json,
        min_duration, max_duration, min_scenes, max_scenes,
        max_scene_duration, system_prompt_fragment,
    )


@mcp.tool
async def lorekit_arc_template_update(
    template_id: str,
    name: str | None = None,
    description: str | None = None,
    beats_json: str | None = None,
    min_duration: float | None = None,
    max_duration: float | None = None,
    min_scenes: int | None = None,
    max_scenes: int | None = None,
    max_scene_duration: float | None = None,
    system_prompt_fragment: str | None = None,
) -> str:
    """Update a custom arc template. Built-in templates cannot be edited."""
    fields = {k: v for k, v in {
        "name": name, "description": description, "beats_json": beats_json,
        "min_duration": min_duration, "max_duration": max_duration,
        "min_scenes": min_scenes, "max_scenes": max_scenes,
        "max_scene_duration": max_scene_duration,
        "system_prompt_fragment": system_prompt_fragment,
    }.items() if v is not None}
    return await tools.arc_template_update(template_id, **fields)


@mcp.tool
async def lorekit_arc_template_delete(template_id: str) -> str:
    """Delete a custom arc template. Built-in templates cannot be deleted."""
    return await tools.arc_template_delete(template_id)


@mcp.tool
async def lorekit_context_presets(category: str = "") -> str:
    """List story context presets — reusable creative directions for video generation.

    Categories: 'ugc', 'cinematic', 'product', 'general'. Leave empty for all.
    Use a preset's `context` value as the `story_context` parameter in lorekit_generate_story.
    """
    return await tools.context_presets(category)


@mcp.tool
async def lorekit_context_preset_create(
    name: str,
    context: str,
    description: str = "",
    category: str = "general",
) -> str:
    """Create a custom story context preset for reuse across video generations.

    context: The creative direction text (e.g. 'Person starts skeptical, slowly becomes convinced').
    category: 'ugc', 'cinematic', 'product', or 'general'.
    """
    return await tools.context_preset_create(name, context, description, category)


@mcp.tool
async def lorekit_context_preset_delete(preset_id: str) -> str:
    """Delete a custom context preset. Built-in presets cannot be deleted."""
    return await tools.context_preset_delete(preset_id)


@mcp.tool
async def lorekit_tts_models() -> str:
    """List available text-to-speech models and voices."""
    return await tools.tts_models()


# ---------------------------------------------------------------------------
# Workflows
# ---------------------------------------------------------------------------

@mcp.tool
async def lorekit_workflow_create(project_id: str, name: str = "") -> str:
    """Create an empty workflow for a project. Then add nodes with lorekit_workflow_add_node."""
    return await wf_tools.workflow_create(project_id, name)


@mcp.tool
async def lorekit_workflow_get(project_id: str) -> str:
    """Get the workflow graph for a project. Shows all nodes, connections, and statuses."""
    return await wf_tools.workflow_get(project_id)


@mcp.tool
async def lorekit_workflow_add_node(
    project_id: str, type: str, label: str = "", params: str = "{}", inputs: str = "{}",
) -> str:
    """Add a node to a project's workflow.

    type: node type (kontext_keyframe, kling_v3_pro, kling_o3, face_swap, download, etc.)
    params: JSON string of model-specific parameters
    inputs: JSON string mapping input names to upstream refs (e.g. {"image": "node_abc.outputs.url"})
    """
    return await wf_tools.workflow_add_node(project_id, type, label, params, inputs)


@mcp.tool
async def lorekit_workflow_update_node(
    project_id: str, node_id: str, params: str | None = None, label: str | None = None, inputs: str | None = None,
) -> str:
    """Update a node's parameters, label, or inputs."""
    return await wf_tools.workflow_update_node(project_id, node_id, params, label, inputs)


@mcp.tool
async def lorekit_workflow_remove_node(project_id: str, node_id: str) -> str:
    """Remove a node from the workflow. Also removes any connections to it."""
    return await wf_tools.workflow_remove_node(project_id, node_id)


@mcp.tool
async def lorekit_workflow_connect(
    project_id: str, from_node: str, output_key: str, to_node: str, input_key: str,
) -> str:
    """Connect one node's output to another node's input."""
    return await wf_tools.workflow_connect(project_id, from_node, output_key, to_node, input_key)


@mcp.tool
async def lorekit_workflow_execute(project_id: str) -> str:
    """Start executing a workflow. Returns a job_id for polling progress."""
    return await wf_tools.workflow_execute(project_id)


@mcp.tool
async def lorekit_workflow_retry_node(project_id: str, node_id: str) -> str:
    """Retry a failed node. Resets it to pending and re-executes the workflow."""
    return await wf_tools.workflow_retry_node(project_id, node_id)


@mcp.tool
async def lorekit_workflow_node_types() -> str:
    """List all available node types with their inputs, outputs, and costs."""
    return await wf_tools.workflow_node_types()

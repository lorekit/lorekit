/**
 * MCP tools reference data.
 *
 * Keep in sync with lorekit/mcp/server.py (46 tools).
 */

export interface McpTool {
  name: string;
  description: string;
}

export interface McpToolCategory {
  name: string;
  tools: McpTool[];
}

export const MCP_TOOL_CATEGORIES: McpToolCategory[] = [
  {
    name: "Universes",
    tools: [
      { name: "lorekit_universe_list", description: "List all universes (story worlds)" },
      { name: "lorekit_universe_get", description: "Get universe details" },
      { name: "lorekit_universe_create", description: "Create a new universe" },
      { name: "lorekit_universe_update", description: "Update a universe's properties" },
      { name: "lorekit_universe_delete", description: "Delete a universe and all its contents" },
    ],
  },
  {
    name: "Characters",
    tools: [
      { name: "lorekit_character_list", description: "List characters in a universe" },
      { name: "lorekit_character_get", description: "Get character details" },
      { name: "lorekit_character_create", description: "Create a character in a universe" },
      { name: "lorekit_character_update", description: "Update a character's properties" },
    ],
  },
  {
    name: "Character Images",
    tools: [
      { name: "lorekit_character_image_generate", description: "Generate a portrait image" },
      { name: "lorekit_character_image_list", description: "List generated portraits" },
    ],
  },
  {
    name: "Reference Images",
    tools: [
      { name: "lorekit_character_reference_image_upload", description: "Upload a reference photo (URL or file path) to anchor character likeness" },
      { name: "lorekit_character_reference_image_list", description: "List reference images for a character" },
      { name: "lorekit_character_reference_image_delete", description: "Delete a reference image" },
    ],
  },
  {
    name: "Source Items",
    tools: [
      { name: "lorekit_source_list", description: "List source items in a universe" },
      { name: "lorekit_source_create", description: "Create a source item for a character" },
      { name: "lorekit_source_update", description: "Update a source item" },
      { name: "lorekit_source_delete", description: "Delete a source item" },
    ],
  },
  {
    name: "Scripts",
    tools: [
      { name: "lorekit_script_list", description: "List scripts in a universe" },
      { name: "lorekit_script_get", description: "Get a script's full content" },
      { name: "lorekit_script_create", description: "Create a new script" },
      { name: "lorekit_script_update", description: "Update a script" },
      { name: "lorekit_script_delete", description: "Delete a script" },
    ],
  },
  {
    name: "Environments",
    tools: [
      { name: "lorekit_environment_list", description: "List visual environments" },
      { name: "lorekit_environment_create", description: "Create an environment" },
      { name: "lorekit_environment_update", description: "Update an environment" },
    ],
  },
  {
    name: "Projects",
    tools: [
      { name: "lorekit_project_list", description: "List video projects" },
      { name: "lorekit_project_get", description: "Get full project details" },
      { name: "lorekit_project_delete", description: "Delete a project and its files" },
    ],
  },
  {
    name: "Generation",
    tools: [
      { name: "lorekit_generate_story", description: "Generate a story breakdown (step 1)" },
      { name: "lorekit_generate_clips", description: "Generate video clips for all scenes (step 2)" },
      { name: "lorekit_generate_clip", description: "Regenerate a single scene's clip" },
      { name: "lorekit_generate_keyframe", description: "Generate a preview keyframe image" },
      { name: "lorekit_generate_render", description: "Render the final assembled video (step 3)" },
      { name: "lorekit_job_status", description: "Check background job status and progress" },
    ],
  },
  {
    name: "Scenes",
    tools: [
      { name: "lorekit_scene_list", description: "List scenes in a project" },
      { name: "lorekit_scene_update", description: "Edit a scene's visual description, camera, duration" },
    ],
  },
  {
    name: "Documents",
    tools: [
      { name: "lorekit_document_list", description: "List documents for a character" },
      { name: "lorekit_document_create", description: "Upload a document as source material" },
      { name: "lorekit_document_process", description: "Process a document to extract source items" },
    ],
  },
  {
    name: "Voices",
    tools: [
      { name: "lorekit_voice_get", description: "Get voice/TTS settings for a character" },
      { name: "lorekit_voice_set", description: "Set voice/TTS settings" },
    ],
  },
  {
    name: "Configuration",
    tools: [
      { name: "lorekit_settings", description: "Get current LoreKit settings" },
      { name: "lorekit_vibe_presets", description: "List video vibe presets (visual styles)" },
      { name: "lorekit_arc_templates", description: "List story arc templates" },
      { name: "lorekit_tts_models", description: "List text-to-speech models" },
    ],
  },
];

export const TOTAL_TOOLS = MCP_TOOL_CATEGORIES.reduce(
  (sum, cat) => sum + cat.tools.length,
  0
);

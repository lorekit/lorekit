import { sql } from "drizzle-orm";
import { pgTable, pgPolicy, text, real, integer, vector, index, jsonb } from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";

// ============================================================
// RLS helpers — mirrors cloud/multi_tenancy/rls_policies.sql
//
// user_org_ids() returns the org IDs the current user belongs to.
// This function must exist in the database (created via a separate
// migration or Supabase SQL editor). Drizzle manages the policies
// that reference it.
// ============================================================

const userOrgIds = sql`(SELECT ARRAY(SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))`;
const inUserOrgs = sql`organization_id = ANY(${userOrgIds})`;
const universeInUserOrgs = sql`universe_id IN (SELECT id FROM universes WHERE organization_id = ANY(${userOrgIds}))`;
const characterInUserOrgs = sql`character_id IN (SELECT id FROM characters WHERE universe_id IN (SELECT id FROM universes WHERE organization_id = ANY(${userOrgIds})))`;
const projectInUserOrgs = sql`project_id IN (SELECT id FROM universe_projects WHERE universe_id IN (SELECT id FROM universes WHERE organization_id = ANY(${userOrgIds})))`;

// Helper: CRUD policies for a given USING/WITH CHECK expression
function orgPolicies(name: string, condition: ReturnType<typeof sql>) {
  return [
    pgPolicy(`${name}_select`, { for: "select", to: authenticatedRole, using: condition }),
    pgPolicy(`${name}_insert`, { for: "insert", to: authenticatedRole, withCheck: condition }),
    pgPolicy(`${name}_update`, { for: "update", to: authenticatedRole, using: condition }),
    pgPolicy(`${name}_delete`, { for: "delete", to: authenticatedRole, using: condition }),
  ];
}

// ============================================================
// TIER 1: UNIVERSES (root entity, owns organization_id)
// ============================================================

export const universes = pgTable("universes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  icon: text("icon").notNull().default(""),
  videoVibePreset: text("video_vibe_preset").notNull().default("mobile_game"),
  organizationId: text("organization_id").notNull().default("local"),
  createdBy: text("created_by").notNull().default("local"),
  createdAt: text("created_at").notNull(),
}, () => [
  pgPolicy("universes_select", { for: "select", to: authenticatedRole, using: inUserOrgs }),
  pgPolicy("universes_insert", { for: "insert", to: authenticatedRole, withCheck: inUserOrgs }),
  pgPolicy("universes_update", { for: "update", to: authenticatedRole, using: inUserOrgs }),
  // Delete requires owner or admin role
  pgPolicy("universes_delete", {
    for: "delete",
    to: authenticatedRole,
    using: sql`organization_id = ANY(${userOrgIds}) AND EXISTS (SELECT 1 FROM organization_members WHERE organization_id = universes.organization_id AND user_id = auth.uid() AND role IN ('owner', 'admin'))`,
  }),
]);

export const videoStyles = pgTable("video_styles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  prompt: text("prompt").notNull(),
  characterPrompt: text("character_prompt").notNull().default(""),
  imageModel: text("image_model").notNull().default("kontext"),  // "kontext" or "nano_banana_2"
  isBuiltin: integer("is_builtin").notNull().default(0),  // 1 = built-in default, 0 = user-created
  organizationId: text("organization_id").notNull().default("local"),
  createdAt: text("created_at").notNull(),
}, () => [
  pgPolicy("video_styles_select", { for: "select", to: authenticatedRole, using: sql`is_builtin = 1 OR ${inUserOrgs}` }),
  pgPolicy("video_styles_insert", { for: "insert", to: authenticatedRole, withCheck: inUserOrgs }),
  pgPolicy("video_styles_update", { for: "update", to: authenticatedRole, using: sql`is_builtin = 0 AND ${inUserOrgs}` }),
  pgPolicy("video_styles_delete", { for: "delete", to: authenticatedRole, using: sql`is_builtin = 0 AND ${inUserOrgs}` }),
]);

// ============================================================
// TIER 2: DIRECT CHILDREN OF UNIVERSES
// ============================================================

export const characters = pgTable("characters", {
  id: text("id").primaryKey(),
  universeId: text("universe_id")
    .notNull()
    .references(() => universes.id),
  name: text("name").notNull(),
  groupName: text("group_name").notNull(),
  era: text("era").notNull().default(""),
  characterDescription: text("character_description").notNull().default(""),
  characterImageUrl: text("character_image_url"),
  characterRefUrls: text("character_ref_urls"),
  characterStylesJson: text("character_styles_json"),  // {"theme": {"description": "...", "image_url": "...", "image_path": "..."}}
}, () => orgPolicies("characters", universeInUserOrgs));

export const environments = pgTable("environments", {
  id: text("id").primaryKey(),
  universeId: text("universe_id")
    .notNull()
    .references(() => universes.id),
  name: text("name").notNull(),
  colorGradeJson: text("color_grade_json"),
  font: text("font").notNull().default("Cinzel"),
  textColor: text("text_color").notNull().default("#FFFFFF"),
  textShadow: text("text_shadow").notNull().default("warm"),
  environmentDescription: text("environment_description").notNull().default(""),
  themedDescriptionsJson: text("themed_descriptions_json"),
}, () => orgPolicies("environments", universeInUserOrgs));

export const sceneTemplates = pgTable("scene_templates", {
  id: text("id").primaryKey(),
  universeId: text("universe_id")
    .notNull()
    .references(() => universes.id),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  beatsJson: text("beats_json"),
  minDuration: real("min_duration").notNull().default(30),
  maxDuration: real("max_duration").notNull().default(50),
  minScenes: integer("min_scenes").notNull().default(5),
  maxScenes: integer("max_scenes").notNull().default(8),
}, () => orgPolicies("scene_templates", universeInUserOrgs));

export const scripts = pgTable("scripts", {
  id: text("id").primaryKey(),
  universeId: text("universe_id")
    .notNull()
    .references(() => universes.id),
  title: text("title").notNull(),
  scriptType: text("script_type").notNull().default("idea"),
  content: text("content").notNull().default(""),
  characterIdsJson: text("character_ids_json"),
  targetDurationSeconds: integer("target_duration_seconds"),
  sceneCount: integer("scene_count"),
  status: text("status").notNull().default("draft"),
  metadataJson: text("metadata_json"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, () => orgPolicies("scripts", universeInUserOrgs));

export const sourceItems = pgTable("source_items", {
  id: text("id").primaryKey(),
  universeId: text("universe_id")
    .notNull()
    .references(() => universes.id),
  characterId: text("character_id")
    .notNull()
    .references(() => characters.id),
  text: text("text").notNull(),
  shortVersion: text("short_version"),
  theme: text("theme").notNull(),
  emotionalFunction: text("emotional_function").notNull(),
  wordCount: integer("word_count").notNull().default(0),
  readTimeSeconds: real("read_time_seconds").notNull().default(0.0),
  pairWithVisual: text("pair_with_visual").notNull().default(""),
  usedCount: integer("used_count").notNull().default(0),
  lastUsedAt: text("last_used_at"),
}, () => orgPolicies("source_items", universeInUserOrgs));

export const universeProjects = pgTable("universe_projects", {
  id: text("id").primaryKey(),
  universeId: text("universe_id")
    .notNull()
    .references(() => universes.id),
  name: text("name").notNull().default(""),
  characterId: text("character_id")
    .notNull()
    .references(() => characters.id),
  hookQuoteId: text("hook_quote_id"),
  truthQuoteId: text("truth_quote_id"),
  status: text("status").notNull().default("draft"),
  outputPath: text("output_path"),
  youtubeId: text("youtube_id"),
  youtubeTitle: text("youtube_title"),
  costUsd: real("cost_usd").notNull().default(0.0),
  characterImageUrl: text("character_image_url"),
  characterImagePath: text("character_image_path"),
  aspectRatio: text("aspect_ratio").notNull().default("9:16"),
  sourceType: text("source_type").notNull().default("quote"),
  scriptId: text("script_id"),
  characterIdsJson: text("character_ids_json"),
  theme: text("theme"),  // video style key, defaults to universe's video_vibe_preset
  audioMode: text("audio_mode").notNull().default("auto"),
  uploadedAudioPath: text("uploaded_audio_path"),
  timelineJson: jsonb("timeline_json"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, () => orgPolicies("projects", universeInUserOrgs));

// ============================================================
// TIER 3: GRANDCHILDREN (via character or project)
// ============================================================

export const characterDocuments = pgTable("character_documents", {
  id: text("id").primaryKey(),
  characterId: text("character_id")
    .notNull()
    .references(() => characters.id),
  universeId: text("universe_id")
    .notNull()
    .references(() => universes.id),
  name: text("name").notNull(),
  docType: text("doc_type").notNull().default("text"),
  content: text("content"),
  filePath: text("file_path"),
  fileSizeBytes: integer("file_size_bytes").default(0),
  chunkCount: integer("chunk_count").default(0),
  status: text("status").notNull().default("pending"),
  metadataJson: text("metadata_json"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, () => [
  pgPolicy("character_documents_select", { for: "select", to: authenticatedRole, using: universeInUserOrgs }),
  pgPolicy("character_documents_insert", { for: "insert", to: authenticatedRole, withCheck: universeInUserOrgs }),
  pgPolicy("character_documents_update", { for: "update", to: authenticatedRole, using: universeInUserOrgs }),
  pgPolicy("character_documents_delete", { for: "delete", to: authenticatedRole, using: universeInUserOrgs }),
]);

export const documentChunks = pgTable("document_chunks", {
  id: text("id").primaryKey(),
  documentId: text("document_id")
    .notNull()
    .references(() => characterDocuments.id),
  characterId: text("character_id")
    .notNull()
    .references(() => characters.id),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  tokenCount: integer("token_count").default(0),
  embedding: vector("embedding", { dimensions: 1536 }),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("embedding_cosine_idx").using("hnsw", table.embedding.op("vector_cosine_ops")),
  pgPolicy("chunks_select", { for: "select", to: authenticatedRole, using: characterInUserOrgs }),
  pgPolicy("chunks_insert", { for: "insert", to: authenticatedRole, withCheck: characterInUserOrgs }),
  pgPolicy("chunks_update", { for: "update", to: authenticatedRole, using: characterInUserOrgs }),
  pgPolicy("chunks_delete", { for: "delete", to: authenticatedRole, using: characterInUserOrgs }),
]);

export const characterVoices = pgTable("character_voices", {
  id: text("id").primaryKey(),
  characterId: text("character_id")
    .notNull()
    .references(() => characters.id),
  ttsModel: text("tts_model").notNull().default("fal-ai/minimax/speech-2.6-turbo"),
  voiceId: text("voice_id"),
  voiceName: text("voice_name").notNull().default("Default"),
  referenceAudioPath: text("reference_audio_path"),
  settingsJson: text("settings_json"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, () => orgPolicies("voices", characterInUserOrgs));

export const jobs = pgTable("jobs", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull().default("pending"),
  progress: real("progress").notNull().default(0.0),
  message: text("message").notNull().default(""),
  resultJson: text("result_json"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, () => [
  pgPolicy("jobs_select", { for: "select", to: authenticatedRole, using: projectInUserOrgs }),
  pgPolicy("jobs_insert", { for: "insert", to: authenticatedRole, withCheck: projectInUserOrgs }),
  pgPolicy("jobs_update", { for: "update", to: authenticatedRole, using: projectInUserOrgs }),
  pgPolicy("jobs_delete", { for: "delete", to: authenticatedRole, using: projectInUserOrgs }),
]);

export const costs = pgTable("costs", {
  id: text("id").primaryKey(),
  videoId: text("video_id").notNull(),
  component: text("component").notNull(),
  amountUsd: real("amount_usd").notNull(),
  createdAt: text("created_at").notNull(),
}, () => [
  pgPolicy("costs_select", { for: "select", to: authenticatedRole, using: sql`video_id IN (SELECT id FROM universe_projects WHERE universe_id IN (SELECT id FROM universes WHERE organization_id = ANY(${userOrgIds})))` }),
  pgPolicy("costs_insert", { for: "insert", to: authenticatedRole, withCheck: sql`video_id IN (SELECT id FROM universe_projects WHERE universe_id IN (SELECT id FROM universes WHERE organization_id = ANY(${userOrgIds})))` }),
]);

export const projectEffects = pgTable("project_effects", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  effectType: text("effect_type").notNull().default("color_grade"),
  name: text("name").notNull().default(""),
  startTime: real("start_time").notNull().default(0),
  endTime: real("end_time"),
  sortOrder: integer("sort_order").notNull().default(0),
  settingsJson: text("settings_json").notNull().default("{}"),
  enabled: integer("enabled").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, () => [
  pgPolicy("project_effects_select", { for: "select", to: authenticatedRole, using: projectInUserOrgs }),
  pgPolicy("project_effects_insert", { for: "insert", to: authenticatedRole, withCheck: projectInUserOrgs }),
  pgPolicy("project_effects_update", { for: "update", to: authenticatedRole, using: projectInUserOrgs }),
  pgPolicy("project_effects_delete", { for: "delete", to: authenticatedRole, using: projectInUserOrgs }),
]);

export const projectAudioAssets = pgTable("project_audio_assets", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  assetType: text("asset_type").notNull().default("music"),
  name: text("name").notNull().default(""),
  filePath: text("file_path").notNull(),
  durationSeconds: real("duration_seconds"),
  metadataJson: text("metadata_json"),
  createdAt: text("created_at").notNull(),
}, () => [
  pgPolicy("audio_assets_select", { for: "select", to: authenticatedRole, using: projectInUserOrgs }),
  pgPolicy("audio_assets_insert", { for: "insert", to: authenticatedRole, withCheck: projectInUserOrgs }),
  pgPolicy("audio_assets_update", { for: "update", to: authenticatedRole, using: projectInUserOrgs }),
  pgPolicy("audio_assets_delete", { for: "delete", to: authenticatedRole, using: projectInUserOrgs }),
]);

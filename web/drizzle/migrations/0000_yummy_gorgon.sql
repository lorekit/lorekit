CREATE TABLE "character_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"character_id" text NOT NULL,
	"universe_id" text NOT NULL,
	"name" text NOT NULL,
	"doc_type" text DEFAULT 'text' NOT NULL,
	"content" text,
	"file_path" text,
	"file_size_bytes" integer DEFAULT 0,
	"chunk_count" integer DEFAULT 0,
	"status" text DEFAULT 'pending' NOT NULL,
	"metadata_json" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "character_voices" (
	"id" text PRIMARY KEY NOT NULL,
	"character_id" text NOT NULL,
	"tts_model" text DEFAULT 'fal-ai/minimax/speech-2.6-turbo' NOT NULL,
	"voice_id" text,
	"voice_name" text DEFAULT 'Default' NOT NULL,
	"reference_audio_path" text,
	"settings_json" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "characters" (
	"id" text PRIMARY KEY NOT NULL,
	"universe_id" text NOT NULL,
	"name" text NOT NULL,
	"group_name" text NOT NULL,
	"era" text DEFAULT '' NOT NULL,
	"character_description" text DEFAULT '' NOT NULL,
	"character_image_url" text,
	"character_ref_urls" text,
	"character_images_json" text
);
--> statement-breakpoint
CREATE TABLE "costs" (
	"id" text PRIMARY KEY NOT NULL,
	"video_id" text NOT NULL,
	"component" text NOT NULL,
	"amount_usd" real NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"character_id" text NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"token_count" integer DEFAULT 0,
	"embedding" vector(1536),
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "environments" (
	"id" text PRIMARY KEY NOT NULL,
	"universe_id" text NOT NULL,
	"name" text NOT NULL,
	"color_grade_json" text,
	"font" text DEFAULT 'Cinzel' NOT NULL,
	"text_color" text DEFAULT '#FFFFFF' NOT NULL,
	"text_shadow" text DEFAULT 'warm' NOT NULL,
	"environment_description" text DEFAULT '' NOT NULL,
	"themed_descriptions_json" text
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"progress" real DEFAULT 0 NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"result_json" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_audio_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"asset_type" text DEFAULT 'music' NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"file_path" text NOT NULL,
	"duration_seconds" real,
	"metadata_json" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scene_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"universe_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"beats_json" text,
	"min_duration" real DEFAULT 30 NOT NULL,
	"max_duration" real DEFAULT 50 NOT NULL,
	"min_scenes" integer DEFAULT 5 NOT NULL,
	"max_scenes" integer DEFAULT 8 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scripts" (
	"id" text PRIMARY KEY NOT NULL,
	"universe_id" text NOT NULL,
	"title" text NOT NULL,
	"script_type" text DEFAULT 'idea' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"character_ids_json" text,
	"target_duration_seconds" integer,
	"scene_count" integer,
	"status" text DEFAULT 'draft' NOT NULL,
	"metadata_json" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_items" (
	"id" text PRIMARY KEY NOT NULL,
	"universe_id" text NOT NULL,
	"character_id" text NOT NULL,
	"text" text NOT NULL,
	"short_version" text,
	"theme" text NOT NULL,
	"emotional_function" text NOT NULL,
	"word_count" integer DEFAULT 0 NOT NULL,
	"read_time_seconds" real DEFAULT 0 NOT NULL,
	"pair_with_visual" text DEFAULT '' NOT NULL,
	"used_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" text
);
--> statement-breakpoint
CREATE TABLE "universe_projects" (
	"id" text PRIMARY KEY NOT NULL,
	"universe_id" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"character_id" text NOT NULL,
	"hook_quote_id" text,
	"truth_quote_id" text,
	"story_json" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"clips_json" text,
	"output_path" text,
	"youtube_id" text,
	"youtube_title" text,
	"cost_usd" real DEFAULT 0 NOT NULL,
	"character_image_url" text,
	"character_image_path" text,
	"aspect_ratio" text DEFAULT '9:16' NOT NULL,
	"source_type" text DEFAULT 'quote' NOT NULL,
	"script_id" text,
	"character_ids_json" text,
	"audio_mode" text DEFAULT 'auto' NOT NULL,
	"uploaded_audio_path" text,
	"narration_json" text,
	"transitions_json" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "universes" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"icon" text DEFAULT '' NOT NULL,
	"video_vibe_preset" text DEFAULT 'mobile_game' NOT NULL,
	"organization_id" text DEFAULT 'local' NOT NULL,
	"created_by" text DEFAULT 'local' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "character_documents" ADD CONSTRAINT "character_documents_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_documents" ADD CONSTRAINT "character_documents_universe_id_universes_id_fk" FOREIGN KEY ("universe_id") REFERENCES "public"."universes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_voices" ADD CONSTRAINT "character_voices_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_universe_id_universes_id_fk" FOREIGN KEY ("universe_id") REFERENCES "public"."universes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_document_id_character_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."character_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environments" ADD CONSTRAINT "environments_universe_id_universes_id_fk" FOREIGN KEY ("universe_id") REFERENCES "public"."universes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_templates" ADD CONSTRAINT "scene_templates_universe_id_universes_id_fk" FOREIGN KEY ("universe_id") REFERENCES "public"."universes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scripts" ADD CONSTRAINT "scripts_universe_id_universes_id_fk" FOREIGN KEY ("universe_id") REFERENCES "public"."universes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_items" ADD CONSTRAINT "source_items_universe_id_universes_id_fk" FOREIGN KEY ("universe_id") REFERENCES "public"."universes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_items" ADD CONSTRAINT "source_items_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "universe_projects" ADD CONSTRAINT "universe_projects_universe_id_universes_id_fk" FOREIGN KEY ("universe_id") REFERENCES "public"."universes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "universe_projects" ADD CONSTRAINT "universe_projects_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "embedding_cosine_idx" ON "document_chunks" USING hnsw ("embedding" vector_cosine_ops);
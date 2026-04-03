CREATE TABLE "project_effects" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"effect_type" text DEFAULT 'color_grade' NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"start_time" real DEFAULT 0 NOT NULL,
	"end_time" real,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"settings_json" text DEFAULT '{}' NOT NULL,
	"enabled" integer DEFAULT 1 NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_effects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "character_styles_json" text;--> statement-breakpoint
ALTER TABLE "video_styles" ADD COLUMN "image_model" text DEFAULT 'kontext' NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" DROP COLUMN "character_descriptions_json";--> statement-breakpoint
ALTER TABLE "characters" DROP COLUMN "character_images_json";--> statement-breakpoint
CREATE POLICY "project_effects_select" ON "project_effects" AS PERMISSIVE FOR SELECT TO "authenticated" USING (project_id IN (SELECT id FROM universe_projects WHERE universe_id IN (SELECT id FROM universes WHERE organization_id = ANY((SELECT ARRAY(SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))))));--> statement-breakpoint
CREATE POLICY "project_effects_insert" ON "project_effects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (project_id IN (SELECT id FROM universe_projects WHERE universe_id IN (SELECT id FROM universes WHERE organization_id = ANY((SELECT ARRAY(SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))))));--> statement-breakpoint
CREATE POLICY "project_effects_update" ON "project_effects" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (project_id IN (SELECT id FROM universe_projects WHERE universe_id IN (SELECT id FROM universes WHERE organization_id = ANY((SELECT ARRAY(SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))))));--> statement-breakpoint
CREATE POLICY "project_effects_delete" ON "project_effects" AS PERMISSIVE FOR DELETE TO "authenticated" USING (project_id IN (SELECT id FROM universe_projects WHERE universe_id IN (SELECT id FROM universes WHERE organization_id = ANY((SELECT ARRAY(SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))))));
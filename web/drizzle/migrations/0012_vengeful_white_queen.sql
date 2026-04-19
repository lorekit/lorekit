CREATE TABLE "arc_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"beats_json" text DEFAULT '[]' NOT NULL,
	"optional_beats_json" text DEFAULT '[]' NOT NULL,
	"min_duration" real DEFAULT 30 NOT NULL,
	"max_duration" real DEFAULT 50 NOT NULL,
	"min_scenes" integer DEFAULT 5 NOT NULL,
	"max_scenes" integer DEFAULT 8 NOT NULL,
	"max_scene_duration" real DEFAULT 8 NOT NULL,
	"system_prompt_fragment" text DEFAULT '' NOT NULL,
	"is_builtin" integer DEFAULT 0 NOT NULL,
	"organization_id" text DEFAULT 'local' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "arc_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "arc_templates_select" ON "arc_templates" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_builtin = 1 OR organization_id = ANY(ARRAY(SELECT organization_id FROM organization_members WHERE user_id = auth.uid()::text)));--> statement-breakpoint
CREATE POLICY "arc_templates_insert" ON "arc_templates" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (organization_id = ANY(ARRAY(SELECT organization_id FROM organization_members WHERE user_id = auth.uid()::text)));--> statement-breakpoint
CREATE POLICY "arc_templates_update" ON "arc_templates" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_builtin = 0 AND organization_id = ANY(ARRAY(SELECT organization_id FROM organization_members WHERE user_id = auth.uid()::text)));--> statement-breakpoint
CREATE POLICY "arc_templates_delete" ON "arc_templates" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_builtin = 0 AND organization_id = ANY(ARRAY(SELECT organization_id FROM organization_members WHERE user_id = auth.uid()::text)));
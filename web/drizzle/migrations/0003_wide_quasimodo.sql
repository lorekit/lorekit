CREATE TABLE "video_styles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"prompt" text NOT NULL,
	"character_prompt" text DEFAULT '' NOT NULL,
	"is_builtin" integer DEFAULT 0 NOT NULL,
	"organization_id" text DEFAULT 'local' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "video_styles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "character_descriptions_json" text;--> statement-breakpoint
ALTER TABLE "universe_projects" ADD COLUMN "theme" text;--> statement-breakpoint
CREATE POLICY "video_styles_select" ON "video_styles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_builtin = 1 OR organization_id = ANY((SELECT ARRAY(SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))));--> statement-breakpoint
CREATE POLICY "video_styles_insert" ON "video_styles" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (organization_id = ANY((SELECT ARRAY(SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))));--> statement-breakpoint
CREATE POLICY "video_styles_update" ON "video_styles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_builtin = 0 AND organization_id = ANY((SELECT ARRAY(SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))));--> statement-breakpoint
CREATE POLICY "video_styles_delete" ON "video_styles" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_builtin = 0 AND organization_id = ANY((SELECT ARRAY(SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))));
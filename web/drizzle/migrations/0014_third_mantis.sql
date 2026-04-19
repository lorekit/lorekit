CREATE TABLE "story_context_presets" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"context" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"is_builtin" integer DEFAULT 0 NOT NULL,
	"organization_id" text DEFAULT 'local' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "story_context_presets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "story_context_presets_select" ON "story_context_presets" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_builtin = 1 OR organization_id = ANY(ARRAY(SELECT organization_id FROM organization_members WHERE user_id = auth.uid()::text)));--> statement-breakpoint
CREATE POLICY "story_context_presets_insert" ON "story_context_presets" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (organization_id = ANY(ARRAY(SELECT organization_id FROM organization_members WHERE user_id = auth.uid()::text)));--> statement-breakpoint
CREATE POLICY "story_context_presets_update" ON "story_context_presets" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_builtin = 0 AND organization_id = ANY(ARRAY(SELECT organization_id FROM organization_members WHERE user_id = auth.uid()::text)));--> statement-breakpoint
CREATE POLICY "story_context_presets_delete" ON "story_context_presets" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_builtin = 0 AND organization_id = ANY(ARRAY(SELECT organization_id FROM organization_members WHERE user_id = auth.uid()::text)));
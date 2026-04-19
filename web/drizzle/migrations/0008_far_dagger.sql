CREATE TABLE "subscription_extras" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"plan_credits" integer DEFAULT 1500 NOT NULL,
	"auto_refill_enabled" integer DEFAULT 0 NOT NULL,
	"auto_refill_threshold" integer DEFAULT 100 NOT NULL,
	"auto_refill_credits" integer DEFAULT 1000 NOT NULL,
	"stripe_payment_method_id" text,
	"low_balance_notified_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "subscription_extras_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
ALTER TABLE "subscription_extras" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "subscription_extras_select" ON "subscription_extras" AS PERMISSIVE FOR SELECT TO "authenticated" USING (organization_id = ANY((SELECT ARRAY(SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))));--> statement-breakpoint
CREATE POLICY "subscription_extras_insert" ON "subscription_extras" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (organization_id = ANY((SELECT ARRAY(SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))));--> statement-breakpoint
CREATE POLICY "subscription_extras_update" ON "subscription_extras" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (organization_id = ANY((SELECT ARRAY(SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))));
CREATE TABLE "billing_events" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"event_type" text NOT NULL,
	"description" text,
	"metadata_json" jsonb,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "credit_balances" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"monthly_allowance" integer DEFAULT 0 NOT NULL,
	"last_refill_at" text,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "credit_balances" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "credit_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text,
	"amount" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"source" text NOT NULL,
	"reference_id" text,
	"description" text,
	"metadata_json" jsonb,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "credit_ledger" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" text PRIMARY KEY NOT NULL,
	"referrer_org_id" text NOT NULL,
	"referee_org_id" text,
	"referral_code" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"referrer_credits" integer DEFAULT 500 NOT NULL,
	"referee_credits" integer DEFAULT 500 NOT NULL,
	"created_at" text NOT NULL,
	"converted_at" text
);
--> statement-breakpoint
ALTER TABLE "referrals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"processed_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"stripe_subscription_id" text,
	"plan_tier" text NOT NULL,
	"plan_credits" integer NOT NULL,
	"status" text NOT NULL,
	"current_period_start" text,
	"current_period_end" text,
	"billing_interval" text,
	"auto_refill_enabled" integer DEFAULT 0 NOT NULL,
	"auto_refill_threshold" integer DEFAULT 100 NOT NULL,
	"auto_refill_credits" integer DEFAULT 1000 NOT NULL,
	"stripe_payment_method_id" text,
	"low_balance_notified_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "billing_events_select" ON "billing_events" AS PERMISSIVE FOR SELECT TO "authenticated" USING (organization_id = ANY((SELECT ARRAY(SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))));--> statement-breakpoint
CREATE POLICY "billing_events_insert" ON "billing_events" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (organization_id = ANY((SELECT ARRAY(SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))));--> statement-breakpoint
CREATE POLICY "credit_balances_select" ON "credit_balances" AS PERMISSIVE FOR SELECT TO "authenticated" USING (organization_id = ANY((SELECT ARRAY(SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))));--> statement-breakpoint
CREATE POLICY "credit_balances_update" ON "credit_balances" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (organization_id = ANY((SELECT ARRAY(SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))));--> statement-breakpoint
CREATE POLICY "credit_ledger_select" ON "credit_ledger" AS PERMISSIVE FOR SELECT TO "authenticated" USING (organization_id = ANY((SELECT ARRAY(SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))));--> statement-breakpoint
CREATE POLICY "credit_ledger_insert" ON "credit_ledger" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (organization_id = ANY((SELECT ARRAY(SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))));--> statement-breakpoint
CREATE POLICY "referrals_select" ON "referrals" AS PERMISSIVE FOR SELECT TO "authenticated" USING (referrer_org_id = ANY((SELECT ARRAY(SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))) OR referee_org_id = ANY((SELECT ARRAY(SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))));--> statement-breakpoint
CREATE POLICY "referrals_insert" ON "referrals" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (referrer_org_id = ANY((SELECT ARRAY(SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))));--> statement-breakpoint
CREATE POLICY "subscriptions_select" ON "subscriptions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (organization_id = ANY((SELECT ARRAY(SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))));--> statement-breakpoint
CREATE POLICY "subscriptions_insert" ON "subscriptions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (organization_id = ANY((SELECT ARRAY(SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))));--> statement-breakpoint
CREATE POLICY "subscriptions_update" ON "subscriptions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (organization_id = ANY((SELECT ARRAY(SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))));--> statement-breakpoint
CREATE POLICY "subscriptions_delete" ON "subscriptions" AS PERMISSIVE FOR DELETE TO "authenticated" USING (organization_id = ANY((SELECT ARRAY(SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))));
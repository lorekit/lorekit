CREATE TABLE "waitlist_signups" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"signup_type" text NOT NULL,
	"source" text DEFAULT 'pricing_page' NOT NULL,
	"created_at" text NOT NULL
);

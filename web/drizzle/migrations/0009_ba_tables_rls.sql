-- RLS policies for Better Auth auto-managed tables.
-- BA creates these tables but does not add RLS. These policies ensure
-- Supabase's row-level security protects auth data at the database layer.
--
-- BA tables use camelCase columns ("userId", "organizationId") while
-- our custom tables use snake_case. The policies handle both conventions.

-- ============================================================
-- user table — users can only read/update their own row
-- ============================================================
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_select_own" ON "user"
  AS PERMISSIVE FOR SELECT TO "authenticated"
  USING (id = auth.uid());

CREATE POLICY "user_update_own" ON "user"
  AS PERMISSIVE FOR UPDATE TO "authenticated"
  USING (id = auth.uid());

-- ============================================================
-- session table — users can only see/manage their own sessions
-- ============================================================
ALTER TABLE "session" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_select_own" ON "session"
  AS PERMISSIVE FOR SELECT TO "authenticated"
  USING ("userId" = auth.uid());

CREATE POLICY "session_insert_own" ON "session"
  AS PERMISSIVE FOR INSERT TO "authenticated"
  WITH CHECK ("userId" = auth.uid());

CREATE POLICY "session_update_own" ON "session"
  AS PERMISSIVE FOR UPDATE TO "authenticated"
  USING ("userId" = auth.uid());

CREATE POLICY "session_delete_own" ON "session"
  AS PERMISSIVE FOR DELETE TO "authenticated"
  USING ("userId" = auth.uid());

-- ============================================================
-- account table — users can only see their own linked accounts
-- ============================================================
ALTER TABLE "account" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "account_select_own" ON "account"
  AS PERMISSIVE FOR SELECT TO "authenticated"
  USING ("userId" = auth.uid());

CREATE POLICY "account_insert_own" ON "account"
  AS PERMISSIVE FOR INSERT TO "authenticated"
  WITH CHECK ("userId" = auth.uid());

CREATE POLICY "account_update_own" ON "account"
  AS PERMISSIVE FOR UPDATE TO "authenticated"
  USING ("userId" = auth.uid());

CREATE POLICY "account_delete_own" ON "account"
  AS PERMISSIVE FOR DELETE TO "authenticated"
  USING ("userId" = auth.uid());

-- ============================================================
-- verification table — internal use only, no direct user access
-- ============================================================
ALTER TABLE "verification" ENABLE ROW LEVEL SECURITY;
-- No user-facing policies — only service_role can read/write

-- ============================================================
-- organization table — members can read their orgs
-- ============================================================
ALTER TABLE "organization" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organization_select_member" ON "organization"
  AS PERMISSIVE FOR SELECT TO "authenticated"
  USING (id IN (SELECT "organizationId" FROM "member" WHERE "userId" = auth.uid()));

CREATE POLICY "organization_update_admin" ON "organization"
  AS PERMISSIVE FOR UPDATE TO "authenticated"
  USING (id IN (SELECT "organizationId" FROM "member" WHERE "userId" = auth.uid() AND role IN ('owner', 'admin')));

-- ============================================================
-- member table — members can see fellow org members
-- ============================================================
ALTER TABLE "member" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "member_select_org" ON "member"
  AS PERMISSIVE FOR SELECT TO "authenticated"
  USING ("organizationId" IN (SELECT "organizationId" FROM "member" m2 WHERE m2."userId" = auth.uid()));

CREATE POLICY "member_insert_admin" ON "member"
  AS PERMISSIVE FOR INSERT TO "authenticated"
  WITH CHECK ("organizationId" IN (SELECT "organizationId" FROM "member" m2 WHERE m2."userId" = auth.uid() AND m2.role IN ('owner', 'admin')));

CREATE POLICY "member_delete_admin" ON "member"
  AS PERMISSIVE FOR DELETE TO "authenticated"
  USING ("organizationId" IN (SELECT "organizationId" FROM "member" m2 WHERE m2."userId" = auth.uid() AND m2.role IN ('owner', 'admin')));

-- ============================================================
-- invitation table — org admins can manage invitations
-- ============================================================
ALTER TABLE "invitation" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invitation_select_org" ON "invitation"
  AS PERMISSIVE FOR SELECT TO "authenticated"
  USING ("organizationId" IN (SELECT "organizationId" FROM "member" WHERE "userId" = auth.uid()));

CREATE POLICY "invitation_insert_admin" ON "invitation"
  AS PERMISSIVE FOR INSERT TO "authenticated"
  WITH CHECK ("organizationId" IN (SELECT "organizationId" FROM "member" WHERE "userId" = auth.uid() AND role IN ('owner', 'admin')));

CREATE POLICY "invitation_update_admin" ON "invitation"
  AS PERMISSIVE FOR UPDATE TO "authenticated"
  USING ("organizationId" IN (SELECT "organizationId" FROM "member" WHERE "userId" = auth.uid() AND role IN ('owner', 'admin')));

CREATE POLICY "invitation_delete_admin" ON "invitation"
  AS PERMISSIVE FOR DELETE TO "authenticated"
  USING ("organizationId" IN (SELECT "organizationId" FROM "member" WHERE "userId" = auth.uid() AND role IN ('owner', 'admin')));

-- ============================================================
-- subscription table (BA Stripe plugin) — org members can read
-- ============================================================
ALTER TABLE "subscription" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscription_select_org" ON "subscription"
  AS PERMISSIVE FOR SELECT TO "authenticated"
  USING ("referenceId" IN (SELECT "organizationId" FROM "member" WHERE "userId" = auth.uid()));

-- ============================================================
-- stripe_events table — internal only, no user access
-- ============================================================
ALTER TABLE "stripe_events" ENABLE ROW LEVEL SECURITY;
-- No user-facing policies — only service_role can read/write

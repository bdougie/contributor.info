-- Fix: drop always-true RLS write policies on ingestion tables (advisor: rls_policy_always_true)
--
-- 21 policies across 12 tables grant authenticated/anon INSERT or UPDATE with
-- WITH CHECK (true) and/or USING (true). These bypass RLS for any client with
-- the publishable key.
--
-- Postgres grants service_role the BYPASSRLS attribute, so writes from
-- gh-datapipe, Inngest (supabaseAdmin), and edge functions (which all use
-- SUPABASE_SERVICE_ROLE_KEY) skip RLS entirely. Verified via pg_roles:
--   service_role.rolbypassrls = true
--
-- After dropping these policies, the existing public_read / consolidated_read
-- SELECT policies are untouched, so frontend reads via anon key continue to
-- work. Service-role writes continue to work via BYPASSRLS. authenticated and
-- anon lose write access — which is the goal.
--
-- Skipped from this migration (need separate review):
--   - commits, issues UPDATE, tracked_repositories UPDATE   — lazy-client writers
--   - discussions UPDATE, issues UPDATE                      — user-mediated "mark as responded"
--   - repository_categories                                  — admin-mediated
--   - repository_confidence_history                          — caller-supplied client
--   - performance_alerts, web_vitals_events, referral_traffic, short_urls — anon telemetry

BEGIN;

-- comments
DROP POLICY IF EXISTS service_and_auth_insert_comments ON public.comments;
DROP POLICY IF EXISTS service_and_auth_update_comments ON public.comments;

-- contributors
DROP POLICY IF EXISTS service_and_auth_insert_contributors ON public.contributors;
DROP POLICY IF EXISTS service_and_auth_update_contributors ON public.contributors;

-- repositories
DROP POLICY IF EXISTS service_and_auth_insert_repositories ON public.repositories;
DROP POLICY IF EXISTS service_and_auth_update_repositories ON public.repositories;

-- reviews
DROP POLICY IF EXISTS service_and_auth_insert_reviews ON public.reviews;
DROP POLICY IF EXISTS service_and_auth_update_reviews ON public.reviews;

-- monthly_rankings
DROP POLICY IF EXISTS service_and_auth_insert_monthly_rankings ON public.monthly_rankings;
DROP POLICY IF EXISTS service_and_auth_update_monthly_rankings ON public.monthly_rankings;

-- organizations
DROP POLICY IF EXISTS service_and_auth_insert_organizations ON public.organizations;
DROP POLICY IF EXISTS service_and_auth_update_organizations ON public.organizations;

-- daily_activity_snapshots
DROP POLICY IF EXISTS service_and_auth_insert_daily_activity_snapshots ON public.daily_activity_snapshots;
DROP POLICY IF EXISTS service_and_auth_update_daily_activity_snapshots ON public.daily_activity_snapshots;

-- repository_changelogs
DROP POLICY IF EXISTS "System can insert changelogs" ON public.repository_changelogs;

-- repository_metrics_history
DROP POLICY IF EXISTS "System can insert metrics history" ON public.repository_metrics_history;

-- integration_logs
DROP POLICY IF EXISTS "System can insert integration logs" ON public.integration_logs;

-- workspace_activity
DROP POLICY IF EXISTS "System can create activity logs" ON public.workspace_activity;

-- workspace_activity_log
DROP POLICY IF EXISTS workspace_activity_log_insert_policy ON public.workspace_activity_log;

COMMIT;

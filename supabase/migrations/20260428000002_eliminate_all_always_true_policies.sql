-- Fix: eliminate all 28 remaining always-true RLS policies (advisor: rls_policy_always_true)
--
-- Categories:
--   A. 14 service_role-only policies with qual=true — redundant since service_role
--      bypasses RLS via BYPASSRLS attribute. Drop all.
--
--   B. 7 public-role writes that should be service_role-only (commits, repository_
--      confidence_history, tracked_repositories INSERT, repository_categories ×3).
--      Drop all — service_role keeps working via BYPASSRLS. Frontend admin tools
--      that previously wrote via anon must now go through Netlify functions
--      (api-track-repository.mts already does this for tracked_repositories).
--
--   C. 4 user-mediated writes — replace with auth.uid()-based ownership checks
--      via the existing public.rls_current_app_user_id() helper.
--
--   D. 3 anon telemetry inserts (web_vitals_events, performance_alerts,
--      referral_traffic) — replace WITH CHECK (true) with column-value checks
--      that enforce expected enum/non-empty constraints. These tables are
--      intentionally writable by anon for client-side telemetry; the new checks
--      add minimal abuse resistance (validates metric_rating values, etc.) and
--      remove the always-true advisor flag.

BEGIN;

-- =====================================================
-- CATEGORY A: drop redundant service_role qual=true policies
-- (service_role bypasses RLS via BYPASSRLS attribute)
-- =====================================================

DROP POLICY IF EXISTS service_delete_contributors                ON public.contributors;
DROP POLICY IF EXISTS service_delete_daily_activity_snapshots    ON public.daily_activity_snapshots;
DROP POLICY IF EXISTS "Service role can insert discussion comments" ON public.discussion_comments;
DROP POLICY IF EXISTS "Service role can update discussion comments" ON public.discussion_comments;
DROP POLICY IF EXISTS "Service role can insert discussions"      ON public.discussions;
DROP POLICY IF EXISTS "Service role can update discussions"      ON public.discussions;
DROP POLICY IF EXISTS service_role_delete_issues                 ON public.issues;
DROP POLICY IF EXISTS service_role_insert_issues                 ON public.issues;
DROP POLICY IF EXISTS service_role_update_issues                 ON public.issues;
DROP POLICY IF EXISTS service_delete_monthly_rankings            ON public.monthly_rankings;
DROP POLICY IF EXISTS "Service role can insert notifications"    ON public.notifications;
DROP POLICY IF EXISTS service_delete_organizations               ON public.organizations;
DROP POLICY IF EXISTS service_delete_repositories                ON public.repositories;
DROP POLICY IF EXISTS service_delete_reviews                     ON public.reviews;

-- =====================================================
-- CATEGORY B: drop public-role write policies
-- (service_role keeps working via BYPASSRLS)
-- =====================================================

DROP POLICY IF EXISTS commits_insert_all  ON public.commits;
DROP POLICY IF EXISTS commits_update_all  ON public.commits;
DROP POLICY IF EXISTS "Allow inserts to confidence history" ON public.repository_confidence_history;
DROP POLICY IF EXISTS consolidated_insert_tracked_repositories ON public.tracked_repositories;
DROP POLICY IF EXISTS consolidated_delete_repository_categories ON public.repository_categories;
DROP POLICY IF EXISTS consolidated_insert_repository_categories ON public.repository_categories;
DROP POLICY IF EXISTS consolidated_update_repository_categories ON public.repository_categories;

-- =====================================================
-- CATEGORY C: replace user-mediated write policies with ownership checks
-- =====================================================

-- discussions: "mark as responded" must set responded_by to the caller, and
-- only target rows that are unresponded or already responded-by-self (prevents
-- attribution-stealing by overwriting another user's responded_by).
DROP POLICY IF EXISTS "Authenticated users can mark discussions as responded" ON public.discussions;
CREATE POLICY mark_discussion_as_responded_by_self
  ON public.discussions
  FOR UPDATE
  TO authenticated
  USING (responded_by IS NULL OR responded_by = public.rls_current_app_user_id())
  WITH CHECK (responded_by = public.rls_current_app_user_id());

-- issues: same pattern as discussions
DROP POLICY IF EXISTS "Authenticated users can mark issues as responded" ON public.issues;
CREATE POLICY mark_issue_as_responded_by_self
  ON public.issues
  FOR UPDATE
  TO authenticated
  USING (responded_by IS NULL OR responded_by = public.rls_current_app_user_id())
  WITH CHECK (responded_by = public.rls_current_app_user_id());

-- tracked_repositories: "users update their own" must check added_by_user_id
DROP POLICY IF EXISTS "Users can update their own tracked repositories" ON public.tracked_repositories;
CREATE POLICY update_own_tracked_repository
  ON public.tracked_repositories
  FOR UPDATE
  TO authenticated
  USING (added_by_user_id = public.rls_current_app_user_id())
  WITH CHECK (added_by_user_id = public.rls_current_app_user_id());

-- short_urls: must be created by an authenticated user
DROP POLICY IF EXISTS "Authenticated users can create short URLs" ON public.short_urls;
CREATE POLICY authenticated_users_create_short_urls
  ON public.short_urls
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- =====================================================
-- CATEGORY D: replace anon telemetry WITH CHECK (true) with value validation
-- (intentionally anon-writable; checks add abuse resistance + clear advisor flag)
-- =====================================================

-- web_vitals_events: enforce known metric_rating values + non-empty session
DROP POLICY IF EXISTS "Public insert for web_vitals_events" ON public.web_vitals_events;
CREATE POLICY anon_insert_web_vitals_events
  ON public.web_vitals_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    metric_rating IN ('good', 'needs-improvement', 'poor')
    AND length(session_id) > 0
  );

-- performance_alerts: enforce known severity values
DROP POLICY IF EXISTS "Public insert for performance_alerts" ON public.performance_alerts;
CREATE POLICY anon_insert_performance_alerts
  ON public.performance_alerts
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    severity IN ('critical', 'warning', 'info', 'low', 'medium', 'high')
  );

-- referral_traffic: enforce non-empty session_id and landing_page
DROP POLICY IF EXISTS "Public insert for referral_traffic" ON public.referral_traffic;
CREATE POLICY anon_insert_referral_traffic
  ON public.referral_traffic
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(session_id) > 0 AND length(landing_page) > 0
  );

COMMIT;

-- Phase 4 & 5: Secure Workspace/User Data and GitHub Cache/Analytics Tables
-- Date: 2025-01-27
-- IMPORTANT: github_events_cache_* partitions need service role access for gh-datapipe

-- ============================================
-- PHASE 4: WORKSPACE & USER DATA
-- ============================================

-- contributor_roles - Remove public read, service role only
DROP POLICY IF EXISTS "contributor_roles_select" ON public.contributor_roles;
DROP POLICY IF EXISTS "contributor_roles_update" ON public.contributor_roles;
DROP POLICY IF EXISTS "contributor_roles_service" ON public.contributor_roles;

-- Service role for system operations
CREATE POLICY "service_role_all" ON public.contributor_roles
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Public read for contributor roles (needed for contributor pages)
CREATE POLICY "public_read_only" ON public.contributor_roles
  FOR SELECT
  USING (true);

-- contributor_role_history - Remove public read, service role only
DROP POLICY IF EXISTS "contributor_role_history_select" ON public.contributor_role_history;
DROP POLICY IF EXISTS "contributor_role_history_service" ON public.contributor_role_history;

CREATE POLICY "service_role_all" ON public.contributor_role_history
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Public read for role history (needed for transparency)
CREATE POLICY "public_read_only" ON public.contributor_role_history
  FOR SELECT
  USING (true);

-- reviews - Already has service role for write, just remove public read
DROP POLICY IF EXISTS "reviews_select" ON public.reviews;
DROP POLICY IF EXISTS "reviews_insert" ON public.reviews;
DROP POLICY IF EXISTS "reviews_update" ON public.reviews;
DROP POLICY IF EXISTS "reviews_delete" ON public.reviews;

CREATE POLICY "service_role_all" ON public.reviews
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Public read maintained for reviews (needed for contributor pages)
CREATE POLICY "public_read_only" ON public.reviews
  FOR SELECT
  USING (true);

-- organizations - Remove unrestricted update/delete
DROP POLICY IF EXISTS "organizations_select" ON public.organizations;
DROP POLICY IF EXISTS "organizations_insert" ON public.organizations;
DROP POLICY IF EXISTS "organizations_update" ON public.organizations;
DROP POLICY IF EXISTS "organizations_delete" ON public.organizations;

CREATE POLICY "service_role_all" ON public.organizations
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Public read maintained for organizations (needed for UI)
CREATE POLICY "public_read_only" ON public.organizations
  FOR SELECT
  USING (true);

-- workspace_members - Already properly scoped to auth users
-- Keep existing policies as they require authentication

-- workspace_tracked_repositories - Remove public ALL, keep public read
DROP POLICY IF EXISTS "workspace_tracked_repositories_select" ON public.workspace_tracked_repositories;
DROP POLICY IF EXISTS "workspace_tracked_repositories_all" ON public.workspace_tracked_repositories;

CREATE POLICY "service_role_all" ON public.workspace_tracked_repositories
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Public read for tracked repositories (needed for UI)
CREATE POLICY "public_read_only" ON public.workspace_tracked_repositories
  FOR SELECT
  USING (true);

-- Workspace members can manage their own workspace repos
CREATE POLICY "workspace_members_manage" ON public.workspace_tracked_repositories
  FOR ALL
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_tracked_repositories.workspace_id
        AND wm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_tracked_repositories.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

-- ============================================
-- PHASE 5: GITHUB CACHE & ANALYTICS
-- ============================================

-- github_events_cache (main table) - Service role write, public read
DROP POLICY IF EXISTS "github_events_cache_all" ON public.github_events_cache;
DROP POLICY IF EXISTS "github_events_cache_select" ON public.github_events_cache;

CREATE POLICY "service_role_all" ON public.github_events_cache
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "public_read_only" ON public.github_events_cache
  FOR SELECT
  USING (true);

-- github_events_cache_2025_01 partition - Service role write, public read
DROP POLICY IF EXISTS "github_events_cache_2025_01_select" ON public.github_events_cache_2025_01;
DROP POLICY IF EXISTS "github_events_cache_2025_01_all" ON public.github_events_cache_2025_01;
DROP POLICY IF EXISTS "public_read" ON public.github_events_cache_2025_01;

CREATE POLICY "service_role_all" ON public.github_events_cache_2025_01
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "public_read_only" ON public.github_events_cache_2025_01
  FOR SELECT
  USING (true);

-- github_events_cache_2025_02 partition - Service role write, public read
DROP POLICY IF EXISTS "github_events_cache_2025_02_select" ON public.github_events_cache_2025_02;
DROP POLICY IF EXISTS "github_events_cache_2025_02_all" ON public.github_events_cache_2025_02;
DROP POLICY IF EXISTS "public_read" ON public.github_events_cache_2025_02;

CREATE POLICY "service_role_all" ON public.github_events_cache_2025_02
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "public_read_only" ON public.github_events_cache_2025_02
  FOR SELECT
  USING (true);

-- github_events_cache_2025_03 partition - Service role write, public read
DROP POLICY IF EXISTS "github_events_cache_2025_03_select" ON public.github_events_cache_2025_03;
DROP POLICY IF EXISTS "github_events_cache_2025_03_all" ON public.github_events_cache_2025_03;
DROP POLICY IF EXISTS "public_read" ON public.github_events_cache_2025_03;

CREATE POLICY "service_role_all" ON public.github_events_cache_2025_03
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "public_read_only" ON public.github_events_cache_2025_03
  FOR SELECT
  USING (true);

-- github_events_cache_2025_06 partition - Service role write, public read
DROP POLICY IF EXISTS "github_events_cache_2025_06_select" ON public.github_events_cache_2025_06;
DROP POLICY IF EXISTS "github_events_cache_2025_06_all" ON public.github_events_cache_2025_06;
DROP POLICY IF EXISTS "public_read" ON public.github_events_cache_2025_06;

CREATE POLICY "service_role_all" ON public.github_events_cache_2025_06
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "public_read_only" ON public.github_events_cache_2025_06
  FOR SELECT
  USING (true);

-- github_activities - Service role write, public read
DROP POLICY IF EXISTS "github_activities_select" ON public.github_activities;
DROP POLICY IF EXISTS "github_activities_auth_select" ON public.github_activities;
DROP POLICY IF EXISTS "github_activities_service" ON public.github_activities;

CREATE POLICY "service_role_all" ON public.github_activities
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "public_read_only" ON public.github_activities
  FOR SELECT
  USING (true);

-- github_sync_status - Service role write, public read
DROP POLICY IF EXISTS "github_sync_status_select" ON public.github_sync_status;
DROP POLICY IF EXISTS "github_sync_status_all" ON public.github_sync_status;

CREATE POLICY "service_role_all" ON public.github_sync_status
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "public_read_only" ON public.github_sync_status
  FOR SELECT
  USING (true);

-- repository_categories - Remove public write/delete
DROP POLICY IF EXISTS "repository_categories_select" ON public.repository_categories;
DROP POLICY IF EXISTS "repository_categories_insert" ON public.repository_categories;
DROP POLICY IF EXISTS "repository_categories_auth_insert" ON public.repository_categories;
DROP POLICY IF EXISTS "repository_categories_update" ON public.repository_categories;
DROP POLICY IF EXISTS "repository_categories_auth_update" ON public.repository_categories;
DROP POLICY IF EXISTS "repository_categories_delete" ON public.repository_categories;
DROP POLICY IF EXISTS "repository_categories_auth_delete" ON public.repository_categories;

CREATE POLICY "service_role_all" ON public.repository_categories
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "public_read_only" ON public.repository_categories
  FOR SELECT
  USING (true);

-- share_click_analytics - Service role write, public read
DROP POLICY IF EXISTS "share_click_analytics_select" ON public.share_click_analytics;
DROP POLICY IF EXISTS "share_click_analytics_service" ON public.share_click_analytics;

CREATE POLICY "service_role_all" ON public.share_click_analytics
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "public_read_only" ON public.share_click_analytics
  FOR SELECT
  USING (true);

-- share_events - Service role write, public read, auth can insert
DROP POLICY IF EXISTS "share_events_select" ON public.share_events;
DROP POLICY IF EXISTS "share_events_insert" ON public.share_events;
DROP POLICY IF EXISTS "share_events_service" ON public.share_events;

CREATE POLICY "service_role_all" ON public.share_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "public_read_only" ON public.share_events
  FOR SELECT
  USING (true);

-- Allow authenticated users to insert share events
CREATE POLICY "authenticated_insert" ON public.share_events
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- daily_activity_snapshots - Service role write, public read
DROP POLICY IF EXISTS "daily_activity_snapshots_select" ON public.daily_activity_snapshots;
DROP POLICY IF EXISTS "daily_activity_snapshots_insert" ON public.daily_activity_snapshots;
DROP POLICY IF EXISTS "daily_activity_snapshots_update" ON public.daily_activity_snapshots;
DROP POLICY IF EXISTS "daily_activity_snapshots_delete" ON public.daily_activity_snapshots;

CREATE POLICY "service_role_all" ON public.daily_activity_snapshots
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "public_read_only" ON public.daily_activity_snapshots
  FOR SELECT
  USING (true);

-- monthly_rankings - Service role write, public read
DROP POLICY IF EXISTS "monthly_rankings_select" ON public.monthly_rankings;
DROP POLICY IF EXISTS "monthly_rankings_insert" ON public.monthly_rankings;
DROP POLICY IF EXISTS "monthly_rankings_update" ON public.monthly_rankings;
DROP POLICY IF EXISTS "monthly_rankings_delete" ON public.monthly_rankings;

CREATE POLICY "service_role_all" ON public.monthly_rankings
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "public_read_only" ON public.monthly_rankings
  FOR SELECT
  USING (true);

-- ============================================
-- VERIFICATION QUERY
-- ============================================
-- Run this after migration to verify tables are properly secured:
/*
SELECT
  tablename,
  COUNT(CASE WHEN roles::text LIKE '%public%' AND cmd = 'SELECT' THEN 1 END) as public_read,
  COUNT(CASE WHEN roles::text LIKE '%public%' AND cmd != 'SELECT' THEN 1 END) as public_write,
  COUNT(CASE WHEN roles::text LIKE '%service_role%' THEN 1 END) as service_policies,
  COUNT(CASE WHEN roles::text LIKE '%authenticated%' THEN 1 END) as auth_policies
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    -- Phase 4
    'contributor_roles', 'contributor_role_history',
    'reviews', 'organizations',
    'workspace_members', 'workspace_tracked_repositories',
    -- Phase 5
    'github_events_cache', 'github_events_cache_2025_01',
    'github_events_cache_2025_02', 'github_events_cache_2025_03',
    'github_events_cache_2025_06', 'github_activities',
    'github_sync_status', 'repository_categories',
    'share_click_analytics', 'share_events',
    'daily_activity_snapshots', 'monthly_rankings'
  )
GROUP BY tablename
ORDER BY tablename;

-- Expected: public_read=1 for most, public_write=0 for all, service_policies>=1
*/
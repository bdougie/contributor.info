-- Fix Phase 2: Consolidate Multiple Permissive Policies
-- This migration consolidates multiple permissive RLS policies into single policies
-- to reduce evaluation overhead and improve query performance
-- Issue: https://github.com/bdougie/contributor.info/issues/816

-- =====================================================
-- app_users table: Consolidate 3 SELECT policies
-- =====================================================
-- Drop redundant SELECT policies
DROP POLICY IF EXISTS "app_users_read_policy" ON public.app_users;
DROP POLICY IF EXISTS "authenticated_read_app_users" ON public.app_users;
DROP POLICY IF EXISTS "public_read_app_users_basic" ON public.app_users;

-- Create consolidated SELECT policy
CREATE POLICY "consolidated_read_app_users" ON public.app_users
FOR SELECT
USING (
  true  -- Public read access (from app_users_read_policy)
  OR (select auth.uid()) IS NOT NULL  -- Authenticated read (from authenticated_read_app_users)
  OR is_active = true  -- Active users read (from public_read_app_users_basic)
);

-- =====================================================
-- auth_errors table: Consolidate 3 SELECT policies
-- =====================================================
DROP POLICY IF EXISTS "Admins can view all auth errors" ON public.auth_errors;
DROP POLICY IF EXISTS "Users can view their own auth errors" ON public.auth_errors;
DROP POLICY IF EXISTS "auth_read_auth_errors" ON public.auth_errors;

-- Create consolidated SELECT policy
CREATE POLICY "consolidated_read_auth_errors" ON public.auth_errors
FOR SELECT
USING (
  (select auth.uid()) IS NOT NULL  -- Any authenticated user
  OR auth_user_id = (select auth.uid())  -- Own errors
  OR EXISTS (
    SELECT 1 FROM app_users au
    WHERE au.auth_user_id = (select auth.uid()) AND au.is_admin = true
  )  -- Admin access
);

-- =====================================================
-- billing_history table: Consolidate 2 ALL policies
-- =====================================================
DROP POLICY IF EXISTS "Service role can manage billing history" ON public.billing_history;
DROP POLICY IF EXISTS "billing_history_admin_only" ON public.billing_history;

-- Create consolidated ALL policy
CREATE POLICY "consolidated_manage_billing_history" ON public.billing_history
FOR ALL
USING (
  (select auth.role()) = 'service_role'
  OR EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = (select auth.uid()) AND user_roles.role = 'admin'
  )
);

-- =====================================================
-- contributor_role_history table: Consolidate duplicate SELECT policies
-- =====================================================
DROP POLICY IF EXISTS "public_read_contributor_role_history" ON public.contributor_role_history;
DROP POLICY IF EXISTS "public_read_only" ON public.contributor_role_history;

-- Create single SELECT policy (both had condition = true)
CREATE POLICY "consolidated_read_contributor_role_history" ON public.contributor_role_history
FOR SELECT
USING (true);

-- Consolidate ALL policies
DROP POLICY IF EXISTS "auth_write_contributor_role_history" ON public.contributor_role_history;
DROP POLICY IF EXISTS "service_role_all" ON public.contributor_role_history;

CREATE POLICY "consolidated_manage_contributor_role_history" ON public.contributor_role_history
FOR ALL
USING (
  (select auth.role()) = 'service_role'
  OR (select auth.role()) = 'authenticated'
);

-- =====================================================
-- contributor_roles table: Consolidate duplicate SELECT policies
-- =====================================================
DROP POLICY IF EXISTS "public_read_contributor_roles" ON public.contributor_roles;
DROP POLICY IF EXISTS "public_read_only" ON public.contributor_roles;

-- Create single SELECT policy (both had condition = true)
CREATE POLICY "consolidated_read_contributor_roles" ON public.contributor_roles
FOR SELECT
USING (true);

-- Consolidate ALL policies
DROP POLICY IF EXISTS "auth_write_contributor_roles" ON public.contributor_roles;
DROP POLICY IF EXISTS "service_role_all" ON public.contributor_roles;

CREATE POLICY "consolidated_manage_contributor_roles" ON public.contributor_roles
FOR ALL
USING (
  (select auth.role()) = 'service_role'
  OR (select auth.role()) = 'authenticated'
);

-- =====================================================
-- daily_activity_snapshots table: Consolidate duplicate SELECT policies
-- =====================================================
DROP POLICY IF EXISTS "public_read_daily_activity_snapshots" ON public.daily_activity_snapshots;
DROP POLICY IF EXISTS "public_read_only" ON public.daily_activity_snapshots;

-- Create single SELECT policy (both had condition = true)
CREATE POLICY "consolidated_read_daily_activity_snapshots" ON public.daily_activity_snapshots
FOR SELECT
USING (true);

-- =====================================================
-- github_activities table: Consolidate 3 SELECT policies
-- =====================================================
DROP POLICY IF EXISTS "Allow read access for all authenticated users" ON public.github_activities;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.github_activities;
DROP POLICY IF EXISTS "public_read_only" ON public.github_activities;

-- Create single SELECT policy (all had condition = true)
CREATE POLICY "consolidated_read_github_activities" ON public.github_activities
FOR SELECT
USING (true);

-- Consolidate ALL policies
DROP POLICY IF EXISTS "Enable insert/update for service role" ON public.github_activities;
DROP POLICY IF EXISTS "service_role_all" ON public.github_activities;

CREATE POLICY "consolidated_manage_github_activities" ON public.github_activities
FOR ALL
USING ((select auth.role()) = 'service_role');

-- =====================================================
-- github_app_installation_settings table: Consolidate duplicate ALL policies
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can manage installation settings" ON public.github_app_installation_settings;
DROP POLICY IF EXISTS "Authenticated users can manage their settings" ON public.github_app_installation_settings;

-- Create single ALL policy (both had same condition)
CREATE POLICY "consolidated_manage_installation_settings" ON public.github_app_installation_settings
FOR ALL
USING ((select auth.role()) = 'authenticated');

-- =====================================================
-- github_events_cache table: Consolidate policies
-- =====================================================
-- Consolidate SELECT policies
DROP POLICY IF EXISTS "public_read_github_events_cache" ON public.github_events_cache;
DROP POLICY IF EXISTS "public_read_only" ON public.github_events_cache;

CREATE POLICY "consolidated_read_github_events_cache" ON public.github_events_cache
FOR SELECT
USING (true);

-- Consolidate ALL policies
DROP POLICY IF EXISTS "service_role_all" ON public.github_events_cache;
DROP POLICY IF EXISTS "service_write_github_events_cache" ON public.github_events_cache;

CREATE POLICY "consolidated_manage_github_events_cache" ON public.github_events_cache
FOR ALL
USING ((select auth.role()) = 'service_role');

-- =====================================================
-- github_events_cache partitioned tables (2025_01, 2025_02, 2025_03, 2025_06)
-- =====================================================

-- 2025_01
DROP POLICY IF EXISTS "github_events_cache_2025_01_read_policy" ON public.github_events_cache_2025_01;
DROP POLICY IF EXISTS "public_read_github_events_2025_01" ON public.github_events_cache_2025_01;
DROP POLICY IF EXISTS "public_read_only" ON public.github_events_cache_2025_01;

CREATE POLICY "consolidated_read_github_events_2025_01" ON public.github_events_cache_2025_01
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "auth_write_github_events_2025_01" ON public.github_events_cache_2025_01;
DROP POLICY IF EXISTS "service_role_all" ON public.github_events_cache_2025_01;

CREATE POLICY "consolidated_manage_github_events_2025_01" ON public.github_events_cache_2025_01
FOR ALL
USING (
  (select auth.role()) = 'service_role'
  OR (select auth.role()) = 'authenticated'
);

-- 2025_02
DROP POLICY IF EXISTS "github_events_cache_2025_02_read_policy" ON public.github_events_cache_2025_02;
DROP POLICY IF EXISTS "public_read_github_events_2025_02" ON public.github_events_cache_2025_02;
DROP POLICY IF EXISTS "public_read_only" ON public.github_events_cache_2025_02;

CREATE POLICY "consolidated_read_github_events_2025_02" ON public.github_events_cache_2025_02
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "auth_write_github_events_2025_02" ON public.github_events_cache_2025_02;
DROP POLICY IF EXISTS "service_role_all" ON public.github_events_cache_2025_02;

CREATE POLICY "consolidated_manage_github_events_2025_02" ON public.github_events_cache_2025_02
FOR ALL
USING (
  (select auth.role()) = 'service_role'
  OR (select auth.role()) = 'authenticated'
);

-- 2025_03
DROP POLICY IF EXISTS "github_events_cache_2025_03_read_policy" ON public.github_events_cache_2025_03;
DROP POLICY IF EXISTS "public_read_github_events_2025_03" ON public.github_events_cache_2025_03;
DROP POLICY IF EXISTS "public_read_only" ON public.github_events_cache_2025_03;

CREATE POLICY "consolidated_read_github_events_2025_03" ON public.github_events_cache_2025_03
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "auth_write_github_events_2025_03" ON public.github_events_cache_2025_03;
DROP POLICY IF EXISTS "service_role_all" ON public.github_events_cache_2025_03;

CREATE POLICY "consolidated_manage_github_events_2025_03" ON public.github_events_cache_2025_03
FOR ALL
USING (
  (select auth.role()) = 'service_role'
  OR (select auth.role()) = 'authenticated'
);

-- 2025_06
DROP POLICY IF EXISTS "github_events_cache_2025_06_read_policy" ON public.github_events_cache_2025_06;
DROP POLICY IF EXISTS "public_read_github_events_2025_06" ON public.github_events_cache_2025_06;
DROP POLICY IF EXISTS "public_read_only" ON public.github_events_cache_2025_06;

CREATE POLICY "consolidated_read_github_events_2025_06" ON public.github_events_cache_2025_06
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "auth_write_github_events_2025_06" ON public.github_events_cache_2025_06;
DROP POLICY IF EXISTS "service_role_all" ON public.github_events_cache_2025_06;

CREATE POLICY "consolidated_manage_github_events_2025_06" ON public.github_events_cache_2025_06
FOR ALL
USING (
  (select auth.role()) = 'service_role'
  OR (select auth.role()) = 'authenticated'
);

-- =====================================================
-- github_sync_status table: Consolidate policies
-- =====================================================
DROP POLICY IF EXISTS "public_read_github_sync_status" ON public.github_sync_status;
DROP POLICY IF EXISTS "public_read_only" ON public.github_sync_status;

CREATE POLICY "consolidated_read_github_sync_status" ON public.github_sync_status
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "auth_write_github_sync_status" ON public.github_sync_status;
DROP POLICY IF EXISTS "service_role_all" ON public.github_sync_status;

CREATE POLICY "consolidated_manage_github_sync_status" ON public.github_sync_status
FOR ALL
USING (
  (select auth.role()) = 'service_role'
  OR (select auth.role()) = 'authenticated'
);

-- =====================================================
-- monthly_rankings table: Consolidate duplicate SELECT policies
-- =====================================================
DROP POLICY IF EXISTS "public_read_monthly_rankings" ON public.monthly_rankings;
DROP POLICY IF EXISTS "public_read_only" ON public.monthly_rankings;

CREATE POLICY "consolidated_read_monthly_rankings" ON public.monthly_rankings
FOR SELECT
USING (true);

-- =====================================================
-- organizations table: Consolidate duplicate SELECT policies
-- =====================================================
DROP POLICY IF EXISTS "public_read_only" ON public.organizations;
DROP POLICY IF EXISTS "public_read_organizations" ON public.organizations;

CREATE POLICY "consolidated_read_organizations" ON public.organizations
FOR SELECT
USING (true);

-- =====================================================
-- pr_insights table: Consolidate duplicate SELECT policies
-- =====================================================
DROP POLICY IF EXISTS "Public read access" ON public.pr_insights;
DROP POLICY IF EXISTS "Public read access for PR insights" ON public.pr_insights;

CREATE POLICY "consolidated_read_pr_insights" ON public.pr_insights
FOR SELECT
USING (true);

-- =====================================================
-- repository_metrics_history table: Consolidate SELECT policies
-- =====================================================
DROP POLICY IF EXISTS "Public can read metrics history" ON public.repository_metrics_history;
DROP POLICY IF EXISTS "Public can read trending data" ON public.repository_metrics_history;

CREATE POLICY "consolidated_read_repository_metrics" ON public.repository_metrics_history
FOR SELECT
USING (true);

-- =====================================================
-- reviews table: Consolidate duplicate SELECT policies
-- =====================================================
DROP POLICY IF EXISTS "public_read_only" ON public.reviews;
DROP POLICY IF EXISTS "public_read_reviews" ON public.reviews;

CREATE POLICY "consolidated_read_reviews" ON public.reviews
FOR SELECT
USING (true);

-- =====================================================
-- share_click_analytics table: Consolidate policies
-- =====================================================
DROP POLICY IF EXISTS "Allow public read access to click analytics" ON public.share_click_analytics;
DROP POLICY IF EXISTS "public_read_only" ON public.share_click_analytics;

CREATE POLICY "consolidated_read_share_click_analytics" ON public.share_click_analytics
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Allow service role full access to click analytics" ON public.share_click_analytics;
DROP POLICY IF EXISTS "service_role_all" ON public.share_click_analytics;

CREATE POLICY "consolidated_manage_share_click_analytics" ON public.share_click_analytics
FOR ALL
USING ((select auth.role()) = 'service_role');

-- =====================================================
-- share_events table: Consolidate policies
-- =====================================================
DROP POLICY IF EXISTS "Allow public read access to share analytics" ON public.share_events;
DROP POLICY IF EXISTS "public_read_only" ON public.share_events;

CREATE POLICY "consolidated_read_share_events" ON public.share_events
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Allow service role full access to share events" ON public.share_events;
DROP POLICY IF EXISTS "service_role_all" ON public.share_events;

CREATE POLICY "consolidated_manage_share_events" ON public.share_events
FOR ALL
USING ((select auth.role()) = 'service_role');

DROP POLICY IF EXISTS "Allow authenticated users to insert share events" ON public.share_events;
DROP POLICY IF EXISTS "authenticated_insert" ON public.share_events;

CREATE POLICY "consolidated_insert_share_events" ON public.share_events
FOR INSERT
USING ((select auth.role()) = 'authenticated');

-- =====================================================
-- subscriptions table: Consolidate ALL policies
-- =====================================================
DROP POLICY IF EXISTS "Service role can manage subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_admin_only" ON public.subscriptions;

CREATE POLICY "consolidated_manage_subscriptions" ON public.subscriptions
FOR ALL
USING (
  (select auth.role()) = 'service_role'
  OR EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = (select auth.uid()) AND user_roles.role = 'admin'
  )
);

-- =====================================================
-- tier_limits table: Consolidate SELECT policies
-- =====================================================
DROP POLICY IF EXISTS "Anyone can view tier limits" ON public.tier_limits;
DROP POLICY IF EXISTS "tier_limits_read_policy" ON public.tier_limits;

CREATE POLICY "consolidated_read_tier_limits" ON public.tier_limits
FOR SELECT
USING (true);

-- =====================================================
-- tracked_repositories table: Consolidate INSERT policies
-- =====================================================
DROP POLICY IF EXISTS "Allow authenticated users to track repositories" ON public.tracked_repositories;
DROP POLICY IF EXISTS "anon_insert_tracked_repositories" ON public.tracked_repositories;
DROP POLICY IF EXISTS "auth_insert_tracked_repositories" ON public.tracked_repositories;
DROP POLICY IF EXISTS "tracked_repositories_insert_authenticated" ON public.tracked_repositories;

CREATE POLICY "consolidated_insert_tracked_repositories" ON public.tracked_repositories
FOR INSERT
USING (
  (select auth.role()) = 'authenticated'
  OR (select auth.role()) = 'anon'
  OR true  -- Allow all inserts
);

DROP POLICY IF EXISTS "Allow anonymous read access to tracked repositories" ON public.tracked_repositories;
DROP POLICY IF EXISTS "tracked_repositories_read_all" ON public.tracked_repositories;

CREATE POLICY "consolidated_read_tracked_repositories" ON public.tracked_repositories
FOR SELECT
USING (true);

-- =====================================================
-- user_email_preferences table: Consolidate ALL policies
-- =====================================================
DROP POLICY IF EXISTS "Service role can manage email preferences" ON public.user_email_preferences;
DROP POLICY IF EXISTS "Users can manage their own email preferences" ON public.user_email_preferences;

CREATE POLICY "consolidated_manage_email_preferences" ON public.user_email_preferences
FOR ALL
USING (
  (select auth.jwt() ->> 'role') = 'service_role'
  OR (select auth.uid()) = user_id
);

-- =====================================================
-- user_roles table: Consolidate policies
-- =====================================================
DROP POLICY IF EXISTS "Allow admin user full access to user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "admin_manage_user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_write_policy" ON public.user_roles;

CREATE POLICY "consolidated_manage_user_roles" ON public.user_roles
FOR ALL
USING (
  (select auth.uid()) IN (
    SELECT app_users.auth_user_id
    FROM app_users
    WHERE app_users.github_user_id = 5713670 AND app_users.is_admin = true
  )
  OR EXISTS (
    SELECT 1 FROM app_users au
    WHERE au.auth_user_id = (select auth.uid()) AND au.is_admin = true AND au.is_active = true
  )
  OR (select auth.role()) = 'authenticated'  -- From user_roles_write_policy
);

DROP POLICY IF EXISTS "user_roles_read_policy" ON public.user_roles;
DROP POLICY IF EXISTS "users_read_own_roles" ON public.user_roles;

CREATE POLICY "consolidated_read_user_roles" ON public.user_roles
FOR SELECT
USING (
  true  -- From user_roles_read_policy
  OR user_id IN (
    SELECT app_users.id FROM app_users
    WHERE app_users.auth_user_id = (select auth.uid())
  )
);

-- =====================================================
-- workspace_metrics_cache table: Consolidate 4 SELECT policies
-- =====================================================
DROP POLICY IF EXISTS "Members can view workspace metrics" ON public.workspace_metrics_cache;
DROP POLICY IF EXISTS "Private workspace metrics viewable by members" ON public.workspace_metrics_cache;
DROP POLICY IF EXISTS "Public workspace metrics are viewable" ON public.workspace_metrics_cache;
DROP POLICY IF EXISTS "Public workspace metrics are viewable by all" ON public.workspace_metrics_cache;

CREATE POLICY "consolidated_read_workspace_metrics" ON public.workspace_metrics_cache
FOR SELECT
USING (
  -- Members can view
  EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_members.workspace_id = workspace_metrics_cache.workspace_id
      AND workspace_members.user_id = (select auth.uid())
      AND workspace_members.accepted_at IS NOT NULL
  )
  -- Owners can view
  OR EXISTS (
    SELECT 1 FROM workspaces
    WHERE workspaces.id = workspace_metrics_cache.workspace_id
      AND workspaces.owner_id = (select auth.uid())
  )
  -- Public workspaces viewable by all
  OR EXISTS (
    SELECT 1 FROM workspaces
    WHERE workspaces.id = workspace_metrics_cache.workspace_id
      AND workspaces.visibility = 'public'
  )
);

-- =====================================================
-- workspace_tracked_repositories table: Consolidate policies
-- =====================================================
DROP POLICY IF EXISTS "service_role_all" ON public.workspace_tracked_repositories;
DROP POLICY IF EXISTS "workspace_members_manage" ON public.workspace_tracked_repositories;
DROP POLICY IF EXISTS "workspace_tracked_repositories_write_policy" ON public.workspace_tracked_repositories;

CREATE POLICY "consolidated_manage_workspace_tracked" ON public.workspace_tracked_repositories
FOR ALL
USING (
  (select auth.role()) = 'service_role'
  OR ((select auth.role()) = 'authenticated' AND EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = workspace_tracked_repositories.workspace_id
      AND wm.user_id = (select auth.uid())
  ))
  OR (select auth.uid()) IS NOT NULL  -- From write_policy
);

DROP POLICY IF EXISTS "public_read_only" ON public.workspace_tracked_repositories;
DROP POLICY IF EXISTS "workspace_tracked_repositories_read_policy" ON public.workspace_tracked_repositories;

CREATE POLICY "consolidated_read_workspace_tracked" ON public.workspace_tracked_repositories
FOR SELECT
USING (true);

-- =====================================================
-- workspaces table: Consolidate policies
-- =====================================================
DROP POLICY IF EXISTS "Anyone can view public active workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Authenticated users can view their workspaces" ON public.workspaces;

CREATE POLICY "consolidated_read_workspaces" ON public.workspaces
FOR SELECT
USING (
  -- Public active workspaces
  (visibility = 'public' AND is_active = true)
  -- Own workspaces
  OR owner_id = (select auth.uid())
  -- Member workspaces (authenticated users)
  OR (visibility = 'public' OR owner_id = (select auth.uid()))
);

DROP POLICY IF EXISTS "Admins can update workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Owners can update their workspaces" ON public.workspaces;

CREATE POLICY "consolidated_update_workspaces" ON public.workspaces
FOR UPDATE
USING (
  owner_id = (select auth.uid())
  OR EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_members.workspace_id = workspaces.id
      AND workspace_members.user_id = (select auth.uid())
      AND workspace_members.role IN ('admin', 'owner')
      AND workspace_members.accepted_at IS NOT NULL
  )
);
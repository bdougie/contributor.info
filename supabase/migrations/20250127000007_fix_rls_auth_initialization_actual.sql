-- Fix Phase 1: Auth RLS Initialization Performance Issues
-- This migration updates RLS policies to use subqueries for auth functions
-- preventing row-by-row evaluation for better performance
-- Issue: https://github.com/bdougie/contributor.info/issues/816

-- _dlt_version table
ALTER POLICY "service_role_only_all" ON public._dlt_version
USING ((select auth.role()) = 'service_role');

-- app_enabled_repositories table
ALTER POLICY "Authenticated users can read app repos" ON public.app_enabled_repositories
USING ((select auth.role()) = 'authenticated');

-- app_metrics table
ALTER POLICY "Service role only" ON public.app_metrics
USING ((select auth.role()) = 'service_role');

-- app_users table
ALTER POLICY "Allow users to manage their own data" ON public.app_users
USING (auth_user_id = (select auth.uid()));

ALTER POLICY "app_users_update_policy" ON public.app_users
USING ((select auth.uid()) = auth_user_id);

ALTER POLICY "authenticated_read_app_users" ON public.app_users
USING ((select auth.uid()) IS NOT NULL);

-- auth_errors table
ALTER POLICY "Admins can update auth errors" ON public.auth_errors
USING (EXISTS (
    SELECT 1
    FROM app_users au
    WHERE au.auth_user_id = (select auth.uid()) AND au.is_admin = true
));

ALTER POLICY "Admins can view all auth errors" ON public.auth_errors
USING (EXISTS (
    SELECT 1
    FROM app_users au
    WHERE au.auth_user_id = (select auth.uid()) AND au.is_admin = true
));

ALTER POLICY "Users can view their own auth errors" ON public.auth_errors
USING (auth_user_id = (select auth.uid()));

ALTER POLICY "auth_read_auth_errors" ON public.auth_errors
USING ((select auth.uid()) IS NOT NULL);

-- backfill_chunks table
ALTER POLICY "auth_read_backfill_chunks" ON public.backfill_chunks
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "service_role_all_backfill_chunks" ON public.backfill_chunks
USING ((select auth.role()) = 'service_role');

-- background_jobs table
ALTER POLICY "Authenticated users can view jobs" ON public.background_jobs
USING ((select auth.role()) = 'authenticated');

ALTER POLICY "Service role can manage all jobs" ON public.background_jobs
USING ((select auth.jwt()) ->> 'role' = 'service_role');

-- batch_progress table
ALTER POLICY "Service role can manage batch progress" ON public.batch_progress
USING ((select auth.role()) = 'service_role');

-- billing_history table
ALTER POLICY "Service role can manage billing history" ON public.billing_history
USING ((select auth.role()) = 'service_role');

ALTER POLICY "Users can view own billing history" ON public.billing_history
USING (user_id = (select auth.uid()));

ALTER POLICY "billing_history_admin_only" ON public.billing_history
USING (EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_roles.user_id = (select auth.uid()) AND user_roles.role = 'admin'
));

-- comments table
ALTER POLICY "auth_update_comments" ON public.comments
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "service_delete_comments" ON public.comments
USING ((select auth.role()) = 'service_role');

-- contributor_group_members table
ALTER POLICY "Users can remove group members in their workspaces" ON public.contributor_group_members
USING (workspace_id IN (
    SELECT workspace_members.workspace_id
    FROM workspace_members
    WHERE workspace_members.user_id = (select auth.uid())
));

ALTER POLICY "Users can view group members in their workspaces" ON public.contributor_group_members
USING (workspace_id IN (
    SELECT workspace_members.workspace_id
    FROM workspace_members
    WHERE workspace_members.user_id = (select auth.uid())
));

-- contributor_groups table
ALTER POLICY "Users can delete non-system groups in their workspaces" ON public.contributor_groups
USING (is_system = false AND workspace_id IN (
    SELECT workspace_members.workspace_id
    FROM workspace_members
    WHERE workspace_members.user_id = (select auth.uid())
));

ALTER POLICY "Users can update non-system groups in their workspaces" ON public.contributor_groups
USING (is_system = false AND workspace_id IN (
    SELECT workspace_members.workspace_id
    FROM workspace_members
    WHERE workspace_members.user_id = (select auth.uid())
));

ALTER POLICY "Users can view groups in their workspaces" ON public.contributor_groups
USING (workspace_id IN (
    SELECT workspace_members.workspace_id
    FROM workspace_members
    WHERE workspace_members.user_id = (select auth.uid())
));

-- contributor_notes table
ALTER POLICY "Users can delete notes in their workspaces" ON public.contributor_notes
USING (workspace_id IN (
    SELECT workspace_members.workspace_id
    FROM workspace_members
    WHERE workspace_members.user_id = (select auth.uid())
));

ALTER POLICY "Users can update notes in their workspaces" ON public.contributor_notes
USING (workspace_id IN (
    SELECT workspace_members.workspace_id
    FROM workspace_members
    WHERE workspace_members.user_id = (select auth.uid())
));

ALTER POLICY "Users can view notes in their workspaces" ON public.contributor_notes
USING (workspace_id IN (
    SELECT workspace_members.workspace_id
    FROM workspace_members
    WHERE workspace_members.user_id = (select auth.uid())
));

-- contributor_role_history table
ALTER POLICY "service_role_all" ON public.contributor_role_history
USING ((select auth.role()) = 'service_role');

-- contributor_roles table
ALTER POLICY "Allow admin users to update contributor roles" ON public.contributor_roles
USING (EXISTS (
    SELECT 1
    FROM app_users
    WHERE app_users.auth_user_id = (select auth.uid())
      AND app_users.is_admin = true
      AND app_users.is_active = true
));

ALTER POLICY "service_role_all" ON public.contributor_roles
USING ((select auth.role()) = 'service_role');

-- contributors_backup table
ALTER POLICY "service_role_only_all" ON public.contributors_backup
USING ((select auth.role()) = 'service_role');

-- contributors_replica table
ALTER POLICY "service_role_only_all" ON public.contributors_replica
USING ((select auth.role()) = 'service_role');

-- daily_activity_snapshots table
ALTER POLICY "service_role_all" ON public.daily_activity_snapshots
USING ((select auth.role()) = 'service_role');

-- data_capture_queue table
ALTER POLICY "service_only_all" ON public.data_capture_queue
USING ((select auth.role()) = 'service_role');

-- data_consistency_checks table
ALTER POLICY "Allow authenticated read access to consistency checks" ON public.data_consistency_checks
USING ((select auth.role()) = ANY (ARRAY['authenticated', 'service_role']));

ALTER POLICY "Service role can manage consistency checks" ON public.data_consistency_checks
USING ((select auth.role()) = 'service_role');

-- data_purge_log table
ALTER POLICY "Authenticated users can read purge logs" ON public.data_purge_log
USING ((select auth.role()) = 'authenticated');

ALTER POLICY "Service role can manage purge logs" ON public.data_purge_log
USING ((select auth.role()) = 'service_role');

-- dead_letter_queue table
ALTER POLICY "service_only_all" ON public.dead_letter_queue
USING ((select auth.role()) = 'service_role');

-- feature_usage table
ALTER POLICY "Service role can manage feature usage" ON public.feature_usage
USING ((select auth.role()) = 'service_role');

ALTER POLICY "Users can view own feature usage" ON public.feature_usage
USING ((select auth.uid()) = user_id);

-- file_contributors table
ALTER POLICY "Service role has full access to file contributors" ON public.file_contributors
USING ((select auth.role()) = 'service_role');

-- file_embeddings table
ALTER POLICY "Service role has full access to file embeddings" ON public.file_embeddings
USING ((select auth.role()) = 'service_role');

-- github_activities table
ALTER POLICY "service_role_all" ON public.github_activities
USING ((select auth.role()) = 'service_role');

-- github_app_installation_settings table
ALTER POLICY "Authenticated users can manage installation settings" ON public.github_app_installation_settings
USING ((select auth.role()) = 'authenticated');

ALTER POLICY "Authenticated users can manage their settings" ON public.github_app_installation_settings
USING ((select auth.role()) = 'authenticated');

-- github_app_installations table
ALTER POLICY "Authenticated users can manage installations" ON public.github_app_installations
USING ((select auth.role()) = 'authenticated');

ALTER POLICY "Authenticated users can read installations" ON public.github_app_installations
USING ((select auth.role()) = 'authenticated');

-- github_events_cache table
ALTER POLICY "service_role_all" ON public.github_events_cache
USING ((select auth.role()) = 'service_role');
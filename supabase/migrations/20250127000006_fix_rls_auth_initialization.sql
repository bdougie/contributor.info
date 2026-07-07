-- Fix Phase 1: Auth RLS Initialization Performance Issues
-- This migration updates 147 RLS policies across 36 tables to use subqueries
-- for auth functions, preventing row-by-row evaluation
-- Issue: https://github.com/bdougie/contributor.info/issues/816

-- auth_emails table (4 policies)
ALTER POLICY "anon_select_policy" ON public.auth_emails
USING (true);

ALTER POLICY "auth_all_policy" ON public.auth_emails
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "service_all_policy" ON public.auth_emails
USING ((select auth.role()) = 'service_role');

ALTER POLICY "user_manage_own" ON public.auth_emails
USING ((select auth.uid()) = user_id);

-- contributor_activity_metrics table (4 policies)
ALTER POLICY "anon_select_policy" ON public.contributor_activity_metrics
USING (true);

ALTER POLICY "auth_all_policy" ON public.contributor_activity_metrics
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "service_all_policy" ON public.contributor_activity_metrics
USING ((select auth.role()) = 'service_role');

ALTER POLICY "user_manage_own" ON public.contributor_activity_metrics
USING ((select auth.uid()) = user_id);

-- contributor_devstats table (4 policies)
ALTER POLICY "anon_select_policy" ON public.contributor_devstats
USING (true);

ALTER POLICY "auth_all_policy" ON public.contributor_devstats
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "service_all_policy" ON public.contributor_devstats
USING ((select auth.role()) = 'service_role');

ALTER POLICY "user_manage_own" ON public.contributor_devstats
USING ((select auth.uid()) = user_id);

-- contributor_pull_requests table (4 policies)
ALTER POLICY "anon_select_policy" ON public.contributor_pull_requests
USING (true);

ALTER POLICY "auth_all_policy" ON public.contributor_pull_requests
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "service_all_policy" ON public.contributor_pull_requests
USING ((select auth.role()) = 'service_role');

ALTER POLICY "user_manage_own" ON public.contributor_pull_requests
USING ((select auth.uid()) = user_id);

-- contributor_repos table (4 policies)
ALTER POLICY "anon_select_policy" ON public.contributor_repos
USING (true);

ALTER POLICY "auth_all_policy" ON public.contributor_repos
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "service_all_policy" ON public.contributor_repos
USING ((select auth.role()) = 'service_role');

ALTER POLICY "user_manage_own" ON public.contributor_repos
USING ((select auth.uid()) = user_id);

-- contributors table (7 policies)
ALTER POLICY "anon_select_policy" ON public.contributors
USING (true);

ALTER POLICY "auth_all_policy" ON public.contributors
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "auth_delete_policy" ON public.contributors
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "auth_insert_policy" ON public.contributors
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "auth_update_policy" ON public.contributors
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "service_all_policy" ON public.contributors
USING ((select auth.role()) = 'service_role');

ALTER POLICY "user_manage_own" ON public.contributors
USING ((select auth.uid()) = user_id);

-- devstats table (4 policies)
ALTER POLICY "anon_select_policy" ON public.devstats
USING (true);

ALTER POLICY "auth_all_policy" ON public.devstats
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "service_all_policy" ON public.devstats
USING ((select auth.role()) = 'service_role');

ALTER POLICY "user_manage_own" ON public.devstats
USING ((select auth.uid()) = user_id);

-- discovery_log table (4 policies)
ALTER POLICY "anon_select_policy" ON public.discovery_log
USING (true);

ALTER POLICY "auth_all_policy" ON public.discovery_log
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "service_all_policy" ON public.discovery_log
USING ((select auth.role()) = 'service_role');

ALTER POLICY "user_manage_own" ON public.discovery_log
USING ((select auth.uid()) = user_id);

-- events table (7 policies)
ALTER POLICY "anon_select_policy" ON public.events
USING (true);

ALTER POLICY "auth_all_policy" ON public.events
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "auth_delete_policy" ON public.events
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "auth_insert_policy" ON public.events
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "auth_update_policy" ON public.events
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "service_all_policy" ON public.events
USING ((select auth.role()) = 'service_role');

ALTER POLICY "user_manage_own" ON public.events
USING ((select auth.uid()) = user_id);

-- github_metrics_summary table (4 policies)
ALTER POLICY "anon_select_policy" ON public.github_metrics_summary
USING (true);

ALTER POLICY "auth_all_policy" ON public.github_metrics_summary
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "service_all_policy" ON public.github_metrics_summary
USING ((select auth.role()) = 'service_role');

ALTER POLICY "user_manage_own" ON public.github_metrics_summary
USING ((select auth.uid()) = user_id);

-- highlights table (6 policies)
ALTER POLICY "anon_select_policy" ON public.highlights
USING (true);

ALTER POLICY "auth_all_policy" ON public.highlights
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "auth_insert_policy" ON public.highlights
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "auth_update_policy" ON public.highlights
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "service_all_policy" ON public.highlights
USING ((select auth.role()) = 'service_role');

ALTER POLICY "user_manage_own" ON public.highlights
USING ((select auth.uid()) = user_id);

-- insights table (7 policies)
ALTER POLICY "anon_select_policy" ON public.insights
USING (true);

ALTER POLICY "auth_all_policy" ON public.insights
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "auth_delete_policy" ON public.insights
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "auth_insert_policy" ON public.insights
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "auth_update_policy" ON public.insights
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "service_all_policy" ON public.insights
USING ((select auth.role()) = 'service_role');

ALTER POLICY "user_manage_own" ON public.insights
USING ((select auth.uid()) = user_id);

-- language_activity table (4 policies)
ALTER POLICY "anon_select_policy" ON public.language_activity
USING (true);

ALTER POLICY "auth_all_policy" ON public.language_activity
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "service_all_policy" ON public.language_activity
USING ((select auth.role()) = 'service_role');

ALTER POLICY "user_manage_own" ON public.language_activity
USING ((select auth.uid()) = user_id);

-- languages table (4 policies)
ALTER POLICY "anon_select_policy" ON public.languages
USING (true);

ALTER POLICY "auth_all_policy" ON public.languages
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "service_all_policy" ON public.languages
USING ((select auth.role()) = 'service_role');

ALTER POLICY "user_manage_own" ON public.languages
USING ((select auth.uid()) = user_id);

-- list_contributors table (4 policies)
ALTER POLICY "anon_select_policy" ON public.list_contributors
USING (true);

ALTER POLICY "auth_all_policy" ON public.list_contributors
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "service_all_policy" ON public.list_contributors
USING ((select auth.role()) = 'service_role');

ALTER POLICY "user_manage_own" ON public.list_contributors
USING ((select auth.uid()) = user_id);

-- list_discovery_log table (4 policies)
ALTER POLICY "anon_select_policy" ON public.list_discovery_log
USING (true);

ALTER POLICY "auth_all_policy" ON public.list_discovery_log
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "service_all_policy" ON public.list_discovery_log
USING ((select auth.role()) = 'service_role');

ALTER POLICY "user_manage_own" ON public.list_discovery_log
USING ((select auth.uid()) = user_id);

-- list_repos table (4 policies)
ALTER POLICY "anon_select_policy" ON public.list_repos
USING (true);

ALTER POLICY "auth_all_policy" ON public.list_repos
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "service_all_policy" ON public.list_repos
USING ((select auth.role()) = 'service_role');

ALTER POLICY "user_manage_own" ON public.list_repos
USING ((select auth.uid()) = user_id);

-- lists table (7 policies)
ALTER POLICY "anon_select_policy" ON public.lists
USING (true);

ALTER POLICY "auth_all_policy" ON public.lists
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "auth_delete_policy" ON public.lists
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "auth_insert_policy" ON public.lists
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "auth_update_policy" ON public.lists
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "service_all_policy" ON public.lists
USING ((select auth.role()) = 'service_role');

ALTER POLICY "user_manage_own" ON public.lists
USING ((select auth.uid()) = user_id);

-- milestone_counts table (4 policies)
ALTER POLICY "anon_select_policy" ON public.milestone_counts
USING (true);

ALTER POLICY "auth_all_policy" ON public.milestone_counts
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "service_all_policy" ON public.milestone_counts
USING ((select auth.role()) = 'service_role');

ALTER POLICY "user_manage_own" ON public.milestone_counts
USING ((select auth.uid()) = user_id);

-- notifications table (7 policies)
ALTER POLICY "anon_select_policy" ON public.notifications
USING (true);

ALTER POLICY "auth_all_policy" ON public.notifications
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "auth_delete_policy" ON public.notifications
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "auth_insert_policy" ON public.notifications
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "auth_update_policy" ON public.notifications
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "service_all_policy" ON public.notifications
USING ((select auth.role()) = 'service_role');

ALTER POLICY "user_manage_own" ON public.notifications
USING ((select auth.uid()) = user_id);

-- pr_history table (4 policies)
ALTER POLICY "anon_select_policy" ON public.pr_history
USING (true);

ALTER POLICY "auth_all_policy" ON public.pr_history
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "service_all_policy" ON public.pr_history
USING ((select auth.role()) = 'service_role');

ALTER POLICY "user_manage_own" ON public.pr_history
USING ((select auth.uid()) = user_id);

-- pr_reviews table (4 policies)
ALTER POLICY "anon_select_policy" ON public.pr_reviews
USING (true);

ALTER POLICY "auth_all_policy" ON public.pr_reviews
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "service_all_policy" ON public.pr_reviews
USING ((select auth.role()) = 'service_role');

ALTER POLICY "user_manage_own" ON public.pr_reviews
USING ((select auth.uid()) = user_id);

-- profile_views table (4 policies)
ALTER POLICY "anon_select_policy" ON public.profile_views
USING (true);

ALTER POLICY "auth_all_policy" ON public.profile_views
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "service_all_policy" ON public.profile_views
USING ((select auth.role()) = 'service_role');

ALTER POLICY "user_manage_own" ON public.profile_views
USING ((select auth.uid()) = user_id);

-- profiles table (7 policies)
ALTER POLICY "anon_select_policy" ON public.profiles
USING (true);

ALTER POLICY "auth_all_policy" ON public.profiles
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "auth_delete_policy" ON public.profiles
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "auth_insert_policy" ON public.profiles
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "auth_update_policy" ON public.profiles
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "service_all_policy" ON public.profiles
USING ((select auth.role()) = 'service_role');

ALTER POLICY "user_manage_own" ON public.profiles
USING ((select auth.uid()) = user_id);

-- pull_request_commits table (4 policies)
ALTER POLICY "anon_select_policy" ON public.pull_request_commits
USING (true);

ALTER POLICY "auth_all_policy" ON public.pull_request_commits
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "service_all_policy" ON public.pull_request_commits
USING ((select auth.role()) = 'service_role');

ALTER POLICY "user_manage_own" ON public.pull_request_commits
USING ((select auth.uid()) = user_id);

-- pull_request_reviews table (4 policies)
ALTER POLICY "anon_select_policy" ON public.pull_request_reviews
USING (true);

ALTER POLICY "auth_all_policy" ON public.pull_request_reviews
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "service_all_policy" ON public.pull_request_reviews
USING ((select auth.role()) = 'service_role');

ALTER POLICY "user_manage_own" ON public.pull_request_reviews
USING ((select auth.uid()) = user_id);

-- pull_requests table (7 policies)
ALTER POLICY "anon_select_policy" ON public.pull_requests
USING (true);

ALTER POLICY "auth_all_policy" ON public.pull_requests
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "auth_delete_policy" ON public.pull_requests
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "auth_insert_policy" ON public.pull_requests
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "auth_update_policy" ON public.pull_requests
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "service_all_policy" ON public.pull_requests
USING ((select auth.role()) = 'service_role');

ALTER POLICY "user_manage_own" ON public.pull_requests
USING ((select auth.uid()) = user_id);

-- repo_contributors table (4 policies)
ALTER POLICY "anon_select_policy" ON public.repo_contributors
USING (true);

ALTER POLICY "auth_all_policy" ON public.repo_contributors
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "service_all_policy" ON public.repo_contributors
USING ((select auth.role()) = 'service_role');

ALTER POLICY "user_manage_own" ON public.repo_contributors
USING ((select auth.uid()) = user_id);

-- repo_discovery_queue table (4 policies)
ALTER POLICY "anon_select_policy" ON public.repo_discovery_queue
USING (true);

ALTER POLICY "auth_all_policy" ON public.repo_discovery_queue
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "service_all_policy" ON public.repo_discovery_queue
USING ((select auth.role()) = 'service_role');

ALTER POLICY "user_manage_own" ON public.repo_discovery_queue
USING ((select auth.uid()) = user_id);

-- repo_insights table (4 policies)
ALTER POLICY "anon_select_policy" ON public.repo_insights
USING (true);

ALTER POLICY "auth_all_policy" ON public.repo_insights
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "service_all_policy" ON public.repo_insights
USING ((select auth.role()) = 'service_role');

ALTER POLICY "user_manage_own" ON public.repo_insights
USING ((select auth.uid()) = user_id);

-- repos table (7 policies)
ALTER POLICY "anon_select_policy" ON public.repos
USING (true);

ALTER POLICY "auth_all_policy" ON public.repos
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "auth_delete_policy" ON public.repos
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "auth_insert_policy" ON public.repos
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "auth_update_policy" ON public.repos
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "service_all_policy" ON public.repos
USING ((select auth.role()) = 'service_role');

ALTER POLICY "user_manage_own" ON public.repos
USING ((select auth.uid()) = user_id);

-- subscriptions table (4 policies)
ALTER POLICY "anon_select_policy" ON public.subscriptions
USING (true);

ALTER POLICY "auth_all_policy" ON public.subscriptions
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "service_all_policy" ON public.subscriptions
USING ((select auth.role()) = 'service_role');

ALTER POLICY "user_manage_own" ON public.subscriptions
USING ((select auth.uid()) = user_id);

-- user_lists table (7 policies)
ALTER POLICY "anon_select_policy" ON public.user_lists
USING (true);

ALTER POLICY "auth_all_policy" ON public.user_lists
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "auth_delete_policy" ON public.user_lists
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "auth_insert_policy" ON public.user_lists
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "auth_update_policy" ON public.user_lists
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "service_all_policy" ON public.user_lists
USING ((select auth.role()) = 'service_role');

ALTER POLICY "user_manage_own" ON public.user_lists
USING ((select auth.uid()) = user_id);

-- user_notifications table (4 policies)
ALTER POLICY "anon_select_policy" ON public.user_notifications
USING (true);

ALTER POLICY "auth_all_policy" ON public.user_notifications
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "service_all_policy" ON public.user_notifications
USING ((select auth.role()) = 'service_role');

ALTER POLICY "user_manage_own" ON public.user_notifications
USING ((select auth.uid()) = user_id);

-- user_preferences table (4 policies)
ALTER POLICY "anon_select_policy" ON public.user_preferences
USING (true);

ALTER POLICY "auth_all_policy" ON public.user_preferences
USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "service_all_policy" ON public.user_preferences
USING ((select auth.role()) = 'service_role');

ALTER POLICY "user_manage_own" ON public.user_preferences
USING ((select auth.uid()) = user_id);
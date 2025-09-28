-- Phase 4: Fix remaining auth RLS initialization issues (120+ policies across 84 tables)
-- This migration optimizes all remaining auth.uid(), auth.role(), and auth.jwt() calls
-- by wrapping them in subqueries for single evaluation per statement

BEGIN;

-- Helper function to recreate policies with optimized auth calls
CREATE OR REPLACE FUNCTION optimize_auth_policies() RETURNS void AS $$
DECLARE
    r RECORD;
    new_qual TEXT;
    new_with_check TEXT;
BEGIN
    FOR r IN
        SELECT
            schemaname,
            tablename,
            policyname,
            cmd AS polcmd,
            permissive AS polpermissive,
            roles AS polroles,
            qual::text AS policy_expression,
            with_check::text AS with_check_expression
        FROM pg_policies
        WHERE schemaname = 'public'
          AND (
            qual::text LIKE '%auth.uid()%' OR
            qual::text LIKE '%auth.role()%' OR
            qual::text LIKE '%auth.jwt()%'
          )
          AND qual::text NOT LIKE '%(SELECT auth.%'
          AND qual::text NOT LIKE '%(select auth.%'
    LOOP
        -- Replace auth function calls with subquery versions
        -- Avoid double-wrapping by checking if already wrapped
        new_qual := r.policy_expression;

        -- First check if auth calls are already wrapped
        IF new_qual NOT LIKE '%( SELECT auth.uid()%' THEN
            new_qual := regexp_replace(new_qual, 'auth\.uid\(\)', '(SELECT auth.uid())', 'g');
        END IF;

        IF new_qual NOT LIKE '%( SELECT auth.role()%' THEN
            new_qual := regexp_replace(new_qual, 'auth\.role\(\)', '(SELECT auth.role())', 'g');
        END IF;

        IF new_qual NOT LIKE '%( SELECT auth.jwt()%' THEN
            new_qual := regexp_replace(new_qual, 'auth\.jwt\(\)', '(SELECT auth.jwt())', 'g');
        END IF;

        -- Handle WITH CHECK if present
        new_with_check := r.with_check_expression;
        IF new_with_check IS NOT NULL THEN
            IF new_with_check NOT LIKE '%( SELECT auth.uid()%' THEN
                new_with_check := regexp_replace(new_with_check, 'auth\.uid\(\)', '(SELECT auth.uid())', 'g');
            END IF;

            IF new_with_check NOT LIKE '%( SELECT auth.role()%' THEN
                new_with_check := regexp_replace(new_with_check, 'auth\.role\(\)', '(SELECT auth.role())', 'g');
            END IF;

            IF new_with_check NOT LIKE '%( SELECT auth.jwt()%' THEN
                new_with_check := regexp_replace(new_with_check, 'auth\.jwt\(\)', '(SELECT auth.jwt())', 'g');
            END IF;
        END IF;

        -- Drop and recreate the policy with optimized version
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
            r.policyname, r.schemaname, r.tablename);

        -- Recreate with optimized auth calls
        IF r.with_check_expression IS NOT NULL THEN
            EXECUTE format('CREATE POLICY %I ON %I.%I FOR %s TO %s USING (%s) WITH CHECK (%s)',
                r.policyname, r.schemaname, r.tablename,
                r.polcmd,
                array_to_string(r.polroles, ', '),
                new_qual,
                new_with_check);
        ELSE
            EXECUTE format('CREATE POLICY %I ON %I.%I FOR %s TO %s USING (%s)',
                r.policyname, r.schemaname, r.tablename,
                r.polcmd,
                array_to_string(r.polroles, ', '),
                new_qual);
        END IF;

        RAISE NOTICE 'Optimized policy % on table %', r.policyname, r.tablename;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute the optimization
SELECT optimize_auth_policies();

-- Clean up the helper function
DROP FUNCTION optimize_auth_policies();

-- Verify the optimization
DO $$
DECLARE
    remaining_count INT;
BEGIN
    SELECT COUNT(*)
    INTO remaining_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        qual::text LIKE '%auth.uid()%' OR
        qual::text LIKE '%auth.role()%' OR
        qual::text LIKE '%auth.jwt()%'
      )
      AND qual::text NOT LIKE '%(SELECT auth.%'
      AND qual::text NOT LIKE '%(select auth.%';

    IF remaining_count > 0 THEN
        RAISE WARNING 'Still have % unoptimized policies remaining', remaining_count;
    ELSE
        RAISE NOTICE 'Successfully optimized all auth RLS policies!';
    END IF;
END $$;

COMMIT;

-- Summary of optimized tables (84 tables, 120+ policies):
-- High count tables (3 policies each):
-- - contributor_groups, contributor_notes, user_email_preferences
-- - workspace_invitations, workspaces
--
-- Medium count tables (2 policies each):
-- - app_users, auth_errors, backfill_chunks, background_jobs
-- - billing_history, comments, contributor_group_members
-- - contributor_roles, data_consistency_checks, data_purge_log
-- - feature_usage, github_app_installations, idempotency_keys
-- - requested_reviewers, subscription_addons, subscriptions
-- - usage_stats, usage_tracking, user_roles
-- - workspace_contributors, workspace_members, workspace_metrics_cache
-- - workspace_repositories
--
-- Single policy tables (1 policy each):
-- - _dlt_version, app_enabled_repositories, app_metrics
-- - batch_progress, contributor_role_history, contributors_backup/replica
-- - daily_activity_snapshots, data_capture_queue, dead_letter_queue
-- - file_contributors, file_embeddings, github_activities
-- - github_app_installation_settings, github_events_cache (and partitions)
-- - github_sync_status, issues_backup/replica, monthly_rankings
-- - organizations, performance_alerts, pr_insights
-- - priority_queue, progressive_* tables, pull_requests_backup/replica
-- - query_patterns, queue_metrics, rate_limit_tracking, rate_limits
-- - referral_traffic, repository_categories, repository_confidence_cache
-- - reviews, rollout_* tables, share_* tables
-- - spam_detections, sync_* tables, tier_limits
-- - web_vitals_events, workspace_activity, workspace_aggregation_queue
-- - workspace_metrics_history, workspace_tracked_repositories
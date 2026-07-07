-- Migration: Drop unused SECURITY DEFINER functions and restrict EXECUTE grants
-- Purpose: Resolve anon/authenticated_security_definer_function_executable advisor
--          warnings. Postgres grants EXECUTE to PUBLIC by default, so every
--          SECURITY DEFINER function was callable by anon and authenticated.
--
-- Classification (verified against app code, netlify/, supabase/functions/,
-- scripts/, e2e/, pg_trigger, cron.job, pg_policies, view definitions, and
-- all function bodies):
--   1. DROP: referenced nowhere (dead code)
--   2. Service-only (triggers, cron, edge/inngest/scripts via service_role):
--      revoke from PUBLIC/anon/authenticated
--   3. Authenticated browser features (admin UIs, workspace member actions,
--      spam reporting): revoke from PUBLIC/anon, grant to authenticated
--   4. Public/pre-auth browser paths and RLS policy helpers: explicit grants
--      to anon + authenticated (replacing the implicit PUBLIC grant)

-- ============================================================================
-- 1. Drop unreferenced functions
-- ============================================================================

DROP FUNCTION IF EXISTS public.calculate_overage_charges(user_uuid uuid, period_start_date timestamp with time zone, period_end_date timestamp with time zone);
DROP FUNCTION IF EXISTS public.can_add_repository(workspace_uuid uuid);
DROP FUNCTION IF EXISTS public.can_create_workspace(user_uuid uuid);
DROP FUNCTION IF EXISTS public.check_email_rate_limit(p_user_id uuid, p_email_type text, p_time_window interval, p_max_emails integer);
DROP FUNCTION IF EXISTS public.check_user_slack_integration_limit();
DROP FUNCTION IF EXISTS public.check_workspace_permission(workspace_id_param uuid, user_id_param uuid, required_permission text);
DROP FUNCTION IF EXISTS public.clean_expired_reviewer_cache();
DROP FUNCTION IF EXISTS public.cleanup_old_github_activities();
DROP FUNCTION IF EXISTS public.current_user_is_admin();
DROP FUNCTION IF EXISTS public.get_confidence_analytics_summary();
DROP FUNCTION IF EXISTS public.get_recent_auth_errors(p_limit integer, p_unresolved_only boolean);
DROP FUNCTION IF EXISTS public.get_repository_confidence_summary();
DROP FUNCTION IF EXISTS public.get_subscription_issues();
DROP FUNCTION IF EXISTS public.get_trending_repositories(p_time_period interval, p_limit integer, p_language text, p_min_stars integer);
DROP FUNCTION IF EXISTS public.get_trending_repositories_with_fallback(p_time_period interval, p_limit integer, p_language text, p_min_stars integer);
DROP FUNCTION IF EXISTS public.get_trending_statistics(p_time_period interval);
DROP FUNCTION IF EXISTS public.get_user_tier(user_uuid uuid);
DROP FUNCTION IF EXISTS public.get_user_workspace_count(p_user_id uuid);
DROP FUNCTION IF EXISTS public.get_workspace_activity_velocity(p_workspace_id uuid, p_days integer);
DROP FUNCTION IF EXISTS public.get_workspace_event_metrics_aggregated(p_workspace_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone);
DROP FUNCTION IF EXISTS public.get_workspace_role(workspace_uuid uuid, user_uuid uuid);
DROP FUNCTION IF EXISTS public.increment_embedding_job_progress(job_id uuid, increment_count integer);
DROP FUNCTION IF EXISTS public.is_workspace_admin_or_owner(workspace_uuid uuid, user_uuid uuid);
DROP FUNCTION IF EXISTS public.is_workspace_member(workspace_uuid uuid, user_uuid uuid);
DROP FUNCTION IF EXISTS public.move_to_dead_letter_queue(job_id uuid);
DROP FUNCTION IF EXISTS public.purge_old_file_data();
DROP FUNCTION IF EXISTS public.resolve_auth_error(p_error_id uuid, p_resolved_by uuid);
DROP FUNCTION IF EXISTS public.trigger_workspace_invitation_email(invitation_id_param uuid);
DROP FUNCTION IF EXISTS public.user_has_email_consent(p_user_id uuid, p_email_type text);
DROP FUNCTION IF EXISTS public.withdraw_email_consent(p_user_id uuid);

-- ============================================================================
-- 2. Service-only functions (triggers, cron, service_role callers)
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.add_owner_as_workspace_member() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_owner_as_workspace_member() TO service_role;
REVOKE EXECUTE ON FUNCTION public.batch_capture_metrics(metrics_data jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.batch_capture_metrics(metrics_data jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.capture_repository_metrics(p_repository_id uuid, p_metric_type text, p_current_value integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.capture_repository_metrics(p_repository_id uuid, p_metric_type text, p_current_value integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.enforce_respond_columns_issues() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_respond_columns_issues() TO service_role;
REVOKE EXECUTE ON FUNCTION public.ensure_repository_id() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_repository_id() TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_progressive_capture_metrics(days_back integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_progressive_capture_metrics(days_back integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_repository_contributor_counts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_repository_contributor_counts() TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_repository_pr_counts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_repository_pr_counts() TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_stuck_job_summary() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_stuck_job_summary() TO service_role;
REVOKE EXECUTE ON FUNCTION public.log_gdpr_processing(p_user_id uuid, p_purpose text, p_legal_basis text, p_data_categories text[], p_notes text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_gdpr_processing(p_user_id uuid, p_purpose text, p_legal_basis text, p_data_categories text[], p_notes text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.refresh_all_workspace_preview_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_all_workspace_preview_stats() TO service_role;
REVOKE EXECUTE ON FUNCTION public.refresh_contribution_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_contribution_stats() TO service_role;
REVOKE EXECUTE ON FUNCTION public.refresh_workspace_preview_stats(p_workspace_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_workspace_preview_stats(p_workspace_id uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.sync_user_to_app_users() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_user_to_app_users() TO service_role;
REVOKE EXECUTE ON FUNCTION public.sync_workspace_tracked_repositories() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_workspace_tracked_repositories() TO service_role;
REVOKE EXECUTE ON FUNCTION public.trigger_workspace_stats_refresh() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_workspace_stats_refresh() TO service_role;
REVOKE EXECUTE ON FUNCTION public.update_reporter_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_reporter_stats() TO service_role;

-- ============================================================================
-- 3. Logged-in browser features (keep authenticated, remove anon)
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.accept_workspace_invitation(p_invitation_token uuid, p_user_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_workspace_invitation(p_invitation_token uuid, p_user_id uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.auto_verify_spam_reports(p_threshold integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auto_verify_spam_reports(p_threshold integer) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.bulk_verify_spam_reports(p_report_ids uuid[], p_admin_id uuid, p_status text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_verify_spam_reports(p_report_ids uuid[], p_admin_id uuid, p_status text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.check_spam_report_rate_limit(p_user_id uuid, p_ip_hash text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_spam_report_rate_limit(p_user_id uuid, p_ip_hash text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.decline_workspace_invitation(p_invitation_token uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decline_workspace_invitation(p_invitation_token uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_confidence_analytics_summary_simple() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_confidence_analytics_summary_simple() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_repository_confidence_breakdown(p_repository_owner text, p_repository_name text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_repository_confidence_breakdown(p_repository_owner text, p_repository_name text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_user_by_github_id(user_github_id bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_by_github_id(user_github_id bigint) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.increment_reporter_counts(p_reporter_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_reporter_counts(p_reporter_id uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.increment_spam_report_count(p_report_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_spam_report_count(p_report_id uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.log_admin_action(p_admin_github_id bigint, p_action_type character varying, p_target_type character varying, p_target_id character varying, p_details jsonb, p_ip_address inet, p_user_agent text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_admin_action(p_admin_github_id bigint, p_action_type character varying, p_target_type character varying, p_target_id character varying, p_details jsonb, p_ip_address inet, p_user_agent text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.manage_spam_reporter(p_reporter_id uuid, p_admin_id uuid, p_action text, p_reason text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manage_spam_reporter(p_reporter_id uuid, p_admin_id uuid, p_action text, p_reason text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.override_contributor_role(p_user_id text, p_repository_owner text, p_repository_name text, p_new_role text, p_admin_github_id bigint, p_reason text, p_lock boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.override_contributor_role(p_user_id text, p_repository_owner text, p_repository_name text, p_new_role text, p_admin_github_id bigint, p_reason text, p_lock boolean) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.verify_spam_report(p_report_id uuid, p_admin_id uuid, p_status text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_spam_report(p_report_id uuid, p_admin_id uuid, p_status text) TO authenticated, service_role;

-- ============================================================================
-- 4. Public/pre-auth paths and RLS helpers (make implicit PUBLIC grant explicit)
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.get_repository_confidence_summary_simple() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_repository_confidence_summary_simple() TO anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_workspace_invitation_by_token(p_invitation_token uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_workspace_invitation_by_token(p_invitation_token uuid) TO anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_workspace_repository_event_summaries(p_workspace_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_workspace_repository_event_summaries(p_workspace_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone) TO anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.log_auth_error(p_auth_user_id uuid, p_github_user_id bigint, p_github_username text, p_error_type text, p_error_message text, p_error_code text, p_user_agent text, p_ip_address inet) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_auth_error(p_auth_user_id uuid, p_github_user_id bigint, p_github_username text, p_error_type text, p_error_message text, p_error_code text, p_user_agent text, p_ip_address inet) TO anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.rls_current_app_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rls_current_app_user_id() TO anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.rls_user_workspace_role(ws_id uuid, u_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rls_user_workspace_role(ws_id uuid, u_id uuid) TO anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.rls_workspace_is_public(ws_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rls_workspace_is_public(ws_id uuid) TO anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.rls_workspace_owner_id(ws_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rls_workspace_owner_id(ws_id uuid) TO anon, authenticated, service_role;

-- ============================================================================
-- 5. Prevent recurrence: new functions no longer get PUBLIC execute by default.
--    NOTE: any future function meant to be called from the frontend via
--    supabase.rpc() now needs an explicit GRANT EXECUTE, e.g.:
--      GRANT EXECUTE ON FUNCTION public.my_rpc(args) TO anon, authenticated;
-- ============================================================================
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;


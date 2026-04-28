-- PR-A of issue #1795: harden search_path on SECURITY DEFINER functions
--
-- 33 of the 69 SECURITY DEFINER functions in `public` granted to anon/authenticated
-- did not pin a hardened search_path:
--   * 25 functions had no `proconfig` at all (caller's search_path applies)
--   * 8 functions used `search_path=public` (no pg_catalog/pg_temp anchor)
--
-- Without a hardened search_path, a SECURITY DEFINER function inherits the caller's
-- search_path, allowing an attacker with CREATE on any earlier-resolved schema to
-- shadow names referenced unqualified in the function body. We standardize on
-- `public, pg_catalog, pg_temp` to match the 21 functions already on this pattern.
--
-- This is a pure mitigation: no body changes, no signature changes, no GRANT changes.
-- Other actions (REVOKE, INVOKER conversion) ship in follow-up PRs (PR-B, PR-C, PR-D).
-- See docs/security/security-definer-audit.md for the full triage.

BEGIN;

-- 25 functions with NULL proconfig
ALTER FUNCTION public.add_owner_as_workspace_member() SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.batch_capture_metrics(metrics_data jsonb) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.calculate_overage_charges(user_uuid uuid, period_start_date timestamp with time zone, period_end_date timestamp with time zone) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.can_add_repository(workspace_uuid uuid) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.can_create_workspace(user_uuid uuid) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.capture_repository_metrics(p_repository_id uuid, p_metric_type text, p_current_value integer) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.check_user_slack_integration_limit() SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.clean_expired_reviewer_cache() SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.enforce_respond_columns_issues() SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.get_repository_contributor_counts() SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.get_repository_pr_counts() SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.get_subscription_issues() SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.get_trending_repositories(p_time_period interval, p_limit integer, p_language text, p_min_stars integer) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.get_trending_repositories_with_fallback(p_time_period interval, p_limit integer, p_language text, p_min_stars integer) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.get_trending_statistics(p_time_period interval) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.get_user_tier(user_uuid uuid) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.get_user_workspace_count(p_user_id uuid) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.get_workspace_activity_velocity(p_workspace_id uuid, p_days integer) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.get_workspace_event_metrics_aggregated(p_workspace_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.get_workspace_repository_event_summaries(p_workspace_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.increment_embedding_job_progress(job_id uuid, increment_count integer) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.is_workspace_admin_or_owner(workspace_uuid uuid, user_uuid uuid) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.move_to_dead_letter_queue(job_id uuid) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.sync_user_to_app_users() SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.trigger_workspace_invitation_email(invitation_id_param uuid) SET search_path = public, pg_catalog, pg_temp;

-- 8 functions on partial `search_path=public` (missing pg_catalog/pg_temp anchor)
ALTER FUNCTION public.accept_workspace_invitation(p_invitation_token uuid, p_user_id uuid) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.decline_workspace_invitation(p_invitation_token uuid) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.get_stuck_job_summary() SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.get_workspace_invitation_by_token(p_invitation_token uuid) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.refresh_all_workspace_preview_stats() SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.refresh_workspace_preview_stats(p_workspace_id uuid) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.sync_workspace_tracked_repositories() SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.trigger_workspace_stats_refresh() SET search_path = public, pg_catalog, pg_temp;

COMMIT;

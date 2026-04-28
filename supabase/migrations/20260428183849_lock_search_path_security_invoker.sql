-- Issue #1796: lock search_path on remaining mutable plpgsql functions
--
-- The advisor flagged 99 functions as `function_search_path_mutable`. PR #1798
-- closed 33 of them (the SECURITY DEFINER subset granted to anon/authenticated).
-- This migration handles the remaining 72 plpgsql SECURITY INVOKER functions.
--
-- Excluded by design (per the issue's acceptance criteria):
--   * 114 C-language pgvector functions (search_path doesn't apply)
--   * 4 internal aggregates over vector/halfvec types (extension-owned)
-- All 118 are pg_depend dependencies of the `vector` extension. The advisor
-- continues to flag them but they cannot be hardened without rewriting pgvector.
--
-- Same mechanical pattern as PR #1798: SET search_path on each function, no
-- body or signature change.

BEGIN;

ALTER FUNCTION public.batch_update_issues_linked_prs(updates jsonb) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.calculate_assignee_distribution(p_repository_ids uuid[], p_exclude_bots boolean, p_limit integer) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.calculate_citation_confidence(referrer_url text, user_agent text, landing_page text) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.calculate_contributor_quality_score(p_contributor_id uuid, p_workspace_id uuid) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.calculate_metric_trend(current_value numeric, previous_value numeric) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.calculate_next_slack_scheduled_at(p_schedule text, p_from_time timestamp with time zone) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.calculate_workspace_repo_priority(p_workspace_id uuid, p_tracked_repository_id uuid) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.check_feature_limit(p_user_id uuid, p_feature_name text) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.check_repository_pr_count_consistency() SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.cleanup_expired_cache() SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.cleanup_expired_idempotency_keys() SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.cleanup_expired_workspace_cache() SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.cleanup_old_confidence_history() SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.cleanup_orphaned_cache_entries() SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.create_default_contributor_groups() SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.detect_ai_platform(referrer_url text, user_agent text) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.detect_significant_metric_change() SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.extract_repository_from_path(path text) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.find_codeowners_for_file(p_repository_id uuid, p_file_path text) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.find_similar_discussions_in_workspace(query_embedding vector, repo_ids uuid[], match_count integer, exclude_discussion_id text) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.find_similar_issues(target_issue_id uuid, limit_count integer) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.find_similar_issues_in_workspace(query_embedding vector, repo_ids uuid[], match_count integer, exclude_issue_id uuid) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.find_similar_items_cross_entity(query_embedding vector, repo_ids uuid[], match_count integer, exclude_item_type text, exclude_item_id text) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.find_similar_pull_requests_in_workspace(query_embedding vector, repo_ids uuid[], match_count integer, exclude_pr_id uuid) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.fix_repository_pr_count_inconsistencies() SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.generate_workspace_slug(workspace_name text) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.get_cache_statistics() SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.get_cache_ttl(p_time_range text) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.get_cached_avatar_url(contributor_github_id bigint) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.get_contributor_velocity(p_contributor_id uuid, p_workspace_id uuid) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.get_job_metrics_windowed(window_hours integer) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.get_next_job() SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.get_queue_depth() SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.get_repository_freshness(p_repository_id uuid) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.get_sync_statistics(repo_name text, days_back integer) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.get_user_subscription(p_user_id uuid) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.get_webhook_performance(p_hours integer) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.get_workspace_repos_for_sync(p_limit integer) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.get_workspace_stats_freshness() SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.increment_cache_access(cache_id uuid) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.invalidate_workspace_cache_on_repo_change() SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.is_avatar_cache_valid(cached_at timestamp with time zone, expires_at timestamp with time zone) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.is_oauth_integration(integration slack_integrations) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.is_pr_data_stale(last_sync timestamp with time zone, max_age_minutes integer) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.is_user_admin(user_github_id bigint) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.mark_workspace_cache_stale(p_workspace_id uuid) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.parse_codeowners_rules(content text) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.refresh_analytics_views() SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.retry_failed_job(job_id uuid) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.run_data_consistency_checks() SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.schedule_job_retry() SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.set_next_scheduled_at() SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.should_use_supabase(repo_name text) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.sync_contributor_analytics_to_contributors() SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.update_action_usage_discoveries_updated_at() SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.update_avatar_cache(contributor_github_id bigint, new_avatar_url text, cache_duration_days integer) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.update_embedding_job_progress(job_id uuid, processed_count integer) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.update_last_updated_column() SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.update_notifications_updated_at() SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.update_repository_last_activity() SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.update_repository_pr_count_trigger() SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.update_requested_reviewers_updated_at() SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.update_slack_integrations_updated_at() SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.update_user_slack_integration_timestamp() SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.update_workspace_activity() SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.update_workspace_metrics_cache_updated_at() SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.update_workspace_repo_priorities() SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.update_workspace_repository_count() SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.update_workspace_sync_status(p_workspace_id uuid, p_tracked_repository_id uuid, p_status text, p_error text) SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.update_workspace_tier_limits() SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.validate_cache_item_reference() SET search_path = public, pg_catalog, pg_temp;

COMMIT;

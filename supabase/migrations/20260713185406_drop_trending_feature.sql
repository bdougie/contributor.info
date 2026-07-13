-- Migration: Drop trending feature database objects
-- Purpose: The /trending page and its data pipeline have been removed from the
--          app (page, api-trending-repositories function, ssr-trending edge
--          function, and the trending half of the metrics capture cron).
--          This drops the now-unused database objects behind it.
--
-- Kept: repository_changelogs (created alongside metrics history in
--       20250810000000 but unrelated to trending).

-- Trending read APIs (restored in 20260707000003, previously used by
-- netlify/functions/api-trending-repositories.mts)
DROP FUNCTION IF EXISTS public.get_trending_repositories(p_time_period interval, p_limit integer, p_language text, p_min_stars integer);
DROP FUNCTION IF EXISTS public.get_trending_repositories_with_fallback(p_time_period interval, p_limit integer, p_language text, p_min_stars integer);
DROP FUNCTION IF EXISTS public.get_trending_statistics(p_time_period interval);

-- Metrics capture write path (previously used by the
-- capture-repository-metrics-cron Inngest function)
DROP FUNCTION IF EXISTS public.batch_capture_metrics(metrics_data jsonb);
DROP FUNCTION IF EXISTS public.capture_repository_metrics(p_repository_id uuid, p_metric_type text, p_current_value integer);
DROP FUNCTION IF EXISTS public.get_repository_contributor_counts();
DROP FUNCTION IF EXISTS public.get_repository_pr_counts();

-- Readers of repository_metrics_history with no remaining callers
DROP FUNCTION IF EXISTS public.get_repository_freshness(p_repository_id uuid);
DROP FUNCTION IF EXISTS public.cleanup_old_metrics_history();

-- The metrics history table itself; CASCADE removes its triggers
-- (detect_significant_changes, trigger_update_repository_activity),
-- indexes, and RLS policies
DROP TABLE IF EXISTS public.repository_metrics_history CASCADE;

-- Trigger functions that only ever fired on repository_metrics_history
DROP FUNCTION IF EXISTS public.detect_significant_metric_change();
DROP FUNCTION IF EXISTS public.update_repository_last_activity();

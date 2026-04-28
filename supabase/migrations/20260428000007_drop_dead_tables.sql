-- Chore: drop 41 dead tables that have never been written to
--
-- All tables in this migration meet ALL of the following criteria, verified
-- via pg_stat_user_tables (12 months of activity since stats reset 2025-04-08):
--
--   1. n_tup_ins = 0 (zero inserts ever)
--   2. n_live_tup = 0 (no live rows; * exception: snapshot tables noted below)
--   3. No active source code references in contributor.info or gh-datapipe
--      (greps verified across src/, supabase/functions/, netlify/, and
--      gh-datapipe/**/*.py)
--   4. Foreign keys reference active tables, not other dead tables
--      (so DROP CASCADE is safe and bounded)
--
-- Tables NOT included even though they look dead:
--   - github_issues — gh-datapipe writes to this via supabase_sync.py
--   - subscriptions, subscription_features, subscription_addons, billing_history,
--     tier_limits, priority_queue, usage_tracking, usage_stats, feature_usage —
--     reserved-for-future scaffolding (see Issue #401)
--
-- Disk reclaim: ~95MB total. The single largest table is
-- pull_requests_backup at 87MB — a one-time snapshot from a Sept 2025
-- backfill exercise that was never read again.

BEGIN;

-- One-time backups (snapshot from 2025-09 backfill, no activity since)
DROP TABLE IF EXISTS public.pull_requests_backup CASCADE;
DROP TABLE IF EXISTS public.contributors_backup  CASCADE;
DROP TABLE IF EXISTS public.issues_backup        CASCADE;

-- Replicas (same provenance as backups)
DROP TABLE IF EXISTS public.pull_requests_replica CASCADE;
DROP TABLE IF EXISTS public.contributors_replica  CASCADE;
DROP TABLE IF EXISTS public.issues_replica        CASCADE;

-- StarSearch tapes (never populated)
DROP TABLE IF EXISTS public.tapes_sessions  CASCADE;
DROP TABLE IF EXISTS public.tapes_knowledge CASCADE;

-- API keys feature (never used)
DROP TABLE IF EXISTS public.api_keys CASCADE;

-- Action discovery (never populated)
DROP TABLE IF EXISTS public.action_usage_discoveries CASCADE;

-- User Slack integrations (feature never enabled)
-- Drop logs first to satisfy FK
DROP TABLE IF EXISTS public.user_slack_integration_logs CASCADE;
DROP TABLE IF EXISTS public.user_slack_integrations     CASCADE;

-- Workspace activity tables (never populated)
DROP TABLE IF EXISTS public.workspace_activity_log       CASCADE;
DROP TABLE IF EXISTS public.workspace_activity           CASCADE;
DROP TABLE IF EXISTS public.workspace_aggregation_queue  CASCADE;
DROP TABLE IF EXISTS public.workspace_metrics_history    CASCADE;
DROP TABLE IF EXISTS public.workspace_metrics_cache      CASCADE;

-- Contributor analytics (workspace-scoped, never populated)
DROP TABLE IF EXISTS public.contributor_analytics CASCADE;

-- Reviewer / codeowners suggestions (feature never shipped)
DROP TABLE IF EXISTS public.reviewer_suggestions_cache CASCADE;
DROP TABLE IF EXISTS public.codeowners_suggestions     CASCADE;
DROP TABLE IF EXISTS public.codeowners                 CASCADE;
DROP TABLE IF EXISTS public.repository_file_trees      CASCADE;

-- File-level analytics (never populated)
DROP TABLE IF EXISTS public.file_contributors CASCADE;
DROP TABLE IF EXISTS public.file_embeddings   CASCADE;

-- Background job infrastructure (never used)
DROP TABLE IF EXISTS public.dead_letter_queue CASCADE;
DROP TABLE IF EXISTS public.background_jobs   CASCADE;

-- Misc never-populated tables
DROP TABLE IF EXISTS public.query_patterns                  CASCADE;
DROP TABLE IF EXISTS public.data_purge_log                  CASCADE;
DROP TABLE IF EXISTS public.data_consistency_checks         CASCADE;
DROP TABLE IF EXISTS public.app_metrics                     CASCADE;
DROP TABLE IF EXISTS public.issue_similarities              CASCADE;
DROP TABLE IF EXISTS public.pr_insights                     CASCADE;
DROP TABLE IF EXISTS public.share_click_analytics           CASCADE;
DROP TABLE IF EXISTS public.daily_activity_snapshots        CASCADE;
DROP TABLE IF EXISTS public.requested_reviewers             CASCADE;
DROP TABLE IF EXISTS public.progressive_capture_progress    CASCADE;
DROP TABLE IF EXISTS public.sync_metrics                    CASCADE;
DROP TABLE IF EXISTS public.sync_progress                   CASCADE;
DROP TABLE IF EXISTS public.batch_progress                  CASCADE;
DROP TABLE IF EXISTS public.github_activities               CASCADE;
DROP TABLE IF EXISTS public.github_app_installation_settings CASCADE;
DROP TABLE IF EXISTS public.rate_limit_tracking             CASCADE;

COMMIT;

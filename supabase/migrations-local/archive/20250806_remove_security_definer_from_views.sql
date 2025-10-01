-- Local-safe version of 20250806_remove_security_definer_from_views.sql
-- Generated: 2025-08-27T02:47:08.062Z
-- This migration has been modified to work without auth, roles, and extensions
-- Original migration may have different behavior in production

-- Transaction wrapper for safety
BEGIN;


-- Ensure anon exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon;
    RAISE NOTICE 'Created missing role: anon';
  END IF;
END $$;

-- Ensure authenticated exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated;
    RAISE NOTICE 'Created missing role: authenticated';
  END IF;
END $$;

-- Ensure service_role exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role;
    RAISE NOTICE 'Created missing role: service_role';
  END IF;
END $$;

-- Remove SECURITY DEFINER from all views to comply with Supabase security best practices
-- This migration drops and recreates views without SECURITY DEFINER to ensure RLS policies are properly enforced

-- 1. Drop and recreate progressive_capture_stats view
DROP VIEW IF EXISTS progressive_capture_stats;
CREATE VIEW progressive_capture_stats AS
SELECT 
  processor_type,
  status,
  COUNT(*) as count,
  MIN(created_at) as oldest_job,
  MAX(created_at) as newest_job,
  AVG(EXTRACT(epoch FROM (completed_at - started_at)) / 60) as avg_duration_minutes
FROM progressive_capture_jobs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY processor_type, status;

-- 2. Drop and recreate repository_top_contributors view
DROP VIEW IF EXISTS repository_top_contributors;
CREATE VIEW repository_top_contributors AS
SELECT 
  fc.repository_id,
  fc.contributor_id,
  c.username,
  c.display_name,
  c.avatar_url,
  COUNT(DISTINCT fc.file_path) as files_contributed_to,
  SUM(fc.commit_count) as total_commits,
  SUM(fc.additions) as total_additions,
  SUM(fc.deletions) as total_deletions,
  MAX(fc.last_commit_at) as last_active
FROM file_contributors fc
JOIN contributors c ON fc.contributor_id = c.id
GROUP BY fc.repository_id, fc.contributor_id, c.username, c.display_name, c.avatar_url
ORDER BY fc.repository_id, SUM(fc.commit_count) DESC;

-- 3. Drop and recreate contributor_stats view
DROP VIEW IF EXISTS contributor_stats;
CREATE VIEW contributor_stats AS
SELECT 
    c.id,
    c.username,
    c.display_name,
    c.avatar_url,
    c.github_id,
    COUNT(DISTINCT pr.id) as total_pull_requests,
    COUNT(DISTINCT pr.id) FILTER (WHERE pr.state = 'closed' AND pr.merged = TRUE) as merged_pull_requests,
    COUNT(DISTINCT r.id) as total_reviews,
    COUNT(DISTINCT cm.id) as total_comments,
    COUNT(DISTINCT pr.repository_id) as repositories_contributed,
    SUM(pr.additions) as total_lines_added,
    SUM(pr.deletions) as total_lines_removed,
    MIN(pr.created_at) as first_contribution,
    MAX(pr.created_at) as last_contribution,
    c.first_seen_at,
    c.last_updated_at,
    c.is_active
FROM contributors c
LEFT JOIN pull_requests pr ON c.id = pr.author_id
LEFT JOIN reviews r ON c.id = r.reviewer_id
LEFT JOIN comments cm ON c.id = cm.commenter_id
WHERE c.is_active = TRUE AND c.is_bot = FALSE
GROUP BY c.id, c.username, c.display_name, c.avatar_url, c.github_id, c.first_seen_at, c.last_updated_at, c.is_active;

-- 4. Drop and recreate repository_stats view
DROP VIEW IF EXISTS repository_stats;
CREATE VIEW repository_stats AS
SELECT 
    r.id,
    r.full_name,
    r.owner,
    r.name,
    r.description,
    r.language,
    r.stargazers_count,
    r.forks_count,
    COUNT(DISTINCT pr.id) as total_pull_requests,
    COUNT(DISTINCT pr.id) FILTER (WHERE pr.state = 'closed' AND pr.merged = TRUE) as merged_pull_requests,
    COUNT(DISTINCT pr.author_id) as unique_contributors,
    COUNT(DISTINCT rv.id) as total_reviews,
    COUNT(DISTINCT cm.id) as total_comments,
    SUM(pr.additions) as total_lines_added,
    SUM(pr.deletions) as total_lines_removed,
    MIN(pr.created_at) as first_contribution,
    MAX(pr.created_at) as last_contribution,
    r.github_created_at,
    r.first_tracked_at,
    r.last_updated_at,
    r.is_active
FROM repositories r
LEFT JOIN pull_requests pr ON r.id = pr.repository_id
LEFT JOIN reviews rv ON pr.id = rv.pull_request_id
LEFT JOIN comments cm ON pr.id = cm.pull_request_id
WHERE r.is_active = TRUE
GROUP BY r.id, r.full_name, r.owner, r.name, r.description, r.language, 
         r.stargazers_count, r.forks_count, r.github_created_at, 
         r.first_tracked_at, r.last_updated_at, r.is_active;

-- 5. Drop and recreate recent_activity view
DROP VIEW IF EXISTS recent_activity;
CREATE VIEW recent_activity AS
SELECT 
    'pull_request' as activity_type,
    pr.id,
    pr.title as description,
    pr.html_url as url,
    pr.author_id as contributor_id,
    c.username,
    c.avatar_url,
    pr.repository_id,
    repo.full_name as repository_name,
    pr.created_at as activity_date,
    pr.state,
    pr.merged
FROM pull_requests pr
JOIN contributors c ON pr.author_id = c.id
JOIN repositories repo ON pr.repository_id = repo.id
WHERE pr.created_at >= NOW() - INTERVAL '30 days'
  AND c.is_active = TRUE 
  AND c.is_bot = FALSE
  AND repo.is_active = TRUE

UNION ALL

SELECT 
    'review' as activity_type,
    r.id,
    'Review: ' || COALESCE(r.state, 'PENDING') as description,
    pr.html_url as url,
    r.reviewer_id as contributor_id,
    c.username,
    c.avatar_url,
    pr.repository_id,
    repo.full_name as repository_name,
    r.submitted_at as activity_date,
    r.state,
    NULL as merged
FROM reviews r
JOIN contributors c ON r.reviewer_id = c.id
JOIN pull_requests pr ON r.pull_request_id = pr.id
JOIN repositories repo ON pr.repository_id = repo.id
WHERE r.submitted_at >= NOW() - INTERVAL '30 days'
  AND c.is_active = TRUE 
  AND c.is_bot = FALSE
  AND repo.is_active = TRUE

ORDER BY activity_date DESC;

-- 6. Drop and recreate share_analytics_summary view
DROP VIEW IF EXISTS share_analytics_summary;
CREATE VIEW share_analytics_summary AS
SELECT 
  se.id,
  se.chart_type,
  se.repository,
  se.action,
  se.share_type,
  se.domain,
  se.short_url,
  se.created_at,
  sca.total_clicks,
  sca.unique_clicks,
  CASE 
    WHEN se.short_url IS NOT NULL THEN TRUE
    ELSE FALSE
  END as is_shortened
FROM share_events se
LEFT JOIN share_click_analytics sca ON se.dub_link_id = sca.dub_link_id
ORDER BY se.created_at DESC;

-- 7. Drop and recreate upcoming_data_purge view
DROP VIEW IF EXISTS upcoming_data_purge;
CREATE VIEW upcoming_data_purge AS
SELECT 
  'file_contributors' as table_name,
  COUNT(*) as records_to_purge,
  MIN(purge_after) as earliest_purge_date
FROM file_contributors
WHERE purge_after <= NOW() + INTERVAL '7 days'

UNION ALL

SELECT 
  'file_embeddings' as table_name,
  COUNT(*) as records_to_purge,
  MIN(purge_after) as earliest_purge_date
FROM file_embeddings
WHERE purge_after <= NOW() + INTERVAL '7 days'

UNION ALL

SELECT 
  'pr_insights' as table_name,
  COUNT(*) as records_to_purge,
  MIN(generated_at + INTERVAL '30 days') as earliest_purge_date
FROM pr_insights
WHERE generated_at <= NOW() - INTERVAL '23 days';

-- 8. Drop and recreate admin_check view
DROP VIEW IF EXISTS admin_check;
CREATE VIEW admin_check AS
SELECT 
  auth_user_id,
  is_admin
FROM app_users
WHERE is_admin = TRUE;

-- 9. Drop and recreate backfill_progress_summary view
DROP VIEW IF EXISTS backfill_progress_summary;
CREATE VIEW backfill_progress_summary AS
SELECT 
  r.owner,
  r.name,
  pbs.id as backfill_id,
  pbs.status,
  pbs.total_prs,
  pbs.processed_prs,
  CASE 
    WHEN pbs.total_prs > 0 THEN ROUND((pbs.processed_prs::NUMERIC / pbs.total_prs::NUMERIC) * 100, 2)
    ELSE 0
  END as progress_percentage,
  pbs.chunk_size,
  pbs.error_count,
  pbs.last_processed_at,
  pbs.created_at,
  pbs.updated_at,
  COALESCE(
    (SELECT COUNT(*) FROM backfill_chunks WHERE backfill_state_id = pbs.id AND status = 'completed'),
    0
  ) as completed_chunks,
  COALESCE(
    (SELECT COUNT(*) FROM backfill_chunks WHERE backfill_state_id = pbs.id AND status = 'failed'),
    0
  ) as failed_chunks,
  COALESCE(
    (SELECT AVG(processing_time_ms)::INTEGER FROM backfill_chunks WHERE backfill_state_id = pbs.id AND status = 'completed'),
    0
  ) as avg_chunk_processing_time_ms
FROM progressive_backfill_state pbs
JOIN repositories r ON pbs.repository_id = r.id
ORDER BY pbs.created_at DESC;

-- DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    Grant appropriate permissions to ensure views work correctly
GRANT SELECT ON progressive_capture_stats TO anon, authenticated, service_role;
  ELSE
    RAISE NOTICE 'Role anon not found, skipping grant';
  END IF;
END $;
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT ON repository_top_contributors TO anon, authenticated, service_role;
  ELSE
    RAISE NOTICE 'Role anon not found, skipping grant';
  END IF;
END $;
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT ON contributor_stats TO anon, authenticated, service_role;
  ELSE
    RAISE NOTICE 'Role anon not found, skipping grant';
  END IF;
END $;
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT ON repository_stats TO anon, authenticated, service_role;
  ELSE
    RAISE NOTICE 'Role anon not found, skipping grant';
  END IF;
END $;
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT ON recent_activity TO anon, authenticated, service_role;
  ELSE
    RAISE NOTICE 'Role anon not found, skipping grant';
  END IF;
END $;
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT ON share_analytics_summary TO anon, authenticated, service_role;
  ELSE
    RAISE NOTICE 'Role anon not found, skipping grant';
  END IF;
END $;
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT ON upcoming_data_purge TO anon, authenticated, service_role;
  ELSE
    RAISE NOTICE 'Role anon not found, skipping grant';
  END IF;
END $;
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT ON admin_check TO anon, authenticated, service_role;
  ELSE
    RAISE NOTICE 'Role anon not found, skipping grant';
  END IF;
END $;
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT ON backfill_progress_summary TO anon, authenticated, service_role;
  ELSE
    RAISE NOTICE 'Role anon not found, skipping grant';
  END IF;
END $;

-- Add comments to document the purpose of these views
COMMENT ON VIEW progressive_capture_stats IS 'Statistics for progressive capture jobs without SECURITY DEFINER';
COMMENT ON VIEW repository_top_contributors IS 'Top contributors by repository based on file contributions without SECURITY DEFINER';
COMMENT ON VIEW contributor_stats IS 'Aggregated contributor statistics without SECURITY DEFINER';
COMMENT ON VIEW repository_stats IS 'Aggregated repository statistics without SECURITY DEFINER';
COMMENT ON VIEW recent_activity IS 'Recent contributor activity (last 30 days) without SECURITY DEFINER';
COMMENT ON VIEW share_analytics_summary IS 'Summary of share events and click analytics without SECURITY DEFINER';
COMMENT ON VIEW upcoming_data_purge IS 'Data scheduled for purging in the next 7 days without SECURITY DEFINER';
COMMENT ON VIEW admin_check IS 'View to check admin users without SECURITY DEFINER';
COMMENT ON VIEW backfill_progress_summary IS 'Summary of progressive backfill progress without SECURITY DEFINER';

COMMIT;

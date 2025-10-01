-- Local-safe version of 20250126_fix_all_rls_issues.sql
-- Generated: 2025-08-27T02:47:08.047Z
-- This migration has been modified to work without auth, roles, and extensions
-- Original migration may have different behavior in production

-- Transaction wrapper for safety
BEGIN;


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

-- Migration: Fix all RLS issues while preserving logged-out user experience
-- This migration addresses all RLS errors from the Supabase linter
-- Date: 2025-01-26

-- =====================================================
-- STEP 1: Fix SECURITY DEFINER Views
-- =====================================================

-- Drop and recreate views without SECURITY DEFINER
-- This allows views to respect the querying user's RLS policies

-- Fix contributor_stats view
DROP VIEW IF EXISTS contributor_stats CASCADE;
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

-- Fix repository_stats view
DROP VIEW IF EXISTS repository_stats CASCADE;
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

-- Fix recent_activity view
DROP VIEW IF EXISTS recent_activity CASCADE;
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

-- Fix share_analytics_summary view
DROP VIEW IF EXISTS share_analytics_summary CASCADE;
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

-- =====================================================
-- STEP 2: Enable RLS on all missing tables
-- =====================================================

-- Enable RLS on tables that don't have it yet
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributor_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_activity_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE pull_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributors ENABLE ROW LEVEL SECURITY;

-- Enable RLS on new tables
ALTER TABLE contributor_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_sync_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributor_role_history ENABLE ROW LEVEL SECURITY;

-- Enable RLS on partition tables
ALTER TABLE github_events_cache_2025_01 ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_events_cache_2025_02 ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_events_cache_2025_03 ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_events_cache_2025_06 ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 3: Create public read policies for all tables
-- =====================================================

-- Drop existing policies if they exist to avoid conflicts
DO $$ 
BEGIN
    -- Reviews policies
    DROP POLICY IF EXISTS "public_read_reviews" ON reviews;
    DROP POLICY IF EXISTS "auth_insert_reviews" ON reviews;
    DROP POLICY IF EXISTS "auth_update_reviews" ON reviews;
    DROP POLICY IF EXISTS "service_delete_reviews" ON reviews;
    
    -- Comments policies
    DROP POLICY IF EXISTS "public_read_comments" ON comments;
    DROP POLICY IF EXISTS "auth_insert_comments" ON comments;
    DROP POLICY IF EXISTS "auth_update_comments" ON comments;
    DROP POLICY IF EXISTS "service_delete_comments" ON comments;
    
    -- Organizations policies
    DROP POLICY IF EXISTS "public_read_organizations" ON organizations;
    DROP POLICY IF EXISTS "auth_insert_organizations" ON organizations;
    DROP POLICY IF EXISTS "auth_update_organizations" ON organizations;
    DROP POLICY IF EXISTS "service_delete_organizations" ON organizations;
    
    -- Contributor Organizations policies
    DROP POLICY IF EXISTS "public_read_contributor_organizations" ON contributor_organizations;
    DROP POLICY IF EXISTS "auth_manage_contributor_organizations" ON contributor_organizations;
    
    -- Monthly Rankings policies
    DROP POLICY IF EXISTS "public_read_monthly_rankings" ON monthly_rankings;
    DROP POLICY IF EXISTS "auth_insert_monthly_rankings" ON monthly_rankings;
    DROP POLICY IF EXISTS "auth_update_monthly_rankings" ON monthly_rankings;
    DROP POLICY IF EXISTS "service_delete_monthly_rankings" ON monthly_rankings;
    
    -- Daily Activity policies
    DROP POLICY IF EXISTS "public_read_daily_activity_snapshots" ON daily_activity_snapshots;
    DROP POLICY IF EXISTS "auth_insert_daily_activity_snapshots" ON daily_activity_snapshots;
    DROP POLICY IF EXISTS "auth_update_daily_activity_snapshots" ON daily_activity_snapshots;
    DROP POLICY IF EXISTS "service_delete_daily_activity_snapshots" ON daily_activity_snapshots;
    
    -- Sync Logs policies
    DROP POLICY IF EXISTS "auth_read_sync_logs" ON sync_logs;
    DROP POLICY IF EXISTS "service_manage_sync_logs" ON sync_logs;
    
    -- Repositories policies
    DROP POLICY IF EXISTS "public_read_repositories" ON repositories;
    DROP POLICY IF EXISTS "auth_insert_repositories" ON repositories;
    DROP POLICY IF EXISTS "auth_update_repositories" ON repositories;
    DROP POLICY IF EXISTS "service_delete_repositories" ON repositories;
    
    -- Pull Requests policies
    DROP POLICY IF EXISTS "public_read_pull_requests" ON pull_requests;
    DROP POLICY IF EXISTS "auth_insert_pull_requests" ON pull_requests;
    DROP POLICY IF EXISTS "auth_update_pull_requests" ON pull_requests;
    DROP POLICY IF EXISTS "service_delete_pull_requests" ON pull_requests;
    
    -- Contributors policies
    DROP POLICY IF EXISTS "public_read_contributors" ON contributors;
    DROP POLICY IF EXISTS "auth_insert_contributors" ON contributors;
    DROP POLICY IF EXISTS "auth_update_contributors" ON contributors;
    DROP POLICY IF EXISTS "service_delete_contributors" ON contributors;
    
    -- New tables policies
    DROP POLICY IF EXISTS "public_read_contributor_roles" ON contributor_roles;
    DROP POLICY IF EXISTS "public_read_github_sync_status" ON github_sync_status;
    DROP POLICY IF EXISTS "public_read_contributor_role_history" ON contributor_role_history;
    
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;

-- Create public read policies for all tables
CREATE POLICY "public_read_reviews" ON reviews FOR SELECT USING (true);
CREATE POLICY "public_read_comments" ON comments FOR SELECT USING (true);
CREATE POLICY "public_read_organizations" ON organizations FOR SELECT USING (true);
CREATE POLICY "public_read_contributor_organizations" ON contributor_organizations FOR SELECT USING (true);
CREATE POLICY "public_read_monthly_rankings" ON monthly_rankings FOR SELECT USING (true);
CREATE POLICY "public_read_daily_activity_snapshots" ON daily_activity_snapshots FOR SELECT USING (true);
CREATE POLICY "public_read_sync_logs" ON sync_logs FOR SELECT USING (true);
CREATE POLICY "public_read_repositories" ON repositories FOR SELECT USING (true);
CREATE POLICY "public_read_pull_requests" ON pull_requests FOR SELECT USING (true);
CREATE POLICY "public_read_contributors" ON contributors FOR SELECT USING (true);

-- Public read for new tables
CREATE POLICY "public_read_contributor_roles" ON contributor_roles FOR SELECT USING (true);
CREATE POLICY "public_read_github_sync_status" ON github_sync_status FOR SELECT USING (true);
CREATE POLICY "public_read_contributor_role_history" ON contributor_role_history FOR SELECT USING (true);

-- Public read for github events cache partitions
CREATE POLICY "public_read_github_events_2025_01" ON github_events_cache_2025_01 FOR SELECT USING (true);
CREATE POLICY "public_read_github_events_2025_02" ON github_events_cache_2025_02 FOR SELECT USING (true);
CREATE POLICY "public_read_github_events_2025_03" ON github_events_cache_2025_03 FOR SELECT USING (true);
CREATE POLICY "public_read_github_events_2025_06" ON github_events_cache_2025_06 FOR SELECT USING (true);

-- =====================================================
-- STEP 4: Create write policies for authenticated users
-- =====================================================

-- Reviews write policies
CREATE POLICY "auth_insert_reviews" ON reviews FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_reviews" ON reviews FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Comments write policies
CREATE POLICY "auth_insert_comments" ON comments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_comments" ON comments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Organizations write policies
CREATE POLICY "auth_insert_organizations" ON organizations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_organizations" ON organizations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Contributor Organizations write policies
CREATE POLICY "auth_manage_contributor_organizations" ON contributor_organizations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Monthly Rankings write policies
CREATE POLICY "auth_insert_monthly_rankings" ON monthly_rankings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_monthly_rankings" ON monthly_rankings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Daily Activity write policies
CREATE POLICY "auth_insert_daily_activity_snapshots" ON daily_activity_snapshots FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_daily_activity_snapshots" ON daily_activity_snapshots FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Repositories write policies
CREATE POLICY "auth_insert_repositories" ON repositories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_repositories" ON repositories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Pull Requests write policies
CREATE POLICY "auth_insert_pull_requests" ON pull_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_pull_requests" ON pull_requests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Contributors write policies
CREATE POLICY "auth_insert_contributors" ON contributors FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_contributors" ON contributors FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- New tables write policies
CREATE POLICY "auth_write_contributor_roles" ON contributor_roles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_write_github_sync_status" ON github_sync_status FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_write_contributor_role_history" ON contributor_role_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Github events cache write policies
CREATE POLICY "auth_write_github_events_2025_01" ON github_events_cache_2025_01 FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_write_github_events_2025_02" ON github_events_cache_2025_02 FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_write_github_events_2025_03" ON github_events_cache_2025_03 FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_write_github_events_2025_06" ON github_events_cache_2025_06 FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- STEP 5: Service role policies for administrative tasks
-- =====================================================

-- Service role delete policies
CREATE POLICY "service_delete_reviews" ON reviews FOR DELETE TO service_role USING (true);
CREATE POLICY "service_delete_comments" ON comments FOR DELETE TO service_role USING (true);
CREATE POLICY "service_delete_organizations" ON organizations FOR DELETE TO service_role USING (true);
CREATE POLICY "service_delete_monthly_rankings" ON monthly_rankings FOR DELETE TO service_role USING (true);
CREATE POLICY "service_delete_daily_activity_snapshots" ON daily_activity_snapshots FOR DELETE TO service_role USING (true);
CREATE POLICY "service_delete_repositories" ON repositories FOR DELETE TO service_role USING (true);
CREATE POLICY "service_delete_pull_requests" ON pull_requests FOR DELETE TO service_role USING (true);
CREATE POLICY "service_delete_contributors" ON contributors FOR DELETE TO service_role USING (true);

-- Service role full access for sync logs
CREATE POLICY "service_manage_sync_logs" ON sync_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================
-- STEP 6: Grant appropriate permissions
-- =====================================================

-- Grant read permissions to public on views
GRANT SELECT ON contributor_stats TO PUBLIC;
GRANT SELECT ON repository_stats TO PUBLIC;
GRANT SELECT ON recent_activity TO PUBLIC;
GRANT SELECT ON share_analytics_summary TO PUBLIC;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify RLS is enabled on all tables
SELECT 
    schemaname,
    tablename,
    CASE 
        WHEN rowsecurity THEN 'Γ£à RLS Enabled'
        ELSE 'Γ¥î RLS Disabled'
    END as rls_status
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename NOT LIKE 'pg_%'
AND tablename NOT IN ('schema_migrations', 'migrations')
ORDER BY tablename;

-- Count policies per table
SELECT 
    schemaname,
    tablename,
    COUNT(*) as policy_count,
    string_agg(policyname, ', ' ORDER BY policyname) as policies
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;

-- Check for SECURITY DEFINER views
SELECT 
    schemaname,
    viewname,
    CASE 
        WHEN definition ILIKE '%SECURITY DEFINER%' THEN 'Γ¥î Has SECURITY DEFINER'
        ELSE 'Γ£à No SECURITY DEFINER'
    END as security_status
FROM pg_views
WHERE schemaname = 'public'
ORDER BY viewname;

COMMIT;

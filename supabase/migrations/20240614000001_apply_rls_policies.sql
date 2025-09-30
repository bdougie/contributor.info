-- Row Level Security (RLS) Implementation for Contributor.info
-- This preserves the progressive onboarding experience by allowing public read access

-- =====================================================
-- STEP 1: ENABLE RLS ON ALL TABLES
-- =====================================================

ALTER TABLE contributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE pull_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributor_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracked_repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_activity_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 2: PUBLIC READ ACCESS (Preserves Progressive Onboarding)
-- =====================================================

-- Contributors - Anyone can view contributor data
CREATE POLICY "public_read_contributors"
ON contributors FOR SELECT
USING (true);

-- Repositories - Anyone can view repository data
CREATE POLICY "public_read_repositories"
ON repositories FOR SELECT
USING (true);

-- Pull Requests - Anyone can view PR data
CREATE POLICY "public_read_pull_requests"
ON pull_requests FOR SELECT
USING (true);

-- Reviews - Anyone can view review data
CREATE POLICY "public_read_reviews"
ON reviews FOR SELECT
USING (true);

-- Comments - Anyone can view comment data
CREATE POLICY "public_read_comments"
ON comments FOR SELECT
USING (true);

-- Organizations - Anyone can view organization data
CREATE POLICY "public_read_organizations"
ON organizations FOR SELECT
USING (true);

-- Contributor Organizations - Anyone can view relationships
CREATE POLICY "public_read_contributor_organizations"
ON contributor_organizations FOR SELECT
USING (true);

-- Tracked Repositories - Anyone can see which repos are tracked
CREATE POLICY "public_read_tracked_repositories"
ON tracked_repositories FOR SELECT
USING (true);

-- Monthly Rankings - Anyone can view rankings
CREATE POLICY "public_read_monthly_rankings"
ON monthly_rankings FOR SELECT
USING (true);

-- Daily Activity - Anyone can view activity data
CREATE POLICY "public_read_daily_activity_snapshots"
ON daily_activity_snapshots FOR SELECT
USING (true);

-- =====================================================
-- STEP 3: WRITE ACCESS (For Data Sync via Inngest/Service Role)
-- =====================================================
-- Only authenticated and service_role can write data
-- Anonymous users have read-only access for security

-- Contributors - Allow service role and authenticated users to modify
CREATE POLICY "service_and_auth_insert_contributors"
ON contributors FOR INSERT
TO authenticated, service_role
WITH CHECK (true);

CREATE POLICY "service_and_auth_update_contributors"
ON contributors FOR UPDATE
TO authenticated, service_role
USING (true)
WITH CHECK (true);

-- Repositories - Allow service role and authenticated users to modify
CREATE POLICY "service_and_auth_insert_repositories"
ON repositories FOR INSERT
TO authenticated, service_role
WITH CHECK (true);

CREATE POLICY "service_and_auth_update_repositories"
ON repositories FOR UPDATE
TO authenticated, service_role
USING (true)
WITH CHECK (true);

-- Pull Requests - Allow service role and authenticated users to modify
CREATE POLICY "service_and_auth_insert_pull_requests"
ON pull_requests FOR INSERT
TO authenticated, service_role
WITH CHECK (true);

CREATE POLICY "service_and_auth_update_pull_requests"
ON pull_requests FOR UPDATE
TO authenticated, service_role
USING (true)
WITH CHECK (true);

-- Reviews - Allow service role and authenticated users to modify
CREATE POLICY "service_and_auth_insert_reviews"
ON reviews FOR INSERT
TO authenticated, service_role
WITH CHECK (true);

CREATE POLICY "service_and_auth_update_reviews"
ON reviews FOR UPDATE
TO authenticated, service_role
USING (true)
WITH CHECK (true);

-- Comments - Allow service role and authenticated users to modify
CREATE POLICY "service_and_auth_insert_comments"
ON comments FOR INSERT
TO authenticated, service_role
WITH CHECK (true);

CREATE POLICY "service_and_auth_update_comments"
ON comments FOR UPDATE
TO authenticated, service_role
USING (true)
WITH CHECK (true);

-- Organizations - Allow service role and authenticated users to modify
CREATE POLICY "service_and_auth_insert_organizations"
ON organizations FOR INSERT
TO authenticated, service_role
WITH CHECK (true);

CREATE POLICY "service_and_auth_update_organizations"
ON organizations FOR UPDATE
TO authenticated, service_role
USING (true)
WITH CHECK (true);

-- Contributor Organizations - Authenticated users can manage
CREATE POLICY "auth_manage_contributor_organizations"
ON contributor_organizations FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Monthly Rankings - Allow service role and authenticated users to modify
CREATE POLICY "service_and_auth_insert_monthly_rankings"
ON monthly_rankings FOR INSERT
TO authenticated, service_role
WITH CHECK (true);

CREATE POLICY "service_and_auth_update_monthly_rankings"
ON monthly_rankings FOR UPDATE
TO authenticated, service_role
USING (true)
WITH CHECK (true);

-- Daily Activity - Allow service role and authenticated users to modify
CREATE POLICY "service_and_auth_insert_daily_activity_snapshots"
ON daily_activity_snapshots FOR INSERT
TO authenticated, service_role
WITH CHECK (true);

CREATE POLICY "service_and_auth_update_daily_activity_snapshots"
ON daily_activity_snapshots FOR UPDATE
TO authenticated, service_role
USING (true)
WITH CHECK (true);

-- =====================================================
-- STEP 4: SERVICE ROLE ADMIN ACCESS
-- =====================================================

-- Tracked Repositories - Only service role can manage
CREATE POLICY "service_manage_tracked_repositories"
ON tracked_repositories FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Sync Logs - Only service role can access
CREATE POLICY "service_manage_sync_logs"
ON sync_logs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Optional: Let authenticated users view sync status
CREATE POLICY "auth_read_sync_logs"
ON sync_logs FOR SELECT
TO authenticated
USING (true);

-- Service role can delete records (for cleanup)
CREATE POLICY "service_delete_contributors"
ON contributors FOR DELETE
TO service_role
USING (true);

CREATE POLICY "service_delete_repositories"
ON repositories FOR DELETE
TO service_role
USING (true);

CREATE POLICY "service_delete_pull_requests"
ON pull_requests FOR DELETE
TO service_role
USING (true);

CREATE POLICY "service_delete_reviews"
ON reviews FOR DELETE
TO service_role
USING (true);

CREATE POLICY "service_delete_comments"
ON comments FOR DELETE
TO service_role
USING (true);

CREATE POLICY "service_delete_organizations"
ON organizations FOR DELETE
TO service_role
USING (true);

CREATE POLICY "service_delete_monthly_rankings"
ON monthly_rankings FOR DELETE
TO service_role
USING (true);

CREATE POLICY "service_delete_daily_activity_snapshots"
ON daily_activity_snapshots FOR DELETE
TO service_role
USING (true);

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check RLS is enabled on all tables
SELECT 
    tablename,
    CASE 
        WHEN rowsecurity THEN '✅ RLS Enabled'
        ELSE '❌ RLS Disabled'
    END as rls_status
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- Count policies per table
SELECT 
    tablename,
    COUNT(*) as policy_count,
    string_agg(policyname, ', ') as policies
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
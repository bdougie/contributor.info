-- Migration: Cleanup unused tables and fix remaining security issues
-- Date: 2025-01-13
-- Issue Reference: https://github.com/bdougie/contributor.info/issues/401
-- 
-- IMPORTANT: Create a backup of the production database before running this migration
-- Command: pg_dump -h db.egcxzonpmmcirmgqdrla.supabase.co -U postgres -d postgres > backup_20250113.sql
--
-- This migration:
-- 1. Drops unused tables that have no references in the codebase
-- 2. Enables RLS on all remaining unprotected tables
-- 3. Preserves billing tables for future implementation (Issue #401)

-- =====================================================
-- STEP 1: Drop Unused Tables
-- =====================================================

-- Drop old data loading tool artifacts (_dlt tables)
DROP TABLE IF EXISTS _dlt_loads CASCADE;
DROP TABLE IF EXISTS _dlt_pipeline_state CASCADE;
DROP TABLE IF EXISTS _dlt_version CASCADE;

-- Drop backup tables no longer needed
DROP TABLE IF EXISTS fresh_events_backup_final CASCADE;

-- Drop deprecated tables
DROP TABLE IF EXISTS github_issue_comments CASCADE; -- Replaced by comments table
DROP TABLE IF EXISTS daily_activity_metrics CASCADE;
DROP TABLE IF EXISTS workspace_issues_cache CASCADE;

-- Drop old monthly event cache partitions
DROP TABLE IF EXISTS github_events_cache_202507 CASCADE;
DROP TABLE IF EXISTS github_events_cache_202508 CASCADE;

-- Drop future partitions not yet needed (we'll create them when the time comes)
DROP TABLE IF EXISTS github_events_cache_2025_09 CASCADE;
DROP TABLE IF EXISTS github_events_cache_2025_10 CASCADE;

-- Drop unused feature tables
DROP TABLE IF EXISTS email_logs CASCADE;
DROP TABLE IF EXISTS email_notifications CASCADE;
DROP TABLE IF EXISTS gdpr_processing_log CASCADE;
DROP TABLE IF EXISTS admin_action_logs CASCADE;

-- Drop unused views
DROP VIEW IF EXISTS upcoming_data_purge CASCADE;

-- =====================================================
-- STEP 2: Enable RLS on Remaining Unprotected Tables
-- =====================================================

-- Enable RLS on workspace_tracked_repositories
ALTER TABLE workspace_tracked_repositories ENABLE ROW LEVEL SECURITY;

-- Create policy for workspace_tracked_repositories (public read, authenticated write)
CREATE POLICY "workspace_tracked_repositories_read_policy" ON workspace_tracked_repositories
    FOR SELECT USING (true);

CREATE POLICY "workspace_tracked_repositories_write_policy" ON workspace_tracked_repositories
    FOR ALL USING (auth.uid() IS NOT NULL);

-- Enable RLS on active github_events_cache partitions
ALTER TABLE github_events_cache_2025_01 ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_events_cache_2025_02 ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_events_cache_2025_03 ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_events_cache_2025_06 ENABLE ROW LEVEL SECURITY;

-- Create policies for github_events_cache partitions (public read only)
CREATE POLICY "github_events_cache_2025_01_read_policy" ON github_events_cache_2025_01
    FOR SELECT USING (true);

CREATE POLICY "github_events_cache_2025_02_read_policy" ON github_events_cache_2025_02
    FOR SELECT USING (true);

CREATE POLICY "github_events_cache_2025_03_read_policy" ON github_events_cache_2025_03
    FOR SELECT USING (true);

CREATE POLICY "github_events_cache_2025_06_read_policy" ON github_events_cache_2025_06
    FOR SELECT USING (true);

-- =====================================================
-- STEP 3: Secure Billing Tables for Future Use
-- =====================================================

-- NOTE: Keeping billing tables for future implementation
-- Reference: https://github.com/bdougie/contributor.info/issues/401
-- These tables will be used when billing features are implemented

-- Ensure RLS is enabled on billing tables (prepare for future use)
ALTER TABLE billing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tier_limits ENABLE ROW LEVEL SECURITY;

-- Create restrictive policies for billing tables (admin only when implemented)
CREATE POLICY "billing_history_admin_only" ON billing_history
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'admin'
        )
    );

CREATE POLICY "subscriptions_admin_only" ON subscriptions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'admin'
        )
    );

CREATE POLICY "tier_limits_read_policy" ON tier_limits
    FOR SELECT USING (true); -- Public read for tier information

CREATE POLICY "tier_limits_admin_write" ON tier_limits
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'admin'
        )
    );

-- =====================================================
-- STEP 4: Add Comments for Documentation
-- =====================================================

-- Document billing tables for future reference
COMMENT ON TABLE billing_history IS 'Reserved for future billing implementation - See Issue #401';
COMMENT ON TABLE subscriptions IS 'Reserved for future subscription management - See Issue #401';
COMMENT ON TABLE tier_limits IS 'Reserved for future tier-based feature limits - See Issue #401';

-- Document active event cache partitions
COMMENT ON TABLE github_events_cache_2025_01 IS 'Active partition for January 2025 GitHub events';
COMMENT ON TABLE github_events_cache_2025_02 IS 'Active partition for February 2025 GitHub events';
COMMENT ON TABLE github_events_cache_2025_03 IS 'Active partition for March 2025 GitHub events';
COMMENT ON TABLE github_events_cache_2025_06 IS 'Active partition for June 2025 GitHub events';

-- =====================================================
-- STEP 5: Verification Queries
-- =====================================================

-- After running this migration, verify with:
-- 1. Check remaining tables: SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
-- 2. Check RLS status: SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false;
-- 3. Run Supabase security advisors to confirm all issues resolved
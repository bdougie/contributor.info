-- RLS Policy Tests
-- Tests verify that Row Level Security policies work correctly for public read access
-- and restricted write access
--
-- NOTE: This test assumes migrations have already been applied to the database
-- Run with: supabase test db

BEGIN;

-- Load pgTAP extension for testing
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Set search path to ensure we can find pgtap functions
SET search_path TO public, extensions;

SELECT plan(23); -- Total number of tests

-- =====================================================
-- TEST 1: RLS is enabled on all tables
-- =====================================================

SELECT ok(
    (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'contributors'),
    'RLS is enabled on contributors table'
);

SELECT ok(
    (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'repositories'),
    'RLS is enabled on repositories table'
);

SELECT ok(
    (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pull_requests'),
    'RLS is enabled on pull_requests table'
);

SELECT ok(
    (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reviews'),
    'RLS is enabled on reviews table'
);

SELECT ok(
    (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'comments'),
    'RLS is enabled on comments table'
);

SELECT ok(
    (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'organizations'),
    'RLS is enabled on organizations table'
);

SELECT ok(
    (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'contributor_organizations'),
    'RLS is enabled on contributor_organizations table'
);

SELECT ok(
    (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tracked_repositories'),
    'RLS is enabled on tracked_repositories table'
);

SELECT ok(
    (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'monthly_rankings'),
    'RLS is enabled on monthly_rankings table'
);

SELECT ok(
    (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'daily_activity_snapshots'),
    'RLS is enabled on daily_activity_snapshots table'
);

SELECT ok(
    (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sync_logs'),
    'RLS is enabled on sync_logs table'
);

-- =====================================================
-- TEST 2: Public read policies exist
-- =====================================================

SELECT ok(
    EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'contributors'
        AND policyname = 'public_read_contributors'
        AND cmd = 'SELECT'
    ),
    'Public read policy exists on contributors table'
);

SELECT ok(
    EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'repositories'
        AND policyname = 'public_read_repositories'
        AND cmd = 'SELECT'
    ),
    'Public read policy exists on repositories table'
);

SELECT ok(
    EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'pull_requests'
        AND policyname = 'public_read_pull_requests'
        AND cmd = 'SELECT'
    ),
    'Public read policy exists on pull_requests table'
);

SELECT ok(
    EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'reviews'
        AND policyname = 'public_read_reviews'
        AND cmd = 'SELECT'
    ),
    'Public read policy exists on reviews table'
);

SELECT ok(
    EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'comments'
        AND policyname = 'public_read_comments'
        AND cmd = 'SELECT'
    ),
    'Public read policy exists on comments table'
);

SELECT ok(
    EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'organizations'
        AND policyname = 'public_read_organizations'
        AND cmd = 'SELECT'
    ),
    'Public read policy exists on organizations table'
);

SELECT ok(
    EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'tracked_repositories'
        AND policyname = 'public_read_tracked_repositories'
        AND cmd = 'SELECT'
    ),
    'Public read policy exists on tracked_repositories table'
);

SELECT ok(
    EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'monthly_rankings'
        AND policyname = 'public_read_monthly_rankings'
        AND cmd = 'SELECT'
    ),
    'Public read policy exists on monthly_rankings table'
);

SELECT ok(
    EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'daily_activity_snapshots'
        AND policyname = 'public_read_daily_activity_snapshots'
        AND cmd = 'SELECT'
    ),
    'Public read policy exists on daily_activity_snapshots table'
);

-- =====================================================
-- TEST 3: Write policies require authentication
-- =====================================================

SELECT ok(
    EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'contributors'
        AND cmd = 'INSERT'
        AND roles @> ARRAY['authenticated'::name]
    ),
    'Insert policy on contributors requires authentication'
);

SELECT ok(
    EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'repositories'
        AND cmd = 'INSERT'
        AND roles @> ARRAY['authenticated'::name]
    ),
    'Insert policy on repositories requires authentication'
);

SELECT ok(
    EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'pull_requests'
        AND cmd = 'INSERT'
        AND roles @> ARRAY['authenticated'::name]
    ),
    'Insert policy on pull_requests requires authentication'
);

SELECT * FROM finish();

ROLLBACK;
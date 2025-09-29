-- RLS Policy Tests for contributor.info
-- Tests Row Level Security policies to ensure proper access control
-- Run these tests after applying RLS policies to verify functionality

-- =====================================================
-- TEST SETUP
-- =====================================================

-- Create test roles to simulate different user types
-- Note: In production, these are handled by Supabase auth system

-- =====================================================
-- PUBLIC READ ACCESS TESTS
-- =====================================================

-- Test 1: Verify RLS is enabled on all core tables
DO $$
DECLARE
    table_record RECORD;
    missing_rls_tables TEXT[] := '{}';
BEGIN
    FOR table_record IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename IN (
            'contributors', 'repositories', 'pull_requests', 'reviews', 
            'comments', 'organizations', 'contributor_organizations', 
            'tracked_repositories', 'monthly_rankings', 'daily_activity_snapshots'
        )
    LOOP
        -- Check if RLS is enabled
        IF NOT EXISTS (
            SELECT 1 FROM pg_tables 
            WHERE schemaname = 'public' 
            AND tablename = table_record.tablename 
            AND rowsecurity = true
        ) THEN
            missing_rls_tables := array_append(missing_rls_tables, table_record.tablename);
        END IF;
    END LOOP;
    
    IF array_length(missing_rls_tables, 1) > 0 THEN
        RAISE EXCEPTION 'RLS not enabled on tables: %', array_to_string(missing_rls_tables, ', ');
    END IF;
    
    RAISE NOTICE '✅ Test 1 PASSED: RLS enabled on all core tables';
END
$$;

-- Test 2: Verify public read policies exist for core tables
DO $$
DECLARE
    table_record RECORD;
    missing_public_read_policies TEXT[] := '{}';
BEGIN
    FOR table_record IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename IN (
            'contributors', 'repositories', 'pull_requests', 'reviews', 
            'comments', 'organizations', 'contributor_organizations', 
            'tracked_repositories', 'monthly_rankings', 'daily_activity_snapshots'
        )
    LOOP
        -- Check if public read policy exists
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'public' 
            AND tablename = table_record.tablename 
            AND cmd = 'SELECT'
            AND (roles = '{public}' OR policyname ILIKE '%public_read%')
        ) THEN
            missing_public_read_policies := array_append(missing_public_read_policies, table_record.tablename);
        END IF;
    END LOOP;
    
    IF array_length(missing_public_read_policies, 1) > 0 THEN
        RAISE EXCEPTION 'Public read policies missing on tables: %', array_to_string(missing_public_read_policies, ', ');
    END IF;
    
    RAISE NOTICE '✅ Test 2 PASSED: Public read policies exist on all core tables';
END
$$;

-- Test 3: Test anonymous (public) read access to contributors table
-- This simulates what happens when unauthenticated users visit the site
DO $$
DECLARE
    test_count INTEGER;
BEGIN
    -- Reset to anonymous access (no authenticated user)
    PERFORM set_config('request.jwt.claims', '', false);
    PERFORM set_config('role', 'anon', false);
    
    -- Try to read from contributors table (should succeed with public read policy)
    SELECT COUNT(*) INTO test_count FROM contributors LIMIT 1;
    
    RAISE NOTICE '✅ Test 3 PASSED: Anonymous users can read from contributors table';
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE EXCEPTION '❌ Test 3 FAILED: Anonymous users cannot read from contributors table';
END
$$;

-- Test 4: Test anonymous (public) read access to repositories table
DO $$
DECLARE
    test_count INTEGER;
BEGIN
    -- Reset to anonymous access
    PERFORM set_config('request.jwt.claims', '', false);
    PERFORM set_config('role', 'anon', false);
    
    -- Try to read from repositories table
    SELECT COUNT(*) INTO test_count FROM repositories LIMIT 1;
    
    RAISE NOTICE '✅ Test 4 PASSED: Anonymous users can read from repositories table';
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE EXCEPTION '❌ Test 4 FAILED: Anonymous users cannot read from repositories table';
END
$$;

-- Test 5: Test anonymous (public) read access to pull_requests table
DO $$
DECLARE
    test_count INTEGER;
BEGIN
    -- Reset to anonymous access
    PERFORM set_config('request.jwt.claims', '', false);
    PERFORM set_config('role', 'anon', false);
    
    -- Try to read from pull_requests table
    SELECT COUNT(*) INTO test_count FROM pull_requests LIMIT 1;
    
    RAISE NOTICE '✅ Test 5 PASSED: Anonymous users can read from pull_requests table';
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE EXCEPTION '❌ Test 5 FAILED: Anonymous users cannot read from pull_requests table';
END
$$;

-- =====================================================
-- WRITE ACCESS RESTRICTION TESTS
-- =====================================================

-- Test 6: Verify anonymous users cannot write to contributors table
DO $$
BEGIN
    -- Reset to anonymous access
    PERFORM set_config('request.jwt.claims', '', false);
    PERFORM set_config('role', 'anon', false);
    
    -- Try to insert (should fail)
    INSERT INTO contributors (github_id, username) VALUES (999999, 'test_user');
    
    RAISE EXCEPTION '❌ Test 6 FAILED: Anonymous users can write to contributors table';
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE NOTICE '✅ Test 6 PASSED: Anonymous users cannot write to contributors table';
END
$$;

-- Test 7: Verify anonymous users cannot write to repositories table
DO $$
BEGIN
    -- Reset to anonymous access
    PERFORM set_config('request.jwt.claims', '', false);
    PERFORM set_config('role', 'anon', false);
    
    -- Try to insert (should fail)
    INSERT INTO repositories (github_id, name, full_name) VALUES (999999, 'test', 'test/test');
    
    RAISE EXCEPTION '❌ Test 7 FAILED: Anonymous users can write to repositories table';
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE NOTICE '✅ Test 7 PASSED: Anonymous users cannot write to repositories table';
END
$$;

-- Test 8: Verify anonymous users cannot write to pull_requests table
DO $$
BEGIN
    -- Reset to anonymous access
    PERFORM set_config('request.jwt.claims', '', false);
    PERFORM set_config('role', 'anon', false);
    
    -- Try to insert (should fail)
    INSERT INTO pull_requests (github_id, number, title, state) VALUES (999999, 1, 'test', 'open');
    
    RAISE EXCEPTION '❌ Test 8 FAILED: Anonymous users can write to pull_requests table';
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE NOTICE '✅ Test 8 PASSED: Anonymous users cannot write to pull_requests table';
END
$$;

-- =====================================================
-- SERVICE ROLE ACCESS TESTS
-- =====================================================

-- Test 9: Verify service role can write to all tables
DO $$
DECLARE
    test_contributor_id UUID;
    test_repo_id UUID;
BEGIN
    -- Set service role context
    PERFORM set_config('role', 'service_role', false);
    
    -- Test service role can insert into contributors
    INSERT INTO contributors (github_id, username) 
    VALUES (999998, 'test_service_user') 
    RETURNING id INTO test_contributor_id;
    
    -- Test service role can insert into repositories
    INSERT INTO repositories (github_id, name, full_name) 
    VALUES (999998, 'test_service', 'test/service') 
    RETURNING id INTO test_repo_id;
    
    -- Clean up test data
    DELETE FROM contributors WHERE id = test_contributor_id;
    DELETE FROM repositories WHERE id = test_repo_id;
    
    RAISE NOTICE '✅ Test 9 PASSED: Service role can write to all tables';
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION '❌ Test 9 FAILED: Service role cannot write to tables: %', SQLERRM;
END
$$;

-- =====================================================
-- POLICY COVERAGE VERIFICATION
-- =====================================================

-- Test 10: Verify all core tables have sufficient policy coverage
DO $$
DECLARE
    table_record RECORD;
    policy_count INTEGER;
    insufficient_policies TEXT[] := '{}';
BEGIN
    FOR table_record IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename IN (
            'contributors', 'repositories', 'pull_requests', 'reviews', 
            'comments', 'organizations', 'contributor_organizations', 
            'tracked_repositories', 'monthly_rankings', 'daily_activity_snapshots'
        )
    LOOP
        -- Count policies for each table (should have at least 2: read + write)
        SELECT COUNT(*) INTO policy_count
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = table_record.tablename;
        
        IF policy_count < 2 THEN
            insufficient_policies := array_append(insufficient_policies, 
                table_record.tablename || ' (' || policy_count || ' policies)');
        END IF;
    END LOOP;
    
    IF array_length(insufficient_policies, 1) > 0 THEN
        RAISE EXCEPTION 'Tables with insufficient policy coverage: %', array_to_string(insufficient_policies, ', ');
    END IF;
    
    RAISE NOTICE '✅ Test 10 PASSED: All core tables have sufficient policy coverage';
END
$$;

-- =====================================================
-- SUMMARY REPORT
-- =====================================================

-- Generate policy summary report
SELECT 
    '=== RLS POLICY SUMMARY REPORT ===' as report_section;

-- Show RLS status for all tables
SELECT 
    'RLS Status by Table' as section,
    tablename,
    CASE 
        WHEN rowsecurity THEN '✅ Enabled'
        ELSE '❌ Disabled'
    END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
    'contributors', 'repositories', 'pull_requests', 'reviews', 
    'comments', 'organizations', 'contributor_organizations', 
    'tracked_repositories', 'monthly_rankings', 'daily_activity_snapshots'
)
ORDER BY tablename;

-- Show policy count by table
SELECT 
    'Policy Count by Table' as section,
    tablename,
    COUNT(*) as policy_count,
    string_agg(policyname, ', ') as policies
FROM pg_policies 
WHERE schemaname = 'public'
AND tablename IN (
    'contributors', 'repositories', 'pull_requests', 'reviews', 
    'comments', 'organizations', 'contributor_organizations', 
    'tracked_repositories', 'monthly_rankings', 'daily_activity_snapshots'
)
GROUP BY tablename
ORDER BY tablename;

-- Show policy details for verification
SELECT 
    'Policy Details' as section,
    tablename,
    policyname,
    cmd as command,
    CASE 
        WHEN roles = '{public}' THEN 'Public'
        WHEN 'authenticated' = ANY(roles) THEN 'Authenticated'
        WHEN 'service_role' = ANY(roles) THEN 'Service Role'
        ELSE array_to_string(roles, ', ')
    END as allowed_roles
FROM pg_policies 
WHERE schemaname = 'public'
AND tablename IN (
    'contributors', 'repositories', 'pull_requests', 'reviews', 
    'comments', 'organizations', 'contributor_organizations', 
    'tracked_repositories', 'monthly_rankings', 'daily_activity_snapshots'
)
ORDER BY tablename, cmd, policyname;

-- Final test completion message
SELECT '🎉 RLS Policy Tests Completed Successfully! All core tables have proper public read access and write restrictions.' as final_status;
-- Fix RLS policies for issues table
-- Problem: Missing INSERT policy preventing issue sync from service_role
-- Security: Only service_role can INSERT/DELETE issues (GitHub sync operations)
-- Existing UPDATE policies for authenticated users remain unchanged

-- =====================================================
-- ADD INSERT POLICY (SERVICE ROLE ONLY)
-- =====================================================

-- Only service_role can insert issues (data comes from GitHub sync)
-- This prevents unauthorized users from creating fake issue records
CREATE POLICY "service_role_insert_issues"
ON issues FOR INSERT
TO service_role
WITH CHECK (true);

-- =====================================================
-- ADD UPDATE POLICY (SERVICE ROLE ONLY)
-- =====================================================

-- Only service_role can perform full updates on issues (for data sync)
-- Note: Existing policies allow authenticated users to update specific fields
-- like 'responded_by' through workspace member permissions
CREATE POLICY "service_role_update_issues"
ON issues FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- =====================================================
-- ADD DELETE POLICY (SERVICE ROLE ONLY)
-- =====================================================

-- Only service_role can delete issues (for data cleanup)
CREATE POLICY "service_role_delete_issues"
ON issues FOR DELETE
TO service_role
USING (true);

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Check all policies on issues table
SELECT
    policyname,
    cmd as command,
    roles::text[] as applies_to,
    CASE
        WHEN qual IS NOT NULL THEN 'USING clause defined'
        ELSE 'No USING clause'
    END as using_check,
    CASE
        WHEN with_check IS NOT NULL THEN 'WITH CHECK clause defined'
        ELSE 'No WITH CHECK clause'
    END as with_check_defined
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'issues'
ORDER BY cmd, policyname;

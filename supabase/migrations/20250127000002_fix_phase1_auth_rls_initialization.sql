-- Phase 1: Fix Auth RLS Initialization Issues for High-Traffic Tables
-- GitHub Issue: #820
--
-- This migration optimizes RLS policies by ensuring auth functions are evaluated
-- once per query instead of once per row, significantly improving performance.
--
-- Pattern: Replace auth.uid() with (SELECT auth.uid())
--          Replace auth.role() with (SELECT auth.role())

-- ============================================================================
-- 1. USER_EMAIL_PREFERENCES TABLE (3 policies)
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can update their own email preferences" ON user_email_preferences;
DROP POLICY IF EXISTS "Users can view their own email preferences" ON user_email_preferences;
DROP POLICY IF EXISTS "consolidated_manage_email_preferences" ON user_email_preferences;

-- Recreate with optimized auth initialization
CREATE POLICY "Users can view their own email preferences"
ON user_email_preferences
FOR SELECT
TO public
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own email preferences"
ON user_email_preferences
FOR UPDATE
TO public
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "consolidated_manage_email_preferences"
ON user_email_preferences
FOR ALL
TO public
USING (
    ((SELECT auth.jwt() ->> 'role'::text) = 'service_role'::text)
    OR
    ((SELECT auth.uid()) = user_id)
);

-- ============================================================================
-- 2. WORKSPACE_MEMBERS TABLE (3 policies)
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can delete members" ON workspace_members;
DROP POLICY IF EXISTS "Admins can insert members" ON workspace_members;
DROP POLICY IF EXISTS "Admins can update members" ON workspace_members;

-- Recreate with optimized auth initialization
-- Note: These use a function is_workspace_admin_or_owner which should internally use (SELECT auth.uid())
-- We'll need to check and potentially update that function as well
CREATE POLICY "Admins can delete members"
ON workspace_members
FOR DELETE
TO authenticated
USING (is_workspace_admin_or_owner(workspace_id, (SELECT auth.uid())));

CREATE POLICY "Admins can insert members"
ON workspace_members
FOR INSERT
TO authenticated
WITH CHECK (is_workspace_admin_or_owner(workspace_id, (SELECT auth.uid())));

CREATE POLICY "Admins can update members"
ON workspace_members
FOR UPDATE
TO authenticated
USING (is_workspace_admin_or_owner(workspace_id, (SELECT auth.uid())))
WITH CHECK (is_workspace_admin_or_owner(workspace_id, (SELECT auth.uid())));

-- ============================================================================
-- 3. WORKSPACE_REPOSITORIES TABLE (3 policies)
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Editors can add repositories to workspaces" ON workspace_repositories;
DROP POLICY IF EXISTS "Editors can remove repositories from workspaces" ON workspace_repositories;
DROP POLICY IF EXISTS "Editors can update repository settings" ON workspace_repositories;

-- Recreate with optimized auth initialization
CREATE POLICY "Editors can add repositories to workspaces"
ON workspace_repositories
FOR INSERT
TO public
WITH CHECK (
    (added_by = (SELECT auth.uid()))
    AND
    EXISTS (
        SELECT 1
        FROM workspace_members
        WHERE workspace_members.workspace_id = workspace_repositories.workspace_id
          AND workspace_members.user_id = (SELECT auth.uid())
          AND workspace_members.role = ANY (ARRAY['editor'::text, 'admin'::text, 'owner'::text])
          AND workspace_members.accepted_at IS NOT NULL
    )
);

CREATE POLICY "Editors can remove repositories from workspaces"
ON workspace_repositories
FOR DELETE
TO public
USING (
    EXISTS (
        SELECT 1
        FROM workspace_members
        WHERE workspace_members.workspace_id = workspace_repositories.workspace_id
          AND workspace_members.user_id = (SELECT auth.uid())
          AND workspace_members.role = ANY (ARRAY['editor'::text, 'admin'::text, 'owner'::text])
          AND workspace_members.accepted_at IS NOT NULL
    )
);

CREATE POLICY "Editors can update repository settings"
ON workspace_repositories
FOR UPDATE
TO public
USING (
    EXISTS (
        SELECT 1
        FROM workspace_members
        WHERE workspace_members.workspace_id = workspace_repositories.workspace_id
          AND workspace_members.user_id = (SELECT auth.uid())
          AND workspace_members.role = ANY (ARRAY['editor'::text, 'admin'::text, 'owner'::text])
          AND workspace_members.accepted_at IS NOT NULL
    )
);

-- ============================================================================
-- 4. REPOSITORY_CONFIDENCE_CACHE TABLE (1 policy)
-- ============================================================================

-- Drop existing policy
DROP POLICY IF EXISTS "Allow authenticated insert/update to confidence cache" ON repository_confidence_cache;

-- Recreate with optimized auth initialization
CREATE POLICY "Allow authenticated insert/update to confidence cache"
ON repository_confidence_cache
FOR ALL
TO public
USING (
    ((SELECT auth.role()) = 'authenticated'::text)
    OR
    ((SELECT auth.role()) = 'service_role'::text)
);

-- ============================================================================
-- 5. MONTHLY_RANKINGS TABLE (1 policy)
-- ============================================================================

-- Drop existing policy
DROP POLICY IF EXISTS "service_role_all" ON monthly_rankings;

-- Recreate with optimized auth initialization
CREATE POLICY "service_role_all"
ON monthly_rankings
FOR ALL
TO public
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- ============================================================================
-- 6. PR_INSIGHTS TABLE (1 policy)
-- ============================================================================

-- Drop existing policy
DROP POLICY IF EXISTS "Service role has full access to PR insights" ON pr_insights;

-- Recreate with optimized auth initialization
CREATE POLICY "Service role has full access to PR insights"
ON pr_insights
FOR ALL
TO public
USING ((SELECT auth.role()) = 'service_role'::text);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- After applying this migration, run these queries to verify the fixes:
--
-- 1. Check for remaining auth initialization warnings:
-- SELECT * FROM supabase_test.auth_rls_initplan;
--
-- 2. Verify all policies were recreated:
-- SELECT tablename, policyname, cmd, roles
-- FROM pg_policies
-- WHERE tablename IN (
--     'user_email_preferences',
--     'workspace_members',
--     'workspace_repositories',
--     'repository_confidence_cache',
--     'monthly_rankings',
--     'pr_insights'
-- )
-- ORDER BY tablename, policyname;
--
-- 3. Test query performance on affected tables
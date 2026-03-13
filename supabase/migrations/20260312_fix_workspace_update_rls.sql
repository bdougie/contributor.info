-- Fix workspaces INSERT, UPDATE, and DELETE RLS policies for app_users.id
-- Related to: 20251021000000_fix_workspace_user_relations.sql,
--             20260228_fix_workspace_repo_delete_update_rls.sql
--
-- Problem: Migration 20251021000000 changed workspaces.owner_id to reference
-- app_users.id instead of auth.users.id. The INSERT, UPDATE, and DELETE policies
-- still compare owner_id against auth.uid() (which returns auth.users.id), so
-- all writes match 0 rows and fail silently with a 406 error.
--
-- Solution: Map auth.uid() to app_users.id via subquery, matching the pattern
-- established in 20260228 for workspace_repositories.

-- =====================================================
-- 1. FIX INSERT POLICY
-- =====================================================

DROP POLICY IF EXISTS "Users can create workspaces" ON workspaces;

CREATE POLICY "Users can create workspaces"
    ON workspaces FOR INSERT
    WITH CHECK (
        owner_id = (SELECT id FROM app_users WHERE auth_user_id = auth.uid())
    );

COMMENT ON POLICY "Users can create workspaces" ON workspaces IS
'Allows authenticated users to create workspaces. Maps auth.uid() to app_users.id for compatibility with foreign key constraints.';

-- =====================================================
-- 2. FIX UPDATE POLICIES (consolidate into one)
-- =====================================================

DROP POLICY IF EXISTS "consolidated_update_workspaces" ON workspaces;
DROP POLICY IF EXISTS "Owners and maintainers can update workspace" ON workspaces;

CREATE POLICY "Owners and maintainers can update workspace"
    ON workspaces FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM workspace_members
            WHERE workspace_members.workspace_id = workspaces.id
            AND workspace_members.user_id = (SELECT id FROM app_users WHERE auth_user_id = auth.uid())
            AND workspace_members.role IN ('owner', 'maintainer')
            AND workspace_members.accepted_at IS NOT NULL
        ) OR
        owner_id = (SELECT id FROM app_users WHERE auth_user_id = auth.uid())
    )
    WITH CHECK (
        -- Prevent non-owners from changing owner_id
        owner_id = (SELECT owner_id FROM workspaces WHERE id = workspaces.id)
        AND (
            EXISTS (
                SELECT 1 FROM workspace_members
                WHERE workspace_members.workspace_id = workspaces.id
                AND workspace_members.user_id = (SELECT id FROM app_users WHERE auth_user_id = auth.uid())
                AND workspace_members.role IN ('owner', 'maintainer')
                AND workspace_members.accepted_at IS NOT NULL
            ) OR
            owner_id = (SELECT id FROM app_users WHERE auth_user_id = auth.uid())
        )
    );

COMMENT ON POLICY "Owners and maintainers can update workspace" ON workspaces IS
'Allows owners/maintainers to update workspace settings. Maps auth.uid() to app_users.id for compatibility with foreign key constraints.';

-- =====================================================
-- 3. FIX DELETE POLICY
-- =====================================================

DROP POLICY IF EXISTS "Owners can delete their workspaces" ON workspaces;

CREATE POLICY "Owners can delete their workspaces"
    ON workspaces FOR DELETE
    USING (
        owner_id = (SELECT id FROM app_users WHERE auth_user_id = auth.uid())
    );

COMMENT ON POLICY "Owners can delete their workspaces" ON workspaces IS
'Allows owners to delete their workspaces. Maps auth.uid() to app_users.id for compatibility with foreign key constraints.';

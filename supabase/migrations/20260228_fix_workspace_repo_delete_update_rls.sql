-- Fix workspace_repositories DELETE and UPDATE RLS policies for app_users.id
-- Related to: 20251021000000_fix_workspace_user_relations.sql, 20251021000001_fix_workspace_rls_for_app_users.sql
--
-- Problem: The INSERT policy was fixed in 20251021000001 to map auth.uid() to app_users.id,
-- but the DELETE and UPDATE policies were missed. Since workspace_members.user_id and
-- workspaces.owner_id now store app_users.id (not auth.users.id), the DELETE/UPDATE
-- RLS checks always fail silently — Supabase returns no error but affects 0 rows.
-- This causes repository removal to appear successful in the UI but the repo reappears
-- on the next data fetch.
--
-- Solution: Update DELETE and UPDATE policies to map auth.uid() to app_users.id via subquery,
-- matching the pattern used in the INSERT policy fix.

-- =====================================================
-- 1. FIX DELETE POLICY
-- =====================================================

DROP POLICY IF EXISTS "Owners and maintainers can remove repositories" ON workspace_repositories;
DROP POLICY IF EXISTS "Editors can remove repositories from workspaces" ON workspace_repositories;

CREATE POLICY "Owners and maintainers can remove repositories"
    ON workspace_repositories FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM workspace_members
            WHERE workspace_members.workspace_id = workspace_repositories.workspace_id
            AND workspace_members.user_id = (SELECT id FROM app_users WHERE auth_user_id = auth.uid())
            AND workspace_members.role IN ('owner', 'maintainer')
            AND workspace_members.accepted_at IS NOT NULL
        ) OR
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = workspace_repositories.workspace_id
            AND workspaces.owner_id = (SELECT id FROM app_users WHERE auth_user_id = auth.uid())
        )
    );

COMMENT ON POLICY "Owners and maintainers can remove repositories" ON workspace_repositories IS
'Allows owners/maintainers to remove repositories. Maps auth.uid() to app_users.id for compatibility with foreign key constraints.';

-- =====================================================
-- 2. FIX UPDATE POLICY
-- =====================================================

DROP POLICY IF EXISTS "Owners and maintainers can update repositories" ON workspace_repositories;
DROP POLICY IF EXISTS "Editors can update repository settings" ON workspace_repositories;

CREATE POLICY "Owners and maintainers can update repositories"
    ON workspace_repositories FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM workspace_members
            WHERE workspace_members.workspace_id = workspace_repositories.workspace_id
            AND workspace_members.user_id = (SELECT id FROM app_users WHERE auth_user_id = auth.uid())
            AND workspace_members.role IN ('owner', 'maintainer')
            AND workspace_members.accepted_at IS NOT NULL
        ) OR
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = workspace_repositories.workspace_id
            AND workspaces.owner_id = (SELECT id FROM app_users WHERE auth_user_id = auth.uid())
        )
    );

COMMENT ON POLICY "Owners and maintainers can update repositories" ON workspace_repositories IS
'Allows owners/maintainers to update repository settings. Maps auth.uid() to app_users.id for compatibility with foreign key constraints.';

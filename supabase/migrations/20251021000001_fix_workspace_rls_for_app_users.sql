-- Fix Workspace RLS Policies for app_users Migration
-- Related to: #1147, 20251021000000_fix_workspace_user_relations.sql
--
-- Problem: After migrating workspace foreign keys to use app_users.id instead of auth.users.id,
-- the RLS policies still check `auth.uid()` which returns auth_user_id, not app_users.id.
-- This breaks INSERT operations on workspace_repositories because the check fails.
--
-- Solution: Update RLS policy to map auth.uid() to app_users.id via subquery

-- =====================================================
-- 1. DROP EXISTING BROKEN POLICY
-- =====================================================

DROP POLICY IF EXISTS "Editors can add repositories to workspaces" ON workspace_repositories;

-- =====================================================
-- 2. CREATE FIXED POLICY
-- =====================================================

-- Fixed policy: Map auth.uid() to app_users.id before comparison
CREATE POLICY "Editors can add repositories to workspaces"
    ON workspace_repositories FOR INSERT
    WITH CHECK (
        -- Convert auth.uid() to app_users.id for comparison
        added_by = (SELECT id FROM app_users WHERE auth_user_id = auth.uid()) AND (
            EXISTS (
                SELECT 1 FROM workspace_members
                WHERE workspace_members.workspace_id = workspace_repositories.workspace_id
                  AND workspace_members.user_id = (SELECT id FROM app_users WHERE auth_user_id = auth.uid())
                  AND workspace_members.role IN ('editor', 'admin', 'owner')
                  AND workspace_members.accepted_at IS NOT NULL
            )
        )
    );

COMMENT ON POLICY "Editors can add repositories to workspaces" ON workspace_repositories IS
'Allows editors/admins/owners to add repositories. Maps auth.uid() to app_users.id for compatibility with foreign key constraints.';

-- =====================================================
-- 3. FIX OTHER WORKSPACE POLICIES USING auth.uid()
-- =====================================================

-- Drop and recreate workspace_members policies that reference auth.uid()
DROP POLICY IF EXISTS "Users can view their workspace memberships" ON workspace_members;
CREATE POLICY "Users can view their workspace memberships"
    ON workspace_members FOR SELECT
    USING (
        user_id = (SELECT id FROM app_users WHERE auth_user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Users can update their own membership settings" ON workspace_members;
CREATE POLICY "Users can update their own membership settings"
    ON workspace_members FOR UPDATE
    USING (
        user_id = (SELECT id FROM app_users WHERE auth_user_id = auth.uid())
    )
    WITH CHECK (
        user_id = (SELECT id FROM app_users WHERE auth_user_id = auth.uid())
    );

-- =====================================================
-- 4. ADD PERFORMANCE INDEX
-- =====================================================

-- Index to optimize auth_user_id lookups in RLS policies
CREATE INDEX IF NOT EXISTS idx_app_users_auth_user_id ON app_users(auth_user_id);

COMMENT ON INDEX idx_app_users_auth_user_id IS
'Optimizes RLS policy lookups that map auth.uid() to app_users.id';

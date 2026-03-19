-- Fix: Infinite Recursion in Workspaces RLS Policy (42P17)
-- Issue: https://github.com/bdougie/contributor.info/issues/1742
--
-- Root cause: Cross-table circular RLS dependencies between workspaces and
-- workspace_members. Policies on each table query the other, creating an
-- evaluation loop:
--
--   workspaces UPDATE policy → SELECT workspace_members
--     → workspace_members SELECT policy → SELECT workspaces
--       → workspaces SELECT policy → SELECT workspace_members → ∞
--
-- Solution: Create SECURITY DEFINER helper functions that bypass RLS to break
-- the cycle. Replace all cross-table subqueries in policies with calls to
-- these functions.

BEGIN;

-- =====================================================
-- STEP 1: Create SECURITY DEFINER helper functions
-- These bypass RLS to break the circular dependency
-- =====================================================

-- Maps auth.uid() → app_users.id (breaks cycle on app_users)
CREATE OR REPLACE FUNCTION public.rls_current_app_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT id FROM public.app_users WHERE auth_user_id = auth.uid();
$$;

COMMENT ON FUNCTION public.rls_current_app_user_id() IS
'RLS helper: maps auth.uid() to app_users.id. SECURITY DEFINER to bypass RLS on app_users.';

-- Checks if a workspace is public and active (breaks cycle on workspaces)
CREATE OR REPLACE FUNCTION public.rls_workspace_is_public(ws_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = ws_id
      AND visibility = 'public'
      AND is_active = true
  );
$$;

COMMENT ON FUNCTION public.rls_workspace_is_public(uuid) IS
'RLS helper: checks if workspace is public and active. SECURITY DEFINER to bypass RLS on workspaces.';

-- Returns workspace owner_id (breaks cycle on workspaces)
CREATE OR REPLACE FUNCTION public.rls_workspace_owner_id(ws_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT owner_id FROM public.workspaces WHERE id = ws_id;
$$;

COMMENT ON FUNCTION public.rls_workspace_owner_id(uuid) IS
'RLS helper: returns workspace owner_id. SECURITY DEFINER to bypass RLS on workspaces.';

-- Returns user role in workspace (breaks cycle on workspace_members)
CREATE OR REPLACE FUNCTION public.rls_user_workspace_role(ws_id uuid, u_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.workspace_members
  WHERE workspace_id = ws_id
    AND user_id = u_id
    AND accepted_at IS NOT NULL
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.rls_user_workspace_role(uuid, uuid) IS
'RLS helper: returns user role in workspace. SECURITY DEFINER to bypass RLS on workspace_members.';


-- =====================================================
-- STEP 2: Drop & recreate ALL workspace_members policies
-- Replace every cross-table subquery with helper calls
-- =====================================================

-- Drop all existing workspace_members policies
DROP POLICY IF EXISTS "Public workspace members are visible" ON public.workspace_members;
DROP POLICY IF EXISTS "Members can view their workspace members" ON public.workspace_members;
DROP POLICY IF EXISTS "Members can view workspace members" ON public.workspace_members;
DROP POLICY IF EXISTS "Users can view their workspace memberships" ON public.workspace_members;
DROP POLICY IF EXISTS "Admins can add members" ON public.workspace_members;
DROP POLICY IF EXISTS "Owners and maintainers can add members" ON public.workspace_members;
DROP POLICY IF EXISTS "Members can update their own settings" ON public.workspace_members;
DROP POLICY IF EXISTS "Users can update their own membership settings" ON public.workspace_members;
DROP POLICY IF EXISTS "Admins can update member roles" ON public.workspace_members;
DROP POLICY IF EXISTS "Owners and maintainers can update members" ON public.workspace_members;
DROP POLICY IF EXISTS "Members can remove themselves" ON public.workspace_members;
DROP POLICY IF EXISTS "Admins can remove members" ON public.workspace_members;
DROP POLICY IF EXISTS "Owners and maintainers can remove members" ON public.workspace_members;

-- SELECT: Public workspace members visible to all
CREATE POLICY "rls_wm_select_public"
    ON public.workspace_members FOR SELECT
    USING (
        public.rls_workspace_is_public(workspace_id)
    );

-- SELECT: Users can see members in their own workspaces (private)
CREATE POLICY "rls_wm_select_private"
    ON public.workspace_members FOR SELECT
    USING (
        user_id = public.rls_current_app_user_id()
        OR public.rls_workspace_owner_id(workspace_id) = public.rls_current_app_user_id()
        OR public.rls_user_workspace_role(workspace_id, public.rls_current_app_user_id()) IS NOT NULL
    );

-- INSERT: Owners and maintainers can add members
CREATE POLICY "rls_wm_insert"
    ON public.workspace_members FOR INSERT
    WITH CHECK (
        invited_by = public.rls_current_app_user_id()
        AND (
            -- Owners can add anyone
            public.rls_workspace_owner_id(workspace_id) = public.rls_current_app_user_id()
            OR public.rls_user_workspace_role(workspace_id, public.rls_current_app_user_id()) = 'owner'
            -- Maintainers can only add contributors
            OR (
                role = 'contributor'
                AND public.rls_user_workspace_role(workspace_id, public.rls_current_app_user_id()) = 'maintainer'
            )
        )
    );

-- UPDATE: Members can update their own settings (no role change)
CREATE POLICY "rls_wm_update_self"
    ON public.workspace_members FOR UPDATE
    USING (
        user_id = public.rls_current_app_user_id()
    )
    WITH CHECK (
        user_id = public.rls_current_app_user_id()
    );

-- UPDATE: Owners and maintainers can update other members
CREATE POLICY "rls_wm_update_admin"
    ON public.workspace_members FOR UPDATE
    USING (
        (
            public.rls_workspace_owner_id(workspace_id) = public.rls_current_app_user_id()
            OR public.rls_user_workspace_role(workspace_id, public.rls_current_app_user_id()) = 'owner'
        )
        -- Owners can update anyone except owner-role members
        OR (
            workspace_members.role = 'contributor'
            AND public.rls_user_workspace_role(workspace_id, public.rls_current_app_user_id()) = 'maintainer'
        )
    )
    WITH CHECK (
        CASE
            -- Owners can set maintainer or contributor roles
            WHEN public.rls_workspace_owner_id(workspace_id) = public.rls_current_app_user_id()
                OR public.rls_user_workspace_role(workspace_id, public.rls_current_app_user_id()) = 'owner'
            THEN role IN ('owner', 'maintainer', 'contributor')
            -- Maintainers can only set contributor role
            WHEN public.rls_user_workspace_role(workspace_id, public.rls_current_app_user_id()) = 'maintainer'
            THEN role = 'contributor'
            ELSE false
        END
    );

-- DELETE: Members can remove themselves
CREATE POLICY "rls_wm_delete_self"
    ON public.workspace_members FOR DELETE
    USING (
        user_id = public.rls_current_app_user_id()
    );

-- DELETE: Owners and maintainers can remove other members
CREATE POLICY "rls_wm_delete_admin"
    ON public.workspace_members FOR DELETE
    USING (
        user_id != public.rls_current_app_user_id()
        AND (
            -- Owners can remove anyone
            public.rls_workspace_owner_id(workspace_id) = public.rls_current_app_user_id()
            OR public.rls_user_workspace_role(workspace_id, public.rls_current_app_user_id()) = 'owner'
            -- Maintainers can remove contributors only
            OR (
                workspace_members.role = 'contributor'
                AND public.rls_user_workspace_role(workspace_id, public.rls_current_app_user_id()) = 'maintainer'
            )
        )
    );


-- =====================================================
-- STEP 3: Fix workspaces policies
-- Drop orphaned/redundant SELECT policies, recreate clean ones
-- =====================================================

-- Drop all existing workspaces SELECT policies (including the orphaned one causing recursion)
DROP POLICY IF EXISTS "Public workspaces are viewable by everyone" ON public.workspaces;
DROP POLICY IF EXISTS "Users can view their private workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "consolidated_read_workspaces" ON public.workspaces;

-- Drop existing UPDATE policies
DROP POLICY IF EXISTS "Owners and maintainers can update workspace" ON public.workspaces;
DROP POLICY IF EXISTS "consolidated_update_workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Admins can update workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Owners can update their workspaces" ON public.workspaces;

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Users can create workspaces" ON public.workspaces;

-- Drop existing DELETE policy
DROP POLICY IF EXISTS "Owners can delete their workspaces" ON public.workspaces;

-- SELECT: Public active workspaces are viewable by everyone (no cross-table query)
CREATE POLICY "rls_ws_select_public"
    ON public.workspaces FOR SELECT
    USING (
        visibility = 'public' AND is_active = true
    );

-- SELECT: Members/owners can view their workspaces (uses helper to avoid recursion)
CREATE POLICY "rls_ws_select_member"
    ON public.workspaces FOR SELECT
    USING (
        is_active = true
        AND (
            owner_id = public.rls_current_app_user_id()
            OR public.rls_user_workspace_role(id, public.rls_current_app_user_id()) IS NOT NULL
        )
    );

-- INSERT: Authenticated users can create workspaces
CREATE POLICY "rls_ws_insert"
    ON public.workspaces FOR INSERT
    WITH CHECK (
        owner_id = public.rls_current_app_user_id()
    );

-- UPDATE: Owners and maintainers can update workspaces (uses helpers to avoid recursion)
CREATE POLICY "rls_ws_update"
    ON public.workspaces FOR UPDATE
    USING (
        public.rls_workspace_owner_id(id) = public.rls_current_app_user_id()
        OR public.rls_user_workspace_role(id, public.rls_current_app_user_id()) IN ('owner', 'maintainer')
    )
    WITH CHECK (
        -- Prevent ownership transfer: owner_id must stay the same
        owner_id = public.rls_workspace_owner_id(id)
        AND (
            public.rls_workspace_owner_id(id) = public.rls_current_app_user_id()
            OR public.rls_user_workspace_role(id, public.rls_current_app_user_id()) IN ('owner', 'maintainer')
        )
    );

-- DELETE: Only owners can delete
CREATE POLICY "rls_ws_delete"
    ON public.workspaces FOR DELETE
    USING (
        owner_id = public.rls_current_app_user_id()
    );


-- =====================================================
-- STEP 4: Update existing helper functions
-- Add SET search_path = '' and use fully-qualified table names
-- =====================================================

CREATE OR REPLACE FUNCTION public.is_workspace_member(workspace_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = workspace_uuid
          AND user_id = user_uuid
          AND accepted_at IS NOT NULL
    ) OR EXISTS (
        SELECT 1 FROM public.workspaces
        WHERE id = workspace_uuid
          AND owner_id = user_uuid
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_workspace_role(workspace_uuid uuid, user_uuid uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    user_role text;
BEGIN
    -- Check if user is owner
    IF EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_uuid AND owner_id = user_uuid) THEN
        RETURN 'owner';
    END IF;

    -- Check member role
    SELECT role INTO user_role
    FROM public.workspace_members
    WHERE workspace_id = workspace_uuid
      AND user_id = user_uuid
      AND accepted_at IS NOT NULL;

    RETURN user_role;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_workspace_permission(
    workspace_id_param uuid,
    user_id_param uuid,
    required_permission text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    user_role text;
    is_owner boolean;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM public.workspaces
        WHERE id = workspace_id_param
          AND owner_id = user_id_param
    ) INTO is_owner;

    IF is_owner THEN
        RETURN true;
    END IF;

    SELECT role INTO user_role
    FROM public.workspace_members
    WHERE workspace_id = workspace_id_param
      AND user_id = user_id_param
      AND accepted_at IS NOT NULL
    LIMIT 1;

    IF user_role IS NULL THEN
        RETURN false;
    END IF;

    CASE required_permission
        WHEN 'view' THEN RETURN true;
        WHEN 'add_repository' THEN RETURN user_role IN ('owner', 'maintainer');
        WHEN 'edit_settings' THEN RETURN user_role IN ('owner', 'maintainer');
        WHEN 'invite_member' THEN RETURN user_role IN ('owner', 'maintainer');
        WHEN 'remove_member' THEN RETURN user_role IN ('owner', 'maintainer');
        WHEN 'delete_workspace' THEN RETURN user_role = 'owner';
        ELSE RETURN false;
    END CASE;
END;
$$;


-- =====================================================
-- STEP 5: Inline validation block
-- Verify no remaining direct cross-table queries
-- =====================================================

DO $$
DECLARE
    bad_policy RECORD;
    found_issues boolean := false;
BEGIN
    -- Check workspace_members policies for direct references to workspaces table
    FOR bad_policy IN
        SELECT policyname, qual, with_check
        FROM pg_policies
        WHERE tablename = 'workspace_members'
          AND schemaname = 'public'
          AND (
              (qual IS NOT NULL AND qual LIKE '%workspaces%' AND qual NOT LIKE '%rls_%')
              OR (with_check IS NOT NULL AND with_check LIKE '%workspaces%' AND with_check NOT LIKE '%rls_%')
          )
    LOOP
        RAISE WARNING 'workspace_members policy "%" still has direct workspaces reference', bad_policy.policyname;
        found_issues := true;
    END LOOP;

    -- Check workspaces policies for direct references to workspace_members table
    FOR bad_policy IN
        SELECT policyname, qual, with_check
        FROM pg_policies
        WHERE tablename = 'workspaces'
          AND schemaname = 'public'
          AND (
              (qual IS NOT NULL AND qual LIKE '%workspace_members%' AND qual NOT LIKE '%rls_%')
              OR (with_check IS NOT NULL AND with_check LIKE '%workspace_members%' AND with_check NOT LIKE '%rls_%')
          )
    LOOP
        RAISE WARNING 'workspaces policy "%" still has direct workspace_members reference', bad_policy.policyname;
        found_issues := true;
    END LOOP;

    IF found_issues THEN
        RAISE EXCEPTION 'Found policies with direct cross-table references that could cause infinite recursion. See warnings above.';
    ELSE
        RAISE NOTICE 'Validation passed: no direct cross-table references found in workspaces/workspace_members policies.';
    END IF;
END;
$$;

COMMIT;

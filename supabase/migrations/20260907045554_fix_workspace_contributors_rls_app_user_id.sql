-- =====================================================
-- Fix workspace_contributors RLS to compare app_users ids
--
-- workspaces.owner_id and workspace_members.user_id hold app_users.id
-- (since 20251021000000), but every write policy on workspace_contributors
-- still compared them against auth.uid(). No owner or member ever matched,
-- so adding or removing a contributor from a workspace failed with 42501.
--
-- Replaces the four overlapping write policies with one per command that
-- uses the rls_* SECURITY DEFINER helpers from 20260319000000, the same
-- pattern workspace_repositories uses. The two SELECT policies are folded
-- into one for the same reason.
-- =====================================================

BEGIN;

DROP POLICY IF EXISTS "workspace_contributors_write_policy" ON public.workspace_contributors;
DROP POLICY IF EXISTS "Workspace owners and admins can add contributors" ON public.workspace_contributors;
DROP POLICY IF EXISTS "Workspace owners and admins can remove contributors" ON public.workspace_contributors;
DROP POLICY IF EXISTS "Users can view workspace contributors" ON public.workspace_contributors;
DROP POLICY IF EXISTS "workspace_contributors_read_policy" ON public.workspace_contributors;

CREATE POLICY "workspace_contributors_select"
    ON public.workspace_contributors FOR SELECT
    USING (
        public.rls_workspace_is_public(workspace_id)
        OR public.rls_workspace_owner_id(workspace_id) = public.rls_current_app_user_id()
        OR public.rls_user_workspace_role(workspace_id, public.rls_current_app_user_id()) IS NOT NULL
    );

COMMENT ON POLICY "workspace_contributors_select" ON public.workspace_contributors IS
'Anyone can read contributors of a public workspace; owner or accepted members can read private ones.';

CREATE POLICY "workspace_contributors_insert"
    ON public.workspace_contributors FOR INSERT
    WITH CHECK (
        public.rls_workspace_owner_id(workspace_id) = public.rls_current_app_user_id()
        OR public.rls_user_workspace_role(workspace_id, public.rls_current_app_user_id())
            IN ('owner', 'admin', 'maintainer', 'editor')
    );

COMMENT ON POLICY "workspace_contributors_insert" ON public.workspace_contributors IS
'Owner or accepted owner/admin/maintainer/editor member may add contributors. Matches permissionsForRole in src/lib/workspace-permissions.ts.';

CREATE POLICY "workspace_contributors_delete"
    ON public.workspace_contributors FOR DELETE
    USING (
        public.rls_workspace_owner_id(workspace_id) = public.rls_current_app_user_id()
        OR public.rls_user_workspace_role(workspace_id, public.rls_current_app_user_id())
            IN ('owner', 'admin', 'maintainer', 'editor')
    );

COMMENT ON POLICY "workspace_contributors_delete" ON public.workspace_contributors IS
'Owner or accepted owner/admin/maintainer/editor member may remove contributors. Matches permissionsForRole in src/lib/workspace-permissions.ts.';

COMMIT;

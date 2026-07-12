-- Fix: All workspace write operations blocked by broken triggers
--
-- Symptoms (all confirmed in production on 2026-07-11):
--   1. Workspace soft-delete (UPDATE workspaces SET is_active = false) fails with
--      42703 'record "new" has no field "workspace_id"'. The shared trigger function
--      trigger_workspace_stats_refresh() reads NEW.workspace_id, which exists on
--      workspace_repositories/workspace_members but NOT on workspaces (its PK is "id").
--      The trigger fires exactly WHEN (OLD.is_active IS DISTINCT FROM NEW.is_active),
--      i.e. only on soft-delete — so owners can never delete a workspace.
--   2. Adding/removing repositories fails with 42P01 'relation "workspace_metrics_cache"
--      does not exist'. trigger_invalidate_cache_on_repo_change calls
--      mark_workspace_cache_stale(), which UPDATEs workspace_metrics_cache — a table
--      dropped by 20260428000007_drop_dead_tables.sql.
--   3. Even where NEW.workspace_id is valid, trigger_workspace_stats_refresh() runs
--      REFRESH MATERIALIZED VIEW CONCURRENTLY, which cannot execute inside a trigger's
--      transaction (0A000) — breaking workspace_members INSERTs (owner auto-membership,
--      invitation acceptance) and workspace_repositories writes.
--
-- The materialized view workspace_preview_stats is already refreshed every 5 minutes by
-- the pg_cron job 'refresh-workspace-preview-stats', so the row-level refresh triggers
-- are redundant. Drop them.

BEGIN;

-- =====================================================
-- 1. Drop broken stats-refresh triggers (matview is cron-refreshed)
-- =====================================================

DROP TRIGGER IF EXISTS trigger_refresh_stats_on_workspace_change ON public.workspaces;
DROP TRIGGER IF EXISTS trigger_refresh_stats_on_repo_change ON public.workspace_repositories;
DROP TRIGGER IF EXISTS trigger_refresh_stats_on_member_change ON public.workspace_members;
DROP FUNCTION IF EXISTS public.trigger_workspace_stats_refresh();

-- =====================================================
-- 2. Drop cache-invalidation trigger for the dropped workspace_metrics_cache table
-- =====================================================

DROP TRIGGER IF EXISTS trigger_invalidate_cache_on_repo_change ON public.workspace_repositories;
DROP FUNCTION IF EXISTS public.invalidate_workspace_cache_on_repo_change();

-- The web client still calls this via supabase.rpc() in invalidateWorkspaceMetrics().
-- Keep the signature but make it a no-op until the in-memory/DB cache strategy is rebuilt.
CREATE OR REPLACE FUNCTION public.mark_workspace_cache_stale(p_workspace_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    -- No-op: workspace_metrics_cache was dropped in 20260428000007_drop_dead_tables.
    NULL;
END;
$$;

-- =====================================================
-- 3. Align workspace_repositories INSERT policy with DELETE/UPDATE
--    (old policy allowed retired roles 'editor'/'admin', omitted 'maintainer',
--     and had no workspaces.owner_id fallback)
-- =====================================================

DROP POLICY IF EXISTS "Editors can add repositories to workspaces" ON public.workspace_repositories;
DROP POLICY IF EXISTS "Owners and maintainers can add repositories" ON public.workspace_repositories;

CREATE POLICY "Owners and maintainers can add repositories"
    ON public.workspace_repositories FOR INSERT
    WITH CHECK (
        added_by = public.rls_current_app_user_id()
        AND (
            public.rls_workspace_owner_id(workspace_id) = public.rls_current_app_user_id()
            OR public.rls_user_workspace_role(workspace_id, public.rls_current_app_user_id())
                IN ('owner', 'maintainer')
        )
    );

COMMENT ON POLICY "Owners and maintainers can add repositories" ON public.workspace_repositories IS
'Owner (workspaces.owner_id) or accepted owner/maintainer member may add repositories. Uses rls_* SECURITY DEFINER helpers from 20260319000000.';

-- =====================================================
-- 4. Members/owners can view repositories of their private workspaces
--    (previously only "View public workspace repositories" existed)
-- =====================================================

DROP POLICY IF EXISTS "Members can view their workspace repositories" ON public.workspace_repositories;

CREATE POLICY "Members can view their workspace repositories"
    ON public.workspace_repositories FOR SELECT
    USING (
        public.rls_workspace_owner_id(workspace_id) = public.rls_current_app_user_id()
        OR public.rls_user_workspace_role(workspace_id, public.rls_current_app_user_id()) IS NOT NULL
    );

-- =====================================================
-- 5. Owners must be able to see their own INACTIVE workspaces,
--    or soft-delete is impossible.
--
--    PostgreSQL enforces SELECT policies against the NEW row of an UPDATE
--    (when the statement reads the table, which it always does via WHERE).
--    Both SELECT policies required is_active = true, so
--    UPDATE workspaces SET is_active = false was rejected with
--    42501 'new row violates row-level security policy' for every owner.
--    Confirmed in production: the update succeeds the moment a SELECT
--    policy matches the post-update row.
-- =====================================================

DROP POLICY IF EXISTS "rls_ws_select_member" ON public.workspaces;

CREATE POLICY "rls_ws_select_member"
    ON public.workspaces FOR SELECT
    USING (
        -- Owners can always see their workspaces, including soft-deleted ones
        owner_id = public.rls_current_app_user_id()
        -- Members only see active workspaces
        OR (
            is_active = true
            AND public.rls_user_workspace_role(id, public.rls_current_app_user_id()) IS NOT NULL
        )
    );

COMMENT ON POLICY "rls_ws_select_member" ON public.workspaces IS
'Owner sees all their workspaces (incl. inactive, required for soft-delete WITH CHECK); accepted members see active ones. App queries filter is_active=true explicitly.';

COMMIT;

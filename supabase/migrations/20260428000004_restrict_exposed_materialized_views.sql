-- Fix: 4 materialized views exposed via PostgREST (advisor: materialized_view_in_api)
--
-- Materialized views can't have RLS policies, so direct exposure to anon /
-- authenticated allows anyone with the publishable key to query stats for
-- private/restricted entities just by knowing their IDs.
--
-- Three of the four matviews have no app callers; revoking anon/authenticated
-- access removes them from the API surface entirely. service_role keeps full
-- access for refresh and ops queries.
--
-- workspace_preview_stats is used by the frontend (use-user-workspaces.ts).
-- We replace direct access with a SECURITY INVOKER wrapper view that
-- inner-joins to public.workspaces — the RLS policies on that table filter
-- out workspaces the caller can't see. Frontend code update lands in the
-- same PR.

BEGIN;

-- =====================================================
-- 3 unused matviews: revoke from anon/authenticated
-- =====================================================

REVOKE ALL ON public.repository_contribution_stats FROM anon, authenticated;
REVOKE ALL ON public.quality_score_rankings        FROM anon, authenticated;
REVOKE ALL ON public.workspace_topic_clusters      FROM anon, authenticated;

-- =====================================================
-- workspace_preview_stats: wrap with SECURITY INVOKER view
-- =====================================================
-- Frontend will query workspace_preview_stats_secure instead. The wrapper
-- joins to workspaces, which has RLS, so anon/authenticated only see stats
-- for workspaces they're authorized to see (public workspaces, owned, or
-- workspaces where they're a member).

REVOKE ALL ON public.workspace_preview_stats FROM anon, authenticated;

CREATE OR REPLACE VIEW public.workspace_preview_stats_secure
  WITH (security_invoker = true) AS
SELECT s.workspace_id,
       s.workspace_name,
       s.workspace_slug,
       s.repository_count,
       s.member_count,
       s.pinned_repository_count,
       s.last_updated
FROM public.workspace_preview_stats s
INNER JOIN public.workspaces w ON w.id = s.workspace_id;

GRANT SELECT ON public.workspace_preview_stats_secure TO anon, authenticated, service_role;

COMMENT ON VIEW public.workspace_preview_stats_secure IS
  'RLS-filtered wrapper around workspace_preview_stats matview. The JOIN to workspaces enforces visibility; anon/authenticated only see stats for workspaces they can read.';

COMMIT;

-- Migration: Per-repository open PR/issue counts and distinct PR-author count in one call
--
-- The workspace dashboard previously fetched up to 1000 `repository_id` rows from
-- pull_requests and 1000 from issues, plus up to 500 author_id rows, and counted
-- them client-side (three round trips, tens of KB) just to show per-repo open
-- counts and a contributor total. This function returns the same numbers as one
-- row per repository plus a shared contributor total, computed in the database.
--
-- SECURITY INVOKER: runs as the caller, so RLS on pull_requests / issues applies.
-- Both tables allow public read, so anon and authenticated may execute it.

CREATE OR REPLACE FUNCTION public.count_workspace_open_items(p_repository_ids uuid[])
RETURNS TABLE (
  repository_id uuid,
  open_prs bigint,
  open_issues bigint,
  contributor_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_catalog, pg_temp
AS $$
  WITH repos AS (
    SELECT unnest(p_repository_ids) AS repository_id
  ),
  pr_counts AS (
    SELECT pr.repository_id, count(*) AS open_prs
    FROM public.pull_requests pr
    WHERE pr.repository_id = ANY (p_repository_ids)
      AND pr.state = 'open'
    GROUP BY pr.repository_id
  ),
  issue_counts AS (
    SELECT i.repository_id, count(*) AS open_issues
    FROM public.issues i
    WHERE i.repository_id = ANY (p_repository_ids)
      AND i.state = 'open'
    GROUP BY i.repository_id
  ),
  contributors AS (
    SELECT count(DISTINCT pr.author_id) AS contributor_count
    FROM public.pull_requests pr
    WHERE pr.repository_id = ANY (p_repository_ids)
      AND pr.author_id IS NOT NULL
  )
  SELECT
    repos.repository_id,
    COALESCE(pr_counts.open_prs, 0) AS open_prs,
    COALESCE(issue_counts.open_issues, 0) AS open_issues,
    contributors.contributor_count
  FROM repos
  LEFT JOIN pr_counts USING (repository_id)
  LEFT JOIN issue_counts USING (repository_id)
  CROSS JOIN contributors;
$$;

COMMENT ON FUNCTION public.count_workspace_open_items(uuid[]) IS
  'Per-repository open PR and issue counts plus distinct PR-author count for a set of repositories. Used by the workspace dashboard.';

-- Default privileges in public no longer grant EXECUTE to PUBLIC (20260707000002),
-- so the frontend needs explicit grants. anon is included because workspace
-- pages are readable logged out.
GRANT EXECUTE ON FUNCTION public.count_workspace_open_items(uuid[]) TO anon, authenticated, service_role;

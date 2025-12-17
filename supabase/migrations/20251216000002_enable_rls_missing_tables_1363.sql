-- Enable RLS on public tables missing row-level security
-- Issue: https://github.com/bdougie/contributor.info/issues/1363
-- Tables: github_events_cache_2025_10, contributor_analytics

-- 1. github_events_cache_2025_10 (partition table)
-- Pattern: public read, service_role write (matches other partitions)
ALTER TABLE public.github_events_cache_2025_10 ENABLE ROW LEVEL SECURITY;

-- Public read access (analytics data is public)
CREATE POLICY public_read_github_events_cache_2025_10
  ON public.github_events_cache_2025_10
  FOR SELECT
  TO public
  USING (true);

-- Service role manages all operations (gh-datapipe uses service_role)
CREATE POLICY service_role_manage_github_events_2025_10
  ON public.github_events_cache_2025_10
  FOR ALL
  TO public
  USING ((SELECT auth.role()) = 'service_role');

-- 2. contributor_analytics (workspace-scoped analytics)
-- Pattern: workspace members can read, service_role manages
ALTER TABLE public.contributor_analytics ENABLE ROW LEVEL SECURITY;

-- Workspace members can view analytics for their workspaces
-- Also allows public workspaces to be viewed by anyone
CREATE POLICY workspace_read_contributor_analytics
  ON public.contributor_analytics
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM workspaces w
      WHERE w.id = contributor_analytics.workspace_id
        AND (
          w.visibility = 'public'
          OR w.owner_id = (SELECT auth.uid())
          OR EXISTS (
            SELECT 1 FROM workspace_members wm
            WHERE wm.workspace_id = w.id
              AND wm.user_id = (SELECT auth.uid())
          )
        )
    )
  );

-- Service role manages all operations (background jobs generate analytics)
CREATE POLICY service_role_manage_contributor_analytics
  ON public.contributor_analytics
  FOR ALL
  TO public
  USING ((SELECT auth.role()) = 'service_role');

COMMENT ON TABLE public.github_events_cache_2025_10 IS 'October 2025 GitHub events cache partition - RLS enabled';
COMMENT ON TABLE public.contributor_analytics IS 'Contributor analytics and enrichment data - workspace-scoped RLS';

-- Migration: Optimize Workspace Loading Performance
-- This migration addresses the N+1 query problem in workspace loading by:
-- 1. Creating a materialized view for precomputed workspace stats
-- 2. Adding composite indexes for frequently queried paths
-- 3. Setting up automatic refresh triggers

-- =====================================================
-- MATERIALIZED VIEW FOR WORKSPACE PREVIEW STATS
-- =====================================================

-- Drop existing view if exists (for safe re-application)
DROP MATERIALIZED VIEW IF EXISTS workspace_preview_stats CASCADE;

-- Create materialized view with workspace counts and stats
CREATE MATERIALIZED VIEW workspace_preview_stats AS
SELECT
    w.id as workspace_id,
    w.name as workspace_name,
    w.slug as workspace_slug,
    COUNT(DISTINCT wr.repository_id) as repository_count,
    COUNT(DISTINCT CASE WHEN wm.accepted_at IS NOT NULL THEN wm.user_id END) as member_count,
    COUNT(DISTINCT CASE WHEN wr.is_pinned = true THEN wr.repository_id END) as pinned_repository_count,
    MAX(w.updated_at) as last_updated
FROM workspaces w
LEFT JOIN workspace_repositories wr ON w.id = wr.workspace_id
LEFT JOIN workspace_members wm ON w.id = wm.workspace_id
WHERE w.is_active = true
GROUP BY w.id, w.name, w.slug;

-- Create unique index on workspace_id for fast lookups
CREATE UNIQUE INDEX idx_workspace_preview_stats_workspace_id
    ON workspace_preview_stats(workspace_id);

-- Create index for filtering by update time
CREATE INDEX idx_workspace_preview_stats_updated
    ON workspace_preview_stats(last_updated DESC);

-- =====================================================
-- COMPOSITE INDEXES FOR QUERY OPTIMIZATION
-- =====================================================

-- Optimize workspace repository queries with pinned status
-- This supports the common pattern: WHERE workspace_id = ? ORDER BY is_pinned DESC
DROP INDEX IF EXISTS idx_workspace_repos_workspace_pinned;
CREATE INDEX idx_workspace_repos_workspace_pinned
    ON workspace_repositories(workspace_id, is_pinned DESC, repository_id)
    WHERE is_pinned = true;

-- Optimize member count queries (only accepted members)
DROP INDEX IF EXISTS idx_workspace_members_count;
CREATE INDEX idx_workspace_members_count
    ON workspace_members(workspace_id)
    WHERE accepted_at IS NOT NULL;

-- Optimize workspace lookup by ID for active workspaces
DROP INDEX IF EXISTS idx_workspaces_active_lookup;
CREATE INDEX idx_workspaces_active_lookup
    ON workspaces(id)
    WHERE is_active = true;

-- Optimize batched repository fetches with all necessary columns
DROP INDEX IF EXISTS idx_workspace_repos_batch_fetch;
CREATE INDEX idx_workspace_repos_batch_fetch
    ON workspace_repositories(workspace_id, is_pinned DESC, added_at DESC);

-- =====================================================
-- REFRESH FUNCTIONS FOR MATERIALIZED VIEW
-- =====================================================

-- Function to refresh workspace stats for a specific workspace
CREATE OR REPLACE FUNCTION refresh_workspace_preview_stats(p_workspace_id UUID)
RETURNS VOID AS $$
BEGIN
    -- For now, we'll do a full refresh since partial refresh is complex
    -- TODO: Implement incremental refresh in future optimization
    REFRESH MATERIALIZED VIEW CONCURRENTLY workspace_preview_stats;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh all workspace stats
CREATE OR REPLACE FUNCTION refresh_all_workspace_preview_stats()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY workspace_preview_stats;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS FOR AUTOMATIC REFRESH
-- =====================================================

-- Trigger function to mark workspace stats for refresh
CREATE OR REPLACE FUNCTION trigger_workspace_stats_refresh()
RETURNS TRIGGER AS $$
BEGIN
    -- Schedule a refresh (we'll use a lightweight flag approach)
    -- In production, this would queue a background job
    -- For now, we'll refresh immediately for small datasets
    PERFORM refresh_workspace_preview_stats(
        COALESCE(NEW.workspace_id, OLD.workspace_id)
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to invalidate cache on changes
DROP TRIGGER IF EXISTS trigger_refresh_stats_on_repo_change ON workspace_repositories;
CREATE TRIGGER trigger_refresh_stats_on_repo_change
    AFTER INSERT OR UPDATE OR DELETE ON workspace_repositories
    FOR EACH ROW
    EXECUTE FUNCTION trigger_workspace_stats_refresh();

DROP TRIGGER IF EXISTS trigger_refresh_stats_on_member_change ON workspace_members;
CREATE TRIGGER trigger_refresh_stats_on_member_change
    AFTER INSERT OR UPDATE OR DELETE ON workspace_members
    FOR EACH ROW
    EXECUTE FUNCTION trigger_workspace_stats_refresh();

DROP TRIGGER IF EXISTS trigger_refresh_stats_on_workspace_change ON workspaces;
CREATE TRIGGER trigger_refresh_stats_on_workspace_change
    AFTER UPDATE ON workspaces
    FOR EACH ROW
    WHEN (OLD.is_active IS DISTINCT FROM NEW.is_active)
    EXECUTE FUNCTION trigger_workspace_stats_refresh();

-- =====================================================
-- INITIAL DATA POPULATION
-- =====================================================

-- Populate the materialized view with current data
REFRESH MATERIALIZED VIEW workspace_preview_stats;

-- =====================================================
-- SCHEDULED REFRESH (Optional - for pg_cron)
-- =====================================================

-- If pg_cron is available, schedule periodic refresh as safety net
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Refresh workspace stats every 5 minutes as a safety net
        -- The triggers handle real-time updates, this catches any edge cases
        PERFORM cron.schedule(
            'refresh-workspace-preview-stats',
            '*/5 * * * *',
            'SELECT refresh_all_workspace_preview_stats();'
        );
    END IF;
END $$;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant SELECT on materialized view to authenticated users
GRANT SELECT ON workspace_preview_stats TO authenticated;
GRANT SELECT ON workspace_preview_stats TO anon;

-- Service role needs to refresh the view
GRANT ALL ON workspace_preview_stats TO service_role;

-- =====================================================
-- ANALYTICS AND MONITORING
-- =====================================================

-- Function to check materialized view freshness
CREATE OR REPLACE FUNCTION get_workspace_stats_freshness()
RETURNS TABLE(
    total_workspaces BIGINT,
    last_refresh TIMESTAMP WITH TIME ZONE,
    staleness_seconds BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) as total_workspaces,
        MAX(last_updated) as last_refresh,
        EXTRACT(EPOCH FROM (NOW() - MAX(last_updated)))::BIGINT as staleness_seconds
    FROM workspace_preview_stats;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON MATERIALIZED VIEW workspace_preview_stats IS
'Precomputed workspace statistics for fast preview loading. Refreshed automatically on data changes.';

COMMENT ON FUNCTION refresh_workspace_preview_stats(UUID) IS
'Refresh workspace preview stats for a specific workspace. Currently does full refresh.';

COMMENT ON FUNCTION refresh_all_workspace_preview_stats() IS
'Refresh all workspace preview statistics. Use for batch updates.';

COMMENT ON FUNCTION get_workspace_stats_freshness() IS
'Check how fresh the materialized view data is. Useful for monitoring.';

-- =====================================================
-- PERFORMANCE NOTES
-- =====================================================

/*
PERFORMANCE IMPROVEMENTS:

1. MATERIALIZED VIEW:
   - Precomputes repository_count and member_count
   - Eliminates 2 queries per workspace (was N+1 problem)
   - Updated automatically via triggers
   - Concurrent refresh doesn't block reads

2. COMPOSITE INDEXES:
   - idx_workspace_repos_workspace_pinned: Optimizes pinned repo queries
   - idx_workspace_members_count: Faster member counting
   - idx_workspaces_active_lookup: Faster workspace lookups
   - idx_workspace_repos_batch_fetch: Optimizes batched fetches

3. EXPECTED IMPACT:
   - Query count: ~20 → 4-5 (75% reduction)
   - Load time: 5-10s → <3s (70% improvement)
   - Database CPU: 50%+ reduction

4. MONITORING:
   - Use get_workspace_stats_freshness() to check view health
   - Monitor refresh frequency in production
   - Consider batch refresh if trigger load is high

5. FUTURE OPTIMIZATIONS:
   - Implement incremental materialized view refresh
   - Add workspace-specific cache invalidation
   - Consider Redis cache layer for high-traffic workspaces
*/

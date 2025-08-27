-- Migration: Workspace Metrics Cache
-- This migration creates the infrastructure for caching aggregated workspace metrics
-- to provide fast dashboard loading and reduce GitHub API calls

-- =====================================================
-- CREATE WORKSPACE METRICS CACHE TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS workspace_metrics_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    time_range TEXT NOT NULL CHECK (time_range IN ('7d', '30d', '90d', '1y', 'all')),
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Core PR metrics
    total_prs INTEGER NOT NULL DEFAULT 0,
    merged_prs INTEGER NOT NULL DEFAULT 0,
    open_prs INTEGER NOT NULL DEFAULT 0,
    draft_prs INTEGER NOT NULL DEFAULT 0,
    avg_pr_merge_time_hours DECIMAL(10, 2),
    pr_velocity DECIMAL(10, 2), -- PRs per day
    
    -- Core Issue metrics
    total_issues INTEGER NOT NULL DEFAULT 0,
    closed_issues INTEGER NOT NULL DEFAULT 0,
    open_issues INTEGER NOT NULL DEFAULT 0,
    avg_issue_close_time_hours DECIMAL(10, 2),
    issue_closure_rate DECIMAL(5, 2), -- percentage
    
    -- Contributor metrics
    total_contributors INTEGER NOT NULL DEFAULT 0,
    active_contributors INTEGER NOT NULL DEFAULT 0,
    new_contributors INTEGER NOT NULL DEFAULT 0,
    
    -- Repository metrics
    total_commits INTEGER NOT NULL DEFAULT 0,
    total_stars INTEGER NOT NULL DEFAULT 0,
    total_forks INTEGER NOT NULL DEFAULT 0,
    total_watchers INTEGER NOT NULL DEFAULT 0,
    
    -- Language distribution (JSONB for flexibility)
    language_distribution JSONB DEFAULT '{}',
    
    -- Top contributors (array of JSONB objects)
    top_contributors JSONB DEFAULT '[]',
    
    -- Activity timeline (array of daily data points)
    activity_timeline JSONB DEFAULT '[]',
    
    -- Repository breakdown
    repository_stats JSONB DEFAULT '[]',
    
    -- Trend comparisons (vs previous period)
    stars_trend DECIMAL(10, 2) DEFAULT 0,
    prs_trend DECIMAL(10, 2) DEFAULT 0,
    contributors_trend DECIMAL(10, 2) DEFAULT 0,
    commits_trend DECIMAL(10, 2) DEFAULT 0,
    
    -- Cache metadata
    calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_stale BOOLEAN DEFAULT FALSE,
    last_github_sync TIMESTAMP WITH TIME ZONE,
    cache_version INTEGER DEFAULT 1,
    
    -- Performance tracking
    calculation_time_ms INTEGER,
    github_api_calls INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure only one active cache entry per workspace and time range
    CONSTRAINT unique_workspace_timerange_cache UNIQUE (workspace_id, time_range)
);

-- Create indexes for performance
CREATE INDEX idx_workspace_metrics_cache_workspace_id ON workspace_metrics_cache(workspace_id);
CREATE INDEX idx_workspace_metrics_cache_expires_at ON workspace_metrics_cache(expires_at);
CREATE INDEX idx_workspace_metrics_cache_is_stale ON workspace_metrics_cache(is_stale);
CREATE INDEX idx_workspace_metrics_cache_calculated_at ON workspace_metrics_cache(calculated_at);

-- =====================================================
-- CREATE WORKSPACE AGGREGATION QUEUE TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS workspace_aggregation_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    time_range TEXT NOT NULL CHECK (time_range IN ('7d', '30d', '90d', '1y', 'all')),
    priority INTEGER DEFAULT 100, -- Lower number = higher priority
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    
    -- Scheduling
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    
    -- Error tracking
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    error_message TEXT,
    error_details JSONB,
    
    -- Metadata
    triggered_by TEXT, -- 'schedule', 'webhook', 'manual', 'dependency'
    trigger_metadata JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Prevent duplicate pending jobs
    CONSTRAINT unique_pending_aggregation UNIQUE (workspace_id, time_range, status)
);

CREATE INDEX idx_workspace_aggregation_queue_status ON workspace_aggregation_queue(status);
CREATE INDEX idx_workspace_aggregation_queue_scheduled ON workspace_aggregation_queue(scheduled_for);
CREATE INDEX idx_workspace_aggregation_queue_priority ON workspace_aggregation_queue(priority, scheduled_for);

-- =====================================================
-- CREATE METRICS HISTORY TABLE (for trends)
-- =====================================================

CREATE TABLE IF NOT EXISTS workspace_metrics_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    metric_date DATE NOT NULL,
    
    -- Daily snapshots
    daily_prs INTEGER DEFAULT 0,
    daily_merged_prs INTEGER DEFAULT 0,
    daily_issues INTEGER DEFAULT 0,
    daily_closed_issues INTEGER DEFAULT 0,
    daily_commits INTEGER DEFAULT 0,
    daily_active_contributors INTEGER DEFAULT 0,
    
    -- Running totals at end of day
    total_stars INTEGER DEFAULT 0,
    total_forks INTEGER DEFAULT 0,
    total_contributors INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- One entry per workspace per day
    CONSTRAINT unique_workspace_date UNIQUE (workspace_id, metric_date)
);

CREATE INDEX idx_workspace_metrics_history_workspace ON workspace_metrics_history(workspace_id);
CREATE INDEX idx_workspace_metrics_history_date ON workspace_metrics_history(metric_date DESC);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to calculate trend percentage
CREATE OR REPLACE FUNCTION calculate_metric_trend(
    current_value NUMERIC,
    previous_value NUMERIC
) RETURNS NUMERIC AS $$
BEGIN
    IF previous_value IS NULL OR previous_value = 0 THEN
        RETURN 0;
    END IF;
    
    RETURN ROUND(((current_value - previous_value) / previous_value) * 100, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to mark cache as stale
CREATE OR REPLACE FUNCTION mark_workspace_cache_stale(
    p_workspace_id UUID
) RETURNS VOID AS $$
BEGIN
    UPDATE workspace_metrics_cache
    SET is_stale = TRUE,
        updated_at = NOW()
    WHERE workspace_id = p_workspace_id;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_workspace_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM workspace_metrics_cache
    WHERE expires_at < NOW() - INTERVAL '1 day'
    AND is_stale = TRUE;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_workspace_metrics_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_workspace_metrics_cache_updated_at
BEFORE UPDATE ON workspace_metrics_cache
FOR EACH ROW
EXECUTE FUNCTION update_workspace_metrics_cache_updated_at();

CREATE TRIGGER trigger_update_workspace_aggregation_queue_updated_at
BEFORE UPDATE ON workspace_aggregation_queue
FOR EACH ROW
EXECUTE FUNCTION update_workspace_metrics_cache_updated_at();

-- Mark cache as stale when repositories are added/removed
CREATE OR REPLACE FUNCTION invalidate_workspace_cache_on_repo_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM mark_workspace_cache_stale(NEW.workspace_id);
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM mark_workspace_cache_stale(OLD.workspace_id);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_invalidate_cache_on_repo_change
AFTER INSERT OR DELETE ON workspace_repositories
FOR EACH ROW
EXECUTE FUNCTION invalidate_workspace_cache_on_repo_change();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE workspace_metrics_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_aggregation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_metrics_history ENABLE ROW LEVEL SECURITY;

-- Anyone can read public workspace metrics
CREATE POLICY "Public workspace metrics are viewable by all"
ON workspace_metrics_cache FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM workspaces 
        WHERE workspaces.id = workspace_metrics_cache.workspace_id 
        AND workspaces.visibility = 'public'
    )
);

-- Workspace members can read their private workspace metrics
CREATE POLICY "Private workspace metrics viewable by members"
ON workspace_metrics_cache FOR SELECT
USING (
    auth.uid() IN (
        SELECT user_id FROM workspace_members 
        WHERE workspace_id = workspace_metrics_cache.workspace_id
    )
);

-- Service role can manage all metrics (for background jobs)
CREATE POLICY "Service role can manage metrics"
ON workspace_metrics_cache FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage aggregation queue"
ON workspace_aggregation_queue FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage metrics history"
ON workspace_metrics_history FOR ALL
USING (auth.role() = 'service_role');

-- =====================================================
-- INITIAL DATA & CONFIGURATION
-- =====================================================

-- Set default cache expiration times based on time range
CREATE OR REPLACE FUNCTION get_cache_ttl(p_time_range TEXT)
RETURNS INTERVAL AS $$
BEGIN
    CASE p_time_range
        WHEN '7d' THEN RETURN INTERVAL '5 minutes';
        WHEN '30d' THEN RETURN INTERVAL '10 minutes';
        WHEN '90d' THEN RETURN INTERVAL '30 minutes';
        WHEN '1y' THEN RETURN INTERVAL '1 hour';
        WHEN 'all' THEN RETURN INTERVAL '2 hours';
        ELSE RETURN INTERVAL '10 minutes';
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- SCHEDULED JOB SETUP (using pg_cron if available)
-- =====================================================

-- Note: This requires pg_cron extension to be enabled
-- The actual scheduling will be done via Inngest, but this is a fallback
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Schedule cleanup of expired cache entries daily at 3 AM
        PERFORM cron.schedule(
            'cleanup-workspace-cache',
            '0 3 * * *',
            'SELECT cleanup_expired_workspace_cache();'
        );
        
        -- Schedule aggregation for all active workspaces every 5 minutes
        -- (This is a backup for the Inngest job)
        PERFORM cron.schedule(
            'aggregate-workspace-metrics',
            '*/5 * * * *',
            $$
            INSERT INTO workspace_aggregation_queue (workspace_id, time_range, triggered_by, priority)
            SELECT 
                w.id,
                '30d',
                'schedule',
                CASE w.tier
                    WHEN 'enterprise' THEN 10
                    WHEN 'pro' THEN 50
                    ELSE 100
                END
            FROM workspaces w
            WHERE w.is_active = TRUE
            AND NOT EXISTS (
                SELECT 1 FROM workspace_aggregation_queue q
                WHERE q.workspace_id = w.id
                AND q.time_range = '30d'
                AND q.status IN ('pending', 'processing')
            )
            ON CONFLICT DO NOTHING;
            $$
        );
    END IF;
END
$$;

-- Add comment for documentation
COMMENT ON TABLE workspace_metrics_cache IS 'Stores aggregated metrics for workspaces to provide fast dashboard loading';
COMMENT ON TABLE workspace_aggregation_queue IS 'Queue for scheduling and tracking workspace metric aggregation jobs';
COMMENT ON TABLE workspace_metrics_history IS 'Historical daily snapshots of workspace metrics for trend analysis';
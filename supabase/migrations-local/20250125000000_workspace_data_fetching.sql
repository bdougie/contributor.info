-- Local-safe version of 20250125000000_workspace_data_fetching.sql
-- Generated: 2025-08-27T02:47:08.045Z
-- This migration has been modified to work without auth, roles, and extensions
-- Original migration may have different behavior in production

-- Transaction wrapper for safety
BEGIN;


-- Ensure authenticated exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated;
    RAISE NOTICE 'Created missing role: authenticated';
  END IF;
END $$;

-- Ensure service_role exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role;
    RAISE NOTICE 'Created missing role: service_role';
  END IF;
END $$;

-- Migration: Workspace Data Fetching Infrastructure
-- This migration adds support for workspace-specific data fetching
-- including issues, commit activity, and repository metadata

-- =====================================================
-- PHASE 1.1: WORKSPACE-TRACKED REPOSITORIES JOIN TABLE
-- =====================================================

-- Create join table linking workspaces to tracked repositories
-- This allows one repository to be tracked by multiple workspaces
-- with different settings for each workspace
CREATE TABLE IF NOT EXISTS workspace_tracked_repositories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    tracked_repository_id UUID NOT NULL REFERENCES tracked_repositories(id) ON DELETE CASCADE,
    
    -- Workspace-specific sync settings
    sync_frequency_hours INTEGER DEFAULT 24 CHECK (sync_frequency_hours >= 1 AND sync_frequency_hours <= 168),
    data_retention_days INTEGER DEFAULT 30 CHECK (data_retention_days >= 7 AND data_retention_days <= 365),
    
    -- Feature flags for this workspace-repo combination
    fetch_issues BOOLEAN DEFAULT TRUE,
    fetch_commits BOOLEAN DEFAULT TRUE,
    fetch_reviews BOOLEAN DEFAULT TRUE,
    fetch_comments BOOLEAN DEFAULT TRUE,
    
    -- Sync tracking
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    added_by UUID NOT NULL, -- References auth.users(id)
    last_sync_at TIMESTAMPTZ,
    next_sync_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
    last_sync_status TEXT CHECK (last_sync_status IN ('success', 'partial', 'failed')),
    last_sync_error TEXT,
    sync_attempts INTEGER DEFAULT 0,
    
    -- Statistics
    total_issues_fetched INTEGER DEFAULT 0,
    total_commits_fetched INTEGER DEFAULT 0,
    total_reviews_fetched INTEGER DEFAULT 0,
    
    -- Metadata
    priority_score INTEGER DEFAULT 50 CHECK (priority_score >= 0 AND priority_score <= 100),
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    
    -- Ensure unique pairing
    CONSTRAINT unique_workspace_tracked_repo UNIQUE (workspace_id, tracked_repository_id)
);

-- =====================================================
-- PHASE 1.2: DAILY ACTIVITY METRICS TABLE
-- =====================================================

-- Store daily activity metrics for repositories
-- Used for activity charts and trend analysis in workspace UI
CREATE TABLE IF NOT EXISTS daily_activity_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    
    -- Commit metrics
    commits_count INTEGER DEFAULT 0 CHECK (commits_count >= 0),
    additions INTEGER DEFAULT 0 CHECK (additions >= 0),
    deletions INTEGER DEFAULT 0 CHECK (deletions >= 0),
    files_changed INTEGER DEFAULT 0 CHECK (files_changed >= 0),
    unique_authors INTEGER DEFAULT 0 CHECK (unique_authors >= 0),
    
    -- PR metrics
    prs_opened INTEGER DEFAULT 0 CHECK (prs_opened >= 0),
    prs_merged INTEGER DEFAULT 0 CHECK (prs_merged >= 0),
    prs_closed INTEGER DEFAULT 0 CHECK (prs_closed >= 0),
    prs_reviewed INTEGER DEFAULT 0 CHECK (prs_reviewed >= 0),
    avg_pr_merge_time_hours DECIMAL(10, 2),
    
    -- Issue metrics
    issues_opened INTEGER DEFAULT 0 CHECK (issues_opened >= 0),
    issues_closed INTEGER DEFAULT 0 CHECK (issues_closed >= 0),
    issues_commented INTEGER DEFAULT 0 CHECK (issues_commented >= 0),
    avg_issue_close_time_hours DECIMAL(10, 2),
    
    -- Contributor metrics
    active_contributors INTEGER DEFAULT 0 CHECK (active_contributors >= 0),
    new_contributors INTEGER DEFAULT 0 CHECK (new_contributors >= 0),
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data_source TEXT DEFAULT 'github_api' CHECK (data_source IN ('github_api', 'webhook', 'manual', 'calculated')),
    is_complete BOOLEAN DEFAULT FALSE, -- Indicates if all metrics are captured for this day
    
    CONSTRAINT unique_repo_date UNIQUE (repository_id, date)
);

-- =====================================================
-- PHASE 1.3: WORKSPACE ISSUES CACHE TABLE
-- =====================================================

-- Cache issues data aggregated at workspace level for performance
CREATE TABLE IF NOT EXISTS workspace_issues_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Time range for these metrics
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    time_range TEXT NOT NULL CHECK (time_range IN ('24h', '7d', '30d', '90d')),
    
    -- Aggregated issue metrics
    total_issues INTEGER DEFAULT 0,
    open_issues INTEGER DEFAULT 0,
    closed_issues INTEGER DEFAULT 0,
    
    -- Issue statistics
    avg_time_to_close_hours DECIMAL(10, 2),
    median_time_to_close_hours DECIMAL(10, 2),
    
    -- Issue breakdown by label (stored as JSONB for flexibility)
    issues_by_label JSONB DEFAULT '{}'::jsonb,
    /* Example structure:
    {
        "bug": 45,
        "feature": 30,
        "documentation": 15,
        "enhancement": 20
    }
    */
    
    -- Issue breakdown by repository
    issues_by_repository JSONB DEFAULT '{}'::jsonb,
    /* Example structure:
    {
        "repo_uuid_1": {
            "name": "repo1",
            "total": 50,
            "open": 10,
            "closed": 40
        }
    }
    */
    
    -- Top issues (most commented/reacted)
    top_issues JSONB DEFAULT '[]'::jsonb,
    /* Example structure:
    [
        {
            "id": "issue_uuid",
            "number": 123,
            "title": "Issue title",
            "comments_count": 45,
            "repository_name": "owner/repo"
        }
    ]
    */
    
    -- Cache management
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),
    is_stale BOOLEAN DEFAULT FALSE,
    
    -- Ensure unique cache entry per workspace and time range
    CONSTRAINT unique_workspace_issues_cache UNIQUE (workspace_id, time_range, period_end)
);

-- =====================================================
-- PHASE 1.4: REPOSITORY METADATA ENHANCEMENTS
-- =====================================================

-- Add missing repository metadata fields if they don't exist
ALTER TABLE repositories 
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS homepage_url TEXT,
ADD COLUMN IF NOT EXISTS topics TEXT[],
ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_fork BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS parent_repository_id UUID REFERENCES repositories(id),
ADD COLUMN IF NOT EXISTS has_issues BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS has_projects BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS has_wiki BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS has_discussions BOOLEAN DEFAULT FALSE;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Indexes for workspace_tracked_repositories
CREATE INDEX IF NOT EXISTS idx_workspace_tracked_repos_workspace 
ON workspace_tracked_repositories(workspace_id) 
WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_workspace_tracked_repos_tracked 
ON workspace_tracked_repositories(tracked_repository_id) 
WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_workspace_tracked_repos_next_sync 
ON workspace_tracked_repositories(next_sync_at) 
WHERE is_active = TRUE AND next_sync_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workspace_tracked_repos_priority 
ON workspace_tracked_repositories(priority_score DESC, next_sync_at) 
WHERE is_active = TRUE;

-- Composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_workspace_tracked_repos_sync_status 
ON workspace_tracked_repositories(workspace_id, last_sync_status, next_sync_at) 
WHERE is_active = TRUE;

-- Indexes for daily_activity_metrics
CREATE INDEX IF NOT EXISTS idx_daily_metrics_repo 
ON daily_activity_metrics(repository_id);

CREATE INDEX IF NOT EXISTS idx_daily_metrics_date 
ON daily_activity_metrics(date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_metrics_repo_date 
ON daily_activity_metrics(repository_id, date DESC);

-- Partial index for recent complete metrics
-- Note: Using a static date comparison instead of CURRENT_DATE for immutability
CREATE INDEX IF NOT EXISTS idx_daily_metrics_recent_complete 
ON daily_activity_metrics(repository_id, date DESC) 
WHERE is_complete = TRUE;

-- Indexes for workspace_issues_cache
CREATE INDEX IF NOT EXISTS idx_workspace_issues_cache_workspace 
ON workspace_issues_cache(workspace_id);

CREATE INDEX IF NOT EXISTS idx_workspace_issues_cache_lookup 
ON workspace_issues_cache(workspace_id, time_range, period_end);

CREATE INDEX IF NOT EXISTS idx_workspace_issues_cache_expires 
ON workspace_issues_cache(expires_at) 
WHERE is_stale = FALSE;

-- Indexes for repository metadata
CREATE INDEX IF NOT EXISTS idx_repositories_avatar 
ON repositories(avatar_url) 
WHERE avatar_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_repositories_topics 
ON repositories USING GIN(topics) 
WHERE topics IS NOT NULL AND array_length(topics, 1) > 0;

-- =====================================================
-- FUNCTIONS FOR DATA MANAGEMENT
-- =====================================================

-- Function to calculate priority score for workspace-tracked repositories
CREATE OR REPLACE FUNCTION calculate_workspace_repo_priority(
    p_workspace_id UUID,
    p_tracked_repository_id UUID
) RETURNS INTEGER AS $$
DECLARE
    v_priority INTEGER := 50; -- Base priority
    v_workspace_tier TEXT;
    v_last_sync_interval INTERVAL;
    v_repo_stars INTEGER;
BEGIN
    -- Get workspace tier
    SELECT tier INTO v_workspace_tier
    FROM workspaces
    WHERE id = p_workspace_id;
    
    -- Adjust for tier
    CASE v_workspace_tier
        WHEN 'private' THEN v_priority := v_priority + 30;
        WHEN 'pro' THEN v_priority := v_priority + 20;
        WHEN 'free' THEN v_priority := v_priority + 0;
    END CASE;
    
    -- Get last sync time
    SELECT NOW() - last_sync_at INTO v_last_sync_interval
    FROM workspace_tracked_repositories
    WHERE workspace_id = p_workspace_id 
    AND tracked_repository_id = p_tracked_repository_id;
    
    -- Increase priority for stale data
    IF v_last_sync_interval > INTERVAL '7 days' THEN
        v_priority := v_priority + 20;
    ELSIF v_last_sync_interval > INTERVAL '3 days' THEN
        v_priority := v_priority + 10;
    END IF;
    
    -- Get repository popularity
    SELECT r.stargazers_count INTO v_repo_stars
    FROM repositories r
    JOIN tracked_repositories tr ON tr.repository_id = r.id
    WHERE tr.id = p_tracked_repository_id;
    
    -- Adjust for repository popularity
    IF v_repo_stars > 1000 THEN
        v_priority := v_priority + 10;
    ELSIF v_repo_stars > 100 THEN
        v_priority := v_priority + 5;
    END IF;
    
    -- Ensure priority stays within bounds
    RETURN LEAST(GREATEST(v_priority, 0), 100);
END;
$$ LANGUAGE plpgsql;

-- Function to get workspace repositories requiring sync
CREATE OR REPLACE FUNCTION get_workspace_repos_for_sync(
    p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
    workspace_id UUID,
    tracked_repository_id UUID,
    repository_id UUID,
    repository_name TEXT,
    priority_score INTEGER,
    last_sync_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        wtr.workspace_id,
        wtr.tracked_repository_id,
        tr.repository_id,
        r.full_name as repository_name,
        wtr.priority_score,
        wtr.last_sync_at
    FROM workspace_tracked_repositories wtr
    JOIN tracked_repositories tr ON tr.id = wtr.tracked_repository_id
    JOIN repositories r ON r.id = tr.repository_id
    WHERE wtr.is_active = TRUE
    AND wtr.next_sync_at <= NOW()
    ORDER BY wtr.priority_score DESC, wtr.next_sync_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to update sync status after successful sync
CREATE OR REPLACE FUNCTION update_workspace_sync_status(
    p_workspace_id UUID,
    p_tracked_repository_id UUID,
    p_status TEXT,
    p_error TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    UPDATE workspace_tracked_repositories
    SET 
        last_sync_at = NOW(),
        next_sync_at = NOW() + (sync_frequency_hours || ' hours')::INTERVAL,
        last_sync_status = p_status,
        last_sync_error = p_error,
        sync_attempts = CASE 
            WHEN p_status = 'success' THEN 0 
            ELSE sync_attempts + 1 
        END
    WHERE workspace_id = p_workspace_id 
    AND tracked_repository_id = p_tracked_repository_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger to update priority score when workspace tier changes
CREATE OR REPLACE FUNCTION update_workspace_repo_priorities()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE workspace_tracked_repositories
    SET priority_score = calculate_workspace_repo_priority(NEW.id, tracked_repository_id)
    WHERE workspace_id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_priorities_on_tier_change
AFTER UPDATE OF tier ON workspaces
FOR EACH ROW
WHEN (OLD.tier IS DISTINCT FROM NEW.tier)
EXECUTE FUNCTION update_workspace_repo_priorities();

-- Trigger to auto-update updated_at timestamp
CREATE TRIGGER update_daily_metrics_updated_at
BEFORE UPDATE ON daily_activity_metrics
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- PERMISSIONS
-- =====================================================

-- DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    Grant permissions for authenticated users
GRANT SELECT ON workspace_tracked_repositories TO authenticated;
  ELSE
    RAISE NOTICE 'Role authenticated not found, skipping grant';
  END IF;
END $;
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT ON daily_activity_metrics TO authenticated;
  ELSE
    RAISE NOTICE 'Role authenticated not found, skipping grant';
  END IF;
END $;
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT ON workspace_issues_cache TO authenticated;
  ELSE
    RAISE NOTICE 'Role authenticated not found, skipping grant';
  END IF;
END $;

-- DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    Grant permissions for service role (for backend operations)
GRANT ALL ON workspace_tracked_repositories TO service_role;
  ELSE
    RAISE NOTICE 'Role service_role not found, skipping grant';
  END IF;
END $;
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON daily_activity_metrics TO service_role;
  ELSE
    RAISE NOTICE 'Role service_role not found, skipping grant';
  END IF;
END $;
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON workspace_issues_cache TO service_role;
  ELSE
    RAISE NOTICE 'Role service_role not found, skipping grant';
  END IF;
END $;

-- DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION calculate_workspace_repo_priority(UUID, UUID) TO authenticated;
  ELSE
    RAISE NOTICE 'Role authenticated not found, skipping grant';
  END IF;
END $;
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION get_workspace_repos_for_sync(INTEGER) TO authenticated;
  ELSE
    RAISE NOTICE 'Role authenticated not found, skipping grant';
  END IF;
END $;
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION update_workspace_sync_status(UUID, UUID, TEXT, TEXT) TO service_role;
  ELSE
    RAISE NOTICE 'Role service_role not found, skipping grant';
  END IF;
END $;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE workspace_tracked_repositories IS 'Join table linking workspaces to tracked repositories with workspace-specific settings';
COMMENT ON TABLE daily_activity_metrics IS 'Daily aggregated metrics for repository activity, used for charts and trends';
COMMENT ON TABLE workspace_issues_cache IS 'Cached issue metrics at workspace level for performance optimization';

COMMENT ON COLUMN workspace_tracked_repositories.priority_score IS 'Calculated priority (0-100) for sync ordering based on tier, staleness, and popularity';
COMMENT ON COLUMN workspace_tracked_repositories.data_retention_days IS 'How long to keep detailed data for this workspace-repo combination';
COMMENT ON COLUMN daily_activity_metrics.is_complete IS 'Whether all metrics have been captured for this day';
COMMENT ON COLUMN workspace_issues_cache.time_range IS 'Time window for aggregated metrics: 24h, 7d, 30d, or 90d';

COMMENT ON FUNCTION calculate_workspace_repo_priority IS 'Calculates sync priority based on workspace tier, data staleness, and repository popularity';
COMMENT ON FUNCTION get_workspace_repos_for_sync IS 'Returns workspace repositories that need syncing, ordered by priority';
COMMENT ON FUNCTION update_workspace_sync_status IS 'Updates sync tracking after a sync attempt';

COMMIT;
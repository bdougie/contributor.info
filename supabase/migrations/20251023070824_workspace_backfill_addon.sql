-- Migration: Workspace Backfill Addon System
-- Description: Add tables and functions to support Extended Data Retention addon
-- with automatic workspace-level historical data backfill
-- Related Issue: #1153

-- =============================================================================
-- SUBSCRIPTION ADDONS TABLE
-- =============================================================================
-- Track purchased addons for each subscription
CREATE TABLE IF NOT EXISTS subscription_addons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID NOT NULL,
  addon_type TEXT NOT NULL CHECK (addon_type IN ('extended_data_retention', 'additional_workspace', 'additional_member')),
  addon_product_id TEXT NOT NULL,

  -- Addon-specific configuration
  retention_days INTEGER,
  max_workspaces INTEGER,
  max_members INTEGER,

  -- Lifecycle
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired', 'canceled')),

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  UNIQUE(subscription_id, addon_type)
);

-- Add foreign key to subscriptions table
ALTER TABLE subscription_addons
  ADD CONSTRAINT subscription_addons_subscription_id_fkey
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE;

-- Indexes for subscription addon queries
CREATE INDEX idx_subscription_addons_subscription_id ON subscription_addons(subscription_id);
CREATE INDEX idx_subscription_addons_addon_type ON subscription_addons(addon_type);
CREATE INDEX idx_subscription_addons_status ON subscription_addons(status);
CREATE INDEX idx_subscription_addons_purchased_at ON subscription_addons(purchased_at);

-- =============================================================================
-- WORKSPACE BACKFILL JOBS TABLE
-- =============================================================================
-- Track workspace-level backfill operations triggered by addon purchases
CREATE TABLE IF NOT EXISTS workspace_backfill_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  subscription_addon_id UUID REFERENCES subscription_addons(id) ON DELETE SET NULL,

  -- Configuration
  retention_days INTEGER NOT NULL DEFAULT 365,
  backfill_types TEXT[] NOT NULL DEFAULT ARRAY['pull_requests', 'issues', 'discussions', 'comments', 'reviews', 'events', 'embeddings'],

  -- Progress tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'canceled')),
  total_repositories INTEGER DEFAULT 0,
  completed_repositories INTEGER DEFAULT 0,
  failed_repositories INTEGER DEFAULT 0,

  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  estimated_completion_at TIMESTAMPTZ,

  -- Error tracking
  error_message TEXT,
  error_details JSONB,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for workspace backfill job queries
CREATE INDEX idx_workspace_backfill_jobs_workspace_id ON workspace_backfill_jobs(workspace_id);
CREATE INDEX idx_workspace_backfill_jobs_status ON workspace_backfill_jobs(status);
CREATE INDEX idx_workspace_backfill_jobs_created_at ON workspace_backfill_jobs(created_at);
CREATE INDEX idx_workspace_backfill_jobs_addon_id ON workspace_backfill_jobs(subscription_addon_id);

-- =============================================================================
-- WORKSPACE BACKFILL PROGRESS TABLE
-- =============================================================================
-- Track per-repository progress within a workspace backfill job
CREATE TABLE IF NOT EXISTS workspace_backfill_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  backfill_job_id UUID NOT NULL REFERENCES workspace_backfill_jobs(id) ON DELETE CASCADE,
  repository_id TEXT NOT NULL,

  -- Progress per data type
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'skipped')),
  data_types_completed TEXT[] DEFAULT '{}',
  data_types_failed TEXT[] DEFAULT '{}',

  -- Counts
  pull_requests_count INTEGER DEFAULT 0,
  issues_count INTEGER DEFAULT 0,
  discussions_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  reviews_count INTEGER DEFAULT 0,
  events_count INTEGER DEFAULT 0,
  embeddings_count INTEGER DEFAULT 0,

  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Error tracking
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  UNIQUE(backfill_job_id, repository_id)
);

-- Indexes for backfill progress queries
CREATE INDEX idx_workspace_backfill_progress_job_id ON workspace_backfill_progress(backfill_job_id);
CREATE INDEX idx_workspace_backfill_progress_status ON workspace_backfill_progress(status);
CREATE INDEX idx_workspace_backfill_progress_repository ON workspace_backfill_progress(repository_id);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS
ALTER TABLE subscription_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_backfill_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_backfill_progress ENABLE ROW LEVEL SECURITY;

-- Subscription Addons Policies
-- Users can view their own subscription addons
CREATE POLICY "Users can view their subscription addons"
  ON subscription_addons FOR SELECT
  USING (
    subscription_id IN (
      SELECT id FROM subscriptions WHERE user_id = auth.uid()
    )
  );

-- Service role has full access for webhook handlers
CREATE POLICY "Service role has full access to subscription addons"
  ON subscription_addons FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Workspace Backfill Jobs Policies
-- Workspace owners and members can view backfill jobs
CREATE POLICY "Workspace members can view backfill jobs"
  ON workspace_backfill_jobs FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Workspace owners can cancel backfill jobs
CREATE POLICY "Workspace owners can cancel backfill jobs"
  ON workspace_backfill_jobs FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    status = 'canceled' -- Can only update to cancel
  );

-- Service role has full access
CREATE POLICY "Service role has full access to backfill jobs"
  ON workspace_backfill_jobs FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Workspace Backfill Progress Policies
-- Workspace members can view progress
CREATE POLICY "Workspace members can view backfill progress"
  ON workspace_backfill_progress FOR SELECT
  USING (
    backfill_job_id IN (
      SELECT id FROM workspace_backfill_jobs
      WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

-- Service role has full access
CREATE POLICY "Service role has full access to backfill progress"
  ON workspace_backfill_progress FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to get active addons for a user
CREATE OR REPLACE FUNCTION get_user_active_addons(p_user_id UUID)
RETURNS TABLE (
  addon_type TEXT,
  retention_days INTEGER,
  purchased_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sa.addon_type,
    sa.retention_days,
    sa.purchased_at
  FROM subscription_addons sa
  JOIN subscriptions s ON s.id = sa.subscription_id
  WHERE s.user_id = p_user_id
    AND sa.status = 'active'
    AND (sa.expires_at IS NULL OR sa.expires_at > now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has extended data retention
CREATE OR REPLACE FUNCTION has_extended_retention(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM subscription_addons sa
    JOIN subscriptions s ON s.id = sa.subscription_id
    WHERE s.user_id = p_user_id
      AND sa.addon_type = 'extended_data_retention'
      AND sa.status = 'active'
      AND (sa.expires_at IS NULL OR sa.expires_at > now())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get retention days for a user
CREATE OR REPLACE FUNCTION get_user_retention_days(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_retention_days INTEGER;
BEGIN
  SELECT COALESCE(MAX(sa.retention_days), 30) INTO v_retention_days
  FROM subscription_addons sa
  JOIN subscriptions s ON s.id = sa.subscription_id
  WHERE s.user_id = p_user_id
    AND sa.addon_type = 'extended_data_retention'
    AND sa.status = 'active'
    AND (sa.expires_at IS NULL OR sa.expires_at > now());

  RETURN v_retention_days;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update backfill job progress
CREATE OR REPLACE FUNCTION update_backfill_job_progress(
  p_job_id UUID,
  p_completed_repos INTEGER,
  p_failed_repos INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE workspace_backfill_jobs
  SET
    completed_repositories = p_completed_repos,
    failed_repositories = p_failed_repos,
    updated_at = now(),
    status = CASE
      WHEN (p_completed_repos + p_failed_repos) >= total_repositories THEN 'completed'
      ELSE 'in_progress'
    END,
    completed_at = CASE
      WHEN (p_completed_repos + p_failed_repos) >= total_repositories THEN now()
      ELSE completed_at
    END
  WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get workspace backfill status
CREATE OR REPLACE FUNCTION get_workspace_backfill_status(p_workspace_id UUID)
RETURNS TABLE (
  job_id UUID,
  status TEXT,
  total_repositories INTEGER,
  completed_repositories INTEGER,
  failed_repositories INTEGER,
  progress_percentage NUMERIC,
  started_at TIMESTAMPTZ,
  estimated_completion_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    wbj.id,
    wbj.status,
    wbj.total_repositories,
    wbj.completed_repositories,
    wbj.failed_repositories,
    CASE
      WHEN wbj.total_repositories > 0
      THEN ROUND((wbj.completed_repositories::NUMERIC / wbj.total_repositories::NUMERIC) * 100, 2)
      ELSE 0
    END AS progress_percentage,
    wbj.started_at,
    wbj.estimated_completion_at
  FROM workspace_backfill_jobs wbj
  WHERE wbj.workspace_id = p_workspace_id
  ORDER BY wbj.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-update updated_at timestamp for subscription_addons
CREATE OR REPLACE FUNCTION update_subscription_addons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_subscription_addons_updated_at
  BEFORE UPDATE ON subscription_addons
  FOR EACH ROW
  EXECUTE FUNCTION update_subscription_addons_updated_at();

-- Auto-update updated_at timestamp for workspace_backfill_jobs
CREATE OR REPLACE FUNCTION update_workspace_backfill_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_workspace_backfill_jobs_updated_at
  BEFORE UPDATE ON workspace_backfill_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_workspace_backfill_jobs_updated_at();

-- Auto-update updated_at timestamp for workspace_backfill_progress
CREATE OR REPLACE FUNCTION update_workspace_backfill_progress_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_workspace_backfill_progress_updated_at
  BEFORE UPDATE ON workspace_backfill_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_workspace_backfill_progress_updated_at();

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE subscription_addons IS 'Tracks purchased addons for subscriptions (extended retention, additional workspaces, etc.)';
COMMENT ON TABLE workspace_backfill_jobs IS 'Tracks workspace-level backfill operations triggered by addon purchases';
COMMENT ON TABLE workspace_backfill_progress IS 'Tracks per-repository progress within workspace backfill jobs';

COMMENT ON FUNCTION get_user_active_addons IS 'Returns all active addons for a user';
COMMENT ON FUNCTION has_extended_retention IS 'Checks if user has active Extended Data Retention addon';
COMMENT ON FUNCTION get_user_retention_days IS 'Returns data retention days for a user (30 or 365)';
COMMENT ON FUNCTION update_backfill_job_progress IS 'Updates backfill job progress and auto-completes when done';
COMMENT ON FUNCTION get_workspace_backfill_status IS 'Returns current backfill status for a workspace';

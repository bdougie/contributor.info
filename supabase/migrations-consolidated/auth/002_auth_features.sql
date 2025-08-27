-- This migration requires auth schema
DO $$
BEGIN
  -- Check if auth schema exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    RAISE NOTICE 'Auth schema not found. Skipping auth-dependent migrations.';
    RETURN;
  END IF;
END $$;

-- Auth-Dependent Features
-- This migration requires auth schema to be configured
-- Will be skipped if auth is not available

-- From 20241225000000_add_share_analytics.sql
-- Migration: Add share analytics tracking tables
-- Purpose: Track short URL creation and sharing analytics for charts/metrics

-- Table to track short URL creation events
CREATE TABLE IF NOT EXISTS share_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- User and session info
  user_id TEXT, -- GitHub user ID when available
  session_id TEXT, -- Browser session ID for anonymous tracking
  
  -- URL and sharing info
  original_url TEXT NOT NULL,
  short_url TEXT, -- The generated short URL (dub.co or oss.fyi)
  dub_link_id TEXT, -- ID from dub.co API for analytics
  
  -- Content context
  chart_type TEXT NOT NULL, -- 'treemap', 'donut', 'bar', etc.
  repository TEXT, -- owner/repo format
  page_path TEXT, -- URL path for grouping
  
  -- Event details
  action TEXT NOT NULL, -- 'create', 'share', 'copy', 'download'
  share_type TEXT, -- 'url', 'image', 'native'
  platform TEXT, -- 'web', 'twitter', 'linkedin', etc.
  
  -- Technical details
  domain TEXT, -- 'dub.co' or 'oss.fyi'
  user_agent TEXT,
  referrer TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}', -- Additional context data
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table to track click analytics (when available from dub.co)
CREATE TABLE IF NOT EXISTS share_click_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Link relationship
  share_event_id UUID REFERENCES share_events(id) ON DELETE CASCADE,
  dub_link_id TEXT NOT NULL,
  
  -- Click metrics from dub.co API
  total_clicks INTEGER DEFAULT 0,
  unique_clicks INTEGER DEFAULT 0,
  click_data JSONB DEFAULT '{}', -- Raw analytics from dub.co
  
  -- Aggregation period
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_share_events_user_id ON share_events(user_id);
CREATE INDEX IF NOT EXISTS idx_share_events_chart_type ON share_events(chart_type);
CREATE INDEX IF NOT EXISTS idx_share_events_repository ON share_events(repository);
CREATE INDEX IF NOT EXISTS idx_share_events_action ON share_events(action);
CREATE INDEX IF NOT EXISTS idx_share_events_created_at ON share_events(created_at);
CREATE INDEX IF NOT EXISTS idx_share_events_dub_link_id ON share_events(dub_link_id);

CREATE INDEX IF NOT EXISTS idx_share_click_analytics_dub_link_id ON share_click_analytics(dub_link_id);
CREATE INDEX IF NOT EXISTS idx_share_click_analytics_period ON share_click_analytics(period_start, period_end);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic updated_at
CREATE TRIGGER update_share_events_updated_at 
  BEFORE UPDATE ON share_events 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_share_click_analytics_updated_at 
  BEFORE UPDATE ON share_click_analytics 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View for comprehensive share analytics
CREATE OR REPLACE VIEW share_analytics_summary AS
SELECT 
  se.id,
  se.chart_type,
  se.repository,
  se.action,
  se.share_type,
  se.domain,
  se.short_url,
  se.created_at,
  sca.total_clicks,
  sca.unique_clicks,
  CASE 
    WHEN se.short_url IS NOT NULL THEN TRUE 
    ELSE FALSE 
  END as is_shortened
FROM share_events se
LEFT JOIN share_click_analytics sca ON se.dub_link_id = sca.dub_link_id
ORDER BY se.created_at DESC;

-- RLS Policies
ALTER TABLE share_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_click_analytics ENABLE ROW LEVEL SECURITY;

-- Allow public read access for analytics (aggregated data only)
CREATE POLICY "Allow public read access to share analytics" ON share_events
  FOR SELECT TO PUBLIC
  USING (true);

CREATE POLICY "Allow public read access to click analytics" ON share_click_analytics
  FOR SELECT TO PUBLIC
  USING (true);

-- Allow authenticated users to insert their own share events
CREATE POLICY "Allow authenticated users to insert share events" ON share_events
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Allow service role full access for analytics updates
CREATE POLICY "Allow service role full access to share events" ON share_events
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service role full access to click analytics" ON share_click_analytics
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON share_events TO PUBLIC;
GRANT SELECT ON share_click_analytics TO PUBLIC;
GRANT SELECT ON share_analytics_summary TO PUBLIC;

-- GRANT INSERT ON share_events TO authenticated (conditional)
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT INSERT ON share_events TO authenticated;
  ELSE
    RAISE NOTICE 'Role authenticated not found, skipping grant';
  END IF;
END $;;
-- GRANT ALL ON share_events TO service_role (conditional)
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON share_events TO service_role;
  ELSE
    RAISE NOTICE 'Role service_role not found, skipping grant';
  END IF;
END $;;
-- GRANT ALL ON share_click_analytics TO service_role (conditional)
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON share_click_analytics TO service_role;
  ELSE
    RAISE NOTICE 'Role service_role not found, skipping grant';
  END IF;
END $;;

-- Add helpful comments
COMMENT ON TABLE share_events IS 'Tracks sharing events for charts and metrics with short URL generation';
COMMENT ON TABLE share_click_analytics IS 'Aggregated click analytics from dub.co API';
COMMENT ON VIEW share_analytics_summary IS 'Comprehensive view of sharing analytics with click data';

COMMENT ON COLUMN share_events.chart_type IS 'Type of chart: treemap, donut, bar, etc.';
COMMENT ON COLUMN share_events.action IS 'User action: create, share, copy, download';
COMMENT ON COLUMN share_events.share_type IS 'Share method: url, image, native';
COMMENT ON COLUMN share_events.domain IS 'Short URL domain: dub.co (dev) or oss.fyi (prod)';

-- From 20250114_enable_rls_missing_tables.sql
-- Enable RLS on missing tables to fix security advisories
-- Applied on 2025-01-14

-- Enable RLS on missing tables
ALTER TABLE rate_limit_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_capture_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE commits ENABLE ROW LEVEL SECURITY;

-- Rate Limit Tracking - Public read access (view rate limit status)
CREATE POLICY "public_read_rate_limit_tracking"
ON rate_limit_tracking FOR SELECT
USING (true);

-- Rate Limit Tracking - Only service role can modify
CREATE POLICY "service_manage_rate_limit_tracking"
ON rate_limit_tracking FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Data Capture Queue - Only service role can access (internal queue)
CREATE POLICY "service_manage_data_capture_queue"
ON data_capture_queue FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Commits - Public read access
CREATE POLICY "public_read_commits"
ON commits FOR SELECT
USING (true);

-- Commits - Authenticated users can insert/update
CREATE POLICY "auth_insert_commits"
ON commits FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "auth_update_commits"
ON commits FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Commits - Service role can delete
CREATE POLICY "service_delete_commits"
ON commits FOR DELETE
TO service_role
USING (true);

-- From 20250114_github_app_schema.sql
-- GitHub App Installation and Related Tables Migration
-- This migration adds support for the Contributor Insights GitHub App

-- 1. App installations tracking
CREATE TABLE IF NOT EXISTS github_app_installations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    installation_id BIGINT UNIQUE NOT NULL,
    account_type TEXT CHECK (account_type IN ('user', 'organization')),
    account_name TEXT NOT NULL,
    account_id BIGINT NOT NULL,
    repository_selection TEXT CHECK (repository_selection IN ('all', 'selected')),
    installed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    suspended_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    settings JSONB DEFAULT '{
        "enabled": true,
        "comment_on_prs": true,
        "include_issue_context": true,
        "max_reviewers_suggested": 3,
        "max_issues_shown": 5,
        "comment_style": "detailed"
    }'::jsonb,
    CONSTRAINT unique_account_installation UNIQUE (account_id, installation_id)
);

-- 2. Track which repos have the app
CREATE TABLE IF NOT EXISTS app_enabled_repositories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    installation_id UUID REFERENCES github_app_installations(id) ON DELETE CASCADE,
    repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE,
    enabled_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_app_repo UNIQUE (installation_id, repository_id)
);

-- 3. PR insights cache
CREATE TABLE IF NOT EXISTS pr_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pull_request_id UUID REFERENCES pull_requests(id) ON DELETE CASCADE,
    contributor_stats JSONB NOT NULL,
    suggested_reviewers JSONB NOT NULL,
    similar_issues JSONB DEFAULT '[]'::jsonb,
    generated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    comment_posted BOOLEAN DEFAULT FALSE,
    comment_id BIGINT,
    github_pr_id BIGINT,
    CONSTRAINT unique_pr_insights UNIQUE (pull_request_id)
);

-- 4. Core issues table
CREATE TABLE IF NOT EXISTS issues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    github_id BIGINT UNIQUE NOT NULL,
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    number INTEGER NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    state TEXT CHECK (state IN ('open', 'closed')),
    author_id UUID REFERENCES contributors(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    closed_at TIMESTAMPTZ,
    closed_by_id UUID REFERENCES contributors(id),
    labels JSONB DEFAULT '[]'::jsonb,
    assignees JSONB DEFAULT '[]'::jsonb,
    milestone JSONB,
    comments_count INTEGER DEFAULT 0,
    is_pull_request BOOLEAN DEFAULT FALSE,
    linked_pr_id UUID REFERENCES pull_requests(id),
    CONSTRAINT unique_issue_per_repo UNIQUE (repository_id, number)
);

-- 5. Issue similarity scores
CREATE TABLE IF NOT EXISTS issue_similarities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_type TEXT CHECK (source_type IN ('issue', 'pull_request')),
    source_id UUID NOT NULL,
    target_issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
    similarity_score DECIMAL(3, 2) CHECK (similarity_score >= 0 AND similarity_score <= 1),
    similarity_reasons JSONB NOT NULL,
    calculated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_similarity UNIQUE (source_type, source_id, target_issue_id)
);

-- 6. Installation settings (per-installation preferences)
CREATE TABLE IF NOT EXISTS github_app_installation_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    installation_id BIGINT UNIQUE NOT NULL,
    comment_on_prs BOOLEAN DEFAULT true,
    include_issue_context BOOLEAN DEFAULT true,
    max_reviewers_suggested INTEGER DEFAULT 3,
    max_issues_shown INTEGER DEFAULT 5,
    comment_style TEXT DEFAULT 'detailed' CHECK (comment_style IN ('minimal', 'detailed', 'comprehensive')),
    excluded_repos TEXT[] DEFAULT '{}',
    excluded_users TEXT[] DEFAULT '{}',
    notification_email TEXT,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 7. App metrics tracking
CREATE TABLE IF NOT EXISTS app_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type TEXT NOT NULL,
    event_data JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_app_installations_account ON github_app_installations(account_id);
CREATE INDEX idx_app_installations_created ON github_app_installations(installed_at);
CREATE INDEX idx_app_enabled_repos_installation ON app_enabled_repositories(installation_id);
CREATE INDEX idx_pr_insights_pr ON pr_insights(pull_request_id);
CREATE INDEX idx_pr_insights_posted ON pr_insights(comment_posted);
CREATE INDEX idx_issues_repo ON issues(repository_id);
CREATE INDEX idx_issues_state ON issues(state);
CREATE INDEX idx_issues_number ON issues(repository_id, number);
CREATE INDEX idx_issue_similarities_source ON issue_similarities(source_type, source_id);
CREATE INDEX idx_issue_similarities_target ON issue_similarities(target_issue_id);
CREATE INDEX idx_app_metrics_event ON app_metrics(event_type);
CREATE INDEX idx_app_metrics_created ON app_metrics(created_at);

-- RLS Policies
ALTER TABLE github_app_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_enabled_repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE pr_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_similarities ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_app_installation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_metrics ENABLE ROW LEVEL SECURITY;

-- Public read access for most tables
CREATE POLICY "Public read access" ON issues FOR SELECT USING (true);
CREATE POLICY "Public read access" ON pr_insights FOR SELECT USING (true);
CREATE POLICY "Public read access" ON issue_similarities FOR SELECT USING (true);

-- Installation management requires authentication
CREATE POLICY "Authenticated users can read installations" ON github_app_installations 
    FOR SELECT USING (auth.role() = 'authenticated');
    
CREATE POLICY "Authenticated users can read app repos" ON app_enabled_repositories 
    FOR SELECT USING (auth.role() = 'authenticated');
    
CREATE POLICY "Authenticated users can manage their settings" ON github_app_installation_settings 
    FOR ALL USING (auth.role() = 'authenticated');

-- App metrics are internal only
CREATE POLICY "Service role only" ON app_metrics 
    FOR ALL USING (auth.role() = 'service_role');

-- From 20250120000000_progressive_backfill_tables.sql
-- Create tables for tracking progressive backfill state and progress

-- Table to track overall backfill state for each repository
CREATE TABLE IF NOT EXISTS progressive_backfill_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  total_prs INTEGER NOT NULL,
  processed_prs INTEGER DEFAULT 0,
  last_processed_cursor TEXT, -- GitHub cursor for pagination
  last_processed_pr_number INTEGER, -- Last PR number processed
  last_processed_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'failed')),
  chunk_size INTEGER DEFAULT 25,
  error_count INTEGER DEFAULT 0,
  consecutive_errors INTEGER DEFAULT 0,
  last_error TEXT,
  last_error_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one backfill per repository
  CONSTRAINT unique_active_backfill UNIQUE (repository_id)
);

-- Table to track individual chunk processing
CREATE TABLE IF NOT EXISTS backfill_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  backfill_state_id UUID NOT NULL REFERENCES progressive_backfill_state(id) ON DELETE CASCADE,
  chunk_number INTEGER NOT NULL,
  pr_numbers INTEGER[],
  pr_count INTEGER GENERATED ALWAYS AS (array_length(pr_numbers, 1)) STORED,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  processor_type VARCHAR(20) DEFAULT 'github_actions',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  processing_time_ms INTEGER GENERATED ALWAYS AS (
    CASE 
      WHEN completed_at IS NOT NULL AND started_at IS NOT NULL 
      THEN EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000
      ELSE NULL
    END
  ) STORED,
  error TEXT,
  retry_count INTEGER DEFAULT 0,
  api_calls_made INTEGER,
  rate_limit_remaining INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique chunk numbers per backfill
  CONSTRAINT unique_chunk_per_backfill UNIQUE (backfill_state_id, chunk_number)
);

-- Index for efficient queries
CREATE INDEX idx_backfill_state_repository ON progressive_backfill_state(repository_id, status);
CREATE INDEX idx_backfill_state_active ON progressive_backfill_state(status) WHERE status = 'active';
CREATE INDEX idx_backfill_chunks_status ON backfill_chunks(backfill_state_id, status);
CREATE INDEX idx_backfill_chunks_pending ON backfill_chunks(status, created_at) WHERE status = 'pending';

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_progressive_backfill_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER progressive_backfill_state_updated_at
  BEFORE UPDATE ON progressive_backfill_state
  FOR EACH ROW
  EXECUTE FUNCTION update_progressive_backfill_updated_at();

-- Add RLS policies
ALTER TABLE progressive_backfill_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE backfill_chunks ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read backfill state
CREATE POLICY "Authenticated users can read backfill state"
  ON progressive_backfill_state
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow service role to manage backfill state
CREATE POLICY "Service role can manage backfill state"
  ON progressive_backfill_state
  FOR ALL
  TO service_role
  USING (true);

-- Allow authenticated users to read backfill chunks
CREATE POLICY "Authenticated users can read backfill chunks"
  ON backfill_chunks
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow service role to manage backfill chunks
CREATE POLICY "Service role can manage backfill chunks"
  ON backfill_chunks
  FOR ALL
  TO service_role
  USING (true);

-- View for monitoring backfill progress
CREATE OR REPLACE VIEW backfill_progress_summary AS
SELECT 
  r.owner,
  r.name,
  pbs.id as backfill_id,
  pbs.status,
  pbs.total_prs,
  pbs.processed_prs,
  CASE 
    WHEN pbs.total_prs > 0 
    THEN ROUND((pbs.processed_prs::NUMERIC / pbs.total_prs) * 100, 2)
    ELSE 0
  END as progress_percentage,
  pbs.chunk_size,
  pbs.error_count,
  pbs.last_processed_at,
  pbs.created_at,
  pbs.updated_at,
  COALESCE(
    (SELECT COUNT(*) FROM backfill_chunks WHERE backfill_state_id = pbs.id AND status = 'completed'),
    0
  ) as completed_chunks,
  COALESCE(
    (SELECT COUNT(*) FROM backfill_chunks WHERE backfill_state_id = pbs.id AND status = 'failed'),
    0
  ) as failed_chunks,
  COALESCE(
    (SELECT AVG(processing_time_ms) FROM backfill_chunks WHERE backfill_state_id = pbs.id AND status = 'completed'),
    0
  )::INTEGER as avg_chunk_processing_time_ms
FROM progressive_backfill_state pbs
JOIN repositories r ON pbs.repository_id = r.id
ORDER BY pbs.created_at DESC;

-- From 20250120_github_events_classification.sql
-- Migration: GitHub Events Classification System
-- Description: Adds tables for tracking contributor roles and GitHub events with confidence scoring

-- Create contributor_roles table for tracking detected maintainer status
CREATE TABLE IF NOT EXISTS public.contributor_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  repository_owner TEXT NOT NULL,
  repository_name TEXT NOT NULL,
  role TEXT CHECK (role IN ('owner', 'maintainer', 'contributor')) NOT NULL,
  confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  detected_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_verified TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  detection_methods JSONB DEFAULT '[]'::jsonb, -- Array of detection signals used
  permission_events_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, repository_owner, repository_name)
);

-- Create github_events_cache table with partitioning support
CREATE TABLE IF NOT EXISTS public.github_events_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL, -- Format: {event_type}_{github_event_id}
  event_type TEXT NOT NULL,
  actor_login TEXT NOT NULL,
  repository_owner TEXT NOT NULL,
  repository_name TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  is_privileged BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  processing_notes TEXT
) PARTITION BY RANGE (created_at);

-- Create initial monthly partitions
CREATE TABLE IF NOT EXISTS public.github_events_cache_2025_01 
  PARTITION OF public.github_events_cache
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE IF NOT EXISTS public.github_events_cache_2025_02 
  PARTITION OF public.github_events_cache
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

CREATE TABLE IF NOT EXISTS public.github_events_cache_2025_03 
  PARTITION OF public.github_events_cache
  FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_contributor_roles_repo 
  ON public.contributor_roles(repository_owner, repository_name);

CREATE INDEX IF NOT EXISTS idx_contributor_roles_user 
  ON public.contributor_roles(user_id);

CREATE INDEX IF NOT EXISTS idx_contributor_roles_confidence 
  ON public.contributor_roles(confidence_score DESC);

-- Indexes on partitioned table (will apply to all partitions)
CREATE INDEX IF NOT EXISTS idx_events_actor_repo 
  ON public.github_events_cache(actor_login, repository_owner, repository_name);

CREATE INDEX IF NOT EXISTS idx_events_privileged 
  ON public.github_events_cache(is_privileged) 
  WHERE is_privileged = TRUE;

CREATE INDEX IF NOT EXISTS idx_events_processed 
  ON public.github_events_cache(processed) 
  WHERE processed = FALSE;

CREATE INDEX IF NOT EXISTS idx_events_type 
  ON public.github_events_cache(event_type);

-- Create historical tracking table for role changes
CREATE TABLE IF NOT EXISTS public.contributor_role_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contributor_role_id UUID NOT NULL REFERENCES public.contributor_roles(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  repository_owner TEXT NOT NULL,
  repository_name TEXT NOT NULL,
  previous_role TEXT,
  new_role TEXT NOT NULL,
  previous_confidence DECIMAL(3,2),
  new_confidence DECIMAL(3,2) NOT NULL,
  change_reason TEXT,
  detection_methods JSONB DEFAULT '[]'::jsonb,
  changed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_role_history_contributor 
  ON public.contributor_role_history(contributor_role_id);

CREATE INDEX IF NOT EXISTS idx_role_history_time 
  ON public.contributor_role_history(changed_at DESC);

-- Create table for tracking sync status
CREATE TABLE IF NOT EXISTS public.github_sync_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_owner TEXT NOT NULL,
  repository_name TEXT NOT NULL,
  last_sync_at TIMESTAMPTZ,
  last_event_at TIMESTAMPTZ,
  events_processed INT DEFAULT 0,
  sync_status TEXT CHECK (sync_status IN ('pending', 'in_progress', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(repository_owner, repository_name)
);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_contributor_roles_updated_at 
  BEFORE UPDATE ON public.contributor_roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_github_sync_status_updated_at 
  BEFORE UPDATE ON public.github_sync_status
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.contributor_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_events_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contributor_role_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_sync_status ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for public read access
CREATE POLICY "Allow public read access to contributor roles" 
  ON public.contributor_roles FOR SELECT 
  USING (true);

CREATE POLICY "Allow public read access to events cache" 
  ON public.github_events_cache FOR SELECT 
  USING (true);

CREATE POLICY "Allow public read access to role history" 
  ON public.contributor_role_history FOR SELECT 
  USING (true);

CREATE POLICY "Allow public read access to sync status" 
  ON public.github_sync_status FOR SELECT 
  USING (true);

-- Create function to automatically create monthly partitions
CREATE OR REPLACE FUNCTION create_monthly_partition()
RETURNS void AS $$
DECLARE
  partition_date DATE;
  partition_name TEXT;
  start_date DATE;
  end_date DATE;
BEGIN
  -- Calculate next month
  partition_date := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month');
  start_date := partition_date;
  end_date := partition_date + INTERVAL '1 month';
  
  -- Generate partition name
  partition_name := 'github_events_cache_' || TO_CHAR(partition_date, 'YYYY_MM');
  
  -- Check if partition already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = partition_name
  ) THEN
    -- Create the partition
    EXECUTE format(
      'CREATE TABLE public.%I PARTITION OF public.github_events_cache FOR VALUES FROM (%L) TO (%L)',
      partition_name,
      start_date,
      end_date
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Comment on tables and important columns
COMMENT ON TABLE public.contributor_roles IS 'Tracks detected roles and permissions for GitHub contributors with confidence scoring';
COMMENT ON COLUMN public.contributor_roles.confidence_score IS 'Confidence level of role detection (0.0 to 1.0)';
COMMENT ON COLUMN public.contributor_roles.detection_methods IS 'JSON array of detection signals used (e.g., ["merge_event", "push_to_protected", "admin_action"])';

COMMENT ON TABLE public.github_events_cache IS 'Caches GitHub events for processing, partitioned by month for performance';
COMMENT ON COLUMN public.github_events_cache.is_privileged IS 'Whether this event indicates elevated permissions';

COMMENT ON TABLE public.contributor_role_history IS 'Audit trail of all role and confidence changes';
COMMENT ON TABLE public.github_sync_status IS 'Tracks synchronization status for each repository';

-- From 20250121_fix_tracked_repositories.sql
-- Fix tracked_repositories table to allow direct insertion without repository_id
-- This resolves the circular dependency where repositories table is only populated by sync

-- Add organization_name and repository_name columns
ALTER TABLE tracked_repositories 
ADD COLUMN IF NOT EXISTS organization_name TEXT,
ADD COLUMN IF NOT EXISTS repository_name TEXT;

-- Make repository_id nullable temporarily
ALTER TABLE tracked_repositories 
ALTER COLUMN repository_id DROP NOT NULL;

-- Add unique constraint on org/repo name combination
ALTER TABLE tracked_repositories
ADD CONSTRAINT tracked_repositories_org_repo_unique 
UNIQUE (organization_name, repository_name);

-- Update existing rows to populate org/repo names from repositories table
UPDATE tracked_repositories tr
SET 
    organization_name = r.owner,
    repository_name = r.name
FROM repositories r
WHERE tr.repository_id = r.id
  AND tr.organization_name IS NULL;

-- Create function to auto-populate repository_id when org/repo exists
CREATE OR REPLACE FUNCTION update_tracked_repository_id()
RETURNS TRIGGER AS $$
BEGIN
    -- If repository_id is not set but org/repo names are provided
    IF NEW.repository_id IS NULL AND NEW.organization_name IS NOT NULL AND NEW.repository_name IS NOT NULL THEN
        -- Try to find the repository
        SELECT id INTO NEW.repository_id
        FROM repositories
        WHERE owner = NEW.organization_name
          AND name = NEW.repository_name;
    END IF;
    
    -- If repository_id is set but org/repo names are not
    IF NEW.repository_id IS NOT NULL AND (NEW.organization_name IS NULL OR NEW.repository_name IS NULL) THEN
        -- Get org/repo names from repository
        SELECT owner, name INTO NEW.organization_name, NEW.repository_name
        FROM repositories
        WHERE id = NEW.repository_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-populate fields
CREATE TRIGGER trigger_update_tracked_repository_id
BEFORE INSERT OR UPDATE ON tracked_repositories
FOR EACH ROW
EXECUTE FUNCTION update_tracked_repository_id();

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tracked_repositories_org_repo 
ON tracked_repositories(organization_name, repository_name);

-- Add RLS policy to allow anonymous users to insert tracked repositories
-- (They can track repos even if not yet synced)
ALTER TABLE tracked_repositories ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read tracked repositories
CREATE POLICY "tracked_repositories_read_all" ON tracked_repositories
FOR SELECT
TO anon, authenticated
USING (true);

-- Allow authenticated users to insert tracked repositories
CREATE POLICY "tracked_repositories_insert_authenticated" ON tracked_repositories
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow service role full access
CREATE POLICY "tracked_repositories_service_role" ON tracked_repositories
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- From 20250121_fix_tracked_repositories_fixed.sql
-- Fix tracked_repositories table to allow direct insertion without repository_id
-- This resolves the circular dependency where repositories table is only populated by sync

-- First, add the missing last_updated_at column if it doesn't exist
ALTER TABLE tracked_repositories 
ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add organization_name and repository_name columns
ALTER TABLE tracked_repositories 
ADD COLUMN IF NOT EXISTS organization_name TEXT,
ADD COLUMN IF NOT EXISTS repository_name TEXT;

-- Make repository_id nullable temporarily
ALTER TABLE tracked_repositories 
ALTER COLUMN repository_id DROP NOT NULL;

-- Drop existing constraint if it exists to avoid error
ALTER TABLE tracked_repositories
DROP CONSTRAINT IF EXISTS tracked_repositories_org_repo_unique;

-- Add unique constraint on org/repo name combination
ALTER TABLE tracked_repositories
ADD CONSTRAINT tracked_repositories_org_repo_unique 
UNIQUE (organization_name, repository_name);

-- Update existing rows to populate org/repo names from repositories table
UPDATE tracked_repositories tr
SET 
    organization_name = r.owner,
    repository_name = r.name
FROM repositories r
WHERE tr.repository_id = r.id
  AND tr.organization_name IS NULL;

-- Drop existing function and trigger if they exist
DROP TRIGGER IF EXISTS trigger_update_tracked_repository_id ON tracked_repositories;
DROP FUNCTION IF EXISTS update_tracked_repository_id();

-- Create function to auto-populate repository_id when org/repo exists
CREATE OR REPLACE FUNCTION update_tracked_repository_id()
RETURNS TRIGGER AS $$
BEGIN
    -- If repository_id is not set but org/repo names are provided
    IF NEW.repository_id IS NULL AND NEW.organization_name IS NOT NULL AND NEW.repository_name IS NOT NULL THEN
        -- Try to find the repository
        SELECT id INTO NEW.repository_id
        FROM repositories
        WHERE owner = NEW.organization_name
          AND name = NEW.repository_name;
    END IF;
    
    -- If repository_id is set but org/repo names are not
    IF NEW.repository_id IS NOT NULL AND (NEW.organization_name IS NULL OR NEW.repository_name IS NULL) THEN
        -- Get org/repo names from repository
        SELECT owner, name INTO NEW.organization_name, NEW.repository_name
        FROM repositories
        WHERE id = NEW.repository_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-populate fields
CREATE TRIGGER trigger_update_tracked_repository_id
BEFORE INSERT OR UPDATE ON tracked_repositories
FOR EACH ROW
EXECUTE FUNCTION update_tracked_repository_id();

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tracked_repositories_org_repo 
ON tracked_repositories(organization_name, repository_name);

-- Add RLS policy to allow anonymous users to insert tracked repositories
-- (They can track repos even if not yet synced)
ALTER TABLE tracked_repositories ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "tracked_repositories_read_all" ON tracked_repositories;
DROP POLICY IF EXISTS "tracked_repositories_insert_authenticated" ON tracked_repositories;
DROP POLICY IF EXISTS "tracked_repositories_service_role" ON tracked_repositories;

-- Allow anyone to read tracked repositories
CREATE POLICY "tracked_repositories_read_all" ON tracked_repositories
FOR SELECT
TO anon, authenticated
USING (true);

-- Allow authenticated users to insert tracked repositories
CREATE POLICY "tracked_repositories_insert_authenticated" ON tracked_repositories
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow service role full access
CREATE POLICY "tracked_repositories_service_role" ON tracked_repositories
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- From 20250124_workspace_contributors.sql
-- Create workspace_contributors table to track which contributors are added to each workspace
CREATE TABLE IF NOT EXISTS workspace_contributors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  contributor_id UUID NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure a contributor can only be added once per workspace
  UNIQUE(workspace_id, contributor_id)
);

-- Add indexes for performance
CREATE INDEX idx_workspace_contributors_workspace_id ON workspace_contributors(workspace_id);
CREATE INDEX idx_workspace_contributors_contributor_id ON workspace_contributors(contributor_id);
CREATE INDEX idx_workspace_contributors_added_by ON workspace_contributors(added_by);

-- RLS policies
ALTER TABLE workspace_contributors ENABLE ROW LEVEL SECURITY;

-- Allow users to view contributors in workspaces they can access
CREATE POLICY "Users can view workspace contributors"
  ON workspace_contributors
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspaces 
      WHERE workspaces.id = workspace_contributors.workspace_id
      AND (
        workspaces.visibility = 'public' 
        OR workspaces.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM workspace_members 
          WHERE workspace_members.workspace_id = workspaces.id 
          AND workspace_members.user_id = auth.uid()
        )
      )
    )
  );

-- Allow workspace owners and admins to add contributors
CREATE POLICY "Workspace owners and admins can add contributors"
  ON workspace_contributors
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspaces 
      WHERE workspaces.id = workspace_contributors.workspace_id
      AND (
        workspaces.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM workspace_members 
          WHERE workspace_members.workspace_id = workspaces.id 
          AND workspace_members.user_id = auth.uid()
          AND workspace_members.role IN ('admin', 'owner')
        )
      )
    )
  );

-- Allow workspace owners and admins to remove contributors
CREATE POLICY "Workspace owners and admins can remove contributors"
  ON workspace_contributors
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workspaces 
      WHERE workspaces.id = workspace_contributors.workspace_id
      AND (
        workspaces.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM workspace_members 
          WHERE workspace_members.workspace_id = workspaces.id 
          AND workspace_members.user_id = auth.uid()
          AND workspace_members.role IN ('admin', 'owner')
        )
      )
    )
  );

-- -- Grant permissions
GRANT ALL ON workspace_contributors TO authenticated (conditional)
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    Grant permissions
GRANT ALL ON workspace_contributors TO authenticated;
  ELSE
    RAISE NOTICE 'Role authenticated not found, skipping grant';
  END IF;
END $;;
-- GRANT SELECT ON workspace_contributors TO anon (conditional)
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT ON workspace_contributors TO anon;
  ELSE
    RAISE NOTICE 'Role anon not found, skipping grant';
  END IF;
END $;;

-- From 20250125000000_workspace_data_fetching.sql
-- Migration: Workspace Data Fetching Infrastructure
-- This migration adds support for workspace-specific data fetching
-- including issues, commit activity, and repository metadata

-- =====================================================
-- PHASE 1.1: WORKSPACE-TRACKED REPOSITORIES JOIN TABLE
-- =====================================================

-- Create join table linking workspaces to tracked repositories
-- This allows one repository to be tracked by multiple workspaces
-- with different settings for each workspace
CREATE TABLE workspace_tracked_repositories (
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
CREATE TABLE daily_activity_metrics (
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
CREATE TABLE workspace_issues_cache (
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
CREATE INDEX idx_workspace_tracked_repos_workspace 
ON workspace_tracked_repositories(workspace_id) 
WHERE is_active = TRUE;

CREATE INDEX idx_workspace_tracked_repos_tracked 
ON workspace_tracked_repositories(tracked_repository_id) 
WHERE is_active = TRUE;

CREATE INDEX idx_workspace_tracked_repos_next_sync 
ON workspace_tracked_repositories(next_sync_at) 
WHERE is_active = TRUE AND next_sync_at IS NOT NULL;

CREATE INDEX idx_workspace_tracked_repos_priority 
ON workspace_tracked_repositories(priority_score DESC, next_sync_at) 
WHERE is_active = TRUE;

-- Composite index for common query pattern
CREATE INDEX idx_workspace_tracked_repos_sync_status 
ON workspace_tracked_repositories(workspace_id, last_sync_status, next_sync_at) 
WHERE is_active = TRUE;

-- Indexes for daily_activity_metrics
CREATE INDEX idx_daily_metrics_repo 
ON daily_activity_metrics(repository_id);

CREATE INDEX idx_daily_metrics_date 
ON daily_activity_metrics(date DESC);

CREATE INDEX idx_daily_metrics_repo_date 
ON daily_activity_metrics(repository_id, date DESC);

-- Partial index for recent complete metrics
-- Note: Using a static date comparison instead of CURRENT_DATE for immutability
CREATE INDEX idx_daily_metrics_recent_complete 
ON daily_activity_metrics(repository_id, date DESC) 
WHERE is_complete = TRUE;

-- Indexes for workspace_issues_cache
CREATE INDEX idx_workspace_issues_cache_workspace 
ON workspace_issues_cache(workspace_id);

CREATE INDEX idx_workspace_issues_cache_lookup 
ON workspace_issues_cache(workspace_id, time_range, period_end);

CREATE INDEX idx_workspace_issues_cache_expires 
ON workspace_issues_cache(expires_at) 
WHERE is_stale = FALSE;

-- Indexes for repository metadata
CREATE INDEX idx_repositories_avatar 
ON repositories(avatar_url) 
WHERE avatar_url IS NOT NULL;

CREATE INDEX idx_repositories_topics 
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

-- -- Grant permissions for authenticated users
GRANT SELECT ON workspace_tracked_repositories TO authenticated (conditional)
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    Grant permissions for authenticated users
GRANT SELECT ON workspace_tracked_repositories TO authenticated;
  ELSE
    RAISE NOTICE 'Role authenticated not found, skipping grant';
  END IF;
END $;;
-- GRANT SELECT ON daily_activity_metrics TO authenticated (conditional)
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT ON daily_activity_metrics TO authenticated;
  ELSE
    RAISE NOTICE 'Role authenticated not found, skipping grant';
  END IF;
END $;;
-- GRANT SELECT ON workspace_issues_cache TO authenticated (conditional)
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT ON workspace_issues_cache TO authenticated;
  ELSE
    RAISE NOTICE 'Role authenticated not found, skipping grant';
  END IF;
END $;;

-- Grant permissions for service role (for backend operations)
-- GRANT ALL ON workspace_tracked_repositories TO service_role (conditional)
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON workspace_tracked_repositories TO service_role;
  ELSE
    RAISE NOTICE 'Role service_role not found, skipping grant';
  END IF;
END $;;
-- GRANT ALL ON daily_activity_metrics TO service_role (conditional)
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON daily_activity_metrics TO service_role;
  ELSE
    RAISE NOTICE 'Role service_role not found, skipping grant';
  END IF;
END $;;
-- GRANT ALL ON workspace_issues_cache TO service_role (conditional)
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON workspace_issues_cache TO service_role;
  ELSE
    RAISE NOTICE 'Role service_role not found, skipping grant';
  END IF;
END $;;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION calculate_workspace_repo_priority(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_workspace_repos_for_sync(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION update_workspace_sync_status(UUID, UUID, TEXT, TEXT) TO service_role;

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

-- From 20250126_fix_all_rls_issues.sql
-- Migration: Fix all RLS issues while preserving logged-out user experience
-- This migration addresses all RLS errors from the Supabase linter
-- Date: 2025-01-26

-- =====================================================
-- STEP 1: Fix SECURITY DEFINER Views
-- =====================================================

-- Drop and recreate views without SECURITY DEFINER
-- This allows views to respect the querying user's RLS policies

-- Fix contributor_stats view
DROP VIEW IF EXISTS contributor_stats CASCADE;
CREATE VIEW contributor_stats AS
SELECT 
    c.id,
    c.username,
    c.display_name,
    c.avatar_url,
    c.github_id,
    COUNT(DISTINCT pr.id) as total_pull_requests,
    COUNT(DISTINCT pr.id) FILTER (WHERE pr.state = 'closed' AND pr.merged = TRUE) as merged_pull_requests,
    COUNT(DISTINCT r.id) as total_reviews,
    COUNT(DISTINCT cm.id) as total_comments,
    COUNT(DISTINCT pr.repository_id) as repositories_contributed,
    SUM(pr.additions) as total_lines_added,
    SUM(pr.deletions) as total_lines_removed,
    MIN(pr.created_at) as first_contribution,
    MAX(pr.created_at) as last_contribution,
    c.first_seen_at,
    c.last_updated_at,
    c.is_active
FROM contributors c
LEFT JOIN pull_requests pr ON c.id = pr.author_id
LEFT JOIN reviews r ON c.id = r.reviewer_id
LEFT JOIN comments cm ON c.id = cm.commenter_id
WHERE c.is_active = TRUE AND c.is_bot = FALSE
GROUP BY c.id, c.username, c.display_name, c.avatar_url, c.github_id, c.first_seen_at, c.last_updated_at, c.is_active;

-- Fix repository_stats view
DROP VIEW IF EXISTS repository_stats CASCADE;
CREATE VIEW repository_stats AS
SELECT 
    r.id,
    r.full_name,
    r.owner,
    r.name,
    r.description,
    r.language,
    r.stargazers_count,
    r.forks_count,
    COUNT(DISTINCT pr.id) as total_pull_requests,
    COUNT(DISTINCT pr.id) FILTER (WHERE pr.state = 'closed' AND pr.merged = TRUE) as merged_pull_requests,
    COUNT(DISTINCT pr.author_id) as unique_contributors,
    COUNT(DISTINCT rv.id) as total_reviews,
    COUNT(DISTINCT cm.id) as total_comments,
    SUM(pr.additions) as total_lines_added,
    SUM(pr.deletions) as total_lines_removed,
    MIN(pr.created_at) as first_contribution,
    MAX(pr.created_at) as last_contribution,
    r.github_created_at,
    r.first_tracked_at,
    r.last_updated_at,
    r.is_active
FROM repositories r
LEFT JOIN pull_requests pr ON r.id = pr.repository_id
LEFT JOIN reviews rv ON pr.id = rv.pull_request_id
LEFT JOIN comments cm ON pr.id = cm.pull_request_id
WHERE r.is_active = TRUE
GROUP BY r.id, r.full_name, r.owner, r.name, r.description, r.language, 
         r.stargazers_count, r.forks_count, r.github_created_at, 
         r.first_tracked_at, r.last_updated_at, r.is_active;

-- Fix recent_activity view
DROP VIEW IF EXISTS recent_activity CASCADE;
CREATE VIEW recent_activity AS
SELECT 
    'pull_request' as activity_type,
    pr.id,
    pr.title as description,
    pr.html_url as url,
    pr.author_id as contributor_id,
    c.username,
    c.avatar_url,
    pr.repository_id,
    repo.full_name as repository_name,
    pr.created_at as activity_date,
    pr.state,
    pr.merged
FROM pull_requests pr
JOIN contributors c ON pr.author_id = c.id
JOIN repositories repo ON pr.repository_id = repo.id
WHERE pr.created_at >= NOW() - INTERVAL '30 days'
  AND c.is_active = TRUE 
  AND c.is_bot = FALSE
  AND repo.is_active = TRUE

UNION ALL

SELECT 
    'review' as activity_type,
    r.id,
    'Review: ' || COALESCE(r.state, 'PENDING') as description,
    pr.html_url as url,
    r.reviewer_id as contributor_id,
    c.username,
    c.avatar_url,
    pr.repository_id,
    repo.full_name as repository_name,
    r.submitted_at as activity_date,
    r.state,
    NULL as merged
FROM reviews r
JOIN contributors c ON r.reviewer_id = c.id
JOIN pull_requests pr ON r.pull_request_id = pr.id
JOIN repositories repo ON pr.repository_id = repo.id
WHERE r.submitted_at >= NOW() - INTERVAL '30 days'
  AND c.is_active = TRUE 
  AND c.is_bot = FALSE
  AND repo.is_active = TRUE

ORDER BY activity_date DESC;

-- Fix share_analytics_summary view
DROP VIEW IF EXISTS share_analytics_summary CASCADE;
CREATE VIEW share_analytics_summary AS
SELECT 
  se.id,
  se.chart_type,
  se.repository,
  se.action,
  se.share_type,
  se.domain,
  se.short_url,
  se.created_at,
  sca.total_clicks,
  sca.unique_clicks,
  CASE 
    WHEN se.short_url IS NOT NULL THEN TRUE 
    ELSE FALSE 
  END as is_shortened
FROM share_events se
LEFT JOIN share_click_analytics sca ON se.dub_link_id = sca.dub_link_id
ORDER BY se.created_at DESC;

-- =====================================================
-- STEP 2: Enable RLS on all missing tables
-- =====================================================

-- Enable RLS on tables that don't have it yet
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributor_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_activity_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE pull_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributors ENABLE ROW LEVEL SECURITY;

-- Enable RLS on new tables
ALTER TABLE contributor_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_sync_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributor_role_history ENABLE ROW LEVEL SECURITY;

-- Enable RLS on partition tables
ALTER TABLE github_events_cache_2025_01 ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_events_cache_2025_02 ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_events_cache_2025_03 ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_events_cache_2025_06 ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 3: Create public read policies for all tables
-- =====================================================

-- Drop existing policies if they exist to avoid conflicts
DO $$ 
BEGIN
    -- Reviews policies
    DROP POLICY IF EXISTS "public_read_reviews" ON reviews;
    DROP POLICY IF EXISTS "auth_insert_reviews" ON reviews;
    DROP POLICY IF EXISTS "auth_update_reviews" ON reviews;
    DROP POLICY IF EXISTS "service_delete_reviews" ON reviews;
    
    -- Comments policies
    DROP POLICY IF EXISTS "public_read_comments" ON comments;
    DROP POLICY IF EXISTS "auth_insert_comments" ON comments;
    DROP POLICY IF EXISTS "auth_update_comments" ON comments;
    DROP POLICY IF EXISTS "service_delete_comments" ON comments;
    
    -- Organizations policies
    DROP POLICY IF EXISTS "public_read_organizations" ON organizations;
    DROP POLICY IF EXISTS "auth_insert_organizations" ON organizations;
    DROP POLICY IF EXISTS "auth_update_organizations" ON organizations;
    DROP POLICY IF EXISTS "service_delete_organizations" ON organizations;
    
    -- Contributor Organizations policies
    DROP POLICY IF EXISTS "public_read_contributor_organizations" ON contributor_organizations;
    DROP POLICY IF EXISTS "auth_manage_contributor_organizations" ON contributor_organizations;
    
    -- Monthly Rankings policies
    DROP POLICY IF EXISTS "public_read_monthly_rankings" ON monthly_rankings;
    DROP POLICY IF EXISTS "auth_insert_monthly_rankings" ON monthly_rankings;
    DROP POLICY IF EXISTS "auth_update_monthly_rankings" ON monthly_rankings;
    DROP POLICY IF EXISTS "service_delete_monthly_rankings" ON monthly_rankings;
    
    -- Daily Activity policies
    DROP POLICY IF EXISTS "public_read_daily_activity_snapshots" ON daily_activity_snapshots;
    DROP POLICY IF EXISTS "auth_insert_daily_activity_snapshots" ON daily_activity_snapshots;
    DROP POLICY IF EXISTS "auth_update_daily_activity_snapshots" ON daily_activity_snapshots;
    DROP POLICY IF EXISTS "service_delete_daily_activity_snapshots" ON daily_activity_snapshots;
    
    -- Sync Logs policies
    DROP POLICY IF EXISTS "auth_read_sync_logs" ON sync_logs;
    DROP POLICY IF EXISTS "service_manage_sync_logs" ON sync_logs;
    
    -- Repositories policies
    DROP POLICY IF EXISTS "public_read_repositories" ON repositories;
    DROP POLICY IF EXISTS "auth_insert_repositories" ON repositories;
    DROP POLICY IF EXISTS "auth_update_repositories" ON repositories;
    DROP POLICY IF EXISTS "service_delete_repositories" ON repositories;
    
    -- Pull Requests policies
    DROP POLICY IF EXISTS "public_read_pull_requests" ON pull_requests;
    DROP POLICY IF EXISTS "auth_insert_pull_requests" ON pull_requests;
    DROP POLICY IF EXISTS "auth_update_pull_requests" ON pull_requests;
    DROP POLICY IF EXISTS "service_delete_pull_requests" ON pull_requests;
    
    -- Contributors policies
    DROP POLICY IF EXISTS "public_read_contributors" ON contributors;
    DROP POLICY IF EXISTS "auth_insert_contributors" ON contributors;
    DROP POLICY IF EXISTS "auth_update_contributors" ON contributors;
    DROP POLICY IF EXISTS "service_delete_contributors" ON contributors;
    
    -- New tables policies
    DROP POLICY IF EXISTS "public_read_contributor_roles" ON contributor_roles;
    DROP POLICY IF EXISTS "public_read_github_sync_status" ON github_sync_status;
    DROP POLICY IF EXISTS "public_read_contributor_role_history" ON contributor_role_history;
    
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;

-- Create public read policies for all tables
CREATE POLICY "public_read_reviews" ON reviews FOR SELECT USING (true);
CREATE POLICY "public_read_comments" ON comments FOR SELECT USING (true);
CREATE POLICY "public_read_organizations" ON organizations FOR SELECT USING (true);
CREATE POLICY "public_read_contributor_organizations" ON contributor_organizations FOR SELECT USING (true);
CREATE POLICY "public_read_monthly_rankings" ON monthly_rankings FOR SELECT USING (true);
CREATE POLICY "public_read_daily_activity_snapshots" ON daily_activity_snapshots FOR SELECT USING (true);
CREATE POLICY "public_read_sync_logs" ON sync_logs FOR SELECT USING (true);
CREATE POLICY "public_read_repositories" ON repositories FOR SELECT USING (true);
CREATE POLICY "public_read_pull_requests" ON pull_requests FOR SELECT USING (true);
CREATE POLICY "public_read_contributors" ON contributors FOR SELECT USING (true);

-- Public read for new tables
CREATE POLICY "public_read_contributor_roles" ON contributor_roles FOR SELECT USING (true);
CREATE POLICY "public_read_github_sync_status" ON github_sync_status FOR SELECT USING (true);
CREATE POLICY "public_read_contributor_role_history" ON contributor_role_history FOR SELECT USING (true);

-- Public read for github events cache partitions
CREATE POLICY "public_read_github_events_2025_01" ON github_events_cache_2025_01 FOR SELECT USING (true);
CREATE POLICY "public_read_github_events_2025_02" ON github_events_cache_2025_02 FOR SELECT USING (true);
CREATE POLICY "public_read_github_events_2025_03" ON github_events_cache_2025_03 FOR SELECT USING (true);
CREATE POLICY "public_read_github_events_2025_06" ON github_events_cache_2025_06 FOR SELECT USING (true);

-- =====================================================
-- STEP 4: Create write policies for authenticated users
-- =====================================================

-- Reviews write policies
CREATE POLICY "auth_insert_reviews" ON reviews FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_reviews" ON reviews FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Comments write policies
CREATE POLICY "auth_insert_comments" ON comments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_comments" ON comments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Organizations write policies
CREATE POLICY "auth_insert_organizations" ON organizations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_organizations" ON organizations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Contributor Organizations write policies
CREATE POLICY "auth_manage_contributor_organizations" ON contributor_organizations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Monthly Rankings write policies
CREATE POLICY "auth_insert_monthly_rankings" ON monthly_rankings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_monthly_rankings" ON monthly_rankings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Daily Activity write policies
CREATE POLICY "auth_insert_daily_activity_snapshots" ON daily_activity_snapshots FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_daily_activity_snapshots" ON daily_activity_snapshots FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Repositories write policies
CREATE POLICY "auth_insert_repositories" ON repositories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_repositories" ON repositories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Pull Requests write policies
CREATE POLICY "auth_insert_pull_requests" ON pull_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_pull_requests" ON pull_requests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Contributors write policies
CREATE POLICY "auth_insert_contributors" ON contributors FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_contributors" ON contributors FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- New tables write policies
CREATE POLICY "auth_write_contributor_roles" ON contributor_roles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_write_github_sync_status" ON github_sync_status FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_write_contributor_role_history" ON contributor_role_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Github events cache write policies
CREATE POLICY "auth_write_github_events_2025_01" ON github_events_cache_2025_01 FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_write_github_events_2025_02" ON github_events_cache_2025_02 FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_write_github_events_2025_03" ON github_events_cache_2025_03 FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_write_github_events_2025_06" ON github_events_cache_2025_06 FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- STEP 5: Service role policies for administrative tasks
-- =====================================================

-- Service role delete policies
CREATE POLICY "service_delete_reviews" ON reviews FOR DELETE TO service_role USING (true);
CREATE POLICY "service_delete_comments" ON comments FOR DELETE TO service_role USING (true);
CREATE POLICY "service_delete_organizations" ON organizations FOR DELETE TO service_role USING (true);
CREATE POLICY "service_delete_monthly_rankings" ON monthly_rankings FOR DELETE TO service_role USING (true);
CREATE POLICY "service_delete_daily_activity_snapshots" ON daily_activity_snapshots FOR DELETE TO service_role USING (true);
CREATE POLICY "service_delete_repositories" ON repositories FOR DELETE TO service_role USING (true);
CREATE POLICY "service_delete_pull_requests" ON pull_requests FOR DELETE TO service_role USING (true);
CREATE POLICY "service_delete_contributors" ON contributors FOR DELETE TO service_role USING (true);

-- Service role full access for sync logs
CREATE POLICY "service_manage_sync_logs" ON sync_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================
-- STEP 6: Grant appropriate permissions
-- =====================================================

-- Grant read permissions to public on views
GRANT SELECT ON contributor_stats TO PUBLIC;
GRANT SELECT ON repository_stats TO PUBLIC;
GRANT SELECT ON recent_activity TO PUBLIC;
GRANT SELECT ON share_analytics_summary TO PUBLIC;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify RLS is enabled on all tables
SELECT 
    schemaname,
    tablename,
    CASE 
        WHEN rowsecurity THEN '✅ RLS Enabled'
        ELSE '❌ RLS Disabled'
    END as rls_status
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename NOT LIKE 'pg_%'
AND tablename NOT IN ('schema_migrations', 'migrations')
ORDER BY tablename;

-- Count policies per table
SELECT 
    schemaname,
    tablename,
    COUNT(*) as policy_count,
    string_agg(policyname, ', ' ORDER BY policyname) as policies
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;

-- Check for SECURITY DEFINER views
SELECT 
    schemaname,
    viewname,
    CASE 
        WHEN definition ILIKE '%SECURITY DEFINER%' THEN '❌ Has SECURITY DEFINER'
        ELSE '✅ No SECURITY DEFINER'
    END as security_status
FROM pg_views
WHERE schemaname = 'public'
ORDER BY viewname;

-- From 20250131_add_maintainer_admin_overrides.sql
-- Migration: Add admin override fields for maintainer management
-- Description: Adds fields to track manual admin overrides of contributor roles

-- Add admin override fields to contributor_roles table
ALTER TABLE public.contributor_roles 
ADD COLUMN IF NOT EXISTS admin_override BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS admin_override_by BIGINT,
ADD COLUMN IF NOT EXISTS admin_override_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS override_reason TEXT,
ADD COLUMN IF NOT EXISTS locked BOOLEAN DEFAULT FALSE;

-- Add foreign key constraint for admin user
ALTER TABLE public.contributor_roles
ADD CONSTRAINT fk_admin_override_by 
FOREIGN KEY (admin_override_by) 
REFERENCES public.app_users(github_user_id) 
ON DELETE SET NULL;

-- Create index for admin overrides
CREATE INDEX IF NOT EXISTS idx_contributor_roles_admin_override 
ON public.contributor_roles(admin_override) 
WHERE admin_override = TRUE;

-- Create index for locked roles
CREATE INDEX IF NOT EXISTS idx_contributor_roles_locked 
ON public.contributor_roles(locked) 
WHERE locked = TRUE;

-- Update RLS policies to allow admin updates
CREATE POLICY "Allow admin users to update contributor roles"
ON public.contributor_roles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.app_users
    WHERE app_users.auth_user_id = auth.uid()
    AND app_users.is_admin = TRUE
    AND app_users.is_active = TRUE
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.app_users
    WHERE app_users.auth_user_id = auth.uid()
    AND app_users.is_admin = TRUE
    AND app_users.is_active = TRUE
  )
);

-- Create function to handle admin role override
CREATE OR REPLACE FUNCTION public.override_contributor_role(
  p_user_id TEXT,
  p_repository_owner TEXT,
  p_repository_name TEXT,
  p_new_role TEXT,
  p_admin_github_id BIGINT,
  p_reason TEXT DEFAULT NULL,
  p_lock BOOLEAN DEFAULT FALSE
)
RETURNS VOID AS $$
DECLARE
  v_role_id UUID;
  v_previous_role TEXT;
  v_previous_confidence DECIMAL(3,2);
BEGIN
  -- Get current role info
  SELECT id, role, confidence_score 
  INTO v_role_id, v_previous_role, v_previous_confidence
  FROM public.contributor_roles
  WHERE user_id = p_user_id 
    AND repository_owner = p_repository_owner 
    AND repository_name = p_repository_name;

  -- Update the role with admin override
  UPDATE public.contributor_roles
  SET 
    role = p_new_role,
    admin_override = TRUE,
    admin_override_by = p_admin_github_id,
    admin_override_at = NOW(),
    override_reason = p_reason,
    locked = p_lock,
    updated_at = NOW()
  WHERE user_id = p_user_id 
    AND repository_owner = p_repository_owner 
    AND repository_name = p_repository_name;

  -- If no existing role, insert new one
  IF NOT FOUND THEN
    INSERT INTO public.contributor_roles (
      user_id, repository_owner, repository_name, role, 
      confidence_score, admin_override, admin_override_by, 
      admin_override_at, override_reason, locked, detection_methods
    ) VALUES (
      p_user_id, p_repository_owner, p_repository_name, p_new_role,
      0.0, TRUE, p_admin_github_id, NOW(), p_reason, p_lock, 
      '["manual_admin_override"]'::jsonb
    )
    RETURNING id INTO v_role_id;
  END IF;

  -- Log the change in history
  INSERT INTO public.contributor_role_history (
    contributor_role_id, user_id, repository_owner, repository_name,
    previous_role, new_role, previous_confidence, new_confidence,
    change_reason, detection_methods
  ) VALUES (
    v_role_id, p_user_id, p_repository_owner, p_repository_name,
    v_previous_role, p_new_role, v_previous_confidence, 0.0,
    COALESCE(p_reason, 'Admin manual override'),
    '["manual_admin_override"]'::jsonb
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -- Grant execute permission to authenticated (conditional)
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    Grant execute permission to authenticated;
  ELSE
    RAISE NOTICE 'Role authenticated not found, skipping grant';
  END IF;
END $; users (admin check is inside function)
GRANT EXECUTE ON FUNCTION public.override_contributor_role TO authenticated;

-- Update role constraint to include bot
ALTER TABLE public.contributor_roles 
DROP CONSTRAINT IF EXISTS contributor_roles_role_check;

ALTER TABLE public.contributor_roles 
ADD CONSTRAINT contributor_roles_role_check 
CHECK (role IN ('owner', 'maintainer', 'contributor', 'bot'));

-- From 20250620_allow_anon_track_repositories.sql
-- Allow anonymous users to track repositories
-- This enables the auto-tracking feature to work without authentication

-- Create policy for anonymous users to insert tracked repositories
CREATE POLICY "anon_insert_tracked_repositories"
ON tracked_repositories FOR INSERT
TO anon
WITH CHECK (true);

-- Also allow anonymous users to check if a repository is already tracked
-- (The SELECT policy already exists as "public_read_tracked_repositories")

-- Optional: Add a policy for authenticated users as well
CREATE POLICY "auth_insert_tracked_repositories"
ON tracked_repositories FOR INSERT
TO authenticated
WITH CHECK (true);

-- From 20250627000000_repository_confidence_cache.sql
-- Repository Confidence Cache Table
-- Stores pre-calculated confidence scores to improve performance

CREATE TABLE IF NOT EXISTS repository_confidence_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Repository identification
  repository_owner text NOT NULL,
  repository_name text NOT NULL,
  
  -- Confidence score data
  confidence_score integer NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
  time_range_days integer NOT NULL CHECK (time_range_days > 0),
  
  -- Cache metadata
  calculated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  
  -- Data freshness tracking
  last_sync_at timestamptz,
  data_version integer DEFAULT 1,
  
  -- Performance tracking
  calculation_time_ms integer,
  
  -- Constraints
  UNIQUE(repository_owner, repository_name, time_range_days),
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_confidence_cache_repo_lookup 
  ON repository_confidence_cache(repository_owner, repository_name, time_range_days);

CREATE INDEX IF NOT EXISTS idx_confidence_cache_expires 
  ON repository_confidence_cache(expires_at);

CREATE INDEX IF NOT EXISTS idx_confidence_cache_freshness 
  ON repository_confidence_cache(calculated_at DESC);

-- RLS Policies (allow public read access similar to other tables)
ALTER TABLE repository_confidence_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to confidence cache" 
  ON repository_confidence_cache 
  FOR SELECT 
  USING (true);

CREATE POLICY "Allow authenticated insert/update to confidence cache" 
  ON repository_confidence_cache 
  FOR ALL 
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_confidence_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_confidence_cache_updated_at_trigger
  BEFORE UPDATE ON repository_confidence_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_confidence_cache_updated_at();

-- Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_confidence_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM repository_confidence_cache 
  WHERE expires_at < now() - interval '1 day';
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE repository_confidence_cache IS 'Caches pre-calculated repository confidence scores to improve performance';
COMMENT ON COLUMN repository_confidence_cache.confidence_score IS 'Cached confidence score (0-100)';
COMMENT ON COLUMN repository_confidence_cache.time_range_days IS 'Time range used for calculation (30, 90, 365 days)';
COMMENT ON COLUMN repository_confidence_cache.expires_at IS 'When this cache entry expires and needs recalculation';
COMMENT ON COLUMN repository_confidence_cache.last_sync_at IS 'Last time the repository was synced with GitHub';
COMMENT ON COLUMN repository_confidence_cache.data_version IS 'Version of the calculation algorithm used';
COMMENT ON COLUMN repository_confidence_cache.calculation_time_ms IS 'Time taken to calculate this score in milliseconds';

-- From 20250629000000_add_admin_system.sql
-- Admin System Migration
-- Creates user role management and admin functionality

-- Create app_users table to link Supabase Auth users with GitHub profiles
CREATE TABLE IF NOT EXISTS app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    github_id BIGINT UNIQUE NOT NULL,
    github_username VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    avatar_url TEXT,
    email VARCHAR(255),
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    UNIQUE(auth_user_id),
    UNIQUE(github_username)
);

-- Create user_roles table for flexible role management
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
    role_name VARCHAR(50) NOT NULL CHECK (role_name IN ('admin', 'moderator', 'user')),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    granted_by UUID REFERENCES app_users(id),
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_by UUID REFERENCES app_users(id),
    is_active BOOLEAN GENERATED ALWAYS AS (revoked_at IS NULL) STORED,
    UNIQUE(user_id, role_name, is_active) WHERE is_active = TRUE
);

-- Create admin_action_logs for audit trail
CREATE TABLE IF NOT EXISTS admin_action_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    action_type VARCHAR(100) NOT NULL,
    target_type VARCHAR(100), -- 'user', 'pull_request', 'repository', etc.
    target_id VARCHAR(255),
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_app_users_github_id ON app_users(github_id);
CREATE INDEX IF NOT EXISTS idx_app_users_github_username ON app_users(github_username);
CREATE INDEX IF NOT EXISTS idx_app_users_auth_user_id ON app_users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_active ON user_roles(user_id, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_admin_action_logs_admin_user_id ON admin_action_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_action_logs_created_at ON admin_action_logs(created_at);

-- Function to check if a user is admin
CREATE OR REPLACE FUNCTION is_user_admin(user_github_id BIGINT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM app_users 
        WHERE github_id = user_github_id 
        AND is_admin = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if a user has a specific role
CREATE OR REPLACE FUNCTION user_has_role(user_github_id BIGINT, role_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM app_users au
        JOIN user_roles ur ON au.id = ur.user_id
        WHERE au.github_id = user_github_id 
        AND ur.role_name = user_has_role.role_name
        AND ur.is_active = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to upsert app_user from auth user and GitHub data
CREATE OR REPLACE FUNCTION upsert_app_user(
    p_auth_user_id UUID,
    p_github_id BIGINT,
    p_github_username VARCHAR(255),
    p_display_name VARCHAR(255) DEFAULT NULL,
    p_avatar_url TEXT DEFAULT NULL,
    p_email VARCHAR(255) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    user_id UUID;
BEGIN
    INSERT INTO app_users (
        auth_user_id, github_id, github_username, 
        display_name, avatar_url, email, last_login
    )
    VALUES (
        p_auth_user_id, p_github_id, p_github_username,
        p_display_name, p_avatar_url, p_email, NOW()
    )
    ON CONFLICT (github_id) 
    DO UPDATE SET
        auth_user_id = EXCLUDED.auth_user_id,
        github_username = EXCLUDED.github_username,
        display_name = COALESCE(EXCLUDED.display_name, app_users.display_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, app_users.avatar_url),
        email = COALESCE(EXCLUDED.email, app_users.email),
        updated_at = NOW(),
        last_login = NOW()
    RETURNING id INTO user_id;
    
    RETURN user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log admin actions
CREATE OR REPLACE FUNCTION log_admin_action(
    p_admin_github_id BIGINT,
    p_action_type VARCHAR(100),
    p_target_type VARCHAR(100) DEFAULT NULL,
    p_target_id VARCHAR(255) DEFAULT NULL,
    p_details JSONB DEFAULT '{}',
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    admin_user_id UUID;
    log_id UUID;
BEGIN
    -- Get admin user ID
    SELECT id INTO admin_user_id 
    FROM app_users 
    WHERE github_id = p_admin_github_id;
    
    -- Create log entry
    INSERT INTO admin_action_logs (
        admin_user_id, action_type, target_type, target_id,
        details, ip_address, user_agent
    )
    VALUES (
        admin_user_id, p_action_type, p_target_type, p_target_id,
        p_details, p_ip_address, p_user_agent
    )
    RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable Row Level Security
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_action_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for app_users
-- Allow public read access (for progressive onboarding)
CREATE POLICY "Allow public read access to app_users" ON app_users
    FOR SELECT USING (true);

-- Allow users to update their own records
CREATE POLICY "Users can update own record" ON app_users
    FOR UPDATE USING (auth.uid() = auth_user_id);

-- Allow admins full access
CREATE POLICY "Admins have full access to app_users" ON app_users
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM app_users 
            WHERE auth_user_id = auth.uid() 
            AND is_admin = TRUE
        )
    );

-- RLS Policies for user_roles
-- Allow public read access to active roles
CREATE POLICY "Allow public read access to active user_roles" ON user_roles
    FOR SELECT USING (is_active = TRUE);

-- Allow admins full access
CREATE POLICY "Admins have full access to user_roles" ON user_roles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM app_users 
            WHERE auth_user_id = auth.uid() 
            AND is_admin = TRUE
        )
    );

-- RLS Policies for admin_action_logs
-- Only admins can read logs
CREATE POLICY "Only admins can read admin_action_logs" ON admin_action_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM app_users 
            WHERE auth_user_id = auth.uid() 
            AND is_admin = TRUE
        )
    );

-- Only admins can insert logs (via function)
CREATE POLICY "Only admins can insert admin_action_logs" ON admin_action_logs
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM app_users 
            WHERE auth_user_id = auth.uid() 
            AND is_admin = TRUE
        )
    );

-- Bootstrap admin user: bdougie (GitHub ID: 5713670)
-- Note: This will be updated when they first log in with actual auth_user_id
INSERT INTO app_users (
    github_id, 
    github_username, 
    display_name,
    is_admin
) VALUES (
    5713670,
    'bdougie', 
    'Brian Douglas',
    TRUE
) ON CONFLICT (github_id) DO UPDATE SET
    is_admin = TRUE,
    updated_at = NOW();

-- Grant admin role to bdougie
INSERT INTO user_roles (user_id, role_name)
SELECT id, 'admin'
FROM app_users 
WHERE github_username = 'bdougie'
ON CONFLICT (user_id, role_name, is_active) WHERE is_active = TRUE 
DO NOTHING;

-- Add helpful comments
COMMENT ON TABLE app_users IS 'Application users linked to Supabase Auth and GitHub profiles';
COMMENT ON TABLE user_roles IS 'Flexible role management system for users';
COMMENT ON TABLE admin_action_logs IS 'Audit trail for administrative actions';
COMMENT ON FUNCTION is_user_admin(BIGINT) IS 'Check if a GitHub user ID has admin privileges';
COMMENT ON FUNCTION user_has_role(BIGINT, TEXT) IS 'Check if a GitHub user ID has a specific role';
COMMENT ON FUNCTION upsert_app_user IS 'Create or update app_user from auth and GitHub data';
COMMENT ON FUNCTION log_admin_action IS 'Log administrative actions for audit trail';

-- From 20250629000001_add_pr_template_support.sql
-- Migration: Add PR Template Support
-- Add fields to repositories table for caching PR templates and enable repository-specific spam detection

-- Add PR template fields to repositories table
ALTER TABLE repositories ADD COLUMN IF NOT EXISTS pr_template_content TEXT;
ALTER TABLE repositories ADD COLUMN IF NOT EXISTS pr_template_url TEXT;
ALTER TABLE repositories ADD COLUMN IF NOT EXISTS pr_template_hash TEXT;
ALTER TABLE repositories ADD COLUMN IF NOT EXISTS pr_template_fetched_at TIMESTAMP WITH TIME ZONE;

-- Create repository_spam_patterns table for storing repository-specific spam patterns
CREATE TABLE IF NOT EXISTS repository_spam_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('template_match', 'empty_sections', 'minimal_effort')),
  pattern_content TEXT NOT NULL,
  pattern_description TEXT NOT NULL,
  weight DECIMAL(3,2) NOT NULL DEFAULT 0.8 CHECK (weight >= 0 AND weight <= 1),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique patterns per repository
  UNIQUE(repository_id, pattern_type, pattern_content)
);

-- Create index for efficient pattern lookup
CREATE INDEX IF NOT EXISTS idx_repository_spam_patterns_repo_id ON repository_spam_patterns(repository_id);
CREATE INDEX IF NOT EXISTS idx_repository_spam_patterns_type ON repository_spam_patterns(pattern_type);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_repository_spam_patterns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_repository_spam_patterns_updated_at
  BEFORE UPDATE ON repository_spam_patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_repository_spam_patterns_updated_at();

-- Enable RLS on repository_spam_patterns
ALTER TABLE repository_spam_patterns ENABLE ROW LEVEL SECURITY;

-- Allow public read access for spam pattern checking
CREATE POLICY "Allow public read access to repository_spam_patterns"
  ON repository_spam_patterns FOR SELECT
  TO PUBLIC
  USING (true);

-- Allow authenticated users to insert/update patterns (for admin functions)
CREATE POLICY "Allow authenticated users to manage repository_spam_patterns"
  ON repository_spam_patterns FOR ALL
  TO authenticated
  USING (true);

-- Add comment for documentation
COMMENT ON TABLE repository_spam_patterns IS 'Repository-specific spam detection patterns generated from PR templates';
COMMENT ON COLUMN repositories.pr_template_content IS 'Cached content of the repository PR template';
COMMENT ON COLUMN repositories.pr_template_url IS 'URL of the PR template file on GitHub';
COMMENT ON COLUMN repositories.pr_template_hash IS 'MD5 hash of template content for change detection';
COMMENT ON COLUMN repositories.pr_template_fetched_at IS 'Timestamp when template was last fetched from GitHub';

-- From 20250710000000_add_progressive_capture_jobs.sql
-- Add progressive capture jobs table for hybrid queue management
-- This enables tracking jobs across both Inngest and GitHub Actions processors

-- Create progressive capture jobs table
CREATE TABLE IF NOT EXISTS progressive_capture_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_type VARCHAR(50) NOT NULL,
  repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE,
  processor_type VARCHAR(20) NOT NULL DEFAULT 'github_actions', -- 'inngest' or 'github_actions'
  status VARCHAR(20) DEFAULT 'pending',
  time_range_days INTEGER,
  workflow_run_id BIGINT, -- For GitHub Actions jobs
  metadata JSONB DEFAULT '{}',
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_capture_jobs_processor 
ON progressive_capture_jobs(processor_type, status, created_at);

CREATE INDEX IF NOT EXISTS idx_capture_jobs_repository 
ON progressive_capture_jobs(repository_id, created_at);

CREATE INDEX IF NOT EXISTS idx_capture_jobs_status
ON progressive_capture_jobs(status, created_at);

CREATE INDEX IF NOT EXISTS idx_capture_jobs_workflow_run
ON progressive_capture_jobs(workflow_run_id) 
WHERE workflow_run_id IS NOT NULL;

-- Create progress tracking table
CREATE TABLE IF NOT EXISTS progressive_capture_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES progressive_capture_jobs(id) ON DELETE CASCADE,
  total_items INTEGER,
  processed_items INTEGER DEFAULT 0,
  failed_items INTEGER DEFAULT 0,
  current_item TEXT,
  errors JSONB DEFAULT '[]',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for progress tracking
CREATE INDEX IF NOT EXISTS idx_capture_progress_job_id
ON progressive_capture_progress(job_id);

-- Add RLS policies
ALTER TABLE progressive_capture_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE progressive_capture_progress ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all jobs (for monitoring)
CREATE POLICY "progressive_capture_jobs_select" ON progressive_capture_jobs
FOR SELECT TO authenticated 
USING (true);

-- Allow service role to manage all jobs
CREATE POLICY "progressive_capture_jobs_service" ON progressive_capture_jobs
FOR ALL TO service_role 
USING (true);

-- Allow authenticated users to read progress
CREATE POLICY "progressive_capture_progress_select" ON progressive_capture_progress
FOR SELECT TO authenticated 
USING (true);

-- Allow service role to manage progress
CREATE POLICY "progressive_capture_progress_service" ON progressive_capture_progress
FOR ALL TO service_role 
USING (true);

-- Add helpful views for monitoring
CREATE OR REPLACE VIEW progressive_capture_stats AS
SELECT 
  processor_type,
  status,
  COUNT(*) as count,
  MIN(created_at) as oldest_job,
  MAX(created_at) as newest_job,
  AVG(EXTRACT(EPOCH FROM (completed_at - started_at))/60) as avg_duration_minutes
FROM progressive_capture_jobs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY processor_type, status;

-- -- Grant select on the view
GRANT SELECT ON progressive_capture_stats TO authenticated (conditional)
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    Grant select on the view
GRANT SELECT ON progressive_capture_stats TO authenticated;
  ELSE
    RAISE NOTICE 'Role authenticated not found, skipping grant';
  END IF;
END $;, service_role;

-- Add function to get job metrics
CREATE OR REPLACE FUNCTION get_progressive_capture_metrics(days_back INTEGER DEFAULT 7)
RETURNS TABLE (
  total_jobs BIGINT,
  pending_jobs BIGINT,
  processing_jobs BIGINT,
  completed_jobs BIGINT,
  failed_jobs BIGINT,
  inngest_jobs BIGINT,
  github_actions_jobs BIGINT,
  avg_completion_time_minutes NUMERIC
) 
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT 
    COUNT(*) as total_jobs,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_jobs,
    COUNT(*) FILTER (WHERE status = 'processing') as processing_jobs,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_jobs,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_jobs,
    COUNT(*) FILTER (WHERE processor_type = 'inngest') as inngest_jobs,
    COUNT(*) FILTER (WHERE processor_type = 'github_actions') as github_actions_jobs,
    AVG(EXTRACT(EPOCH FROM (completed_at - started_at))/60) as avg_completion_time_minutes
  FROM progressive_capture_jobs
  WHERE created_at > NOW() - INTERVAL '1 day' * days_back;
$$;

-- -- Grant execute permission
GRANT EXECUTE ON FUNCTION get_progressive_capture_metrics TO authenticated (conditional)
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    Grant execute permission
GRANT EXECUTE ON FUNCTION get_progressive_capture_metrics TO authenticated;
  ELSE
    RAISE NOTICE 'Role authenticated not found, skipping grant';
  END IF;
END $;, service_role;

-- Add comment for documentation
COMMENT ON TABLE progressive_capture_jobs IS 'Tracks jobs across hybrid progressive capture system (Inngest + GitHub Actions)';
COMMENT ON TABLE progressive_capture_progress IS 'Tracks progress of individual progressive capture jobs';

-- From 20250710010000_add_rollout_configuration.sql
-- Add rollout configuration tables for hybrid progressive capture
-- This enables gradual rollout with safety controls and monitoring

-- Create rollout configuration table
CREATE TABLE IF NOT EXISTS rollout_configuration (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feature_name VARCHAR(100) NOT NULL,
  rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  is_active BOOLEAN DEFAULT false,
  target_repositories TEXT[] DEFAULT '{}', -- Array of repository IDs for whitelist
  excluded_repositories TEXT[] DEFAULT '{}', -- Array of repository IDs for blacklist
  rollout_strategy VARCHAR(50) DEFAULT 'percentage', -- 'percentage', 'whitelist', 'repository_size'
  max_error_rate DECIMAL(5,2) DEFAULT 5.0, -- Maximum error rate before auto-rollback
  monitoring_window_hours INTEGER DEFAULT 24, -- Window for monitoring rollout health
  auto_rollback_enabled BOOLEAN DEFAULT true,
  emergency_stop BOOLEAN DEFAULT false, -- Manual emergency stop
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create repository categorization table
CREATE TABLE IF NOT EXISTS repository_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE,
  category VARCHAR(20) NOT NULL, -- 'test', 'small', 'medium', 'large', 'enterprise'
  priority_level INTEGER DEFAULT 0, -- 0 = lowest priority, 100 = highest priority
  is_test_repository BOOLEAN DEFAULT false,
  star_count INTEGER DEFAULT 0,
  contributor_count INTEGER DEFAULT 0,
  pr_count INTEGER DEFAULT 0,
  monthly_activity_score INTEGER DEFAULT 0,
  last_categorized_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(repository_id)
);

-- Create rollout metrics table for monitoring
CREATE TABLE IF NOT EXISTS rollout_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rollout_config_id UUID REFERENCES rollout_configuration(id) ON DELETE CASCADE,
  repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE,
  processor_type VARCHAR(20) NOT NULL, -- 'inngest' or 'github_actions'
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  total_jobs INTEGER DEFAULT 0,
  average_processing_time DECIMAL(10,2), -- in seconds
  last_error_message TEXT,
  last_error_at TIMESTAMP WITH TIME ZONE,
  metrics_window_start TIMESTAMP WITH TIME ZONE,
  metrics_window_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create rollout history table for audit trail
CREATE TABLE IF NOT EXISTS rollout_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rollout_config_id UUID REFERENCES rollout_configuration(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL, -- 'created', 'updated', 'rollback', 'emergency_stop'
  previous_percentage INTEGER,
  new_percentage INTEGER,
  reason TEXT,
  triggered_by VARCHAR(100), -- 'manual', 'auto_rollback', 'schedule'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_rollout_config_feature_active 
ON rollout_configuration(feature_name, is_active);

CREATE INDEX IF NOT EXISTS idx_rollout_config_emergency_stop 
ON rollout_configuration(emergency_stop, is_active);

CREATE INDEX IF NOT EXISTS idx_repo_categories_category 
ON repository_categories(category, priority_level);

CREATE INDEX IF NOT EXISTS idx_repo_categories_test 
ON repository_categories(is_test_repository, priority_level);

CREATE INDEX IF NOT EXISTS idx_rollout_metrics_config_repo 
ON rollout_metrics(rollout_config_id, repository_id, created_at);

CREATE INDEX IF NOT EXISTS idx_rollout_metrics_errors 
ON rollout_metrics(error_count, created_at) 
WHERE error_count > 0;

CREATE INDEX IF NOT EXISTS idx_rollout_history_config_action 
ON rollout_history(rollout_config_id, action, created_at);

-- Add RLS policies
ALTER TABLE rollout_configuration ENABLE ROW LEVEL SECURITY;
ALTER TABLE repository_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE rollout_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE rollout_history ENABLE ROW LEVEL SECURITY;

-- Allow public read access for monitoring
CREATE POLICY "rollout_config_public_read" 
ON rollout_configuration FOR SELECT 
TO public 
USING (true);

CREATE POLICY "repo_categories_public_read" 
ON repository_categories FOR SELECT 
TO public 
USING (true);

CREATE POLICY "rollout_metrics_public_read" 
ON rollout_metrics FOR SELECT 
TO public 
USING (true);

CREATE POLICY "rollout_history_public_read" 
ON rollout_history FOR SELECT 
TO public 
USING (true);

-- Insert initial rollout configuration for hybrid progressive capture
INSERT INTO rollout_configuration (
  feature_name,
  rollout_percentage,
  is_active,
  rollout_strategy,
  max_error_rate,
  monitoring_window_hours,
  auto_rollback_enabled,
  emergency_stop,
  metadata
) VALUES (
  'hybrid_progressive_capture',
  0, -- Start with 0% rollout
  true,
  'percentage',
  5.0,
  24,
  true,
  false,
  '{"description": "Hybrid progressive capture system with Inngest + GitHub Actions routing"}'
) ON CONFLICT DO NOTHING;

-- Function to automatically categorize repositories
CREATE OR REPLACE FUNCTION categorize_repository(repo_id UUID)
RETURNS TEXT AS $$
DECLARE
  star_count INTEGER;
  contributor_count INTEGER;
  pr_count INTEGER;
  category TEXT;
  priority INTEGER;
BEGIN
  -- Get repository stats
  SELECT 
    COALESCE(r.stargazers_count, 0),
    COALESCE(r.contributors_count, 0),
    COALESCE(pr_stats.pr_count, 0)
  INTO star_count, contributor_count, pr_count
  FROM repositories r
  LEFT JOIN (
    SELECT repository_id, COUNT(*) as pr_count
    FROM pull_requests
    WHERE repository_id = repo_id
    GROUP BY repository_id
  ) pr_stats ON r.id = pr_stats.repository_id
  WHERE r.id = repo_id;

  -- Categorize based on activity and size
  IF star_count = 0 AND contributor_count <= 2 AND pr_count <= 10 THEN
    category := 'test';
    priority := 100; -- Highest priority for testing
  ELSIF star_count <= 50 AND contributor_count <= 10 AND pr_count <= 100 THEN
    category := 'small';
    priority := 80;
  ELSIF star_count <= 500 AND contributor_count <= 50 AND pr_count <= 1000 THEN
    category := 'medium';
    priority := 60;
  ELSIF star_count <= 5000 AND contributor_count <= 200 AND pr_count <= 10000 THEN
    category := 'large';
    priority := 40;
  ELSE
    category := 'enterprise';
    priority := 20; -- Lowest priority for enterprise repos
  END IF;

  -- Insert or update categorization
  INSERT INTO repository_categories (
    repository_id,
    category,
    priority_level,
    is_test_repository,
    star_count,
    contributor_count,
    pr_count,
    monthly_activity_score
  ) VALUES (
    repo_id,
    category,
    priority,
    category = 'test',
    star_count,
    contributor_count,
    pr_count,
    LEAST(100, star_count + contributor_count + (pr_count / 10))
  )
  ON CONFLICT (repository_id) DO UPDATE SET
    category = EXCLUDED.category,
    priority_level = EXCLUDED.priority_level,
    is_test_repository = EXCLUDED.is_test_repository,
    star_count = EXCLUDED.star_count,
    contributor_count = EXCLUDED.contributor_count,
    pr_count = EXCLUDED.pr_count,
    monthly_activity_score = EXCLUDED.monthly_activity_score,
    last_categorized_at = NOW(),
    updated_at = NOW();

  RETURN category;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate rollout eligibility
CREATE OR REPLACE FUNCTION is_repository_eligible_for_rollout(
  repo_id UUID,
  feature_name TEXT DEFAULT 'hybrid_progressive_capture'
)
RETURNS BOOLEAN AS $$
DECLARE
  config_record RECORD;
  repo_category TEXT;
  is_eligible BOOLEAN := false;
BEGIN
  -- Get rollout configuration
  SELECT * INTO config_record
  FROM rollout_configuration
  WHERE rollout_configuration.feature_name = is_repository_eligible_for_rollout.feature_name
    AND is_active = true
    AND emergency_stop = false;

  -- If no active configuration, return false
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Check if explicitly excluded
  IF repo_id::TEXT = ANY(config_record.excluded_repositories) THEN
    RETURN false;
  END IF;

  -- Check if explicitly included (whitelist)
  IF repo_id::TEXT = ANY(config_record.target_repositories) THEN
    RETURN true;
  END IF;

  -- If whitelist strategy and not in whitelist, return false
  IF config_record.rollout_strategy = 'whitelist' AND 
     NOT (repo_id::TEXT = ANY(config_record.target_repositories)) THEN
    RETURN false;
  END IF;

  -- Get repository category
  SELECT category INTO repo_category
  FROM repository_categories
  WHERE repository_id = repo_id;

  -- If no category, categorize now
  IF NOT FOUND THEN
    repo_category := categorize_repository(repo_id);
  END IF;

  -- Apply rollout percentage based on category and strategy
  IF config_record.rollout_strategy = 'percentage' THEN
    -- Use hash-based deterministic selection
    is_eligible := (hashtext(repo_id::TEXT) % 100) < config_record.rollout_percentage;
  ELSIF config_record.rollout_strategy = 'repository_size' THEN
    -- Start with test repositories, then small, then larger
    CASE config_record.rollout_percentage
      WHEN 0 THEN is_eligible := false;
      WHEN 10 THEN is_eligible := repo_category = 'test';
      WHEN 25 THEN is_eligible := repo_category IN ('test', 'small');
      WHEN 50 THEN is_eligible := repo_category IN ('test', 'small', 'medium');
      WHEN 75 THEN is_eligible := repo_category IN ('test', 'small', 'medium', 'large');
      ELSE is_eligible := true; -- 100% includes all categories
    END CASE;
  END IF;

  RETURN is_eligible;
END;
$$ LANGUAGE plpgsql;

-- From 20250712000000_add_email_logs.sql
-- Add email logs table for tracking sent emails
CREATE TABLE IF NOT EXISTS email_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    email_type text NOT NULL CHECK (email_type IN ('welcome', 'notification', 'marketing', 'transactional')),
    recipient_email text NOT NULL,
    resend_email_id text, -- Resend API email ID for tracking
    sent_at timestamptz DEFAULT now(),
    failed_at timestamptz,
    error_message text,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_email_type ON email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient_email ON email_logs(recipient_email);

-- Add RLS policy to allow users to see their own email logs
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own email logs
CREATE POLICY "Users can view their own email logs" ON email_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Service role can manage all email logs
CREATE POLICY "Service role can manage email logs" ON email_logs
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Add a trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_email_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_email_logs_updated_at
    BEFORE UPDATE ON email_logs
    FOR EACH ROW
    EXECUTE PROCEDURE update_email_logs_updated_at();

-- Add a function to check email sending rate limits (optional)
CREATE OR REPLACE FUNCTION check_email_rate_limit(
    p_user_id uuid,
    p_email_type text,
    p_time_window interval DEFAULT '1 hour',
    p_max_emails integer DEFAULT 5
)
RETURNS boolean AS $$
DECLARE
    email_count integer;
BEGIN
    SELECT COUNT(*)
    INTO email_count
    FROM email_logs
    WHERE user_id = p_user_id
      AND email_type = p_email_type
      AND sent_at > (now() - p_time_window)
      AND failed_at IS NULL;
    
    RETURN email_count < p_max_emails;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -- Grant permissions
GRANT USAGE ON SCHEMA public TO anon (conditional)
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    Grant permissions
GRANT USAGE ON SCHEMA public TO anon;
  ELSE
    RAISE NOTICE 'Role anon not found, skipping grant';
  END IF;
END $;, authenticated;
-- GRANT SELECT ON email_logs TO anon (conditional)
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT ON email_logs TO anon;
  ELSE
    RAISE NOTICE 'Role anon not found, skipping grant';
  END IF;
END $;, authenticated;
-- GRANT ALL ON email_logs TO service_role (conditional)
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON email_logs TO service_role;
  ELSE
    RAISE NOTICE 'Role service_role not found, skipping grant';
  END IF;
END $;;

-- From 20250712000001_add_auth_user_trigger.sql
-- Migration to automatically create app_users entry when a new user logs in via GitHub OAuth
-- This fixes the "Database error saving new user" issue

-- Create or replace function to handle new auth user creation
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger AS $$
BEGIN
    -- Only process if the user has GitHub metadata
    IF NEW.raw_user_meta_data->>'provider_id' IS NOT NULL AND 
       NEW.raw_user_meta_data->>'user_name' IS NOT NULL THEN
        
        -- Insert or update the app_users table
        INSERT INTO public.app_users (
            auth_user_id,
            github_id,
            github_username,
            display_name,
            avatar_url,
            email,
            last_login
        )
        VALUES (
            NEW.id,
            (NEW.raw_user_meta_data->>'provider_id')::BIGINT,
            NEW.raw_user_meta_data->>'user_name',
            COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
            NEW.raw_user_meta_data->>'avatar_url',
            COALESCE(NEW.raw_user_meta_data->>'email', NEW.email),
            NOW()
        )
        ON CONFLICT (github_id) 
        DO UPDATE SET
            auth_user_id = EXCLUDED.auth_user_id,
            github_username = EXCLUDED.github_username,
            display_name = COALESCE(EXCLUDED.display_name, app_users.display_name),
            avatar_url = COALESCE(EXCLUDED.avatar_url, app_users.avatar_url),
            email = COALESCE(EXCLUDED.email, app_users.email),
            updated_at = NOW(),
            last_login = NOW();
            
        -- Also ensure the user exists in the contributors table
        INSERT INTO public.contributors (
            github_id,
            username,
            display_name,
            avatar_url,
            email,
            profile_url
        )
        VALUES (
            (NEW.raw_user_meta_data->>'provider_id')::BIGINT,
            NEW.raw_user_meta_data->>'user_name',
            COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
            NEW.raw_user_meta_data->>'avatar_url',
            COALESCE(NEW.raw_user_meta_data->>'email', NEW.email),
            COALESCE(NEW.raw_user_meta_data->>'html_url', 
                     'https://github.com/' || (NEW.raw_user_meta_data->>'user_name'))
        )
        ON CONFLICT (github_id) 
        DO UPDATE SET
            username = EXCLUDED.username,
            display_name = COALESCE(EXCLUDED.display_name, contributors.display_name),
            avatar_url = COALESCE(EXCLUDED.avatar_url, contributors.avatar_url),
            email = COALESCE(EXCLUDED.email, contributors.email),
            last_updated_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_new_auth_user();

-- Create or replace function to handle auth user updates (for login events)
CREATE OR REPLACE FUNCTION public.handle_auth_user_login()
RETURNS trigger AS $$
BEGIN
    -- Only process if last_sign_in_at has changed and user has GitHub metadata
    IF NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at AND
       NEW.raw_user_meta_data->>'provider_id' IS NOT NULL AND 
       NEW.raw_user_meta_data->>'user_name' IS NOT NULL THEN
        
        -- Update last login time
        UPDATE public.app_users 
        SET last_login = NOW(),
            updated_at = NOW()
        WHERE auth_user_id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for user login updates
DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users;
CREATE TRIGGER on_auth_user_login
    AFTER UPDATE ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_auth_user_login();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO postgres, authenticated, anon;
GRANT SELECT ON auth.users TO postgres, authenticated;

-- Add helpful comments
COMMENT ON FUNCTION public.handle_new_auth_user() IS 'Automatically creates app_users and contributors entries when a new user signs up via GitHub OAuth';
COMMENT ON FUNCTION public.handle_auth_user_login() IS 'Updates last login time when a user logs in';

-- From 20250712000002_fix_auth_trigger_with_error_handling.sql
-- Fix auth trigger with proper error handling and variable declaration
-- This matches the implementation from the post-mortem

-- Drop existing function and trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_auth_user();

-- Create improved function with error handling
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger AS $$
DECLARE
    github_user_id BIGINT;
    github_username TEXT;
    user_display_name TEXT;
    user_avatar_url TEXT;
    user_email TEXT;
BEGIN
    -- Extract GitHub metadata from the auth user
    github_user_id := COALESCE(
        (NEW.raw_user_meta_data->>'provider_id')::BIGINT,
        (NEW.raw_user_meta_data->>'sub')::BIGINT
    );
    
    github_username := NEW.raw_user_meta_data->>'user_name';
    user_display_name := NEW.raw_user_meta_data->>'full_name';
    user_avatar_url := NEW.raw_user_meta_data->>'avatar_url';
    user_email := COALESCE(NEW.email, NEW.raw_user_meta_data->>'email');

    -- Only proceed if we have GitHub data
    IF github_user_id IS NOT NULL AND github_username IS NOT NULL THEN
        -- Use the existing upsert_app_user function to create the record
        PERFORM upsert_app_user(
            NEW.id,                    -- auth_user_id
            github_user_id,            -- github_id
            github_username,           -- github_username
            user_display_name,         -- display_name
            user_avatar_url,          -- avatar_url
            user_email                -- email
        );
    END IF;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the auth user creation
        RAISE WARNING 'Failed to create app_users record for auth user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create app_users record
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_auth_user();

-- Also create a function to handle existing users who don't have app_users records
CREATE OR REPLACE FUNCTION public.create_missing_app_users_records()
RETURNS void AS $$
DECLARE
    auth_user RECORD;
    github_user_id BIGINT;
    github_username TEXT;
    user_display_name TEXT;
    user_avatar_url TEXT;
    user_email TEXT;
BEGIN
    -- Loop through all auth.users that don't have corresponding app_users records
    FOR auth_user IN 
        SELECT u.* 
        FROM auth.users u
        LEFT JOIN public.app_users au ON u.id = au.auth_user_id
        WHERE au.id IS NULL
        AND u.raw_user_meta_data->>'provider_id' IS NOT NULL
    LOOP
        -- Extract GitHub metadata
        github_user_id := COALESCE(
            (auth_user.raw_user_meta_data->>'provider_id')::BIGINT,
            (auth_user.raw_user_meta_data->>'sub')::BIGINT
        );
        
        github_username := auth_user.raw_user_meta_data->>'user_name';
        user_display_name := auth_user.raw_user_meta_data->>'full_name';
        user_avatar_url := auth_user.raw_user_meta_data->>'avatar_url';
        user_email := COALESCE(auth_user.email, auth_user.raw_user_meta_data->>'email');

        -- Create the missing app_users record
        IF github_user_id IS NOT NULL AND github_username IS NOT NULL THEN
            BEGIN
                PERFORM upsert_app_user(
                    auth_user.id,
                    github_user_id,
                    github_username,
                    user_display_name,
                    user_avatar_url,
                    user_email
                );
                RAISE NOTICE 'Created app_users record for %', github_username;
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE WARNING 'Failed to create app_users record for %: %', github_username, SQLERRM;
            END;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run the function to create any missing records
SELECT public.create_missing_app_users_records();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO postgres, authenticated, anon;
GRANT SELECT ON auth.users TO postgres, authenticated;

-- From 20250712000003_simplify_auth_fix.sql
-- Simplify auth fix - remove the problematic trigger and use a simpler approach

-- First, drop the existing triggers that are causing the error
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_auth_user();
DROP FUNCTION IF EXISTS public.handle_auth_user_login();

-- Create a simplified trigger that just ensures the user can log in
-- We'll handle the app_users creation in the frontend
CREATE OR REPLACE FUNCTION public.simple_auth_user_handler()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Just return NEW without any processing
    -- This prevents the "Database error saving new user" issue
    RETURN NEW;
END;
$$;

-- Only log warnings if we need to debug
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION public.simple_auth_user_handler();

-- From 20250712000004_remove_auth_trigger.sql
-- Remove all auth triggers to fix the "Database error saving new user" issue
-- The frontend fallback logic will handle creating app_users records

-- Drop all triggers on auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users;

-- Drop the trigger functions
DROP FUNCTION IF EXISTS public.handle_new_auth_user();
DROP FUNCTION IF EXISTS public.handle_auth_user_login();
DROP FUNCTION IF EXISTS public.simple_auth_user_handler();
DROP FUNCTION IF EXISTS public.create_missing_app_users_records();

-- From 20250712000005_fix_email_preferences_trigger.sql
-- Fix the email preferences trigger that's causing auth errors

-- Drop and recreate the trigger function with better error handling
CREATE OR REPLACE FUNCTION public.create_default_email_preferences()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Try to insert email preferences, but don't fail if it errors
    BEGIN
        INSERT INTO user_email_preferences (
            user_id,
            welcome_emails,
            marketing_emails,
            notification_emails,
            transactional_emails,
            consent_given_at,
            privacy_policy_version,
            terms_accepted_at,
            consent_method
        ) VALUES (
            NEW.id,
            true,  -- Welcome emails enabled by default
            false, -- Marketing requires explicit consent
            true,  -- Notifications enabled by default
            true,  -- Transactional always enabled
            NEW.created_at,
            '1.0',
            NEW.created_at,
            'signup'
        )
        ON CONFLICT (user_id) DO NOTHING; -- Don't fail if record already exists
    EXCEPTION
        WHEN OTHERS THEN
            -- Log the error but don't fail the auth process
            RAISE WARNING 'Failed to create email preferences for user %: %', NEW.id, SQLERRM;
    END;
    
    RETURN NEW;
END;
$$;

-- Make sure the trigger exists with the correct settings
DROP TRIGGER IF EXISTS create_user_email_preferences_trigger ON auth.users;
CREATE TRIGGER create_user_email_preferences_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.create_default_email_preferences();

-- From 20250712000006_disable_email_trigger.sql
-- Temporarily disable the email preferences trigger to fix auth issues
-- We'll handle email preferences in the app instead

DROP TRIGGER IF EXISTS create_user_email_preferences_trigger ON auth.users;

-- Keep the function but don't use it as a trigger
-- This way we can call it manually if needed

-- From 20250805_enable_rls_comment_commands.sql
-- Enable RLS on comment_commands table
ALTER TABLE comment_commands ENABLE ROW LEVEL SECURITY;

-- Allow public read access to comment_commands
CREATE POLICY "public_read_comment_commands"
ON comment_commands FOR SELECT
USING (true);

-- Only authenticated users or service role can insert
CREATE POLICY "service_insert_comment_commands"
ON comment_commands FOR INSERT
WITH CHECK (auth.role() = 'service_role' OR auth.uid() IS NOT NULL);

-- Only service role can update
CREATE POLICY "service_update_comment_commands"
ON comment_commands FOR UPDATE
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Only service role can delete
CREATE POLICY "service_delete_comment_commands"
ON comment_commands FOR DELETE
USING (auth.role() = 'service_role');

-- Enable RLS on other tables that might be missing it
-- These are conditional to avoid errors if RLS is already enabled

DO $$ 
BEGIN
    -- Enable RLS on tables that might not have it
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'repository_confidence_cache' AND schemaname = 'public') THEN
        ALTER TABLE repository_confidence_cache ENABLE ROW LEVEL SECURITY;
        CREATE POLICY IF NOT EXISTS "public_read_repository_confidence_cache" ON repository_confidence_cache FOR SELECT USING (true);
        CREATE POLICY IF NOT EXISTS "service_write_repository_confidence_cache" ON repository_confidence_cache FOR ALL USING (auth.role() = 'service_role');
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'file_contributors' AND schemaname = 'public') THEN
        ALTER TABLE file_contributors ENABLE ROW LEVEL SECURITY;
        CREATE POLICY IF NOT EXISTS "public_read_file_contributors" ON file_contributors FOR SELECT USING (true);
        CREATE POLICY IF NOT EXISTS "service_write_file_contributors" ON file_contributors FOR ALL USING (auth.role() = 'service_role');
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'file_embeddings' AND schemaname = 'public') THEN
        ALTER TABLE file_embeddings ENABLE ROW LEVEL SECURITY;
        CREATE POLICY IF NOT EXISTS "public_read_file_embeddings" ON file_embeddings FOR SELECT USING (true);
        CREATE POLICY IF NOT EXISTS "service_write_file_embeddings" ON file_embeddings FOR ALL USING (auth.role() = 'service_role');
    END IF;
    
    -- More restrictive tables (admin/app related)
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'app_users' AND schemaname = 'public') THEN
        ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
        CREATE POLICY IF NOT EXISTS "users_read_own_app_users" ON app_users FOR SELECT USING (auth.uid() = id OR auth.role() = 'service_role');
        CREATE POLICY IF NOT EXISTS "service_write_app_users" ON app_users FOR ALL USING (auth.role() = 'service_role');
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'user_roles' AND schemaname = 'public') THEN
        ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
        CREATE POLICY IF NOT EXISTS "service_only_user_roles" ON user_roles FOR ALL USING (auth.role() = 'service_role');
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'admin_action_logs' AND schemaname = 'public') THEN
        ALTER TABLE admin_action_logs ENABLE ROW LEVEL SECURITY;
        CREATE POLICY IF NOT EXISTS "service_only_admin_logs" ON admin_action_logs FOR ALL USING (auth.role() = 'service_role');
    END IF;
END $$;

-- From 20250806_remove_security_definer_from_views.sql
-- Remove SECURITY DEFINER from all views to comply with Supabase security best practices
-- This migration drops and recreates views without SECURITY DEFINER to ensure RLS policies are properly enforced

-- 1. Drop and recreate progressive_capture_stats view
DROP VIEW IF EXISTS progressive_capture_stats;
CREATE VIEW progressive_capture_stats AS
SELECT 
  processor_type,
  status,
  COUNT(*) as count,
  MIN(created_at) as oldest_job,
  MAX(created_at) as newest_job,
  AVG(EXTRACT(epoch FROM (completed_at - started_at)) / 60) as avg_duration_minutes
FROM progressive_capture_jobs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY processor_type, status;

-- 2. Drop and recreate repository_top_contributors view
DROP VIEW IF EXISTS repository_top_contributors;
CREATE VIEW repository_top_contributors AS
SELECT 
  fc.repository_id,
  fc.contributor_id,
  c.username,
  c.display_name,
  c.avatar_url,
  COUNT(DISTINCT fc.file_path) as files_contributed_to,
  SUM(fc.commit_count) as total_commits,
  SUM(fc.additions) as total_additions,
  SUM(fc.deletions) as total_deletions,
  MAX(fc.last_commit_at) as last_active
FROM file_contributors fc
JOIN contributors c ON fc.contributor_id = c.id
GROUP BY fc.repository_id, fc.contributor_id, c.username, c.display_name, c.avatar_url
ORDER BY fc.repository_id, SUM(fc.commit_count) DESC;

-- 3. Drop and recreate contributor_stats view
DROP VIEW IF EXISTS contributor_stats;
CREATE VIEW contributor_stats AS
SELECT 
    c.id,
    c.username,
    c.display_name,
    c.avatar_url,
    c.github_id,
    COUNT(DISTINCT pr.id) as total_pull_requests,
    COUNT(DISTINCT pr.id) FILTER (WHERE pr.state = 'closed' AND pr.merged = TRUE) as merged_pull_requests,
    COUNT(DISTINCT r.id) as total_reviews,
    COUNT(DISTINCT cm.id) as total_comments,
    COUNT(DISTINCT pr.repository_id) as repositories_contributed,
    SUM(pr.additions) as total_lines_added,
    SUM(pr.deletions) as total_lines_removed,
    MIN(pr.created_at) as first_contribution,
    MAX(pr.created_at) as last_contribution,
    c.first_seen_at,
    c.last_updated_at,
    c.is_active
FROM contributors c
LEFT JOIN pull_requests pr ON c.id = pr.author_id
LEFT JOIN reviews r ON c.id = r.reviewer_id
LEFT JOIN comments cm ON c.id = cm.commenter_id
WHERE c.is_active = TRUE AND c.is_bot = FALSE
GROUP BY c.id, c.username, c.display_name, c.avatar_url, c.github_id, c.first_seen_at, c.last_updated_at, c.is_active;

-- 4. Drop and recreate repository_stats view
DROP VIEW IF EXISTS repository_stats;
CREATE VIEW repository_stats AS
SELECT 
    r.id,
    r.full_name,
    r.owner,
    r.name,
    r.description,
    r.language,
    r.stargazers_count,
    r.forks_count,
    COUNT(DISTINCT pr.id) as total_pull_requests,
    COUNT(DISTINCT pr.id) FILTER (WHERE pr.state = 'closed' AND pr.merged = TRUE) as merged_pull_requests,
    COUNT(DISTINCT pr.author_id) as unique_contributors,
    COUNT(DISTINCT rv.id) as total_reviews,
    COUNT(DISTINCT cm.id) as total_comments,
    SUM(pr.additions) as total_lines_added,
    SUM(pr.deletions) as total_lines_removed,
    MIN(pr.created_at) as first_contribution,
    MAX(pr.created_at) as last_contribution,
    r.github_created_at,
    r.first_tracked_at,
    r.last_updated_at,
    r.is_active
FROM repositories r
LEFT JOIN pull_requests pr ON r.id = pr.repository_id
LEFT JOIN reviews rv ON pr.id = rv.pull_request_id
LEFT JOIN comments cm ON pr.id = cm.pull_request_id
WHERE r.is_active = TRUE
GROUP BY r.id, r.full_name, r.owner, r.name, r.description, r.language, 
         r.stargazers_count, r.forks_count, r.github_created_at, 
         r.first_tracked_at, r.last_updated_at, r.is_active;

-- 5. Drop and recreate recent_activity view
DROP VIEW IF EXISTS recent_activity;
CREATE VIEW recent_activity AS
SELECT 
    'pull_request' as activity_type,
    pr.id,
    pr.title as description,
    pr.html_url as url,
    pr.author_id as contributor_id,
    c.username,
    c.avatar_url,
    pr.repository_id,
    repo.full_name as repository_name,
    pr.created_at as activity_date,
    pr.state,
    pr.merged
FROM pull_requests pr
JOIN contributors c ON pr.author_id = c.id
JOIN repositories repo ON pr.repository_id = repo.id
WHERE pr.created_at >= NOW() - INTERVAL '30 days'
  AND c.is_active = TRUE 
  AND c.is_bot = FALSE
  AND repo.is_active = TRUE

UNION ALL

SELECT 
    'review' as activity_type,
    r.id,
    'Review: ' || COALESCE(r.state, 'PENDING') as description,
    pr.html_url as url,
    r.reviewer_id as contributor_id,
    c.username,
    c.avatar_url,
    pr.repository_id,
    repo.full_name as repository_name,
    r.submitted_at as activity_date,
    r.state,
    NULL as merged
FROM reviews r
JOIN contributors c ON r.reviewer_id = c.id
JOIN pull_requests pr ON r.pull_request_id = pr.id
JOIN repositories repo ON pr.repository_id = repo.id
WHERE r.submitted_at >= NOW() - INTERVAL '30 days'
  AND c.is_active = TRUE 
  AND c.is_bot = FALSE
  AND repo.is_active = TRUE

ORDER BY activity_date DESC;

-- 6. Drop and recreate share_analytics_summary view
DROP VIEW IF EXISTS share_analytics_summary;
CREATE VIEW share_analytics_summary AS
SELECT 
  se.id,
  se.chart_type,
  se.repository,
  se.action,
  se.share_type,
  se.domain,
  se.short_url,
  se.created_at,
  sca.total_clicks,
  sca.unique_clicks,
  CASE 
    WHEN se.short_url IS NOT NULL THEN TRUE
    ELSE FALSE
  END as is_shortened
FROM share_events se
LEFT JOIN share_click_analytics sca ON se.dub_link_id = sca.dub_link_id
ORDER BY se.created_at DESC;

-- 7. Drop and recreate upcoming_data_purge view
DROP VIEW IF EXISTS upcoming_data_purge;
CREATE VIEW upcoming_data_purge AS
SELECT 
  'file_contributors' as table_name,
  COUNT(*) as records_to_purge,
  MIN(purge_after) as earliest_purge_date
FROM file_contributors
WHERE purge_after <= NOW() + INTERVAL '7 days'

UNION ALL

SELECT 
  'file_embeddings' as table_name,
  COUNT(*) as records_to_purge,
  MIN(purge_after) as earliest_purge_date
FROM file_embeddings
WHERE purge_after <= NOW() + INTERVAL '7 days'

UNION ALL

SELECT 
  'pr_insights' as table_name,
  COUNT(*) as records_to_purge,
  MIN(generated_at + INTERVAL '30 days') as earliest_purge_date
FROM pr_insights
WHERE generated_at <= NOW() - INTERVAL '23 days';

-- 8. Drop and recreate admin_check view
DROP VIEW IF EXISTS admin_check;
CREATE VIEW admin_check AS
SELECT 
  auth_user_id,
  is_admin
FROM app_users
WHERE is_admin = TRUE;

-- 9. Drop and recreate backfill_progress_summary view
DROP VIEW IF EXISTS backfill_progress_summary;
CREATE VIEW backfill_progress_summary AS
SELECT 
  r.owner,
  r.name,
  pbs.id as backfill_id,
  pbs.status,
  pbs.total_prs,
  pbs.processed_prs,
  CASE 
    WHEN pbs.total_prs > 0 THEN ROUND((pbs.processed_prs::NUMERIC / pbs.total_prs::NUMERIC) * 100, 2)
    ELSE 0
  END as progress_percentage,
  pbs.chunk_size,
  pbs.error_count,
  pbs.last_processed_at,
  pbs.created_at,
  pbs.updated_at,
  COALESCE(
    (SELECT COUNT(*) FROM backfill_chunks WHERE backfill_state_id = pbs.id AND status = 'completed'),
    0
  ) as completed_chunks,
  COALESCE(
    (SELECT COUNT(*) FROM backfill_chunks WHERE backfill_state_id = pbs.id AND status = 'failed'),
    0
  ) as failed_chunks,
  COALESCE(
    (SELECT AVG(processing_time_ms)::INTEGER FROM backfill_chunks WHERE backfill_state_id = pbs.id AND status = 'completed'),
    0
  ) as avg_chunk_processing_time_ms
FROM progressive_backfill_state pbs
JOIN repositories r ON pbs.repository_id = r.id
ORDER BY pbs.created_at DESC;

-- -- Grant appropriate permissions to ensure views work correctly
GRANT SELECT ON progressive_capture_stats TO anon (conditional)
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    Grant appropriate permissions to ensure views work correctly
GRANT SELECT ON progressive_capture_stats TO anon;
  ELSE
    RAISE NOTICE 'Role anon not found, skipping grant';
  END IF;
END $;, authenticated, service_role;
-- GRANT SELECT ON repository_top_contributors TO anon (conditional)
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT ON repository_top_contributors TO anon;
  ELSE
    RAISE NOTICE 'Role anon not found, skipping grant';
  END IF;
END $;, authenticated, service_role;
-- GRANT SELECT ON contributor_stats TO anon (conditional)
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT ON contributor_stats TO anon;
  ELSE
    RAISE NOTICE 'Role anon not found, skipping grant';
  END IF;
END $;, authenticated, service_role;
-- GRANT SELECT ON repository_stats TO anon (conditional)
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT ON repository_stats TO anon;
  ELSE
    RAISE NOTICE 'Role anon not found, skipping grant';
  END IF;
END $;, authenticated, service_role;
-- GRANT SELECT ON recent_activity TO anon (conditional)
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT ON recent_activity TO anon;
  ELSE
    RAISE NOTICE 'Role anon not found, skipping grant';
  END IF;
END $;, authenticated, service_role;
-- GRANT SELECT ON share_analytics_summary TO anon (conditional)
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT ON share_analytics_summary TO anon;
  ELSE
    RAISE NOTICE 'Role anon not found, skipping grant';
  END IF;
END $;, authenticated, service_role;
-- GRANT SELECT ON upcoming_data_purge TO anon (conditional)
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT ON upcoming_data_purge TO anon;
  ELSE
    RAISE NOTICE 'Role anon not found, skipping grant';
  END IF;
END $;, authenticated, service_role;
-- GRANT SELECT ON admin_check TO anon (conditional)
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT ON admin_check TO anon;
  ELSE
    RAISE NOTICE 'Role anon not found, skipping grant';
  END IF;
END $;, authenticated, service_role;
-- GRANT SELECT ON backfill_progress_summary TO anon (conditional)
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT ON backfill_progress_summary TO anon;
  ELSE
    RAISE NOTICE 'Role anon not found, skipping grant';
  END IF;
END $;, authenticated, service_role;

-- Add comments to document the purpose of these views
COMMENT ON VIEW progressive_capture_stats IS 'Statistics for progressive capture jobs without SECURITY DEFINER';
COMMENT ON VIEW repository_top_contributors IS 'Top contributors by repository based on file contributions without SECURITY DEFINER';
COMMENT ON VIEW contributor_stats IS 'Aggregated contributor statistics without SECURITY DEFINER';
COMMENT ON VIEW repository_stats IS 'Aggregated repository statistics without SECURITY DEFINER';
COMMENT ON VIEW recent_activity IS 'Recent contributor activity (last 30 days) without SECURITY DEFINER';
COMMENT ON VIEW share_analytics_summary IS 'Summary of share events and click analytics without SECURITY DEFINER';
COMMENT ON VIEW upcoming_data_purge IS 'Data scheduled for purging in the next 7 days without SECURITY DEFINER';
COMMENT ON VIEW admin_check IS 'View to check admin users without SECURITY DEFINER';
COMMENT ON VIEW backfill_progress_summary IS 'Summary of progressive backfill progress without SECURITY DEFINER';

-- From 20250810_add_metric_history_tracking.sql
-- Create table for tracking repository metric changes over time
-- This enables content freshness signals and trending detection

CREATE TABLE IF NOT EXISTS repository_metrics_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('stars', 'forks', 'pull_requests', 'contributors', 'issues', 'watchers')),
  previous_value INTEGER,
  current_value INTEGER NOT NULL,
  change_amount INTEGER GENERATED ALWAYS AS (current_value - COALESCE(previous_value, 0)) STORED,
  change_percentage DECIMAL(10, 2) GENERATED ALWAYS AS (
    CASE 
      WHEN previous_value IS NULL OR previous_value = 0 THEN NULL
      ELSE ((current_value - previous_value)::DECIMAL / previous_value * 100)
    END
  ) STORED,
  is_significant BOOLEAN DEFAULT FALSE,
  captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Index for efficient queries
  CONSTRAINT unique_metric_capture UNIQUE (repository_id, metric_type, captured_at)
);

-- Create indexes for performance
CREATE INDEX idx_repository_metrics_history_repo ON repository_metrics_history(repository_id);
CREATE INDEX idx_repository_metrics_history_type ON repository_metrics_history(metric_type);
CREATE INDEX idx_repository_metrics_history_captured ON repository_metrics_history(captured_at DESC);
CREATE INDEX idx_repository_metrics_history_significant ON repository_metrics_history(is_significant) WHERE is_significant = TRUE;
CREATE INDEX idx_repository_metrics_history_trending ON repository_metrics_history(change_percentage DESC) WHERE change_percentage > 5;
-- Composite index for trending queries optimization
CREATE INDEX idx_metrics_trending_composite ON repository_metrics_history 
  (captured_at DESC, is_significant, change_percentage DESC) 
  WHERE captured_at > NOW() - INTERVAL '7 days';

-- Create table for repository changelog entries (auto-generated from significant changes)
CREATE TABLE IF NOT EXISTS repository_changelogs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  change_type TEXT NOT NULL CHECK (change_type IN ('milestone', 'trending', 'activity_spike', 'contributor_surge', 'release')),
  metadata JSONB DEFAULT '{}',
  importance_score INTEGER DEFAULT 0 CHECK (importance_score >= 0 AND importance_score <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure we don't duplicate entries (without timestamp for effective deduplication)
  CONSTRAINT unique_changelog_entry UNIQUE (repository_id, title)
);

-- Create indexes for changelog
CREATE INDEX idx_repository_changelogs_repo ON repository_changelogs(repository_id);
CREATE INDEX idx_repository_changelogs_created ON repository_changelogs(created_at DESC);
CREATE INDEX idx_repository_changelogs_type ON repository_changelogs(change_type);
CREATE INDEX idx_repository_changelogs_importance ON repository_changelogs(importance_score DESC);

-- Create a function to detect significant changes
CREATE OR REPLACE FUNCTION detect_significant_metric_change()
RETURNS TRIGGER AS $$
DECLARE
  v_threshold DECIMAL := 5.0; -- 5% change threshold for determining significant changes (adjustable based on metric volatility)
  v_changelog_title TEXT;
  v_changelog_description TEXT;
  v_change_type TEXT;
  v_importance INTEGER;
BEGIN
  -- Mark as significant if change is > threshold
  IF NEW.change_percentage IS NOT NULL AND ABS(NEW.change_percentage) > v_threshold THEN
    NEW.is_significant := TRUE;
    
    -- Generate changelog entry for significant changes
    CASE NEW.metric_type
      WHEN 'stars' THEN
        v_changelog_title := 
          CASE 
            WHEN NEW.change_percentage > 0 THEN 'Repository gained ' || NEW.change_amount || ' stars'
            ELSE 'Repository lost ' || ABS(NEW.change_amount) || ' stars'
          END;
        v_change_type := CASE WHEN NEW.change_percentage > 20 THEN 'trending' ELSE 'activity_spike' END;
        v_importance := LEAST(100, ABS(NEW.change_percentage)::INTEGER * 2);
        
      WHEN 'contributors' THEN
        v_changelog_title := NEW.change_amount || ' new contributors joined';
        v_change_type := 'contributor_surge';
        v_importance := LEAST(100, NEW.change_amount * 10);
        
      WHEN 'pull_requests' THEN
        v_changelog_title := 'PR activity ' || 
          CASE 
            WHEN NEW.change_percentage > 0 THEN 'increased by ' || ROUND(NEW.change_percentage) || '%'
            ELSE 'decreased by ' || ROUND(ABS(NEW.change_percentage)) || '%'
          END;
        v_change_type := 'activity_spike';
        v_importance := LEAST(100, ABS(NEW.change_percentage)::INTEGER);
        
      ELSE
        v_changelog_title := NEW.metric_type || ' changed by ' || ROUND(NEW.change_percentage) || '%';
        v_change_type := 'activity_spike';
        v_importance := LEAST(100, ABS(NEW.change_percentage)::INTEGER);
    END CASE;
    
    -- Use format() for safer string concatenation to prevent injection
    v_changelog_description := format('Metric changed from %s to %s (%s%% change)', 
                               COALESCE(NEW.previous_value::TEXT, 'unknown'),
                               NEW.current_value, 
                               CASE 
                                 WHEN NEW.change_percentage > 0 THEN '+' || ROUND(NEW.change_percentage)
                                 ELSE ROUND(NEW.change_percentage)::TEXT
                               END);
    
    -- Insert changelog entry (ignore conflicts)
    INSERT INTO repository_changelogs (
      repository_id,
      title,
      description,
      change_type,
      metadata,
      importance_score
    ) VALUES (
      NEW.repository_id,
      v_changelog_title,
      v_changelog_description,
      v_change_type,
      jsonb_build_object(
        'metric_type', NEW.metric_type,
        'previous_value', NEW.previous_value,
        'current_value', NEW.current_value,
        'change_percentage', NEW.change_percentage
      ),
      v_importance
    ) ON CONFLICT (repository_id, title) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic detection
CREATE TRIGGER detect_significant_changes
  BEFORE INSERT ON repository_metrics_history
  FOR EACH ROW
  EXECUTE FUNCTION detect_significant_metric_change();

-- Create a view for trending repositories (last 7 days)
CREATE OR REPLACE VIEW trending_repositories AS
SELECT 
  r.id,
  r.owner,
  r.name,
  r.description,
  r.stargazers_count as stars,
  r.language,
  COALESCE(metrics.total_change_score, 0) as trending_score,
  COALESCE(metrics.star_change, 0) as star_change,
  COALESCE(metrics.pr_change, 0) as pr_change,
  COALESCE(metrics.contributor_change, 0) as contributor_change,
  GREATEST(r.last_updated_at, metrics.last_update) as last_activity
FROM repositories r
LEFT JOIN LATERAL (
  SELECT 
    repository_id,
    SUM(CASE 
      WHEN metric_type = 'stars' AND change_percentage > 0 THEN change_percentage * 2
      WHEN metric_type = 'pull_requests' AND change_percentage > 0 THEN change_percentage * 1.5
      WHEN metric_type = 'contributors' AND change_percentage > 0 THEN change_percentage * 3
      ELSE 0
    END) as total_change_score,
    MAX(CASE WHEN metric_type = 'stars' THEN change_percentage ELSE 0 END) as star_change,
    MAX(CASE WHEN metric_type = 'pull_requests' THEN change_percentage ELSE 0 END) as pr_change,
    MAX(CASE WHEN metric_type = 'contributors' THEN change_percentage ELSE 0 END) as contributor_change,
    MAX(captured_at) as last_update
  FROM repository_metrics_history
  WHERE 
    repository_id = r.id
    AND captured_at > NOW() - INTERVAL '7 days'
    AND is_significant = TRUE
  GROUP BY repository_id
) metrics ON true
WHERE metrics.total_change_score > 0
ORDER BY metrics.total_change_score DESC;

-- Create a function to get repository freshness
CREATE OR REPLACE FUNCTION get_repository_freshness(p_repository_id UUID)
RETURNS TABLE (
  freshness_status TEXT,
  last_data_update TIMESTAMP WITH TIME ZONE,
  hours_since_update NUMERIC,
  has_recent_activity BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN MAX(captured_at) > NOW() - INTERVAL '24 hours' THEN 'fresh'
      WHEN MAX(captured_at) > NOW() - INTERVAL '7 days' THEN 'stale'
      ELSE 'old'
    END as freshness_status,
    MAX(captured_at) as last_data_update,
    EXTRACT(EPOCH FROM (NOW() - MAX(captured_at))) / 3600 as hours_since_update,
    EXISTS(
      SELECT 1 
      FROM repository_metrics_history 
      WHERE repository_id = p_repository_id 
        AND captured_at > NOW() - INTERVAL '24 hours'
    ) as has_recent_activity
  FROM repository_metrics_history
  WHERE repository_id = p_repository_id;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE repository_metrics_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE repository_changelogs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (public read, authenticated write)
CREATE POLICY "Public can read metrics history" ON repository_metrics_history
  FOR SELECT USING (true);

CREATE POLICY "System can insert metrics history" ON repository_metrics_history
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can read changelogs" ON repository_changelogs
  FOR SELECT USING (true);

CREATE POLICY "System can insert changelogs" ON repository_changelogs
  FOR INSERT WITH CHECK (true);

-- Add comments for documentation
COMMENT ON TABLE repository_metrics_history IS 'Tracks changes in repository metrics over time for trend detection and freshness signals';
COMMENT ON TABLE repository_changelogs IS 'Auto-generated changelog entries for significant repository changes';
COMMENT ON VIEW trending_repositories IS 'Shows repositories with significant positive metric changes in the last 7 days';
COMMENT ON FUNCTION get_repository_freshness IS 'Returns the data freshness status for a repository';

-- Create a function for cleaning up old metric history (data older than 6 months)
CREATE OR REPLACE FUNCTION cleanup_old_metrics_history()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Delete metric history older than 6 months, keeping significant changes for 1 year
  DELETE FROM repository_metrics_history
  WHERE 
    (captured_at < NOW() - INTERVAL '6 months' AND is_significant = FALSE)
    OR (captured_at < NOW() - INTERVAL '1 year');
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  -- Also cleanup old changelog entries (keep for 1 year)
  DELETE FROM repository_changelogs
  WHERE created_at < NOW() - INTERVAL '1 year';
  
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_metrics_history IS 'Removes old metric history data to manage storage. Keeps significant changes for 1 year, others for 6 months.';

-- From 20250821000000_add_avatar_caching.sql
-- Add avatar caching fields to contributors table
-- This enables Supabase-based avatar caching with TTL for improved performance

-- Add new columns for avatar caching
ALTER TABLE contributors 
ADD COLUMN IF NOT EXISTS avatar_cached_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS avatar_cache_expires_at TIMESTAMPTZ;

-- Create index for efficient cache queries
CREATE INDEX IF NOT EXISTS idx_contributors_avatar_cache_expires 
ON contributors(avatar_cache_expires_at) 
WHERE avatar_cache_expires_at IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN contributors.avatar_cached_at IS 'Timestamp when avatar was last cached from GitHub';
COMMENT ON COLUMN contributors.avatar_cache_expires_at IS 'Timestamp when avatar cache expires (TTL-based invalidation)';

-- Function to check if avatar cache is valid
CREATE OR REPLACE FUNCTION is_avatar_cache_valid(
    cached_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN cached_at IS NOT NULL 
           AND expires_at IS NOT NULL 
           AND expires_at > NOW();
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get cached avatar URL if valid, null otherwise
CREATE OR REPLACE FUNCTION get_cached_avatar_url(
    contributor_github_id BIGINT
) RETURNS TEXT AS $$
DECLARE
    cached_url TEXT;
    cached_at TIMESTAMPTZ;
    expires_at TIMESTAMPTZ;
BEGIN
    SELECT avatar_url, avatar_cached_at, avatar_cache_expires_at
    INTO cached_url, cached_at, expires_at
    FROM contributors
    WHERE github_id = contributor_github_id;
    
    -- Return URL only if cache is valid
    IF is_avatar_cache_valid(cached_at, expires_at) THEN
        RETURN cached_url;
    ELSE
        RETURN NULL;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to update avatar cache with TTL
CREATE OR REPLACE FUNCTION update_avatar_cache(
    contributor_github_id BIGINT,
    new_avatar_url TEXT,
    cache_duration_days INTEGER DEFAULT 7
) RETURNS VOID AS $$
BEGIN
    UPDATE contributors
    SET 
        avatar_url = new_avatar_url,
        avatar_cached_at = NOW(),
        avatar_cache_expires_at = NOW() + (cache_duration_days || ' days')::interval,
        last_updated_at = NOW()
    WHERE github_id = contributor_github_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION is_avatar_cache_valid IS 'Checks if avatar cache is valid (not expired)';
COMMENT ON FUNCTION get_cached_avatar_url IS 'Returns cached avatar URL if valid, null if expired';
COMMENT ON FUNCTION update_avatar_cache IS 'Updates avatar cache with TTL expiration';

-- Add index for faster avatar cache lookups
CREATE INDEX IF NOT EXISTS idx_contributors_avatar_cache 
ON contributors(github_id, avatar_cache_expires_at) 
WHERE avatar_cached_at IS NOT NULL;

-- Add RLS policies for avatar cache columns (read-only for public)
ALTER TABLE contributors ENABLE ROW LEVEL SECURITY;

-- Allow public read access to avatar cache
CREATE POLICY "Avatar cache is viewable by everyone" 
ON contributors FOR SELECT 
USING (true);

-- Only service role can update avatar cache
CREATE POLICY "Avatar cache updates require service role" 
ON contributors FOR UPDATE 
USING (auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- From 20250821001000_add_sync_monitoring.sql
-- Migration for sync monitoring and progress tracking
-- Supports Supabase Edge Functions migration

-- Table for tracking sync progress (for resumable syncs)
CREATE TABLE IF NOT EXISTS sync_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE UNIQUE,
  last_cursor TEXT,
  last_sync_at TIMESTAMPTZ DEFAULT NOW(),
  prs_processed INTEGER DEFAULT 0,
  total_prs INTEGER,
  status TEXT CHECK (status IN ('partial', 'in_progress', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for batch processing progress
CREATE TABLE IF NOT EXISTS batch_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE UNIQUE,
  last_pr_number INTEGER,
  processed_count INTEGER DEFAULT 0,
  total_count INTEGER,
  status TEXT CHECK (status IN ('partial', 'in_progress', 'completed', 'failed')),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for sync metrics and monitoring
CREATE TABLE IF NOT EXISTS sync_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name TEXT NOT NULL,
  repository TEXT NOT NULL,
  execution_time DECIMAL(10, 2) NOT NULL, -- in seconds
  success BOOLEAN DEFAULT false,
  processed INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  timed_out BOOLEAN DEFAULT false,
  router TEXT CHECK (router IN ('supabase', 'netlify', 'inngest')),
  error_details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add sync status to repositories if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'repositories' 
    AND column_name = 'sync_status'
  ) THEN
    ALTER TABLE repositories 
    ADD COLUMN sync_status TEXT DEFAULT 'idle' 
    CHECK (sync_status IN ('idle', 'syncing', 'completed', 'failed', 'partial'));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'repositories' 
    AND column_name = 'last_synced_at'
  ) THEN
    ALTER TABLE repositories 
    ADD COLUMN last_synced_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'repositories' 
    AND column_name = 'total_pull_requests'
  ) THEN
    ALTER TABLE repositories 
    ADD COLUMN total_pull_requests INTEGER DEFAULT 0;
  END IF;
END $$;

-- Add last_synced_at to pull_requests if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pull_requests' 
    AND column_name = 'last_synced_at'
  ) THEN
    ALTER TABLE pull_requests 
    ADD COLUMN last_synced_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sync_progress_repository 
ON sync_progress(repository_id, status);

CREATE INDEX IF NOT EXISTS idx_batch_progress_repository 
ON batch_progress(repository_id, status);

CREATE INDEX IF NOT EXISTS idx_sync_metrics_repository 
ON sync_metrics(repository, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_metrics_timeouts 
ON sync_metrics(timed_out, created_at DESC) 
WHERE timed_out = true;

CREATE INDEX IF NOT EXISTS idx_repositories_sync_status 
ON repositories(sync_status) 
WHERE sync_status != 'idle';

-- Function to get sync statistics
CREATE OR REPLACE FUNCTION get_sync_statistics(
  repo_name TEXT DEFAULT NULL,
  days_back INTEGER DEFAULT 7
)
RETURNS TABLE (
  total_syncs BIGINT,
  successful_syncs BIGINT,
  failed_syncs BIGINT,
  timeouts BIGINT,
  avg_execution_time DECIMAL,
  max_execution_time DECIMAL,
  supabase_usage BIGINT,
  netlify_usage BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_syncs,
    COUNT(*) FILTER (WHERE success = true)::BIGINT as successful_syncs,
    COUNT(*) FILTER (WHERE success = false)::BIGINT as failed_syncs,
    COUNT(*) FILTER (WHERE timed_out = true)::BIGINT as timeouts,
    AVG(execution_time)::DECIMAL as avg_execution_time,
    MAX(execution_time)::DECIMAL as max_execution_time,
    COUNT(*) FILTER (WHERE router = 'supabase')::BIGINT as supabase_usage,
    COUNT(*) FILTER (WHERE router IN ('netlify', 'inngest'))::BIGINT as netlify_usage
  FROM sync_metrics
  WHERE 
    created_at >= NOW() - INTERVAL '1 day' * days_back
    AND (repo_name IS NULL OR repository = repo_name);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check if repository should use Supabase
CREATE OR REPLACE FUNCTION should_use_supabase(repo_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  recent_timeouts INTEGER;
  avg_time DECIMAL;
BEGIN
  -- Check for recent timeouts
  SELECT COUNT(*) INTO recent_timeouts
  FROM sync_metrics
  WHERE 
    repository = repo_name
    AND timed_out = true
    AND router IN ('netlify', 'inngest')
    AND created_at >= NOW() - INTERVAL '30 days';
  
  IF recent_timeouts > 0 THEN
    RETURN true;
  END IF;
  
  -- Check average execution time
  SELECT AVG(execution_time) INTO avg_time
  FROM sync_metrics
  WHERE 
    repository = repo_name
    AND created_at >= NOW() - INTERVAL '30 days';
  
  IF avg_time > 20 THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE;

-- RLS policies for monitoring tables
ALTER TABLE sync_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_metrics ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can read sync metrics (prevents data leakage)
CREATE POLICY "Authenticated users can read sync metrics" 
ON sync_metrics FOR SELECT 
USING (auth.role() IN ('authenticated', 'service_role'));

-- Only service role can write to monitoring tables
CREATE POLICY "Service role can manage sync progress" 
ON sync_progress FOR ALL 
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can manage batch progress" 
ON batch_progress FOR ALL 
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can insert sync metrics" 
ON sync_metrics FOR INSERT 
WITH CHECK (auth.role() = 'service_role');

-- Grant permissions (only authenticated, not anon)
-- GRANT SELECT ON sync_metrics TO authenticated (conditional)
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT ON sync_metrics TO authenticated;
  ELSE
    RAISE NOTICE 'Role authenticated not found, skipping grant';
  END IF;
END $;;
-- GRANT ALL ON sync_progress TO service_role (conditional)
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON sync_progress TO service_role;
  ELSE
    RAISE NOTICE 'Role service_role not found, skipping grant';
  END IF;
END $;;
-- GRANT ALL ON batch_progress TO service_role (conditional)
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON batch_progress TO service_role;
  ELSE
    RAISE NOTICE 'Role service_role not found, skipping grant';
  END IF;
END $;;
-- GRANT ALL ON sync_metrics TO service_role (conditional)
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON sync_metrics TO service_role;
  ELSE
    RAISE NOTICE 'Role service_role not found, skipping grant';
  END IF;
END $;;

-- From 20250823_workspace_rls_policies.sql
-- Row Level Security (RLS) Policies for Workspaces
-- These policies ensure users can only access workspaces they own or are members of

-- =====================================================
-- ENABLE RLS ON ALL WORKSPACE TABLES
-- =====================================================

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_metrics_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- WORKSPACES TABLE POLICIES
-- =====================================================

-- Public workspaces are viewable by everyone
CREATE POLICY "Public workspaces are viewable by everyone"
    ON workspaces FOR SELECT
    USING (visibility = 'public' AND is_active = TRUE);

-- Users can view private workspaces they own or are members of
CREATE POLICY "Users can view their private workspaces"
    ON workspaces FOR SELECT
    USING (
        is_active = TRUE AND
        visibility = 'private' AND (
            owner_id = auth.uid() OR
            EXISTS (
                SELECT 1 FROM workspace_members
                WHERE workspace_members.workspace_id = workspaces.id
                AND workspace_members.user_id = auth.uid()
                AND workspace_members.accepted_at IS NOT NULL
            )
        )
    );

-- Users can create workspaces (they become the owner)
CREATE POLICY "Users can create workspaces"
    ON workspaces FOR INSERT
    WITH CHECK (owner_id = auth.uid());

-- Owners can update their workspaces
CREATE POLICY "Owners can update their workspaces"
    ON workspaces FOR UPDATE
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid()); -- Prevent ownership transfer via UPDATE

-- Admins can also update workspaces (but cannot change ownership)
CREATE POLICY "Admins can update workspaces"
    ON workspaces FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM workspace_members
            WHERE workspace_members.workspace_id = workspaces.id
            AND workspace_members.user_id = auth.uid()
            AND workspace_members.role IN ('admin', 'owner')
            AND workspace_members.accepted_at IS NOT NULL
        )
    )
    WITH CHECK (
        -- Prevent admins from changing owner_id
        owner_id = (SELECT owner_id FROM workspaces WHERE id = workspaces.id)
        AND EXISTS (
            SELECT 1 FROM workspace_members
            WHERE workspace_members.workspace_id = workspaces.id
            AND workspace_members.user_id = auth.uid()
            AND workspace_members.role IN ('admin', 'owner')
            AND workspace_members.accepted_at IS NOT NULL
        )
    );

-- Only owners can delete (soft delete by setting is_active = FALSE)
CREATE POLICY "Owners can delete their workspaces"
    ON workspaces FOR DELETE
    USING (owner_id = auth.uid());

-- =====================================================
-- WORKSPACE_REPOSITORIES TABLE POLICIES
-- =====================================================

-- View repositories in public workspaces (requires login)
CREATE POLICY "Logged in users can view repositories in public workspaces"
    ON workspace_repositories FOR SELECT
    USING (
        auth.uid() IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = workspace_repositories.workspace_id
            AND workspaces.visibility = 'public'
            AND workspaces.is_active = TRUE
        )
    );

-- Members can view repositories in their workspaces
CREATE POLICY "Members can view repositories in their workspaces"
    ON workspace_repositories FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM workspace_members
            WHERE workspace_members.workspace_id = workspace_repositories.workspace_id
            AND workspace_members.user_id = auth.uid()
            AND workspace_members.accepted_at IS NOT NULL
        ) OR
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = workspace_repositories.workspace_id
            AND workspaces.owner_id = auth.uid()
        )
    );

-- Editors, admins, and owners can add repositories
CREATE POLICY "Editors can add repositories to workspaces"
    ON workspace_repositories FOR INSERT
    WITH CHECK (
        added_by = auth.uid() AND (
            EXISTS (
                SELECT 1 FROM workspace_members
                WHERE workspace_members.workspace_id = workspace_repositories.workspace_id
                AND workspace_members.user_id = auth.uid()
                AND workspace_members.role IN ('editor', 'admin', 'owner')
                AND workspace_members.accepted_at IS NOT NULL
            ) OR
            EXISTS (
                SELECT 1 FROM workspaces
                WHERE workspaces.id = workspace_repositories.workspace_id
                AND workspaces.owner_id = auth.uid()
            )
        )
    );

-- Editors, admins, and owners can update repository settings
CREATE POLICY "Editors can update repository settings"
    ON workspace_repositories FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM workspace_members
            WHERE workspace_members.workspace_id = workspace_repositories.workspace_id
            AND workspace_members.user_id = auth.uid()
            AND workspace_members.role IN ('editor', 'admin', 'owner')
            AND workspace_members.accepted_at IS NOT NULL
        ) OR
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = workspace_repositories.workspace_id
            AND workspaces.owner_id = auth.uid()
        )
    );

-- Editors, admins, and owners can remove repositories
CREATE POLICY "Editors can remove repositories from workspaces"
    ON workspace_repositories FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM workspace_members
            WHERE workspace_members.workspace_id = workspace_repositories.workspace_id
            AND workspace_members.user_id = auth.uid()
            AND workspace_members.role IN ('editor', 'admin', 'owner')
            AND workspace_members.accepted_at IS NOT NULL
        ) OR
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = workspace_repositories.workspace_id
            AND workspaces.owner_id = auth.uid()
        )
    );

-- =====================================================
-- WORKSPACE_MEMBERS TABLE POLICIES
-- =====================================================

-- Members of public workspaces are visible to everyone
CREATE POLICY "Public workspace members are visible"
    ON workspace_members FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = workspace_members.workspace_id
            AND workspaces.visibility = 'public'
            AND workspaces.is_active = TRUE
        )
    );

-- Members can view other members in their private workspaces
CREATE POLICY "Members can view their workspace members"
    ON workspace_members FOR SELECT
    USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM workspace_members wm
            WHERE wm.workspace_id = workspace_members.workspace_id
            AND wm.user_id = auth.uid()
            AND wm.accepted_at IS NOT NULL
        ) OR
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = workspace_members.workspace_id
            AND workspaces.owner_id = auth.uid()
        )
    );

-- Admins and owners can add members
CREATE POLICY "Admins can add members"
    ON workspace_members FOR INSERT
    WITH CHECK (
        invited_by = auth.uid() AND (
            EXISTS (
                SELECT 1 FROM workspace_members wm
                WHERE wm.workspace_id = workspace_members.workspace_id
                AND wm.user_id = auth.uid()
                AND wm.role IN ('admin', 'owner')
                AND wm.accepted_at IS NOT NULL
            ) OR
            EXISTS (
                SELECT 1 FROM workspaces w
                WHERE w.id = workspace_members.workspace_id
                AND w.owner_id = auth.uid()
            )
        )
    );

-- Members can update their own settings
CREATE POLICY "Members can update their own settings"
    ON workspace_members FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Admins can update member roles (but not owner roles)
CREATE POLICY "Admins can update member roles"
    ON workspace_members FOR UPDATE
    USING (
        -- Can only update if you're an admin/owner
        (EXISTS (
            SELECT 1 FROM workspace_members wm
            WHERE wm.workspace_id = workspace_members.workspace_id
            AND wm.user_id = auth.uid()
            AND wm.role IN ('admin', 'owner')
            AND wm.accepted_at IS NOT NULL
        ) OR
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = workspace_members.workspace_id
            AND workspaces.owner_id = auth.uid()
        ))
        -- AND the target member is not an owner (prevent demoting owners)
        AND workspace_members.role != 'owner'
    )
    WITH CHECK (
        -- Prevent assigning owner role unless you're the workspace owner
        (role != 'owner' OR EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = workspace_members.workspace_id
            AND workspaces.owner_id = auth.uid()
        ))
    );

-- Members can remove themselves
CREATE POLICY "Members can remove themselves"
    ON workspace_members FOR DELETE
    USING (user_id = auth.uid());

-- Admins and owners can remove members
CREATE POLICY "Admins can remove members"
    ON workspace_members FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM workspace_members wm
            WHERE wm.workspace_id = workspace_members.workspace_id
            AND wm.user_id = auth.uid()
            AND wm.role IN ('admin', 'owner')
            AND wm.accepted_at IS NOT NULL
        ) OR
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = workspace_members.workspace_id
            AND workspaces.owner_id = auth.uid()
        )
    );

-- =====================================================
-- WORKSPACE_METRICS_CACHE TABLE POLICIES
-- =====================================================

-- Anyone can view metrics for public workspaces
CREATE POLICY "Public workspace metrics are viewable"
    ON workspace_metrics_cache FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = workspace_metrics_cache.workspace_id
            AND workspaces.visibility = 'public'
            AND workspaces.is_active = TRUE
        )
    );

-- Members can view metrics for their workspaces
CREATE POLICY "Members can view workspace metrics"
    ON workspace_metrics_cache FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM workspace_members
            WHERE workspace_members.workspace_id = workspace_metrics_cache.workspace_id
            AND workspace_members.user_id = auth.uid()
            AND workspace_members.accepted_at IS NOT NULL
        ) OR
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = workspace_metrics_cache.workspace_id
            AND workspaces.owner_id = auth.uid()
        )
    );

-- System/service role can insert and update metrics (for background jobs)
-- Note: This would typically be done by a service role or function
CREATE POLICY "Service role can manage metrics cache"
    ON workspace_metrics_cache FOR ALL
    USING (auth.role() = 'service_role');

-- =====================================================
-- WORKSPACE_INVITATIONS TABLE POLICIES
-- =====================================================

-- Users can view invitations sent to their email
CREATE POLICY "Users can view their invitations"
    ON workspace_invitations FOR SELECT
    USING (
        invited_by = auth.uid() OR
        email = auth.jwt() ->> 'email'
    );

-- Admins and owners can create invitations
CREATE POLICY "Admins can create invitations"
    ON workspace_invitations FOR INSERT
    WITH CHECK (
        invited_by = auth.uid() AND (
            EXISTS (
                SELECT 1 FROM workspace_members
                WHERE workspace_members.workspace_id = workspace_invitations.workspace_id
                AND workspace_members.user_id = auth.uid()
                AND workspace_members.role IN ('admin', 'owner')
                AND workspace_members.accepted_at IS NOT NULL
            ) OR
            EXISTS (
                SELECT 1 FROM workspaces
                WHERE workspaces.id = workspace_invitations.workspace_id
                AND workspaces.owner_id = auth.uid()
            )
        )
    );

-- Users can update invitations sent to them (accept/reject)
CREATE POLICY "Users can respond to their invitations"
    ON workspace_invitations FOR UPDATE
    USING (email = auth.jwt() ->> 'email')
    WITH CHECK (email = auth.jwt() ->> 'email');

-- Admins can delete/cancel invitations
CREATE POLICY "Admins can cancel invitations"
    ON workspace_invitations FOR DELETE
    USING (
        invited_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM workspace_members
            WHERE workspace_members.workspace_id = workspace_invitations.workspace_id
            AND workspace_members.user_id = auth.uid()
            AND workspace_members.role IN ('admin', 'owner')
            AND workspace_members.accepted_at IS NOT NULL
        ) OR
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = workspace_invitations.workspace_id
            AND workspaces.owner_id = auth.uid()
        )
    );

-- =====================================================
-- HELPER FUNCTIONS FOR RLS
-- =====================================================

-- Function to check if a user is a workspace member
CREATE OR REPLACE FUNCTION is_workspace_member(workspace_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM workspace_members
        WHERE workspace_id = workspace_uuid
        AND user_id = user_uuid
        AND accepted_at IS NOT NULL
    ) OR EXISTS (
        SELECT 1 FROM workspaces
        WHERE id = workspace_uuid
        AND owner_id = user_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check user's role in a workspace
CREATE OR REPLACE FUNCTION get_workspace_role(workspace_uuid UUID, user_uuid UUID)
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    -- Check if user is owner
    IF EXISTS (SELECT 1 FROM workspaces WHERE id = workspace_uuid AND owner_id = user_uuid) THEN
        RETURN 'owner';
    END IF;
    
    -- Check member role
    SELECT role INTO user_role
    FROM workspace_members
    WHERE workspace_id = workspace_uuid
    AND user_id = user_uuid
    AND accepted_at IS NOT NULL;
    
    RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON POLICY "Public workspaces are viewable by everyone" ON workspaces 
    IS 'Allows anyone to view public workspaces for discovery and sharing';

COMMENT ON POLICY "Users can view their private workspaces" ON workspaces 
    IS 'Restricts private workspace access to owners and accepted members only';

COMMENT ON POLICY "Editors can add repositories to workspaces" ON workspace_repositories 
    IS 'Allows editors, admins, and owners to manage workspace repositories';

-- From 20250823_workspace_schema.sql
-- Workspace Feature Database Schema
-- This migration creates tables for the workspace feature, allowing users to create
-- and manage collections of repositories with team collaboration capabilities

-- =====================================================
-- WORKSPACE CORE TABLES
-- =====================================================

-- 1. Workspaces table - stores workspace configurations
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE, -- URL-friendly identifier
    description TEXT,
    owner_id UUID NOT NULL, -- References auth.users(id) from Supabase Auth
    visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
    
    -- Subscription and limits
    tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'private')),
    max_repositories INTEGER NOT NULL DEFAULT 4,
    current_repository_count INTEGER NOT NULL DEFAULT 0,
    data_retention_days INTEGER NOT NULL DEFAULT 30,
    
    -- Settings stored as JSONB for flexibility
    settings JSONB DEFAULT '{
        "theme": "default",
        "dashboard_layout": "grid",
        "default_time_range": "30d",
        "notifications": {
            "email": true,
            "in_app": true
        }
    }'::jsonb,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE, -- Soft delete support
    
    -- Constraints
    CONSTRAINT workspace_slug_format CHECK (slug ~ '^[a-z0-9-]+$'),
    CONSTRAINT workspace_name_length CHECK (char_length(name) BETWEEN 3 AND 100),
    CONSTRAINT workspace_slug_length CHECK (char_length(slug) BETWEEN 3 AND 50),
    CONSTRAINT workspace_repo_limit CHECK (current_repository_count <= max_repositories)
);

-- 2. Workspace repositories junction table - many-to-many relationship
CREATE TABLE workspace_repositories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    
    -- Track who added the repository and when
    added_by UUID NOT NULL, -- References auth.users(id)
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Optional metadata for this specific workspace-repo relationship
    notes TEXT,
    tags TEXT[], -- Custom tags for organization within workspace
    is_pinned BOOLEAN DEFAULT FALSE, -- Pin important repos to top
    
    -- Ensure unique repository per workspace
    CONSTRAINT unique_workspace_repository UNIQUE (workspace_id, repository_id)
);

-- 3. Workspace members table - team collaboration with roles
CREATE TABLE workspace_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- References auth.users(id)
    
    -- Role-based access control
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
    
    -- Invitation tracking
    invited_by UUID, -- References auth.users(id)
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ, -- NULL if invitation pending
    
    -- Member settings
    notifications_enabled BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ,
    
    -- Ensure unique membership
    CONSTRAINT unique_workspace_member UNIQUE (workspace_id, user_id)
);

-- 4. Workspace metrics cache table - for performance optimization
CREATE TABLE workspace_metrics_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Time range for these metrics
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    time_range TEXT NOT NULL, -- '7d', '30d', '90d', etc.
    
    -- Aggregated metrics stored as JSONB
    metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    /* Example metrics structure:
    {
        "total_prs": 150,
        "merged_prs": 120,
        "open_prs": 30,
        "total_issues": 75,
        "closed_issues": 60,
        "total_contributors": 25,
        "active_contributors": 15,
        "total_commits": 500,
        "total_stars": 1250,
        "total_forks": 85,
        "avg_pr_merge_time_hours": 48,
        "pr_velocity": 4.0,
        "issue_closure_rate": 0.8,
        "languages": {
            "TypeScript": 65,
            "JavaScript": 20,
            "CSS": 10,
            "Other": 5
        },
        "top_contributors": [
            {"username": "user1", "prs": 25, "avatar_url": "..."},
            {"username": "user2", "prs": 20, "avatar_url": "..."}
        ],
        "activity_timeline": [...]
    }
    */
    
    -- Cache management
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),
    is_stale BOOLEAN DEFAULT FALSE,
    
    -- Ensure unique cache entry per workspace and time range
    CONSTRAINT unique_workspace_metrics_period UNIQUE (workspace_id, time_range, period_end)
);

-- 5. Workspace invitations table - for pending invitations
CREATE TABLE workspace_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Invitation details
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
    invitation_token UUID NOT NULL DEFAULT uuid_generate_v4() UNIQUE,
    
    -- Tracking
    invited_by UUID NOT NULL, -- References auth.users(id)
    invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    accepted_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired'))
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Workspace indexes
CREATE INDEX idx_workspaces_owner ON workspaces(owner_id) WHERE is_active = TRUE;
CREATE INDEX idx_workspaces_slug ON workspaces(slug) WHERE is_active = TRUE;
CREATE INDEX idx_workspaces_visibility ON workspaces(visibility) WHERE is_active = TRUE;
CREATE INDEX idx_workspaces_updated ON workspaces(updated_at DESC) WHERE is_active = TRUE;

-- Workspace repositories indexes
CREATE INDEX idx_workspace_repos_workspace ON workspace_repositories(workspace_id);
CREATE INDEX idx_workspace_repos_repository ON workspace_repositories(repository_id);
CREATE INDEX idx_workspace_repos_pinned ON workspace_repositories(workspace_id, is_pinned) WHERE is_pinned = TRUE;

-- Workspace members indexes
CREATE INDEX idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX idx_workspace_members_role ON workspace_members(workspace_id, role);
CREATE INDEX idx_workspace_members_accepted ON workspace_members(workspace_id, accepted_at) WHERE accepted_at IS NOT NULL;

-- Metrics cache indexes
CREATE INDEX idx_metrics_cache_workspace ON workspace_metrics_cache(workspace_id);
CREATE INDEX idx_metrics_cache_lookup ON workspace_metrics_cache(workspace_id, time_range, period_end);
CREATE INDEX idx_metrics_cache_expires ON workspace_metrics_cache(expires_at) WHERE is_stale = FALSE;

-- Invitations indexes
CREATE INDEX idx_invitations_workspace ON workspace_invitations(workspace_id);
CREATE INDEX idx_invitations_email ON workspace_invitations(email) WHERE status = 'pending';
CREATE INDEX idx_invitations_token ON workspace_invitations(invitation_token) WHERE status = 'pending';
CREATE INDEX idx_invitations_expires ON workspace_invitations(expires_at) WHERE status = 'pending';
-- Ensure unique pending invitation per email and workspace (partial unique index)
CREATE UNIQUE INDEX unique_pending_invitation ON workspace_invitations(workspace_id, email) WHERE status = 'pending';

-- =====================================================
-- FUNCTIONS FOR WORKSPACE MANAGEMENT
-- =====================================================

-- Function to generate URL-friendly slug from workspace name
CREATE OR REPLACE FUNCTION generate_workspace_slug(workspace_name TEXT)
RETURNS TEXT AS $$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 0;
BEGIN
    -- Convert to lowercase and replace spaces/special chars with hyphens
    base_slug := lower(workspace_name);
    base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');
    base_slug := regexp_replace(base_slug, '^-+|-+$', '', 'g');
    
    -- Ensure slug is within length limits
    IF char_length(base_slug) > 47 THEN
        base_slug := substring(base_slug, 1, 47);
    END IF;
    
    final_slug := base_slug;
    
    -- Check for uniqueness and append number if needed
    WHILE EXISTS (SELECT 1 FROM workspaces WHERE slug = final_slug) LOOP
        counter := counter + 1;
        final_slug := base_slug || '-' || counter;
    END LOOP;
    
    RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Function to update workspace activity timestamp
CREATE OR REPLACE FUNCTION update_workspace_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE workspaces 
    SET last_activity_at = NOW()
    WHERE id = COALESCE(NEW.workspace_id, OLD.workspace_id);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers to maintain workspace activity
CREATE TRIGGER update_workspace_activity_on_repo_change
    AFTER INSERT OR UPDATE OR DELETE ON workspace_repositories
    FOR EACH ROW EXECUTE FUNCTION update_workspace_activity();

CREATE TRIGGER update_workspace_activity_on_member_change
    AFTER INSERT OR UPDATE OR DELETE ON workspace_members
    FOR EACH ROW EXECUTE FUNCTION update_workspace_activity();

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON workspaces
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workspace_members_updated_at BEFORE UPDATE ON workspace_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE workspaces IS 'Stores workspace configurations for organizing repositories and team collaboration';
COMMENT ON TABLE workspace_repositories IS 'Junction table linking workspaces to repositories they track';
COMMENT ON TABLE workspace_members IS 'Manages team members and their roles within workspaces';
COMMENT ON TABLE workspace_metrics_cache IS 'Caches aggregated metrics for workspace performance optimization';
COMMENT ON TABLE workspace_invitations IS 'Tracks pending invitations to join workspaces';

COMMENT ON COLUMN workspaces.slug IS 'URL-friendly unique identifier for the workspace';
COMMENT ON COLUMN workspaces.settings IS 'Flexible JSON storage for workspace preferences and configuration';
COMMENT ON COLUMN workspace_members.role IS 'Access level: owner (full control), admin (manage members), editor (add/remove repos), viewer (read-only)';
COMMENT ON COLUMN workspace_metrics_cache.metrics IS 'Pre-calculated metrics to avoid expensive real-time aggregations';

-- From 20250824_enhance_trending_capture.sql
-- Enhanced trending capture system for comprehensive trend detection
-- This migration adds additional functionality for trend capture and analysis

-- Create a function to capture repository metrics with better error handling
CREATE OR REPLACE FUNCTION capture_repository_metrics(
  p_repository_id UUID,
  p_metric_type TEXT,
  p_current_value INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  v_previous_value INTEGER;
  v_exists BOOLEAN;
BEGIN
  -- Validate input parameters
  IF p_repository_id IS NULL OR p_metric_type IS NULL OR p_current_value IS NULL THEN
    RAISE EXCEPTION 'All parameters are required for metrics capture';
  END IF;

  -- Check if repository exists
  SELECT EXISTS(SELECT 1 FROM repositories WHERE id = p_repository_id) INTO v_exists;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'Repository with id % does not exist', p_repository_id;
  END IF;

  -- Get the most recent value for this metric
  SELECT current_value INTO v_previous_value
  FROM repository_metrics_history 
  WHERE repository_id = p_repository_id 
    AND metric_type = p_metric_type 
  ORDER BY captured_at DESC 
  LIMIT 1;

  -- Only insert if value has changed or this is the first capture
  IF v_previous_value IS NULL OR v_previous_value != p_current_value THEN
    INSERT INTO repository_metrics_history (
      repository_id,
      metric_type,
      previous_value,
      current_value,
      captured_at
    ) VALUES (
      p_repository_id,
      p_metric_type,
      v_previous_value,
      p_current_value,
      NOW()
    );
    
    RETURN TRUE;
  END IF;
  
  RETURN FALSE; -- No change detected
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get trending repositories with improved scoring
CREATE OR REPLACE FUNCTION get_trending_repositories(
  p_time_period INTERVAL DEFAULT INTERVAL '7 days',
  p_limit INTEGER DEFAULT 50,
  p_language TEXT DEFAULT NULL,
  p_min_stars INTEGER DEFAULT 0
) RETURNS TABLE (
  repository_id UUID,
  owner TEXT,
  name TEXT,
  description TEXT,
  language TEXT,
  stars INTEGER,
  trending_score DECIMAL,
  star_change DECIMAL,
  pr_change DECIMAL,
  contributor_change DECIMAL,
  last_activity TIMESTAMP WITH TIME ZONE,
  avatar_url TEXT,
  html_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id as repository_id,
    r.owner,
    r.name,
    r.description,
    r.language,
    r.stargazers_count as stars,
    COALESCE(metrics.total_change_score, 0) as trending_score,
    COALESCE(metrics.star_change, 0) as star_change,
    COALESCE(metrics.pr_change, 0) as pr_change,
    COALESCE(metrics.contributor_change, 0) as contributor_change,
    GREATEST(r.last_updated_at, COALESCE(metrics.last_update, r.first_tracked_at)) as last_activity,
    '' as avatar_url,  -- Avatar URL not available in repositories table
    CONCAT('https://github.com/', r.owner, '/', r.name) as html_url
  FROM repositories r
  LEFT JOIN LATERAL (
    SELECT 
      repository_id,
      -- Enhanced scoring algorithm that weighs different metrics appropriately
      SUM(CASE 
        WHEN metric_type = 'stars' THEN
          CASE
            -- If gained 100+ stars in the last day, give massive boost
            WHEN p_time_period <= INTERVAL '24 hours' AND change_amount >= 100 THEN
              1000.0 + (change_amount * 2.0)
            -- If gained 100+ stars recently (scaled by time period)
            WHEN change_amount >= 100 THEN
              500.0 + (change_amount * 1.5) + (change_percentage * 10.0)
            -- High percentage changes get boosted (for smaller repos growing fast)
            WHEN change_percentage >= 50 THEN
              200.0 + (change_percentage * 5.0)
            WHEN change_percentage >= 20 THEN
              100.0 + (change_percentage * 3.0)
            WHEN change_percentage > 0 THEN
              LEAST(change_percentage * 2.0, 100.0) * (1 + LOG(GREATEST(current_value, 1)) / 10.0)
            ELSE 0
          END
        WHEN metric_type = 'pull_requests' AND change_percentage > 0 THEN 
          LEAST(change_percentage * 1.5, 75.0) * 1.2
        WHEN metric_type = 'contributors' AND change_percentage > 0 THEN 
          LEAST(change_percentage * 3.0, 150.0) * 1.1
        WHEN metric_type = 'forks' AND change_percentage > 0 THEN 
          LEAST(change_percentage * 1.0, 50.0)
        WHEN metric_type = 'watchers' AND change_percentage > 0 THEN 
          LEAST(change_percentage * 0.8, 40.0)
        ELSE 0
      END) as total_change_score,
      MAX(CASE WHEN metric_type = 'stars' THEN change_percentage ELSE 0 END) as star_change,
      MAX(CASE WHEN metric_type = 'pull_requests' THEN change_percentage ELSE 0 END) as pr_change,
      MAX(CASE WHEN metric_type = 'contributors' THEN change_percentage ELSE 0 END) as contributor_change,
      MAX(captured_at) as last_update
    FROM repository_metrics_history
    WHERE 
      repository_id = r.id
      AND captured_at > NOW() - p_time_period
      AND is_significant = TRUE
    GROUP BY repository_id
  ) metrics ON true
  WHERE 
    r.stargazers_count >= p_min_stars
    AND (p_language IS NULL OR r.language = p_language)
    AND metrics.total_change_score > 0
    AND r.is_private = FALSE  -- Use is_private column instead of visibility
  ORDER BY metrics.total_change_score DESC, r.stargazers_count DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get trending statistics summary
CREATE OR REPLACE FUNCTION get_trending_statistics(
  p_time_period INTERVAL DEFAULT INTERVAL '7 days'
) RETURNS TABLE (
  total_trending_repos INTEGER,
  avg_trending_score DECIMAL,
  top_language TEXT,
  total_star_growth INTEGER,
  total_new_contributors INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT rmh.repository_id)::INTEGER as total_trending_repos,
    ROUND(AVG(rmh.change_percentage), 2) as avg_trending_score,
    (
      SELECT r.language 
      FROM repository_metrics_history rmh2
      JOIN repositories r ON r.id = rmh2.repository_id
      WHERE rmh2.captured_at > NOW() - p_time_period
        AND rmh2.is_significant = TRUE
        AND r.language IS NOT NULL
      GROUP BY r.language
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) as top_language,
    COALESCE(SUM(CASE WHEN rmh.metric_type = 'stars' THEN rmh.change_amount ELSE 0 END), 0)::INTEGER as total_star_growth,
    COALESCE(SUM(CASE WHEN rmh.metric_type = 'contributors' THEN rmh.change_amount ELSE 0 END), 0)::INTEGER as total_new_contributors
  FROM repository_metrics_history rmh
  WHERE 
    rmh.captured_at > NOW() - p_time_period
    AND rmh.is_significant = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a view for trending repositories with time-based filtering
CREATE OR REPLACE VIEW trending_repositories_24h AS
SELECT * FROM get_trending_repositories(INTERVAL '24 hours');

CREATE OR REPLACE VIEW trending_repositories_30d AS
SELECT * FROM get_trending_repositories(INTERVAL '30 days');

-- Create index for faster trending queries
CREATE INDEX IF NOT EXISTS idx_metrics_history_trending_composite_enhanced 
ON repository_metrics_history (repository_id, metric_type, captured_at DESC, is_significant) 
WHERE is_significant = TRUE;

-- Create a trigger to update repository last_activity when metrics change
CREATE OR REPLACE FUNCTION update_repository_last_activity() 
RETURNS TRIGGER AS $$
BEGIN
  -- Update the repository's last_updated_at when significant metrics change
  IF NEW.is_significant = TRUE THEN
    UPDATE repositories 
    SET last_updated_at = NEW.captured_at 
    WHERE id = NEW.repository_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_repository_activity ON repository_metrics_history;
CREATE TRIGGER trigger_update_repository_activity
  AFTER INSERT ON repository_metrics_history
  FOR EACH ROW
  WHEN (NEW.is_significant = TRUE)
  EXECUTE FUNCTION update_repository_last_activity();

-- Create a function to batch capture metrics (for bulk updates)
CREATE OR REPLACE FUNCTION batch_capture_metrics(
  metrics_data JSONB
) RETURNS INTEGER AS $$
DECLARE
  metric_record RECORD;
  inserted_count INTEGER := 0;
BEGIN
  -- Loop through each metric in the JSON array
  FOR metric_record IN 
    SELECT 
      (item->>'repository_id')::UUID as repository_id,
      item->>'metric_type' as metric_type,
      (item->>'current_value')::INTEGER as current_value
    FROM jsonb_array_elements(metrics_data) as item
  LOOP
    -- Use the existing capture function
    IF capture_repository_metrics(
      metric_record.repository_id,
      metric_record.metric_type,
      metric_record.current_value
    ) THEN
      inserted_count := inserted_count + 1;
    END IF;
  END LOOP;
  
  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add RLS policies for the new functions
CREATE POLICY "Public can read trending data" ON repository_metrics_history
  FOR SELECT USING (true);

-- -- Grant execute permissions for the functions to appropriate roles
GRANT EXECUTE ON FUNCTION capture_repository_metrics TO authenticated (conditional)
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    Grant execute permissions for the functions to appropriate roles
GRANT EXECUTE ON FUNCTION capture_repository_metrics TO authenticated;
  ELSE
    RAISE NOTICE 'Role authenticated not found, skipping grant';
  END IF;
END $;;
-- GRANT EXECUTE ON FUNCTION get_trending_repositories TO anon (conditional)
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT EXECUTE ON FUNCTION get_trending_repositories TO anon;
  ELSE
    RAISE NOTICE 'Role anon not found, skipping grant';
  END IF;
END $;, authenticated;
-- GRANT EXECUTE ON FUNCTION get_trending_statistics TO anon (conditional)
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT EXECUTE ON FUNCTION get_trending_statistics TO anon;
  ELSE
    RAISE NOTICE 'Role anon not found, skipping grant';
  END IF;
END $;, authenticated;
-- GRANT EXECUTE ON FUNCTION batch_capture_metrics TO authenticated (conditional)
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION batch_capture_metrics TO authenticated;
  ELSE
    RAISE NOTICE 'Role authenticated not found, skipping grant';
  END IF;
END $;;

-- Add comments for documentation
COMMENT ON FUNCTION capture_repository_metrics IS 'Captures repository metrics with validation and change detection';
COMMENT ON FUNCTION get_trending_repositories IS 'Returns trending repositories with enhanced scoring algorithm';
COMMENT ON FUNCTION get_trending_statistics IS 'Provides summary statistics for trending repositories';
COMMENT ON FUNCTION batch_capture_metrics IS 'Batch capture multiple repository metrics from JSON data';
COMMENT ON VIEW trending_repositories_24h IS 'Trending repositories in the last 24 hours';
COMMENT ON VIEW trending_repositories_30d IS 'Trending repositories in the last 30 days';

-- From 20250824_subscription_system.sql
-- Subscription System for Workspaces
-- This migration creates tables for managing workspace subscriptions, usage tracking, and billing

-- =====================================================
-- SUBSCRIPTION TABLES
-- =====================================================

-- 1. User subscriptions table
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Stripe integration
    stripe_customer_id TEXT UNIQUE,
    stripe_subscription_id TEXT UNIQUE,
    stripe_price_id TEXT,
    
    -- Subscription details
    tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'incomplete')),
    
    -- Billing cycle
    billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'yearly')),
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    canceled_at TIMESTAMPTZ,
    
    -- Trial information
    trial_start TIMESTAMPTZ,
    trial_end TIMESTAMPTZ,
    
    -- Limits based on tier
    max_workspaces INTEGER NOT NULL DEFAULT 1,
    max_repos_per_workspace INTEGER NOT NULL DEFAULT 4,
    data_retention_days INTEGER NOT NULL DEFAULT 30,
    allows_private_repos BOOLEAN DEFAULT FALSE,
    
    -- Additional features
    features JSONB DEFAULT '{
        "priority_queue": false,
        "advanced_analytics": false,
        "api_access": false,
        "export_data": false,
        "team_collaboration": false,
        "custom_branding": false
    }'::jsonb,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure one subscription per user
    CONSTRAINT unique_user_subscription UNIQUE (user_id)
);

-- 2. Usage tracking table
CREATE TABLE usage_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Usage metrics
    metric_type TEXT NOT NULL CHECK (metric_type IN (
        'workspace_count',
        'repository_count',
        'member_count',
        'api_calls',
        'data_queries',
        'export_count'
    )),
    value INTEGER NOT NULL DEFAULT 0,
    
    -- Time period
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    
    -- Metadata
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Unique constraint for metric per period
    CONSTRAINT unique_usage_metric UNIQUE (user_id, workspace_id, metric_type, period_start)
);

-- 3. Billing history table
CREATE TABLE billing_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    
    -- Invoice details
    stripe_invoice_id TEXT UNIQUE,
    stripe_payment_intent_id TEXT,
    
    -- Amount in cents
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'usd',
    
    -- Status
    status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
    
    -- Description
    description TEXT,
    invoice_url TEXT,
    receipt_url TEXT,
    
    -- Dates
    billing_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    
    -- Metadata
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Priority queue for data ingestion
CREATE TABLE priority_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    
    -- Priority level (lower number = higher priority)
    priority INTEGER NOT NULL DEFAULT 100 CHECK (priority BETWEEN 1 AND 1000),
    
    -- Queue status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    
    -- Processing details
    queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    
    -- Data capture window
    capture_window_hours INTEGER NOT NULL DEFAULT 24,
    last_captured_at TIMESTAMPTZ,
    
    -- Metadata
    metadata JSONB
);

-- 5. Email notification tracking (for Resend integration)
CREATE TABLE email_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Email details
    recipient_email TEXT NOT NULL,
    email_type TEXT NOT NULL CHECK (email_type IN (
        'workspace_invitation',
        'member_added',
        'member_removed',
        'role_changed',
        'subscription_confirmation',
        'payment_receipt',
        'payment_failed',
        'usage_limit_warning',
        'data_retention_warning',
        'workspace_summary'
    )),
    
    -- Resend integration
    resend_email_id TEXT UNIQUE,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'bounced', 'failed')),
    
    -- Content
    subject TEXT NOT NULL,
    template_data JSONB,
    
    -- Tracking
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    bounced_at TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- TIER CONFIGURATION (Reference Table)
-- =====================================================

CREATE TABLE tier_limits (
    tier TEXT PRIMARY KEY CHECK (tier IN ('free', 'pro', 'enterprise')),
    
    -- Limits
    max_workspaces INTEGER NOT NULL,
    max_repos_per_workspace INTEGER NOT NULL,
    max_members_per_workspace INTEGER,
    data_retention_days INTEGER NOT NULL,
    
    -- Features
    allows_private_repos BOOLEAN DEFAULT FALSE,
    priority_queue_enabled BOOLEAN DEFAULT FALSE,
    advanced_analytics BOOLEAN DEFAULT FALSE,
    api_access BOOLEAN DEFAULT FALSE,
    export_enabled BOOLEAN DEFAULT FALSE,
    custom_branding BOOLEAN DEFAULT FALSE,
    
    -- Pricing (in cents)
    monthly_price INTEGER,
    yearly_price INTEGER,
    
    -- Additional workspace pricing
    additional_workspace_yearly INTEGER,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert tier configurations (prices in cents)
INSERT INTO tier_limits (
    tier, max_workspaces, max_repos_per_workspace, max_members_per_workspace,
    data_retention_days, allows_private_repos, priority_queue_enabled,
    advanced_analytics, api_access, export_enabled, custom_branding,
    monthly_price, yearly_price, additional_workspace_yearly
) VALUES
    ('free', 1, 4, 3, 30, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, 0, 0, 0),
    ('pro', 5, 10, NULL, 90, FALSE, TRUE, TRUE, TRUE, TRUE, FALSE, 1200, 10000, 5000), -- $12/mo or $100/yr
    ('enterprise', 10, 10, NULL, 365, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, 50000, 400000, 25000); -- $500/mo or $4000/yr

-- =====================================================
-- FUNCTIONS FOR SUBSCRIPTION MANAGEMENT
-- =====================================================

-- Function to check if user can create more workspaces
CREATE OR REPLACE FUNCTION can_create_workspace(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_subscription subscriptions%ROWTYPE;
    current_workspace_count INTEGER;
BEGIN
    -- Get user's subscription
    SELECT * INTO user_subscription
    FROM subscriptions
    WHERE user_id = user_uuid AND status = 'active';
    
    -- If no subscription, use free tier defaults
    IF NOT FOUND THEN
        user_subscription.max_workspaces := 1;
    END IF;
    
    -- Count current workspaces
    SELECT COUNT(*) INTO current_workspace_count
    FROM workspaces
    WHERE owner_id = user_uuid AND is_active = TRUE;
    
    RETURN current_workspace_count < user_subscription.max_workspaces;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if workspace can add more repositories
CREATE OR REPLACE FUNCTION can_add_repository(workspace_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    workspace_record workspaces%ROWTYPE;
BEGIN
    -- Get workspace with limits
    SELECT * INTO workspace_record
    FROM workspaces
    WHERE id = workspace_uuid;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Use <= to allow reaching the limit, not just approaching it
    RETURN workspace_record.current_repository_count <= workspace_record.max_repositories;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update repository count when adding/removing repos
CREATE OR REPLACE FUNCTION update_repository_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE workspaces
        SET current_repository_count = current_repository_count + 1
        WHERE id = NEW.workspace_id;
        
        -- Check if limit exceeded
        IF NOT can_add_repository(NEW.workspace_id) THEN
            RAISE EXCEPTION 'Repository limit exceeded for this workspace';
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE workspaces
        SET current_repository_count = GREATEST(current_repository_count - 1, 0)
        WHERE id = OLD.workspace_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_workspace_repo_count
    AFTER INSERT OR DELETE ON workspace_repositories
    FOR EACH ROW EXECUTE FUNCTION update_repository_count();

-- Function to update user's workspace limits based on subscription
CREATE OR REPLACE FUNCTION sync_workspace_limits()
RETURNS TRIGGER AS $$
BEGIN
    -- Update all workspaces owned by the user with new tier limits
    UPDATE workspaces
    SET 
        max_repositories = NEW.max_repos_per_workspace,
        data_retention_days = NEW.data_retention_days,
        tier = NEW.tier
    WHERE owner_id = NEW.user_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_limits_on_subscription_change
    AFTER INSERT OR UPDATE OF tier ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION sync_workspace_limits();

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);

CREATE INDEX idx_usage_tracking_user ON usage_tracking(user_id);
CREATE INDEX idx_usage_tracking_workspace ON usage_tracking(workspace_id);
CREATE INDEX idx_usage_tracking_period ON usage_tracking(period_start, period_end);

CREATE INDEX idx_billing_history_user ON billing_history(user_id);
CREATE INDEX idx_billing_history_status ON billing_history(status);
CREATE INDEX idx_billing_history_date ON billing_history(billing_date DESC);

CREATE INDEX idx_priority_queue_workspace ON priority_queue(workspace_id);
CREATE INDEX idx_priority_queue_status ON priority_queue(status, priority);
CREATE INDEX idx_priority_queue_pending ON priority_queue(priority) WHERE status = 'pending';
-- Ensure unique pending item per repository
CREATE UNIQUE INDEX unique_pending_queue_item ON priority_queue(repository_id) WHERE status = 'pending';

-- Email notification indexes
CREATE INDEX idx_email_user ON email_notifications(user_id);
CREATE INDEX idx_email_workspace ON email_notifications(workspace_id);
CREATE INDEX idx_email_type ON email_notifications(email_type);
CREATE INDEX idx_email_status ON email_notifications(status);

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE priority_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE tier_limits ENABLE ROW LEVEL SECURITY;

-- Subscriptions policies
CREATE POLICY "Users can view own subscription"
    ON subscriptions FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Service role can manage subscriptions"
    ON subscriptions FOR ALL
    USING (auth.role() = 'service_role');

-- Usage tracking policies
CREATE POLICY "Users can view own usage"
    ON usage_tracking FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Service role can manage usage tracking"
    ON usage_tracking FOR ALL
    USING (auth.role() = 'service_role');

-- Billing history policies
CREATE POLICY "Users can view own billing history"
    ON billing_history FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Service role can manage billing history"
    ON billing_history FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Priority queue policies (service role only)
CREATE POLICY "Service role manages priority queue"
    ON priority_queue FOR ALL
    USING (auth.role() = 'service_role');

-- Email notifications policies
CREATE POLICY "Users can view own email notifications"
    ON email_notifications FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Service role can manage email notifications"
    ON email_notifications FOR ALL
    USING (auth.role() = 'service_role');

-- Tier limits are public read
CREATE POLICY "Anyone can view tier limits"
    ON tier_limits FOR SELECT
    USING (TRUE);

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE subscriptions IS 'User subscription details and tier information';
COMMENT ON TABLE usage_tracking IS 'Tracks usage metrics for billing and limits enforcement';
COMMENT ON TABLE billing_history IS 'Historical record of all billing transactions';
COMMENT ON TABLE priority_queue IS 'Queue for prioritized data ingestion based on tier';
COMMENT ON TABLE email_notifications IS 'Tracking for all transactional emails sent via Resend';
COMMENT ON TABLE tier_limits IS 'Configuration table for subscription tier limits and features';

-- From 20250826_fix_workspace_owner_member.sql
-- Fix for issue #538: Workspace owners cannot add repositories
-- This migration ensures workspace owners are automatically added as members
-- and fixes the RLS policy for workspace_repositories

-- ROLLBACK COMMANDS (if needed):
-- DROP TRIGGER IF EXISTS add_workspace_owner_as_member ON workspaces;
-- DROP FUNCTION IF EXISTS add_owner_as_workspace_member() CASCADE;
-- DROP FUNCTION IF EXISTS has_workspace_edit_permission(UUID) CASCADE;
-- DELETE FROM workspace_members WHERE role = 'owner' AND user_id IN (SELECT owner_id FROM workspaces WHERE id = workspace_members.workspace_id);
-- Recreate original policies if they exist

-- Ensure proper index exists for ON CONFLICT clause performance
-- This index should already exist from the initial schema, but verify:
-- CREATE UNIQUE INDEX IF NOT EXISTS workspace_members_workspace_user_idx ON workspace_members(workspace_id, user_id);

-- Create a function to automatically add owner as a member when workspace is created
CREATE OR REPLACE FUNCTION add_owner_as_workspace_member()
RETURNS TRIGGER AS $$
BEGIN
    -- Use exception handling to prevent workspace creation failure
    BEGIN
        -- Insert the owner as a member with 'owner' role
        INSERT INTO workspace_members (
            workspace_id,
            user_id,
            role,
            invited_by,
            invited_at,
            accepted_at,
            notifications_enabled
        ) VALUES (
            NEW.id,
            NEW.owner_id,
            'owner',
            NEW.owner_id,
            NOW(),
            NOW(),
            TRUE
        ) ON CONFLICT (workspace_id, user_id) DO NOTHING;
        
        -- Log when conflict occurs (member already exists)
        IF NOT FOUND THEN
            RAISE NOTICE 'Owner member already exists for workspace %', NEW.id;
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            -- Log error but don't fail workspace creation
            RAISE WARNING 'Failed to add owner as member for workspace %: %', NEW.id, SQLERRM;
            -- Still return NEW to allow workspace creation to succeed
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to add owner as member on workspace creation
DROP TRIGGER IF EXISTS add_workspace_owner_as_member ON workspaces;
CREATE TRIGGER add_workspace_owner_as_member
    AFTER INSERT ON workspaces
    FOR EACH ROW
    EXECUTE FUNCTION add_owner_as_workspace_member();

-- Add any existing workspace owners who are not already members
-- This fixes existing workspaces that were created before this migration
INSERT INTO workspace_members (
    workspace_id,
    user_id,
    role,
    invited_by,
    invited_at,
    accepted_at,
    notifications_enabled
)
SELECT 
    w.id,
    w.owner_id,
    'owner',
    w.owner_id,
    w.created_at,
    w.created_at,
    TRUE
FROM workspaces w
LEFT JOIN workspace_members wm ON w.id = wm.workspace_id AND w.owner_id = wm.user_id
WHERE wm.id IS NULL;

-- Update the RLS policies for workspace_repositories to simplify the checks
-- The policies now only check workspace_members table since owners are always members

-- Create a helper function to check workspace membership without recursion
-- Using has_workspace_edit_permission for clearer boolean intent
CREATE OR REPLACE FUNCTION has_workspace_edit_permission(workspace_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_uuid UUID;
BEGIN
    -- Get current user ID
    user_uuid := auth.uid();
    
    -- Check if user is a member with edit permissions
    RETURN EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = workspace_uuid
        AND wm.user_id = user_uuid
        AND wm.role IN ('editor', 'admin', 'owner')
        AND wm.accepted_at IS NOT NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix INSERT policy
DROP POLICY IF EXISTS "Editors can add repositories to workspaces" ON workspace_repositories;
CREATE POLICY "Editors can add repositories to workspaces"
    ON workspace_repositories FOR INSERT
    WITH CHECK (
        added_by = auth.uid() AND
        has_workspace_edit_permission(workspace_id)
    );

-- Fix UPDATE policy
DROP POLICY IF EXISTS "Editors can update repository settings" ON workspace_repositories;
CREATE POLICY "Editors can update repository settings"
    ON workspace_repositories FOR UPDATE
    USING (check_workspace_edit_permission(workspace_id));

-- Fix DELETE policy
DROP POLICY IF EXISTS "Editors can remove repositories from workspaces" ON workspace_repositories;
CREATE POLICY "Editors can remove repositories from workspaces"
    ON workspace_repositories FOR DELETE
    USING (check_workspace_edit_permission(workspace_id));


-- This migration requires auth schema
DO $$
BEGIN
  -- Check if auth schema exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    RAISE NOTICE 'Auth schema not found. Skipping auth-dependent migrations.';
    RETURN;
  END IF;
END $$;

-- Extension-Dependent Features
-- This migration requires specific PostgreSQL extensions
-- Extensions will be created if possible, features skipped if not

-- From 20240614000000_initial_contributor_schema.sql
-- Contributor Info Database Schema Migration
-- This migration creates the core database schema for storing GitHub contributor data
-- Run this using Supabase CLI: supabase db reset --db-url your_database_url

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable Row Level Security (will be configured separately)
-- CREATE EXTENSION IF NOT EXISTS "rls";

-- =====================================================
-- CORE TABLES
-- =====================================================

-- 1. Contributors table - stores GitHub user information
CREATE TABLE contributors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    github_id BIGINT UNIQUE NOT NULL, -- GitHub user ID
    username TEXT NOT NULL, -- GitHub username (@username)
    display_name TEXT, -- Display name (can be different from username)
    avatar_url TEXT,
    profile_url TEXT,
    email TEXT, -- if available from GitHub API
    company TEXT, -- if available from GitHub API
    location TEXT, -- if available from GitHub API
    bio TEXT, -- if available from GitHub API
    blog TEXT, -- personal website if available
    public_repos INTEGER DEFAULT 0,
    public_gists INTEGER DEFAULT 0,
    followers INTEGER DEFAULT 0,
    following INTEGER DEFAULT 0,
    github_created_at TIMESTAMPTZ, -- when user joined GitHub
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_bot BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Indexes for common queries
    CONSTRAINT contributors_username_key UNIQUE (username)
);

-- 2. Organizations table - stores GitHub organization information
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    github_id BIGINT UNIQUE NOT NULL,
    login TEXT NOT NULL UNIQUE, -- org username
    avatar_url TEXT,
    description TEXT,
    company TEXT,
    blog TEXT,
    location TEXT,
    email TEXT,
    public_repos INTEGER DEFAULT 0,
    public_gists INTEGER DEFAULT 0,
    followers INTEGER DEFAULT 0,
    following INTEGER DEFAULT 0,
    github_created_at TIMESTAMPTZ,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- 3. Repositories table - stores repository information
CREATE TABLE repositories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    github_id BIGINT UNIQUE NOT NULL,
    full_name TEXT NOT NULL UNIQUE, -- "owner/repo"
    owner TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    homepage TEXT,
    language TEXT,
    stargazers_count INTEGER DEFAULT 0,
    watchers_count INTEGER DEFAULT 0,
    forks_count INTEGER DEFAULT 0,
    open_issues_count INTEGER DEFAULT 0,
    size INTEGER DEFAULT 0, -- repo size in KB
    default_branch TEXT DEFAULT 'main',
    is_fork BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    is_disabled BOOLEAN DEFAULT FALSE,
    is_private BOOLEAN DEFAULT FALSE,
    has_issues BOOLEAN DEFAULT TRUE,
    has_projects BOOLEAN DEFAULT TRUE,
    has_wiki BOOLEAN DEFAULT TRUE,
    has_pages BOOLEAN DEFAULT FALSE,
    has_downloads BOOLEAN DEFAULT TRUE,
    license TEXT, -- license SPDX ID
    topics TEXT[], -- array of topic tags
    github_created_at TIMESTAMPTZ,
    github_updated_at TIMESTAMPTZ,
    github_pushed_at TIMESTAMPTZ,
    first_tracked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Composite index for owner/name lookups
    CONSTRAINT repositories_owner_name_key UNIQUE (owner, name)
);

-- 4. Pull Requests table - stores PR information
CREATE TABLE pull_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    github_id BIGINT UNIQUE NOT NULL,
    number INTEGER NOT NULL,
    title TEXT NOT NULL,
    body TEXT, -- PR description
    state TEXT NOT NULL CHECK (state IN ('open', 'closed')), 
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
    assignee_id UUID REFERENCES contributors(id),
    base_branch TEXT NOT NULL DEFAULT 'main',
    head_branch TEXT NOT NULL,
    draft BOOLEAN DEFAULT FALSE,
    mergeable BOOLEAN,
    mergeable_state TEXT,
    merged BOOLEAN DEFAULT FALSE,
    merged_by_id UUID REFERENCES contributors(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    merged_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    additions INTEGER DEFAULT 0,
    deletions INTEGER DEFAULT 0,
    changed_files INTEGER DEFAULT 0,
    commits INTEGER DEFAULT 0,
    html_url TEXT,
    diff_url TEXT,
    patch_url TEXT,
    
    -- Composite unique constraint for repo + PR number
    CONSTRAINT pull_requests_repo_number_key UNIQUE (repository_id, number)
);

-- 5. Reviews table - stores PR review information
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    github_id BIGINT UNIQUE NOT NULL,
    pull_request_id UUID NOT NULL REFERENCES pull_requests(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
    state TEXT NOT NULL CHECK (state IN ('PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'COMMENTED', 'DISMISSED')),
    body TEXT, -- review comment
    submitted_at TIMESTAMPTZ NOT NULL,
    commit_id TEXT -- specific commit reviewed
);

-- 6. Comments table - stores PR and issue comments
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    github_id BIGINT UNIQUE NOT NULL,
    pull_request_id UUID NOT NULL REFERENCES pull_requests(id) ON DELETE CASCADE,
    commenter_id UUID NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    comment_type TEXT NOT NULL CHECK (comment_type IN ('issue_comment', 'review_comment')),
    in_reply_to_id UUID REFERENCES comments(id), -- for threaded comments
    position INTEGER, -- line position for review comments
    original_position INTEGER,
    diff_hunk TEXT, -- code context for review comments
    path TEXT, -- file path for review comments
    commit_id TEXT -- specific commit for review comments
);

-- 7. Contributor Organizations junction table
CREATE TABLE contributor_organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contributor_id UUID NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role TEXT, -- 'member', 'admin', 'owner', etc.
    is_public BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT contributor_organizations_unique UNIQUE (contributor_id, organization_id)
);

-- 8. Repository tracking table - which repos we're actively monitoring
CREATE TABLE tracked_repositories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    added_by_user_id UUID, -- if we track user who added it
    tracking_enabled BOOLEAN DEFAULT TRUE,
    last_sync_at TIMESTAMPTZ,
    sync_frequency_hours INTEGER DEFAULT 24, -- how often to sync
    include_forks BOOLEAN DEFAULT FALSE,
    include_bots BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT tracked_repositories_repo_unique UNIQUE (repository_id)
);

-- =====================================================
-- ANALYTICS & RANKINGS TABLES
-- =====================================================

-- 9. Monthly Rankings table - for Contributor of the Month
CREATE TABLE monthly_rankings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    year INTEGER NOT NULL CHECK (year >= 2020),
    contributor_id UUID NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
    repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE, -- null for global rankings
    rank INTEGER NOT NULL,
    weighted_score NUMERIC(10,4) NOT NULL DEFAULT 0.0,
    pull_requests_count INTEGER NOT NULL DEFAULT 0,
    reviews_count INTEGER NOT NULL DEFAULT 0,
    comments_count INTEGER NOT NULL DEFAULT 0,
    repositories_contributed INTEGER NOT NULL DEFAULT 0,
    lines_added INTEGER NOT NULL DEFAULT 0,
    lines_removed INTEGER NOT NULL DEFAULT 0,
    first_contribution_at TIMESTAMPTZ,
    last_contribution_at TIMESTAMPTZ,
    is_winner BOOLEAN DEFAULT FALSE,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT monthly_rankings_unique UNIQUE (month, year, contributor_id, repository_id)
);

-- 10. Daily activity snapshots - for tracking trends
CREATE TABLE daily_activity_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    contributor_id UUID NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
    repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE, -- null for global stats
    pull_requests_opened INTEGER DEFAULT 0,
    pull_requests_merged INTEGER DEFAULT 0,
    pull_requests_closed INTEGER DEFAULT 0,
    reviews_submitted INTEGER DEFAULT 0,
    comments_made INTEGER DEFAULT 0,
    lines_added INTEGER DEFAULT 0,
    lines_removed INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT daily_activity_unique UNIQUE (date, contributor_id, repository_id)
);

-- 11. Sync logs - track data synchronization
CREATE TABLE sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sync_type TEXT NOT NULL CHECK (sync_type IN ('full_sync', 'incremental_sync', 'repository_sync', 'contributor_sync')),
    repository_id UUID REFERENCES repositories(id),
    status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed', 'cancelled')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    records_processed INTEGER DEFAULT 0,
    records_inserted INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    error_message TEXT,
    github_api_calls_used INTEGER DEFAULT 0,
    rate_limit_remaining INTEGER,
    metadata JSONB -- for storing additional sync information
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Contributors indexes
CREATE INDEX idx_contributors_username ON contributors(username);
CREATE INDEX idx_contributors_github_id ON contributors(github_id);
CREATE INDEX idx_contributors_last_updated ON contributors(last_updated_at);
CREATE INDEX idx_contributors_active ON contributors(is_active) WHERE is_active = TRUE;

-- Repositories indexes
CREATE INDEX idx_repositories_owner ON repositories(owner);
CREATE INDEX idx_repositories_full_name ON repositories(full_name);
CREATE INDEX idx_repositories_language ON repositories(language);
CREATE INDEX idx_repositories_stars ON repositories(stargazers_count DESC);
CREATE INDEX idx_repositories_active ON repositories(is_active) WHERE is_active = TRUE;

-- Pull requests indexes
CREATE INDEX idx_pull_requests_repository ON pull_requests(repository_id);
CREATE INDEX idx_pull_requests_author ON pull_requests(author_id);
CREATE INDEX idx_pull_requests_state ON pull_requests(state);
CREATE INDEX idx_pull_requests_created ON pull_requests(created_at DESC);
CREATE INDEX idx_pull_requests_merged ON pull_requests(merged_at DESC) WHERE merged_at IS NOT NULL;
CREATE INDEX idx_pull_requests_repo_state ON pull_requests(repository_id, state);
CREATE INDEX idx_pull_requests_author_state ON pull_requests(author_id, state);

-- Reviews indexes
CREATE INDEX idx_reviews_pull_request ON reviews(pull_request_id);
CREATE INDEX idx_reviews_reviewer ON reviews(reviewer_id);
CREATE INDEX idx_reviews_state ON reviews(state);
CREATE INDEX idx_reviews_submitted ON reviews(submitted_at DESC);

-- Comments indexes
CREATE INDEX idx_comments_pull_request ON comments(pull_request_id);
CREATE INDEX idx_comments_commenter ON comments(commenter_id);
CREATE INDEX idx_comments_created ON comments(created_at DESC);
CREATE INDEX idx_comments_type ON comments(comment_type);

-- Monthly rankings indexes
CREATE INDEX idx_monthly_rankings_month_year ON monthly_rankings(year DESC, month DESC);
CREATE INDEX idx_monthly_rankings_contributor ON monthly_rankings(contributor_id);
CREATE INDEX idx_monthly_rankings_repository ON monthly_rankings(repository_id);
CREATE INDEX idx_monthly_rankings_score ON monthly_rankings(weighted_score DESC);
CREATE INDEX idx_monthly_rankings_winners ON monthly_rankings(year DESC, month DESC, is_winner) WHERE is_winner = TRUE;

-- Daily activity indexes
CREATE INDEX idx_daily_activity_date ON daily_activity_snapshots(date DESC);
CREATE INDEX idx_daily_activity_contributor ON daily_activity_snapshots(contributor_id);
CREATE INDEX idx_daily_activity_repository ON daily_activity_snapshots(repository_id);

-- Sync logs indexes
CREATE INDEX idx_sync_logs_started ON sync_logs(started_at DESC);
CREATE INDEX idx_sync_logs_type ON sync_logs(sync_type);
CREATE INDEX idx_sync_logs_status ON sync_logs(status);
CREATE INDEX idx_sync_logs_repository ON sync_logs(repository_id);

-- =====================================================
-- VIEWS FOR COMMON QUERIES
-- =====================================================

-- View for contributor statistics
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

-- View for repository statistics
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

-- View for recent activity (last 30 days)
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

-- =====================================================
-- FUNCTIONS FOR COMMON OPERATIONS
-- =====================================================

-- Function to calculate weighted contributor score
CREATE OR REPLACE FUNCTION calculate_weighted_score(
    pull_requests_count INTEGER,
    reviews_count INTEGER,
    comments_count INTEGER,
    repositories_count INTEGER,
    lines_added INTEGER DEFAULT 0,
    lines_removed INTEGER DEFAULT 0
) RETURNS NUMERIC AS $$
BEGIN
    -- Weighted scoring algorithm
    -- PRs: 10 points each
    -- Reviews: 3 points each  
    -- Comments: 1 point each
    -- Repositories: 5 points each
    -- Lines of code: 0.01 points per line (capped contribution)
    RETURN (
        (pull_requests_count * 10.0) +
        (reviews_count * 3.0) +
        (comments_count * 1.0) +
        (repositories_count * 5.0) +
        (LEAST(lines_added + lines_removed, 10000) * 0.01)
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get contributor rank for a specific month/year
CREATE OR REPLACE FUNCTION get_contributor_rank(
    contributor_uuid UUID,
    rank_month INTEGER,
    rank_year INTEGER,
    repository_uuid UUID DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    contributor_rank INTEGER;
BEGIN
    SELECT rank INTO contributor_rank
    FROM monthly_rankings
    WHERE contributor_id = contributor_uuid
      AND month = rank_month
      AND year = rank_year
      AND (repository_id = repository_uuid OR (repository_id IS NULL AND repository_uuid IS NULL));
    
    RETURN COALESCE(contributor_rank, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to update contributor statistics
CREATE OR REPLACE FUNCTION refresh_contributor_stats(contributor_uuid UUID DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
    -- If specific contributor provided, update only that one
    -- Otherwise, this could be extended to update all
    
    -- Update last_updated_at timestamp
    IF contributor_uuid IS NOT NULL THEN
        UPDATE contributors 
        SET last_updated_at = NOW()
        WHERE id = contributor_uuid;
    END IF;
    
    -- Additional stats refresh logic could go here
    -- For now, the views handle real-time calculations
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =====================================================

-- Trigger to update last_updated_at on contributors
CREATE OR REPLACE FUNCTION update_last_updated_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables that need last_updated_at updates
CREATE TRIGGER update_contributors_updated_at
    BEFORE UPDATE ON contributors
    FOR EACH ROW
    EXECUTE FUNCTION update_last_updated_column();

CREATE TRIGGER update_repositories_updated_at
    BEFORE UPDATE ON repositories
    FOR EACH ROW
    EXECUTE FUNCTION update_last_updated_column();

CREATE TRIGGER update_tracked_repositories_updated_at
    BEFORE UPDATE ON tracked_repositories
    FOR EACH ROW
    EXECUTE FUNCTION update_last_updated_column();

-- =====================================================
-- SAMPLE DATA (Optional - for testing)
-- =====================================================

-- Insert a sample repository (GitHub itself)
INSERT INTO repositories (
    github_id, full_name, owner, name, description,
    language, stargazers_count, forks_count,
    is_fork, github_created_at, github_updated_at
) VALUES (
    1, 'github/docs', 'github', 'docs', 
    'The open-source repo for docs.github.com',
    'JavaScript', 15000, 8000,
    FALSE, '2008-01-01T00:00:00Z', NOW()
) ON CONFLICT (github_id) DO NOTHING;

-- Insert sample contributor (Octocat)
INSERT INTO contributors (
    github_id, username, display_name, avatar_url, profile_url,
    email, company, location, bio, public_repos, followers, following
) VALUES (
    583231, 'octocat', 'The Octocat', 
    'https://avatars.githubusercontent.com/u/583231?v=4',
    'https://github.com/octocat',
    'octocat@github.com', '@github', 'San Francisco',
    'How people build software.', 8, 4000, 9
) ON CONFLICT (github_id) DO NOTHING;

-- Add repository to tracking
INSERT INTO tracked_repositories (repository_id, tracking_enabled)
SELECT id, TRUE FROM repositories WHERE full_name = 'github/docs'
ON CONFLICT (repository_id) DO NOTHING;

-- =====================================================
-- COMMENTS AND DOCUMENTATION
-- =====================================================

COMMENT ON TABLE contributors IS 'Stores GitHub user/contributor information';
COMMENT ON TABLE repositories IS 'Stores GitHub repository information that we track';
COMMENT ON TABLE pull_requests IS 'Stores pull request data from tracked repositories';
COMMENT ON TABLE reviews IS 'Stores pull request review data';
COMMENT ON TABLE comments IS 'Stores comments on pull requests and issues';
COMMENT ON TABLE monthly_rankings IS 'Pre-calculated monthly contributor rankings and statistics';
COMMENT ON TABLE daily_activity_snapshots IS 'Daily activity summaries for trend analysis';
COMMENT ON TABLE sync_logs IS 'Logs of data synchronization operations with GitHub API';

COMMENT ON FUNCTION calculate_weighted_score IS 'Calculates weighted contributor score based on various activity metrics';
COMMENT ON FUNCTION get_contributor_rank IS 'Gets the rank of a contributor for a specific month/year';
COMMENT ON FUNCTION refresh_contributor_stats IS 'Refreshes contributor statistics and timestamps';

-- Migration completed successfully
-- Next steps:
-- 1. Configure Row Level Security (RLS) policies based on your app's needs
-- 2. Set up GitHub API sync jobs/functions
-- 3. Create API endpoints for the frontend
-- 4. Add data validation and constraints as needed
-- 5. Set up monitoring and alerting for sync jobs

-- From 20250103000000_add_ai_summaries_support.sql
-- Migration: Add AI Summaries and pgvector Support
-- Add pgvector extension and AI summary fields to repositories table

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Add AI summary fields to repositories table
ALTER TABLE repositories ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE repositories ADD COLUMN IF NOT EXISTS embedding VECTOR(1536); -- OpenAI embeddings are 1536 dimensions
ALTER TABLE repositories ADD COLUMN IF NOT EXISTS summary_generated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE repositories ADD COLUMN IF NOT EXISTS recent_activity_hash TEXT;

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_repositories_embedding ON repositories USING ivfflat (embedding vector_cosine_ops);

-- Add comment for documentation
COMMENT ON COLUMN repositories.ai_summary IS 'AI-generated summary of repository activity and recent PRs';
COMMENT ON COLUMN repositories.embedding IS 'OpenAI embedding vector for semantic search (1536 dimensions)';
COMMENT ON COLUMN repositories.summary_generated_at IS 'Timestamp when AI summary was last generated';
COMMENT ON COLUMN repositories.recent_activity_hash IS 'Hash of recent activity to detect when summary needs regeneration';

-- From 20250120_setup_pg_cron.sql
-- Migration: Setup pg_cron for automated tasks
-- Description: Configures scheduled jobs for GitHub event synchronization and maintenance

-- Enable pg_cron extension (requires superuser privileges)
-- Note: This may need to be enabled via Supabase dashboard if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage on cron schema to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;

-- Create function to invoke Edge Function
CREATE OR REPLACE FUNCTION invoke_edge_function(function_name TEXT, payload JSONB DEFAULT '{}'::jsonb)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  service_role_key TEXT;
  project_url TEXT;
BEGIN
  -- Get the service role key from vault (you'll need to store this)
  -- In production, store these in Supabase Vault
  service_role_key := current_setting('app.service_role_key', true);
  project_url := current_setting('app.supabase_url', true);
  
  -- Use pg_net to call the Edge Function
  SELECT net.http_post(
    url := project_url || '/functions/v1/' || function_name,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || service_role_key,
      'Content-Type', 'application/json'
    ),
    body := payload
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule hourly GitHub sync
SELECT -- cron.schedule(
  'sync-github-events-hourly',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT invoke_edge_function('github-sync', '{"trigger": "scheduled"}'::jsonb);
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    cron.schedule(
  'sync-github-events-hourly',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT invoke_edge_function('github-sync', '{"trigger": "scheduled"}'::jsonb);
  ELSE
    RAISE NOTICE 'pg_cron extension not available, skipping cron job';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not create cron job: %', SQLERRM;
END $;
  $$
);

-- Schedule daily cleanup of old events (at 2 AM UTC)
SELECT -- cron.schedule(
  'cleanup-old-events-daily',
  '0 2 * * *', -- Daily at 2:00 AM
  $$
  DELETE FROM github_events_cache 
  WHERE created_at < NOW() - INTERVAL '90 days'
  AND processed = true;
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    cron.schedule(
  'cleanup-old-events-daily',
  '0 2 * * *', -- Daily at 2:00 AM
  $$
  DELETE FROM github_events_cache 
  WHERE created_at < NOW() - INTERVAL '90 days'
  AND processed = true;
  ELSE
    RAISE NOTICE 'pg_cron extension not available, skipping cron job';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not create cron job: %', SQLERRM;
END $;
  $$
);

-- Schedule monthly partition creation (on the 25th to prepare for next month)
SELECT -- cron.schedule(
  'create-monthly-partition',
  '0 0 25 * *', -- Monthly on the 25th at midnight
  $$
  SELECT create_monthly_partition();
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    cron.schedule(
  'create-monthly-partition',
  '0 0 25 * *', -- Monthly on the 25th at midnight
  $$
  SELECT create_monthly_partition();
  ELSE
    RAISE NOTICE 'pg_cron extension not available, skipping cron job';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not create cron job: %', SQLERRM;
END $;
  $$
);

-- Schedule daily role confidence decay (to handle inactive maintainers)
SELECT -- cron.schedule(
  'decay-role-confidence-daily',
  '0 3 * * *', -- Daily at 3:00 AM
  $$
  UPDATE contributor_roles
  SET confidence_score = GREATEST(0.5, confidence_score - 0.01),
      updated_at = NOW()
  WHERE last_verified < NOW() - INTERVAL '30 days'
  AND confidence_score > 0.5;
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    cron.schedule(
  'decay-role-confidence-daily',
  '0 3 * * *', -- Daily at 3:00 AM
  $$
  UPDATE contributor_roles
  SET confidence_score = GREATEST(0.5, confidence_score - 0.01),
      updated_at = NOW()
  WHERE last_verified < NOW() - INTERVAL '30 days'
  AND confidence_score > 0.5;
  ELSE
    RAISE NOTICE 'pg_cron extension not available, skipping cron job';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not create cron job: %', SQLERRM;
END $;
  $$
);

-- Schedule weekly statistics aggregation
SELECT -- cron.schedule(
  'aggregate-statistics-weekly',
  '0 0 * * 0', -- Weekly on Sunday at midnight
  $$
  INSERT INTO contributor_role_history (
    contributor_role_id,
    user_id,
    repository_owner,
    repository_name,
    previous_role,
    new_role,
    previous_confidence,
    new_confidence,
    change_reason
  )
  SELECT 
    id,
    user_id,
    repository_owner,
    repository_name,
    role,
    role,
    confidence_score,
    confidence_score,
    'Weekly snapshot'
  FROM contributor_roles
  WHERE updated_at > NOW() - INTERVAL '7 days';
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    cron.schedule(
  'aggregate-statistics-weekly',
  '0 0 * * 0', -- Weekly on Sunday at midnight
  $$
  INSERT INTO contributor_role_history (
    contributor_role_id,
    user_id,
    repository_owner,
    repository_name,
    previous_role,
    new_role,
    previous_confidence,
    new_confidence,
    change_reason
  )
  SELECT 
    id,
    user_id,
    repository_owner,
    repository_name,
    role,
    role,
    confidence_score,
    confidence_score,
    'Weekly snapshot'
  FROM contributor_roles
  WHERE updated_at > NOW() - INTERVAL '7 days';
  ELSE
    RAISE NOTICE 'pg_cron extension not available, skipping cron job';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not create cron job: %', SQLERRM;
END $;
  $$
);

-- Create function to check and create next month's partition
CREATE OR REPLACE FUNCTION ensure_future_partitions()
RETURNS void AS $$
DECLARE
  next_month DATE;
  partition_name TEXT;
BEGIN
  -- Get next month
  next_month := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month');
  partition_name := 'github_events_cache_' || TO_CHAR(next_month, 'YYYY_MM');
  
  -- Check if partition exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = partition_name
  ) THEN
    -- Create partition
    PERFORM create_monthly_partition();
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Schedule partition check daily (as backup to monthly creation)
SELECT -- cron.schedule(
  'ensure-partitions-daily',
  '0 1 * * *', -- Daily at 1:00 AM
  $$
  SELECT ensure_future_partitions();
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    cron.schedule(
  'ensure-partitions-daily',
  '0 1 * * *', -- Daily at 1:00 AM
  $$
  SELECT ensure_future_partitions();
  ELSE
    RAISE NOTICE 'pg_cron extension not available, skipping cron job';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not create cron job: %', SQLERRM;
END $;
  $$
);

-- Create view to monitor cron job status
CREATE OR REPLACE VIEW cron_job_status AS
SELECT 
  jobname,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active
FROM cron.job
ORDER BY jobname;

-- -- Grant select on the view
GRANT SELECT ON cron_job_status TO authenticated (conditional)
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    Grant select on the view
GRANT SELECT ON cron_job_status TO authenticated;
  ELSE
    RAISE NOTICE 'Role authenticated not found, skipping grant';
  END IF;
END $;;

-- Comment on scheduled jobs
COMMENT ON FUNCTION invoke_edge_function IS 'Helper function to invoke Supabase Edge Functions from cron jobs';
COMMENT ON VIEW cron_job_status IS 'Monitor status of all scheduled cron jobs';

-- From 20250122000000_add_issue_pr_embeddings.sql
-- Migration: Add embeddings support for issues and pull requests
-- This enables semantic search for the .issues command feature

-- Add embedding columns to issues table
ALTER TABLE issues 
ADD COLUMN IF NOT EXISTS embedding VECTOR(1536),
ADD COLUMN IF NOT EXISTS embedding_generated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS content_hash TEXT; -- To detect when content changes

-- Add embedding columns to pull_requests table
ALTER TABLE pull_requests 
ADD COLUMN IF NOT EXISTS embedding VECTOR(1536),
ADD COLUMN IF NOT EXISTS embedding_generated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- Create indexes for vector similarity search
CREATE INDEX IF NOT EXISTS idx_issues_embedding 
ON issues USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pull_requests_embedding 
ON pull_requests USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
WHERE embedding IS NOT NULL;

-- Create table to track .issues command usage
CREATE TABLE IF NOT EXISTS comment_commands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    command TEXT NOT NULL CHECK (command IN ('.issues', '.related', '.context')),
    pull_request_id UUID REFERENCES pull_requests(id) ON DELETE CASCADE,
    comment_id BIGINT NOT NULL,
    comment_author_id UUID REFERENCES contributors(id),
    response_posted BOOLEAN DEFAULT FALSE,
    response_comment_id BIGINT,
    results_count INTEGER,
    processing_time_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_comment_command UNIQUE (comment_id)
);

-- Create index for command lookups
CREATE INDEX IF NOT EXISTS idx_comment_commands_pr 
ON comment_commands(pull_request_id) 
WHERE response_posted = true;

-- Add comments for documentation
COMMENT ON COLUMN issues.embedding IS 'OpenAI embedding vector for semantic search (1536 dimensions)';
COMMENT ON COLUMN issues.embedding_generated_at IS 'Timestamp when embedding was last generated';
COMMENT ON COLUMN issues.content_hash IS 'Hash of title+body to detect content changes';

COMMENT ON COLUMN pull_requests.embedding IS 'OpenAI embedding vector for semantic search (1536 dimensions)';
COMMENT ON COLUMN pull_requests.embedding_generated_at IS 'Timestamp when embedding was last generated';
COMMENT ON COLUMN pull_requests.content_hash IS 'Hash of title+body to detect content changes';

COMMENT ON TABLE comment_commands IS 'Tracks usage of special commands like .issues in PR comments';

-- Create a view for recent issues/PRs that need embeddings
CREATE OR REPLACE VIEW items_needing_embeddings AS
SELECT 
    'issue' as item_type,
    id,
    repository_id,
    title,
    body,
    created_at,
    embedding_generated_at,
    content_hash
FROM issues
WHERE (embedding IS NULL OR embedding_generated_at < updated_at)
AND created_at > NOW() - INTERVAL '90 days'
UNION ALL
SELECT 
    'pull_request' as item_type,
    id,
    repository_id,
    title,
    body,
    created_at,
    embedding_generated_at,
    content_hash
FROM pull_requests
WHERE (embedding IS NULL OR embedding_generated_at < updated_at)
AND created_at > NOW() - INTERVAL '90 days'
ORDER BY created_at DESC
LIMIT 100;

-- From 20250122000001_add_vector_search_functions.sql
-- Migration: Add vector search functions for issue/PR similarity
-- These functions enable semantic search using pgvector

-- Function to find similar issues using vector similarity
CREATE OR REPLACE FUNCTION find_similar_issues(
  query_embedding vector(1536),
  match_count int,
  repo_id uuid
)
RETURNS TABLE (
  id uuid,
  number int,
  title text,
  state text,
  similarity float,
  created_at timestamptz,
  html_url text
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.number,
    i.title,
    i.state,
    1 - (i.embedding <=> query_embedding) as similarity,
    i.created_at,
    CONCAT('https://github.com/', r.full_name, '/issues/', i.number) as html_url
  FROM issues i
  JOIN repositories r ON i.repository_id = r.id
  WHERE 
    i.repository_id = repo_id
    AND i.embedding IS NOT NULL
  ORDER BY i.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to find similar pull requests using vector similarity
CREATE OR REPLACE FUNCTION find_similar_pull_requests(
  query_embedding vector(1536),
  match_count int,
  repo_id uuid,
  exclude_pr_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  number int,
  title text,
  state text,
  merged_at timestamptz,
  similarity float,
  created_at timestamptz,
  html_url text
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pr.id,
    pr.number,
    pr.title,
    pr.state,
    pr.merged_at,
    1 - (pr.embedding <=> query_embedding) as similarity,
    pr.created_at,
    CONCAT('https://github.com/', r.full_name, '/pull/', pr.number) as html_url
  FROM pull_requests pr
  JOIN repositories r ON pr.repository_id = r.id
  WHERE 
    pr.repository_id = repo_id
    AND pr.embedding IS NOT NULL
    AND (exclude_pr_id IS NULL OR pr.id != exclude_pr_id)
  ORDER BY pr.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- -- Grant execute permissions to authenticated (conditional)
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    Grant execute permissions to authenticated;
  ELSE
    RAISE NOTICE 'Role authenticated not found, skipping grant';
  END IF;
END $; users
GRANT EXECUTE ON FUNCTION find_similar_issues(vector, int, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION find_similar_pull_requests(vector, int, uuid, uuid) TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION find_similar_issues IS 'Find issues similar to a given embedding vector using cosine similarity';
COMMENT ON FUNCTION find_similar_pull_requests IS 'Find pull requests similar to a given embedding vector using cosine similarity';

-- From 20250616000002_enable_performance_monitoring.sql
-- Performance Monitoring Setup Migration
-- This migration enables comprehensive database performance monitoring
-- Run this using Supabase CLI or Dashboard SQL Editor

-- =====================================================
-- ENABLE PERFORMANCE MONITORING EXTENSIONS
-- =====================================================

-- Enable pg_stat_statements for query performance monitoring
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Enable pg_stat_statements tracking
-- Note: This may require superuser privileges, configure via Supabase dashboard if needed
-- ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
-- ALTER SYSTEM SET pg_stat_statements.track = all;
-- ALTER SYSTEM SET pg_stat_statements.max = 10000;

-- =====================================================
-- PERFORMANCE MONITORING VIEWS
-- =====================================================

-- View: Slow Query Detection
-- Identifies queries that take longer than 500ms on average
CREATE OR REPLACE VIEW slow_queries AS
SELECT 
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    stddev_exec_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent,
    query AS query_text
FROM pg_stat_statements 
WHERE mean_exec_time > 500  -- Queries taking longer than 500ms on average
ORDER BY mean_exec_time DESC;

-- View: Query Performance Summary
-- Provides overall query performance metrics
CREATE OR REPLACE VIEW query_performance_summary AS
SELECT 
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    min_exec_time,
    max_exec_time,
    stddev_exec_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS cache_hit_ratio,
    round((total_exec_time / sum(total_exec_time) OVER ()) * 100, 2) AS percent_total_time
FROM pg_stat_statements
ORDER BY total_exec_time DESC;

-- View: Index Usage Analysis
-- Shows which indexes are being used and their effectiveness
CREATE OR REPLACE VIEW index_usage_stats AS
SELECT
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan,
    CASE 
        WHEN idx_scan = 0 THEN 0
        ELSE round((idx_tup_fetch::numeric / idx_scan), 2)
    END AS avg_tuples_per_scan,
    CASE 
        WHEN idx_tup_read = 0 THEN 0
        ELSE round((idx_tup_fetch::numeric / idx_tup_read * 100), 2)
    END AS fetch_ratio_percent
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- View: Table Activity Statistics
-- Shows table-level activity for monitoring database load
CREATE OR REPLACE VIEW table_activity_stats AS
SELECT
    schemaname,
    tablename,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch,
    n_tup_ins,
    n_tup_upd,
    n_tup_del,
    n_tup_hot_upd,
    n_live_tup,
    n_dead_tup,
    vacuum_count,
    autovacuum_count,
    analyze_count,
    autoanalyze_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY (seq_tup_read + idx_tup_fetch) DESC;

-- View: Connection Activity
-- Monitors database connections and their states
CREATE OR REPLACE VIEW connection_stats AS
SELECT
    state,
    count(*) as connection_count,
    max(now() - state_change) as max_duration,
    avg(now() - state_change) as avg_duration
FROM pg_stat_activity
WHERE pid != pg_backend_pid()  -- Exclude current connection
GROUP BY state
ORDER BY connection_count DESC;

-- =====================================================
-- PERFORMANCE MONITORING FUNCTIONS
-- =====================================================

-- Function: Reset Query Statistics
-- Allows clearing pg_stat_statements for fresh monitoring periods
CREATE OR REPLACE FUNCTION reset_query_stats()
RETURNS VOID AS $$
BEGIN
    -- Only reset if user has appropriate permissions
    IF has_function_privilege('pg_stat_statements_reset()', 'EXECUTE') THEN
        PERFORM pg_stat_statements_reset();
        INSERT INTO sync_logs (sync_type, status, started_at, completed_at, metadata)
        VALUES ('full_sync', 'completed', NOW(), NOW(), jsonb_build_object('operation', 'reset_query_stats', 'details', 'Query statistics reset'));
    ELSE
        INSERT INTO sync_logs (sync_type, status, started_at, error_message, metadata)
        VALUES ('full_sync', 'failed', NOW(), 'Insufficient permissions', jsonb_build_object('operation', 'reset_query_stats'));
    END IF;
EXCEPTION WHEN OTHERS THEN
    INSERT INTO sync_logs (sync_type, status, started_at, error_message, metadata)
    VALUES ('full_sync', 'failed', NOW(), SQLERRM, jsonb_build_object('operation', 'reset_query_stats'));
END;
$$ LANGUAGE plpgsql;

-- Function: Get Database Size Stats
-- Provides database size information for capacity monitoring
CREATE OR REPLACE FUNCTION get_database_size_stats()
RETURNS TABLE (
    database_name TEXT,
    size_bytes BIGINT,
    size_pretty TEXT,
    table_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        current_database()::TEXT,
        pg_database_size(current_database())::BIGINT,
        pg_size_pretty(pg_database_size(current_database()))::TEXT,
        (SELECT count(*)::INTEGER FROM information_schema.tables WHERE table_schema = 'public');
END;
$$ LANGUAGE plpgsql;

-- Function: Get Connection Pool Status
-- Monitors connection pool health and capacity
CREATE OR REPLACE FUNCTION get_connection_pool_status()
RETURNS TABLE (
    total_connections INTEGER,
    active_connections INTEGER,
    idle_connections INTEGER,
    max_connections INTEGER,
    connection_utilization_percent NUMERIC
) AS $$
DECLARE
    max_conn INTEGER;
BEGIN
    -- Get max connections setting
    SELECT setting::INTEGER INTO max_conn FROM pg_settings WHERE name = 'max_connections';
    
    RETURN QUERY
    SELECT 
        (SELECT count(*)::INTEGER FROM pg_stat_activity WHERE pid != pg_backend_pid()),
        (SELECT count(*)::INTEGER FROM pg_stat_activity WHERE state = 'active' AND pid != pg_backend_pid()),
        (SELECT count(*)::INTEGER FROM pg_stat_activity WHERE state = 'idle' AND pid != pg_backend_pid()),
        max_conn,
        round((SELECT count(*) FROM pg_stat_activity WHERE pid != pg_backend_pid())::NUMERIC * 100.0 / max_conn, 2);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- MONITORING TABLES
-- =====================================================

-- Table: Performance Snapshots
-- Stores periodic performance snapshots for historical analysis
CREATE TABLE IF NOT EXISTS performance_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    snapshot_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_queries BIGINT,
    slow_queries_count INTEGER,
    avg_query_time NUMERIC,
    max_query_time NUMERIC,
    cache_hit_ratio NUMERIC,
    active_connections INTEGER,
    database_size_bytes BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for time-based queries on performance snapshots
CREATE INDEX IF NOT EXISTS idx_performance_snapshots_time ON performance_snapshots (snapshot_time);

-- Table: Query Performance Alerts
-- Logs performance alerts for tracking and analysis
CREATE TABLE IF NOT EXISTS query_performance_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_type TEXT NOT NULL, -- 'slow_query', 'high_connection_count', 'low_cache_hit_ratio'
    severity TEXT NOT NULL, -- 'warning', 'critical'
    query_text TEXT,
    metric_value NUMERIC,
    threshold_value NUMERIC,
    details JSONB,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for alert queries
CREATE INDEX IF NOT EXISTS idx_query_alerts_type_time ON query_performance_alerts (alert_type, created_at);
CREATE INDEX IF NOT EXISTS idx_query_alerts_unresolved ON query_performance_alerts (created_at) WHERE resolved_at IS NULL;

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on monitoring tables
ALTER TABLE performance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE query_performance_alerts ENABLE ROW LEVEL SECURITY;

-- Allow public read access to monitoring data (following existing pattern)
CREATE POLICY "Public read access for performance_snapshots" ON performance_snapshots FOR SELECT USING (true);
CREATE POLICY "Public read access for query_performance_alerts" ON query_performance_alerts FOR SELECT USING (true);

-- Allow service role to manage monitoring data
CREATE POLICY "Service role full access to performance_snapshots" ON performance_snapshots FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access to query_performance_alerts" ON query_performance_alerts FOR ALL USING (auth.role() = 'service_role');

-- =====================================================
-- INITIAL DATA AND COMMENTS
-- =====================================================

-- Add comments for documentation
COMMENT ON VIEW slow_queries IS 'Identifies database queries with mean execution time > 500ms';
COMMENT ON VIEW query_performance_summary IS 'Comprehensive query performance metrics with cache hit ratios';
COMMENT ON VIEW index_usage_stats IS 'Index usage statistics for optimization analysis';
COMMENT ON VIEW table_activity_stats IS 'Table-level activity statistics for monitoring database load';
COMMENT ON VIEW connection_stats IS 'Real-time connection state monitoring';

COMMENT ON TABLE performance_snapshots IS 'Historical performance snapshots for trend analysis';
COMMENT ON TABLE query_performance_alerts IS 'Performance alert logs for monitoring and analysis';

COMMENT ON FUNCTION reset_query_stats() IS 'Resets pg_stat_statements for fresh monitoring periods';
COMMENT ON FUNCTION get_database_size_stats() IS 'Returns database size information for capacity monitoring';
COMMENT ON FUNCTION get_connection_pool_status() IS 'Monitors connection pool health and utilization';

-- Log migration completion
INSERT INTO sync_logs (sync_type, status, started_at, completed_at, metadata)
VALUES (
    'full_sync', 
    'completed', 
    NOW(), 
    NOW(),
    jsonb_build_object(
        'operation', 'enable_performance_monitoring',
        'details', 'Performance monitoring migration completed'
    )
);

-- From 20250802000000_enhance_vector_similarity_search.sql
-- Migration: Enhanced vector similarity search functions
-- Adds similarity threshold filtering and performance improvements
-- for the issue similarity search feature

-- Enhanced function to find similar issues with similarity threshold
CREATE OR REPLACE FUNCTION find_similar_issues(
  query_embedding vector(384),
  match_count int DEFAULT 5,
  repo_id uuid DEFAULT NULL,
  similarity_threshold float DEFAULT 0.7,
  exclude_issue_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  github_id bigint,
  number int,
  title text,
  body_snippet text,
  state text,
  similarity float,
  created_at timestamptz,
  updated_at timestamptz,
  html_url text,
  author_login text
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.github_id,
    i.number,
    i.title,
    -- Return first 200 characters of body as snippet
    CASE 
      WHEN i.body IS NOT NULL AND LENGTH(i.body) > 200 
      THEN LEFT(i.body, 200) || '...'
      ELSE i.body
    END as body_snippet,
    i.state,
    (1 - (i.embedding <=> query_embedding))::float as similarity,
    i.created_at,
    i.updated_at,
    CONCAT('https://github.com/', r.full_name, '/issues/', i.number) as html_url,
    c.login as author_login
  FROM issues i
  JOIN repositories r ON i.repository_id = r.id
  LEFT JOIN contributors c ON i.author_id = c.id
  WHERE 
    i.embedding IS NOT NULL
    AND (repo_id IS NULL OR i.repository_id = repo_id)
    AND (exclude_issue_id IS NULL OR i.id != exclude_issue_id)
    AND (1 - (i.embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY i.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Enhanced function for cross-repository similarity search
-- Useful for finding similar issues across an organization's repositories
CREATE OR REPLACE FUNCTION find_similar_issues_cross_repo(
  query_embedding vector(384),
  organization_name text,
  match_count int DEFAULT 5,
  similarity_threshold float DEFAULT 0.7,
  exclude_issue_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  github_id bigint,
  number int,
  title text,
  body_snippet text,
  state text,
  similarity float,
  created_at timestamptz,
  updated_at timestamptz,
  html_url text,
  author_login text,
  repository_name text,
  repository_full_name text
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.github_id,
    i.number,
    i.title,
    -- Return first 200 characters of body as snippet
    CASE 
      WHEN i.body IS NOT NULL AND LENGTH(i.body) > 200 
      THEN LEFT(i.body, 200) || '...'
      ELSE i.body
    END as body_snippet,
    i.state,
    (1 - (i.embedding <=> query_embedding))::float as similarity,
    i.created_at,
    i.updated_at,
    CONCAT('https://github.com/', r.full_name, '/issues/', i.number) as html_url,
    c.login as author_login,
    r.name as repository_name,
    r.full_name as repository_full_name
  FROM issues i
  JOIN repositories r ON i.repository_id = r.id
  LEFT JOIN contributors c ON i.author_id = c.id
  WHERE 
    i.embedding IS NOT NULL
    AND r.full_name LIKE (organization_name || '/%')
    AND (exclude_issue_id IS NULL OR i.id != exclude_issue_id)
    AND (1 - (i.embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY i.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to find the most similar issue for a given text input
-- This is useful for duplicate detection
CREATE OR REPLACE FUNCTION find_most_similar_issue(
  query_embedding vector(384),
  repo_id uuid,
  exclude_issue_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  github_id bigint,
  number int,
  title text,
  similarity float,
  html_url text,
  is_duplicate_likely boolean
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.github_id,
    i.number,
    i.title,
    (1 - (i.embedding <=> query_embedding))::float as similarity,
    CONCAT('https://github.com/', r.full_name, '/issues/', i.number) as html_url,
    -- Consider similarity > 0.85 as likely duplicate
    (1 - (i.embedding <=> query_embedding)) > 0.85 as is_duplicate_likely
  FROM issues i
  JOIN repositories r ON i.repository_id = r.id
  WHERE 
    i.repository_id = repo_id
    AND i.embedding IS NOT NULL
    AND (exclude_issue_id IS NULL OR i.id != exclude_issue_id)
  ORDER BY i.embedding <=> query_embedding
  LIMIT 1;
END;
$$;

-- Function to get similarity statistics for a repository
-- Useful for understanding the embedding quality and coverage
CREATE OR REPLACE FUNCTION get_repository_embedding_stats(repo_id uuid)
RETURNS TABLE (
  total_issues bigint,
  issues_with_embeddings bigint,
  embedding_coverage_percent numeric,
  avg_embedding_age_days numeric,
  oldest_embedding_date timestamptz,
  newest_embedding_date timestamptz
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_issues,
    COUNT(embedding) as issues_with_embeddings,
    ROUND((COUNT(embedding)::numeric / COUNT(*)::numeric) * 100, 2) as embedding_coverage_percent,
    ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - embedding_generated_at)) / 86400), 1) as avg_embedding_age_days,
    MIN(embedding_generated_at) as oldest_embedding_date,
    MAX(embedding_generated_at) as newest_embedding_date
  FROM issues
  WHERE repository_id = repo_id;
END;
$$;

-- Optimized function for batch similarity comparisons
-- Useful for finding clusters of similar issues
CREATE OR REPLACE FUNCTION find_issue_clusters(
  repo_id uuid,
  similarity_threshold float DEFAULT 0.8,
  min_cluster_size int DEFAULT 2
)
RETURNS TABLE (
  issue_id uuid,
  issue_number int,
  issue_title text,
  cluster_id int,
  cluster_size int,
  avg_similarity_in_cluster float
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  rec RECORD;
  cluster_counter int := 0;
  temp_cluster_id int;
BEGIN
  -- Create temporary table to store cluster assignments
  CREATE TEMP TABLE IF NOT EXISTS issue_clusters (
    issue_id uuid,
    issue_number int,
    issue_title text,
    cluster_id int,
    similarity float
  );

  -- Simple clustering: for each issue, find similar ones
  FOR rec IN 
    SELECT i.id, i.number, i.title, i.embedding
    FROM issues i
    WHERE i.repository_id = repo_id AND i.embedding IS NOT NULL
    ORDER BY i.created_at
  LOOP
    -- Check if this issue is already assigned to a cluster
    SELECT c.cluster_id INTO temp_cluster_id 
    FROM issue_clusters c 
    WHERE c.issue_id = rec.id;
    
    IF temp_cluster_id IS NULL THEN
      -- Start a new cluster
      cluster_counter := cluster_counter + 1;
      
      -- Add all similar issues to this cluster
      INSERT INTO issue_clusters (issue_id, issue_number, issue_title, cluster_id, similarity)
      SELECT 
        i.id,
        i.number,
        i.title,
        cluster_counter,
        (1 - (i.embedding <=> rec.embedding))::float
      FROM issues i
      WHERE 
        i.repository_id = repo_id
        AND i.embedding IS NOT NULL
        AND (1 - (i.embedding <=> rec.embedding)) >= similarity_threshold
        AND NOT EXISTS (
          SELECT 1 FROM issue_clusters c2 WHERE c2.issue_id = i.id
        );
    END IF;
  END LOOP;

  -- Return clusters with minimum size
  RETURN QUERY
  SELECT 
    c.issue_id,
    c.issue_number,
    c.issue_title,
    c.cluster_id,
    cluster_sizes.cluster_size,
    cluster_averages.avg_similarity
  FROM issue_clusters c
  JOIN (
    SELECT cluster_id, COUNT(*) as cluster_size
    FROM issue_clusters
    GROUP BY cluster_id
    HAVING COUNT(*) >= min_cluster_size
  ) cluster_sizes ON c.cluster_id = cluster_sizes.cluster_id
  JOIN (
    SELECT cluster_id, AVG(similarity) as avg_similarity
    FROM issue_clusters
    GROUP BY cluster_id
  ) cluster_averages ON c.cluster_id = cluster_averages.cluster_id
  ORDER BY c.cluster_id, c.similarity DESC;

  -- Clean up
  DROP TABLE IF EXISTS issue_clusters;
END;
$$;

-- Add performance indexes for the new functionality
CREATE INDEX IF NOT EXISTS idx_issues_embedding_cosine_threshold 
ON issues USING ivfflat (embedding vector_cosine_ops) WITH (lists = 200)
WHERE embedding IS NOT NULL;

-- Add index for repository lookups in cross-repo searches
CREATE INDEX IF NOT EXISTS idx_repositories_full_name_prefix 
ON repositories (full_name text_pattern_ops);

-- -- Grant execute permissions to authenticated (conditional)
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    Grant execute permissions to authenticated;
  ELSE
    RAISE NOTICE 'Role authenticated not found, skipping grant';
  END IF;
END $; users
GRANT EXECUTE ON FUNCTION find_similar_issues(vector, int, uuid, float, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION find_similar_issues_cross_repo(vector, text, int, float, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION find_most_similar_issue(vector, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_repository_embedding_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION find_issue_clusters(uuid, float, int) TO authenticated;

-- Also grant to anonymous users for public repositories
GRANT EXECUTE ON FUNCTION find_similar_issues(vector, int, uuid, float, uuid) TO anon;
GRANT EXECUTE ON FUNCTION find_similar_issues_cross_repo(vector, text, int, float, uuid) TO anon;
GRANT EXECUTE ON FUNCTION find_most_similar_issue(vector, uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION get_repository_embedding_stats(uuid) TO anon;

-- Add comprehensive documentation
COMMENT ON FUNCTION find_similar_issues IS 'Enhanced function to find issues similar to a query embedding with similarity threshold filtering, optional repository scoping, and detailed metadata';
COMMENT ON FUNCTION find_similar_issues_cross_repo IS 'Find similar issues across all repositories in an organization using vector similarity';
COMMENT ON FUNCTION find_most_similar_issue IS 'Find the single most similar issue, useful for duplicate detection with confidence scoring';
COMMENT ON FUNCTION get_repository_embedding_stats IS 'Get embedding coverage statistics for a repository to monitor data quality';
COMMENT ON FUNCTION find_issue_clusters IS 'Find clusters of similar issues within a repository using similarity threshold-based grouping';

-- Create a helper view for common similarity search scenarios
CREATE OR REPLACE VIEW similar_issues_with_metadata AS
SELECT 
  i.id,
  i.github_id,
  i.repository_id,
  i.number,
  i.title,
  i.body,
  i.state,
  i.created_at,
  i.updated_at,
  i.embedding,
  r.full_name as repository_full_name,
  r.name as repository_name,
  c.login as author_login,
  CONCAT('https://github.com/', r.full_name, '/issues/', i.number) as html_url
FROM issues i
JOIN repositories r ON i.repository_id = r.id
LEFT JOIN contributors c ON i.author_id = c.id
WHERE i.embedding IS NOT NULL;

COMMENT ON VIEW similar_issues_with_metadata IS 'Pre-joined view of issues with embeddings and all related metadata for similarity searches';

-- From 20250802000001_update_to_minilm_embeddings.sql
-- Migration: Update from OpenAI embeddings (1536 dims) to MiniLM embeddings (384 dims)
-- This migration updates all vector columns and functions to use 384-dimensional embeddings

-- First, drop existing columns and recreate with new dimensions
-- Note: This will delete existing embeddings, they'll need to be regenerated

-- Update issues table
ALTER TABLE issues DROP COLUMN IF EXISTS embedding CASCADE;
ALTER TABLE issues ADD COLUMN embedding VECTOR(384);

-- Update pull_requests table  
ALTER TABLE pull_requests DROP COLUMN IF EXISTS embedding CASCADE;
ALTER TABLE pull_requests ADD COLUMN embedding VECTOR(384);

-- Update repositories table (if it has embeddings)
ALTER TABLE repositories DROP COLUMN IF EXISTS embedding CASCADE;
ALTER TABLE repositories ADD COLUMN embedding VECTOR(384);

-- Drop and recreate indexes with new dimensions
DROP INDEX IF EXISTS idx_issues_embedding;
DROP INDEX IF EXISTS idx_pull_requests_embedding;
DROP INDEX IF EXISTS idx_issues_embedding_cosine_threshold;

-- Recreate indexes for 384-dimensional vectors
CREATE INDEX idx_issues_embedding 
ON issues USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
WHERE embedding IS NOT NULL;

CREATE INDEX idx_pull_requests_embedding 
ON pull_requests USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
WHERE embedding IS NOT NULL;

-- Update all vector search functions to use 384 dimensions
DROP FUNCTION IF EXISTS find_similar_issues(vector, int, uuid, float, uuid);
DROP FUNCTION IF EXISTS find_similar_issues_cross_repo(vector, text, int, float, uuid);
DROP FUNCTION IF EXISTS find_most_similar_issue(vector, uuid, uuid);
DROP FUNCTION IF EXISTS find_similar_pull_requests(vector, int, uuid, uuid);

-- Recreate find_similar_issues with 384 dimensions
CREATE OR REPLACE FUNCTION find_similar_issues(
  query_embedding vector(384),
  match_count int DEFAULT 5,
  repo_id uuid DEFAULT NULL,
  similarity_threshold float DEFAULT 0.7,
  exclude_issue_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  github_id bigint,
  number int,
  title text,
  body_snippet text,
  state text,
  similarity float,
  created_at timestamptz,
  updated_at timestamptz,
  html_url text,
  author_login text
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.github_id,
    i.number,
    i.title,
    CASE 
      WHEN i.body IS NOT NULL AND LENGTH(i.body) > 200 
      THEN LEFT(i.body, 200) || '...'
      ELSE i.body
    END as body_snippet,
    i.state,
    (1 - (i.embedding <=> query_embedding))::float as similarity,
    i.created_at,
    i.updated_at,
    CONCAT('https://github.com/', r.full_name, '/issues/', i.number) as html_url,
    c.login as author_login
  FROM issues i
  JOIN repositories r ON i.repository_id = r.id
  LEFT JOIN contributors c ON i.author_id = c.id
  WHERE 
    i.embedding IS NOT NULL
    AND (repo_id IS NULL OR i.repository_id = repo_id)
    AND (exclude_issue_id IS NULL OR i.id != exclude_issue_id)
    AND (1 - (i.embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY i.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Recreate find_similar_issues_cross_repo with 384 dimensions
CREATE OR REPLACE FUNCTION find_similar_issues_cross_repo(
  query_embedding vector(384),
  organization_name text,
  match_count int DEFAULT 5,
  similarity_threshold float DEFAULT 0.7,
  exclude_issue_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  github_id bigint,
  number int,
  title text,
  body_snippet text,
  state text,
  similarity float,
  created_at timestamptz,
  updated_at timestamptz,
  html_url text,
  author_login text,
  repository_name text,
  repository_full_name text
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.github_id,
    i.number,
    i.title,
    CASE 
      WHEN i.body IS NOT NULL AND LENGTH(i.body) > 200 
      THEN LEFT(i.body, 200) || '...'
      ELSE i.body
    END as body_snippet,
    i.state,
    (1 - (i.embedding <=> query_embedding))::float as similarity,
    i.created_at,
    i.updated_at,
    CONCAT('https://github.com/', r.full_name, '/issues/', i.number) as html_url,
    c.login as author_login,
    r.name as repository_name,
    r.full_name as repository_full_name
  FROM issues i
  JOIN repositories r ON i.repository_id = r.id
  LEFT JOIN contributors c ON i.author_id = c.id
  WHERE 
    i.embedding IS NOT NULL
    AND r.full_name ILIKE (organization_name || '/%')
    AND (exclude_issue_id IS NULL OR i.id != exclude_issue_id)
    AND (1 - (i.embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY i.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Recreate find_most_similar_issue with 384 dimensions
CREATE OR REPLACE FUNCTION find_most_similar_issue(
  query_embedding vector(384),
  repo_id uuid,
  exclude_issue_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  github_id bigint,
  number int,
  title text,
  similarity float,
  html_url text,
  is_duplicate_likely boolean
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.github_id,
    i.number,
    i.title,
    (1 - (i.embedding <=> query_embedding))::float as similarity,
    CONCAT('https://github.com/', r.full_name, '/issues/', i.number) as html_url,
    (1 - (i.embedding <=> query_embedding)) > 0.85 as is_duplicate_likely
  FROM issues i
  JOIN repositories r ON i.repository_id = r.id
  WHERE 
    i.repository_id = repo_id
    AND i.embedding IS NOT NULL
    AND (exclude_issue_id IS NULL OR i.id != exclude_issue_id)
  ORDER BY i.embedding <=> query_embedding
  LIMIT 1;
END;
$$;

-- Create similar function for pull requests
CREATE OR REPLACE FUNCTION find_similar_pull_requests(
  query_embedding vector(384),
  match_count int DEFAULT 5,
  repo_id uuid DEFAULT NULL,
  exclude_pr_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  github_id bigint,
  number int,
  title text,
  state text,
  merged_at timestamptz,
  similarity float,
  created_at timestamptz,
  html_url text
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pr.id,
    pr.github_id,
    pr.number,
    pr.title,
    pr.state,
    pr.merged_at,
    (1 - (pr.embedding <=> query_embedding))::float as similarity,
    pr.created_at,
    CONCAT('https://github.com/', r.full_name, '/pull/', pr.number) as html_url
  FROM pull_requests pr
  JOIN repositories r ON pr.repository_id = r.id
  WHERE 
    pr.embedding IS NOT NULL
    AND (repo_id IS NULL OR pr.repository_id = repo_id)
    AND (exclude_pr_id IS NULL OR pr.id != exclude_pr_id)
  ORDER BY pr.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION find_similar_issues(vector, int, uuid, float, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION find_similar_issues_cross_repo(vector, text, int, float, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION find_most_similar_issue(vector, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION find_similar_pull_requests(vector, int, uuid, uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION find_similar_issues(vector, int, uuid, float, uuid) TO anon;
GRANT EXECUTE ON FUNCTION find_similar_issues_cross_repo(vector, text, int, float, uuid) TO anon;
GRANT EXECUTE ON FUNCTION find_most_similar_issue(vector, uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION find_similar_pull_requests(vector, int, uuid, uuid) TO anon;

-- Add comments
COMMENT ON COLUMN issues.embedding IS 'MiniLM embedding vector for semantic search (384 dimensions)';
COMMENT ON COLUMN pull_requests.embedding IS 'MiniLM embedding vector for semantic search (384 dimensions)';
COMMENT ON COLUMN repositories.embedding IS 'MiniLM embedding vector for semantic search (384 dimensions)';

-- Note: After this migration, all embeddings need to be regenerated using the new MiniLM model

-- From 20250802000002_add_file_contributors_and_embeddings.sql
-- Add file contributors tracking for better reviewer suggestions
-- This migration adds tables to track who contributes to which files
-- and stores file embeddings for semantic similarity matching

-- Create file_contributors table to track who works on which files
CREATE TABLE IF NOT EXISTS file_contributors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  contributor_id UUID NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
  commit_count INTEGER DEFAULT 0,
  additions INTEGER DEFAULT 0,
  deletions INTEGER DEFAULT 0,
  last_commit_at TIMESTAMP WITH TIME ZONE,
  first_commit_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(repository_id, file_path, contributor_id)
);

-- Create file_embeddings table for semantic file similarity
CREATE TABLE IF NOT EXISTS file_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  embedding vector(384), -- Using same dimension as issue embeddings
  content_hash TEXT, -- To detect when re-embedding is needed
  file_size INTEGER,
  language TEXT, -- Programming language detected
  last_indexed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(repository_id, file_path)
);

-- Create github_app_installations table if not exists
CREATE TABLE IF NOT EXISTS github_app_installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id BIGINT NOT NULL UNIQUE,
  repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE,
  account_type TEXT NOT NULL CHECK (account_type IN ('user', 'organization')),
  account_login TEXT NOT NULL,
  account_id BIGINT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('User', 'Organization', 'Repository')),
  permissions JSONB,
  events TEXT[],
  installed_at TIMESTAMP WITH TIME ZONE,
  suspended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create github_app_installation_settings table
CREATE TABLE IF NOT EXISTS github_app_installation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id BIGINT NOT NULL REFERENCES github_app_installations(installation_id) ON DELETE CASCADE,
  comment_on_prs BOOLEAN DEFAULT true,
  comment_on_issues BOOLEAN DEFAULT true,
  auto_track_repos BOOLEAN DEFAULT true,
  excluded_repos TEXT[],
  excluded_users TEXT[],
  comment_style TEXT DEFAULT 'detailed' CHECK (comment_style IN ('detailed', 'minimal')),
  features JSONB DEFAULT '{"reviewer_suggestions": true, "similar_issues": true, "auto_comment": true}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(installation_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_file_contributors_repo_path ON file_contributors(repository_id, file_path);
CREATE INDEX IF NOT EXISTS idx_file_contributors_contributor ON file_contributors(contributor_id);
CREATE INDEX IF NOT EXISTS idx_file_contributors_repo_contributor ON file_contributors(repository_id, contributor_id);
CREATE INDEX IF NOT EXISTS idx_file_contributors_last_commit ON file_contributors(last_commit_at DESC);

CREATE INDEX IF NOT EXISTS idx_file_embeddings_repo_path ON file_embeddings(repository_id, file_path);
CREATE INDEX IF NOT EXISTS idx_file_embeddings_language ON file_embeddings(repository_id, language);
CREATE INDEX IF NOT EXISTS idx_file_embeddings_vector ON file_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_file_contributors_updated_at ON file_contributors;
CREATE TRIGGER update_file_contributors_updated_at BEFORE UPDATE ON file_contributors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_file_embeddings_updated_at ON file_embeddings;
CREATE TRIGGER update_file_embeddings_updated_at BEFORE UPDATE ON file_embeddings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_github_app_installations_updated_at ON github_app_installations;
CREATE TRIGGER update_github_app_installations_updated_at BEFORE UPDATE ON github_app_installations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_github_app_installation_settings_updated_at ON github_app_installation_settings;
CREATE TRIGGER update_github_app_installation_settings_updated_at BEFORE UPDATE ON github_app_installation_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create view for top contributors per repository
CREATE OR REPLACE VIEW repository_top_contributors AS
SELECT 
  fc.repository_id,
  fc.contributor_id,
  c.github_login,
  c.name,
  c.avatar_url,
  COUNT(DISTINCT fc.file_path) as files_contributed_to,
  SUM(fc.commit_count) as total_commits,
  SUM(fc.additions) as total_additions,
  SUM(fc.deletions) as total_deletions,
  MAX(fc.last_commit_at) as last_active
FROM file_contributors fc
JOIN contributors c ON fc.contributor_id = c.id
GROUP BY fc.repository_id, fc.contributor_id, c.github_login, c.name, c.avatar_url
ORDER BY fc.repository_id, total_commits DESC;

-- Create function to find similar files by embedding
CREATE OR REPLACE FUNCTION find_similar_files(
  p_repository_id UUID,
  p_file_path TEXT,
  p_threshold FLOAT DEFAULT 0.8,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  file_path TEXT,
  similarity FLOAT,
  language TEXT,
  contributor_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH target_embedding AS (
    SELECT embedding
    FROM file_embeddings
    WHERE repository_id = p_repository_id
      AND file_path = p_file_path
    LIMIT 1
  )
  SELECT 
    fe.file_path,
    1 - (fe.embedding <=> te.embedding) AS similarity,
    fe.language,
    COUNT(DISTINCT fc.contributor_id) as contributor_count
  FROM file_embeddings fe
  CROSS JOIN target_embedding te
  LEFT JOIN file_contributors fc ON fc.repository_id = fe.repository_id AND fc.file_path = fe.file_path
  WHERE fe.repository_id = p_repository_id
    AND fe.file_path != p_file_path
    AND 1 - (fe.embedding <=> te.embedding) >= p_threshold
  GROUP BY fe.file_path, fe.embedding, te.embedding, fe.language
  ORDER BY similarity DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Add RLS policies
ALTER TABLE file_contributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_app_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_app_installation_settings ENABLE ROW LEVEL SECURITY;

-- Public read access for file contributors
CREATE POLICY "Public read access for file contributors"
  ON file_contributors FOR SELECT
  USING (true);

-- Public read access for file embeddings
CREATE POLICY "Public read access for file embeddings"
  ON file_embeddings FOR SELECT
  USING (true);

-- Authenticated users can manage github app installations
CREATE POLICY "Authenticated users can manage installations"
  ON github_app_installations FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage installation settings"
  ON github_app_installation_settings FOR ALL
  USING (auth.role() = 'authenticated');

-- Service role has full access
CREATE POLICY "Service role has full access to file contributors"
  ON file_contributors FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to file embeddings"
  ON file_embeddings FOR ALL
  USING (auth.role() = 'service_role');

-- Comment tracking for PR insights
CREATE TABLE IF NOT EXISTS pr_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pull_request_id UUID REFERENCES pull_requests(id) ON DELETE CASCADE,
  github_pr_id BIGINT NOT NULL,
  contributor_stats JSONB,
  suggested_reviewers JSONB,
  similar_issues JSONB,
  has_codeowners BOOLEAN DEFAULT false,
  comment_posted BOOLEAN DEFAULT false,
  comment_id BIGINT,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pr_insights_pr ON pr_insights(pull_request_id);
CREATE INDEX IF NOT EXISTS idx_pr_insights_github_pr ON pr_insights(github_pr_id);

-- Add trigger for pr_insights
DROP TRIGGER IF EXISTS update_pr_insights_updated_at ON pr_insights;
CREATE TRIGGER update_pr_insights_updated_at BEFORE UPDATE ON pr_insights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add RLS for pr_insights
ALTER TABLE pr_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for PR insights"
  ON pr_insights FOR SELECT
  USING (true);

CREATE POLICY "Service role has full access to PR insights"
  ON pr_insights FOR ALL
  USING (auth.role() = 'service_role');

-- Add comment to explain the schema
COMMENT ON TABLE file_contributors IS 'Tracks which contributors have worked on which files in a repository';
COMMENT ON TABLE file_embeddings IS 'Stores embeddings for files to enable semantic similarity search';
COMMENT ON TABLE github_app_installations IS 'Tracks GitHub App installations';
COMMENT ON TABLE github_app_installation_settings IS 'Per-installation settings for the GitHub App';
COMMENT ON TABLE pr_insights IS 'Stores generated insights and suggestions for pull requests';
COMMENT ON COLUMN file_embeddings.embedding IS 'Vector embedding of file content for similarity search';
COMMENT ON COLUMN file_embeddings.content_hash IS 'Hash of file content to detect when re-embedding is needed';

-- From 20250802000003_add_data_purge_cron.sql
-- Add automatic data purging for privacy compliance
-- This migration sets up pg_cron to automatically purge old file data after 30 days

-- Enable pg_cron extension if not already enabled
-- Note: This requires superuser privileges and may need to be run separately
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Add purge tracking to file_contributors and file_embeddings
ALTER TABLE file_contributors ADD COLUMN IF NOT EXISTS purge_after TIMESTAMP WITH TIME ZONE 
  GENERATED ALWAYS AS (last_commit_at + INTERVAL '30 days') STORED;

ALTER TABLE file_embeddings ADD COLUMN IF NOT EXISTS purge_after TIMESTAMP WITH TIME ZONE 
  GENERATED ALWAYS AS (last_indexed_at + INTERVAL '30 days') STORED;

-- Create indexes for efficient purging
CREATE INDEX IF NOT EXISTS idx_file_contributors_purge_after ON file_contributors(purge_after);
CREATE INDEX IF NOT EXISTS idx_file_embeddings_purge_after ON file_embeddings(purge_after);

-- Add indexes on the actual filter columns for better performance
CREATE INDEX IF NOT EXISTS idx_file_contributors_last_commit ON file_contributors(last_commit_at);
CREATE INDEX IF NOT EXISTS idx_file_embeddings_last_indexed ON file_embeddings(last_indexed_at);
CREATE INDEX IF NOT EXISTS idx_pr_insights_generated_at ON pr_insights(generated_at);

-- Create a function to purge old data (alternative to Edge Function)
CREATE OR REPLACE FUNCTION purge_old_file_data()
RETURNS TABLE (
  purged_contributors INTEGER,
  purged_embeddings INTEGER,
  purged_insights INTEGER
) AS $$
DECLARE
  cutoff_date TIMESTAMP WITH TIME ZONE;
  contributors_count INTEGER;
  embeddings_count INTEGER;
  insights_count INTEGER;
BEGIN
  -- Calculate cutoff date (30 days ago)
  cutoff_date := NOW() - INTERVAL '30 days';
  
  -- Purge old file contributors
  WITH deleted AS (
    DELETE FROM file_contributors
    WHERE last_commit_at < cutoff_date
    RETURNING 1
  )
  SELECT COUNT(*)::INTEGER INTO contributors_count FROM deleted;
  
  -- Purge old file embeddings
  WITH deleted AS (
    DELETE FROM file_embeddings
    WHERE last_indexed_at < cutoff_date
    RETURNING 1
  )
  SELECT COUNT(*)::INTEGER INTO embeddings_count FROM deleted;
  
  -- Purge old PR insights
  WITH deleted AS (
    DELETE FROM pr_insights
    WHERE generated_at < cutoff_date
    RETURNING 1
  )
  SELECT COUNT(*)::INTEGER INTO insights_count FROM deleted;
  
  -- Log the purge activity
  INSERT INTO data_purge_log (
    purge_date,
    file_contributors_purged,
    file_embeddings_purged,
    pr_insights_purged
  ) VALUES (
    NOW(),
    contributors_count,
    embeddings_count,
    insights_count
  );
  
  RETURN QUERY SELECT contributors_count, embeddings_count, insights_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Create a table to log purge activities
CREATE TABLE IF NOT EXISTS data_purge_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purge_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  file_contributors_purged INTEGER DEFAULT 0,
  file_embeddings_purged INTEGER DEFAULT 0,
  pr_insights_purged INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for purge log
CREATE INDEX idx_data_purge_log_date ON data_purge_log(purge_date DESC);

-- Add RLS for purge log (read-only for authenticated users)
ALTER TABLE data_purge_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read purge logs"
  ON data_purge_log FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage purge logs"
  ON data_purge_log FOR ALL
  USING (auth.role() = 'service_role');

-- Add comment about the purge policy
COMMENT ON FUNCTION purge_old_file_data IS 'Automatically purges file data older than 30 days for privacy compliance';
COMMENT ON TABLE data_purge_log IS 'Tracks data purge activities for compliance auditing';

-- Note: To schedule this function with pg_cron, run the following after enabling the extension:
/*
SELECT -- cron.schedule(
  'purge-old-file-data',
  '0 2 * * *', -- Daily at 2 AM UTC
  $$SELECT purge_old_file_data();
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    cron.schedule(
  'purge-old-file-data',
  '0 2 * * *', -- Daily at 2 AM UTC
  $$SELECT purge_old_file_data();
  ELSE
    RAISE NOTICE 'pg_cron extension not available, skipping cron job';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not create cron job: %', SQLERRM;
END $;$$
);
*/

-- Create a view to show upcoming data to be purged
CREATE OR REPLACE VIEW upcoming_data_purge AS
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

-- -- Grant access to the purge view
GRANT SELECT ON upcoming_data_purge TO authenticated (conditional)
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    Grant access to the purge view
GRANT SELECT ON upcoming_data_purge TO authenticated;
  ELSE
    RAISE NOTICE 'Role authenticated not found, skipping grant';
  END IF;
END $;;

COMMENT ON VIEW upcoming_data_purge IS 'Shows data that will be purged in the next 7 days';

-- From 20250805_fix_function_search_paths.sql
-- Fix function search paths for security
-- This prevents potential security issues with schema resolution

-- Update all functions to have an immutable search path
-- This is a security best practice recommended by Supabase

DO $$ 
DECLARE
    func RECORD;
BEGIN
    -- Loop through all functions in the public schema
    FOR func IN 
        SELECT proname, pg_get_function_identity_arguments(oid) as args
        FROM pg_proc
        WHERE pronamespace = 'public'::regnamespace
        AND prokind = 'f' -- Only functions, not procedures
    LOOP
        BEGIN
            -- Set search_path for each function
            EXECUTE format('
                ALTER FUNCTION public.%I(%s) 
                SET search_path = public, pg_catalog, pg_temp
            ', func.proname, func.args);
        EXCEPTION
            WHEN OTHERS THEN
                -- Log but don't fail if a function can't be altered
                RAISE NOTICE 'Could not alter function %.%: %', func.proname, func.args, SQLERRM;
        END;
    END LOOP;
END $$;

-- Move extensions out of public schema for security
-- This prevents potential security issues with extension functions

-- Create a dedicated schema for extensions if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Grant usage on extensions schema to necessary roles
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- Note: Moving extensions requires careful handling of dependencies
-- The following commands are commented out and should be run manually after verifying dependencies:
-- ALTER EXTENSION vector SET SCHEMA extensions;
-- ALTER EXTENSION http SET SCHEMA extensions;

-- Add RLS policy for materialized view (convert to regular view if needed)
-- Note: Materialized views can't have RLS, so we need to control access differently
COMMENT ON MATERIALIZED VIEW public.repository_contribution_stats IS 
'This materialized view is publicly accessible. Consider converting to a regular view with RLS-enabled base tables if sensitive data is involved.';

-- From 20250823_add_rate_limits_table.sql
-- Create rate limits table for API rate limiting
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_request TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits(key);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON rate_limits(window_start);

-- Add auto-update for updated_at
CREATE OR REPLACE FUNCTION update_rate_limits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rate_limits_updated_at
  BEFORE UPDATE ON rate_limits
  FOR EACH ROW
  EXECUTE FUNCTION update_rate_limits_updated_at();

-- Add cleanup function to remove old rate limit records
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limits 
  WHERE window_start < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to clean up old rate limits (if pg_cron is available)
-- Note: This requires pg_cron extension to be enabled
-- Uncomment the following if pg_cron is available:
-- SELECT -- cron.schedule('cleanup-rate-limits', '0 */6 * * *', 'SELECT cleanup_old_rate_limits();
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    cron.schedule('cleanup-rate-limits', '0 */6 * * *', 'SELECT cleanup_old_rate_limits();
  ELSE
    RAISE NOTICE 'pg_cron extension not available, skipping cron job';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not create cron job: %', SQLERRM;
END $;');

-- -- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON rate_limits TO service_role (conditional)
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON rate_limits TO service_role;
  ELSE
    RAISE NOTICE 'Role service_role not found, skipping grant';
  END IF;
END $;;
-- GRANT SELECT ON rate_limits TO authenticated (conditional)
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT ON rate_limits TO authenticated;
  ELSE
    RAISE NOTICE 'Role authenticated not found, skipping grant';
  END IF;
END $;;

-- Add RLS policies
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role can manage all rate limits" ON rate_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can only read their own rate limits
CREATE POLICY "Users can read their own rate limits" ON rate_limits
  FOR SELECT
  TO authenticated
  USING (key LIKE 'user:' || auth.uid() || '%');


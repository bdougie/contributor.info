-- Local-safe version of 20240614000000_initial_contributor_schema.sql
-- Generated: 2025-08-27T02:47:08.033Z
-- This migration has been modified to work without auth, roles, and extensions
-- Original migration may have different behavior in production

-- Transaction wrapper for safety
BEGIN;

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
CREATE TABLE IF NOT EXISTS contributors (
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
CREATE TABLE IF NOT EXISTS organizations (
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
CREATE TABLE IF NOT EXISTS repositories (
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
CREATE TABLE IF NOT EXISTS pull_requests (
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
CREATE TABLE IF NOT EXISTS reviews (
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
CREATE TABLE IF NOT EXISTS comments (
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
CREATE TABLE IF NOT EXISTS contributor_organizations (
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
CREATE TABLE IF NOT EXISTS tracked_repositories (
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
CREATE TABLE IF NOT EXISTS monthly_rankings (
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
CREATE TABLE IF NOT EXISTS daily_activity_snapshots (
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
CREATE TABLE IF NOT EXISTS sync_logs (
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
CREATE INDEX IF NOT EXISTS idx_contributors_username ON contributors(username);
CREATE INDEX IF NOT EXISTS idx_contributors_github_id ON contributors(github_id);
CREATE INDEX IF NOT EXISTS idx_contributors_last_updated ON contributors(last_updated_at);
CREATE INDEX IF NOT EXISTS idx_contributors_active ON contributors(is_active) WHERE is_active = TRUE;

-- Repositories indexes
CREATE INDEX IF NOT EXISTS idx_repositories_owner ON repositories(owner);
CREATE INDEX IF NOT EXISTS idx_repositories_full_name ON repositories(full_name);
CREATE INDEX IF NOT EXISTS idx_repositories_language ON repositories(language);
CREATE INDEX IF NOT EXISTS idx_repositories_stars ON repositories(stargazers_count DESC);
CREATE INDEX IF NOT EXISTS idx_repositories_active ON repositories(is_active) WHERE is_active = TRUE;

-- Pull requests indexes
CREATE INDEX IF NOT EXISTS idx_pull_requests_repository ON pull_requests(repository_id);
CREATE INDEX IF NOT EXISTS idx_pull_requests_author ON pull_requests(author_id);
CREATE INDEX IF NOT EXISTS idx_pull_requests_state ON pull_requests(state);
CREATE INDEX IF NOT EXISTS idx_pull_requests_created ON pull_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pull_requests_merged ON pull_requests(merged_at DESC) WHERE merged_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pull_requests_repo_state ON pull_requests(repository_id, state);
CREATE INDEX IF NOT EXISTS idx_pull_requests_author_state ON pull_requests(author_id, state);

-- Reviews indexes
CREATE INDEX IF NOT EXISTS idx_reviews_pull_request ON reviews(pull_request_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_state ON reviews(state);
CREATE INDEX IF NOT EXISTS idx_reviews_submitted ON reviews(submitted_at DESC);

-- Comments indexes
CREATE INDEX IF NOT EXISTS idx_comments_pull_request ON comments(pull_request_id);
CREATE INDEX IF NOT EXISTS idx_comments_commenter ON comments(commenter_id);
CREATE INDEX IF NOT EXISTS idx_comments_created ON comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_type ON comments(comment_type);

-- Monthly rankings indexes
CREATE INDEX IF NOT EXISTS idx_monthly_rankings_month_year ON monthly_rankings(year DESC, month DESC);
CREATE INDEX IF NOT EXISTS idx_monthly_rankings_contributor ON monthly_rankings(contributor_id);
CREATE INDEX IF NOT EXISTS idx_monthly_rankings_repository ON monthly_rankings(repository_id);
CREATE INDEX IF NOT EXISTS idx_monthly_rankings_score ON monthly_rankings(weighted_score DESC);
CREATE INDEX IF NOT EXISTS idx_monthly_rankings_winners ON monthly_rankings(year DESC, month DESC, is_winner) WHERE is_winner = TRUE;

-- Daily activity indexes
CREATE INDEX IF NOT EXISTS idx_daily_activity_date ON daily_activity_snapshots(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_activity_contributor ON daily_activity_snapshots(contributor_id);
CREATE INDEX IF NOT EXISTS idx_daily_activity_repository ON daily_activity_snapshots(repository_id);

-- Sync logs indexes
CREATE INDEX IF NOT EXISTS idx_sync_logs_started ON sync_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_logs_type ON sync_logs(sync_type);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_sync_logs_repository ON sync_logs(repository_id);

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

COMMIT;

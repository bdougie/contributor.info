-- Create github_issues table for DLT pipeline integration
-- This table stores GitHub issues data synced via gh-datapipe
-- Similar structure to pull_requests table with DLT tracking columns

CREATE TABLE github_issues (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    github_id BIGINT UNIQUE NOT NULL,
    number INTEGER NOT NULL,

    -- Core issue data
    title TEXT NOT NULL,
    body TEXT,
    state TEXT NOT NULL CHECK (state IN ('open', 'closed')),

    -- Relationships
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    author_id UUID REFERENCES contributors(id) ON DELETE CASCADE,
    closed_by_id UUID REFERENCES contributors(id),

    -- Issue metadata
    labels JSONB,
    assignees JSONB,
    milestone JSONB,
    comments_count INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    closed_at TIMESTAMPTZ,

    -- Additional fields
    html_url TEXT,
    is_pull_request BOOLEAN DEFAULT FALSE,
    linked_pr_id UUID REFERENCES pull_requests(id),

    -- DLT tracking columns (required for gh-datapipe sync)
    _dlt_load_id TEXT,
    _dlt_id TEXT,

    -- Composite unique constraint for repo + issue number
    CONSTRAINT github_issues_repo_number_key UNIQUE (repository_id, number)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Primary lookup indexes
CREATE INDEX idx_github_issues_github_id ON github_issues(github_id);
CREATE INDEX idx_github_issues_repository ON github_issues(repository_id);
CREATE INDEX idx_github_issues_author ON github_issues(author_id);
CREATE INDEX idx_github_issues_number ON github_issues(number);

-- State and filtering indexes
CREATE INDEX idx_github_issues_state ON github_issues(state);
CREATE INDEX idx_github_issues_created ON github_issues(created_at DESC);
CREATE INDEX idx_github_issues_updated ON github_issues(updated_at DESC);
CREATE INDEX idx_github_issues_closed ON github_issues(closed_at DESC) WHERE closed_at IS NOT NULL;

-- Composite indexes for common queries
CREATE INDEX idx_github_issues_repo_state ON github_issues(repository_id, state);
CREATE INDEX idx_github_issues_repo_created ON github_issues(repository_id, created_at DESC);
CREATE INDEX idx_github_issues_author_state ON github_issues(author_id, state);

-- DLT tracking indexes
CREATE INDEX idx_github_issues_dlt_load_id ON github_issues(_dlt_load_id);
CREATE INDEX idx_github_issues_dlt_id ON github_issues(_dlt_id);

-- JSONB indexes for label and assignee filtering
CREATE INDEX idx_github_issues_labels ON github_issues USING GIN (labels);
CREATE INDEX idx_github_issues_assignees ON github_issues USING GIN (assignees);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE github_issues ENABLE ROW LEVEL SECURITY;

-- Allow public read access (consistent with project's progressive onboarding)
CREATE POLICY "github_issues_public_read" ON github_issues
    FOR SELECT
    TO public
    USING (true);

-- Allow service_role full access for DLT sync operations
CREATE POLICY "github_issues_service_role_all" ON github_issues
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Allow authenticated users to read
CREATE POLICY "github_issues_authenticated_read" ON github_issues
    FOR SELECT
    TO authenticated
    USING (true);

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE github_issues IS 'Stores GitHub issues data synced via gh-datapipe with DLT tracking';
COMMENT ON COLUMN github_issues._dlt_load_id IS 'DLT pipeline load identifier for tracking sync batches';
COMMENT ON COLUMN github_issues._dlt_id IS 'DLT unique record identifier for deduplication';
COMMENT ON COLUMN github_issues.is_pull_request IS 'Flag indicating if this issue is actually a pull request (GitHub treats PRs as issues)';
COMMENT ON COLUMN github_issues.linked_pr_id IS 'Reference to pull_requests table if this issue is linked to a PR';
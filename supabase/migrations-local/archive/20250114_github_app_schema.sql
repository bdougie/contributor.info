-- Local-safe version of 20250114_github_app_schema.sql
-- Generated: 2025-08-27T02:47:08.037Z
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

-- This migration requires auth schema
DO $$
BEGIN
  -- Check if auth schema and functions exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    RAISE NOTICE 'Auth schema not found. Skipping 20250114_github_app_schema.sql';
    RETURN;
  END IF;
  
  -- Check for auth.uid() function
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'auth' AND p.proname = 'uid'
  ) THEN
    RAISE NOTICE 'Auth functions not available. Skipping 20250114_github_app_schema.sql';
    RETURN;
  END IF;
END $$;

-- Original migration content (only runs if auth is available)
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
CREATE INDEX IF NOT EXISTS idx_app_installations_account ON github_app_installations(account_id);
CREATE INDEX IF NOT EXISTS idx_app_installations_created ON github_app_installations(installed_at);
CREATE INDEX IF NOT EXISTS idx_app_enabled_repos_installation ON app_enabled_repositories(installation_id);
CREATE INDEX IF NOT EXISTS idx_pr_insights_pr ON pr_insights(pull_request_id);
CREATE INDEX IF NOT EXISTS idx_pr_insights_posted ON pr_insights(comment_posted);
CREATE INDEX IF NOT EXISTS idx_issues_repo ON issues(repository_id);
CREATE INDEX IF NOT EXISTS idx_issues_state ON issues(state);
CREATE INDEX IF NOT EXISTS idx_issues_number ON issues(repository_id, number);
CREATE INDEX IF NOT EXISTS idx_issue_similarities_source ON issue_similarities(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_issue_similarities_target ON issue_similarities(target_issue_id);
CREATE INDEX IF NOT EXISTS idx_app_metrics_event ON app_metrics(event_type);
CREATE INDEX IF NOT EXISTS idx_app_metrics_created ON app_metrics(created_at);

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

COMMIT;

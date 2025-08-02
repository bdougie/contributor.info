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
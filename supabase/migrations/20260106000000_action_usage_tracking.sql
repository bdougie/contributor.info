-- Migration: GitHub Action Usage Tracking
-- Description: Create table to store discovered repositories using .continue/agents folder
-- Date: 2026-01-06
-- Reference: Issue #1468

-- Create action_usage_discoveries table
CREATE TABLE IF NOT EXISTS action_usage_discoveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  github_id BIGINT NOT NULL UNIQUE,
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  full_name TEXT NOT NULL UNIQUE,
  stargazers_count INTEGER NOT NULL,
  language TEXT,
  description TEXT,
  last_updated_at TIMESTAMPTZ NOT NULL,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add comments for documentation
COMMENT ON TABLE action_usage_discoveries IS 'Stores repositories discovered to be using .continue/agents folder';
COMMENT ON COLUMN action_usage_discoveries.github_id IS 'GitHub repository ID (unique identifier)';
COMMENT ON COLUMN action_usage_discoveries.owner IS 'Repository owner/organization name';
COMMENT ON COLUMN action_usage_discoveries.name IS 'Repository name';
COMMENT ON COLUMN action_usage_discoveries.full_name IS 'Full repository name (owner/name)';
COMMENT ON COLUMN action_usage_discoveries.stargazers_count IS 'Number of GitHub stars';
COMMENT ON COLUMN action_usage_discoveries.language IS 'Primary programming language';
COMMENT ON COLUMN action_usage_discoveries.description IS 'Repository description from GitHub';
COMMENT ON COLUMN action_usage_discoveries.last_updated_at IS 'Last update timestamp from GitHub';
COMMENT ON COLUMN action_usage_discoveries.discovered_at IS 'When repository was first discovered';
COMMENT ON COLUMN action_usage_discoveries.last_verified_at IS 'Last time repository was verified to have .continue/agents';
COMMENT ON COLUMN action_usage_discoveries.is_active IS 'Whether repository still has .continue/agents folder';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_action_usage_stars ON action_usage_discoveries(stargazers_count DESC);
CREATE INDEX IF NOT EXISTS idx_action_usage_language ON action_usage_discoveries(language);
CREATE INDEX IF NOT EXISTS idx_action_usage_active ON action_usage_discoveries(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_action_usage_full_name ON action_usage_discoveries(full_name);
CREATE INDEX IF NOT EXISTS idx_action_usage_verified ON action_usage_discoveries(last_verified_at DESC);

-- Enable Row Level Security
ALTER TABLE action_usage_discoveries ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Authenticated users can read active discoveries
CREATE POLICY "authenticated_read_active_discoveries" ON action_usage_discoveries
  FOR SELECT
  TO authenticated
  USING (is_active = TRUE);

-- RLS Policy: Service role can do anything (for webhook/cron jobs)
CREATE POLICY "service_role_all_access" ON action_usage_discoveries
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_action_usage_discoveries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER action_usage_discoveries_updated_at
  BEFORE UPDATE ON action_usage_discoveries
  FOR EACH ROW
  EXECUTE FUNCTION update_action_usage_discoveries_updated_at();

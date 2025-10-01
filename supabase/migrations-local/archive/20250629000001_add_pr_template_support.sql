-- Local-safe version of 20250629000001_add_pr_template_support.sql
-- Generated: 2025-08-27T02:47:08.050Z
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

-- CREATE INDEX IF NOT EXISTS for efficient pattern lookup
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

COMMIT;

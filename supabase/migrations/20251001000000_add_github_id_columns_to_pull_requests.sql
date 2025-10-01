-- Migration: Add github_id columns to pull_requests table
-- Issue: #874
-- Purpose: Enable DLT pipeline to sync pull_requests using github_ids instead of UUIDs
--          DLT serializes UUID objects to strings, causing PostgreSQL type mismatches
--          This follows the pattern established in PR #873 for UUID handling

-- Add author_github_id and repository_github_id columns
ALTER TABLE pull_requests
ADD COLUMN IF NOT EXISTS author_github_id BIGINT,
ADD COLUMN IF NOT EXISTS repository_github_id BIGINT;

-- Backfill author_github_id from existing author_id relationships
UPDATE pull_requests pr
SET author_github_id = c.github_id
FROM contributors c
WHERE pr.author_id = c.id
  AND pr.author_github_id IS NULL;

-- Backfill repository_github_id from existing repository_id relationships
UPDATE pull_requests pr
SET repository_github_id = r.github_id
FROM repositories r
WHERE pr.repository_id = r.id
  AND pr.repository_github_id IS NULL;

-- Add indexes for performance on the new columns
CREATE INDEX IF NOT EXISTS idx_pull_requests_author_github_id ON pull_requests(author_github_id);
CREATE INDEX IF NOT EXISTS idx_pull_requests_repository_github_id ON pull_requests(repository_github_id);

-- Add comments to document the purpose of these columns
COMMENT ON COLUMN pull_requests.author_github_id IS 'GitHub user ID of the PR author - used for DLT pipeline sync and async UUID mapping';
COMMENT ON COLUMN pull_requests.repository_github_id IS 'GitHub repository ID - used for DLT pipeline sync and async UUID mapping';

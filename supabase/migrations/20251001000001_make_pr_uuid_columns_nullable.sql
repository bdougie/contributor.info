-- Migration: Make author_id and repository_id nullable in pull_requests table
-- Issue: #877
-- Purpose: Enable DLT pipeline to sync PRs with github_ids first, UUIDs populated asynchronously
--          DLT merge operations fail when trying to update all columns including NOT NULL UUIDs
--          Two-phase approach: DLT writes github_ids, frontend utilities resolve UUIDs later

-- Make UUID foreign key columns nullable
ALTER TABLE pull_requests
  ALTER COLUMN author_id DROP NOT NULL,
  ALTER COLUMN repository_id DROP NOT NULL;

-- Add comments to document the nullable columns and two-phase approach
COMMENT ON COLUMN pull_requests.author_id IS 'UUID reference to contributors table - nullable to support two-phase sync (github_id first, UUID resolved asynchronously)';
COMMENT ON COLUMN pull_requests.repository_id IS 'UUID reference to repositories table - nullable to support two-phase sync (github_id first, UUID resolved asynchronously)';

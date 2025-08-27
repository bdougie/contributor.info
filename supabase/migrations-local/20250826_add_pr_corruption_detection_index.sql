-- Local-safe version of 20250826_add_pr_corruption_detection_index.sql
-- Generated: 2025-08-27T02:47:08.071Z
-- This migration has been modified to work without auth, roles, and extensions
-- Original migration may have different behavior in production

-- Transaction wrapper for safety
BEGIN;

-- Add index for efficient PR corruption detection queries
-- This index helps identify PRs with all zero values which may indicate data corruption
-- Using CONCURRENTLY to avoid blocking database writes during deployment

CREATE INDEX IF NOT EXISTS CONCURRENTLY IF NOT EXISTS idx_pr_corruption_detection 
ON pull_requests (repository_id, created_at DESC) 
WHERE additions = 0 AND deletions = 0 AND changed_files = 0 AND commits = 0;

-- This partial index only includes potentially corrupted records,
-- making corruption detection queries much faster
COMMENT ON INDEX idx_pr_corruption_detection IS 'Partial index for detecting potentially corrupted PR data with all zero metrics';

-- Also add an index for recent PR lookups by repository
CREATE INDEX IF NOT EXISTS CONCURRENTLY IF NOT EXISTS idx_pr_recent_by_repo 
ON pull_requests (repository_id, created_at DESC);

COMMENT ON INDEX idx_pr_recent_by_repo IS 'Index for efficient recent PR lookups by repository';

COMMIT;
-- Migration: Optimize spam query performance for PR #1334
-- Description: Adds indexes to support spam tab filtering and sorting
-- Related: WorkspaceSpamTab component queries

-- Drop unused spam-related indexes
DROP INDEX IF EXISTS idx_pull_requests_spam_detected;
DROP INDEX IF EXISTS idx_pull_requests_admin_review;

-- Add composite index for spam query pattern:
-- WHERE repository_id = X AND spam_score IS NOT NULL ORDER BY spam_score DESC
CREATE INDEX IF NOT EXISTS idx_pull_requests_spam_query 
ON pull_requests (repository_id, spam_score DESC NULLS LAST) 
WHERE spam_score IS NOT NULL;

-- Add indexes on foreign keys used in JOINs
CREATE INDEX IF NOT EXISTS idx_pull_requests_assignee_id ON pull_requests (assignee_id);
CREATE INDEX IF NOT EXISTS idx_pull_requests_merged_by_id ON pull_requests (merged_by_id);
CREATE INDEX IF NOT EXISTS idx_pull_requests_responded_by ON pull_requests (responded_by);

-- Add comment for future reference
COMMENT ON INDEX idx_pull_requests_spam_query IS 
'Composite index optimized for spam tab query pattern: filter by repository + sort by spam_score DESC';

-- Migration: Add original_commit_id column to comments table
-- Description: Adds missing original_commit_id column to support review comments
--              that track the original commit when a review comment is outdated
-- Related Issue: Review comments from GraphQL API include original commit reference

-- Add original_commit_id column to comments table
ALTER TABLE comments
ADD COLUMN IF NOT EXISTS original_commit_id TEXT;

-- Add index for better query performance when looking up comments by original commit
CREATE INDEX IF NOT EXISTS idx_comments_original_commit_id
ON comments(original_commit_id)
WHERE original_commit_id IS NOT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN comments.original_commit_id IS
'The original commit ID for review comments. Used when a review comment becomes outdated due to new commits.';

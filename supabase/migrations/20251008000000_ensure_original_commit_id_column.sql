-- Migration: Ensure original_commit_id column exists in comments table
-- Description: Fixes production error where original_commit_id column is missing
--              This column is needed for PR review comments from GraphQL API
-- Related Issue: https://github.com/bdougie/contributor.info/issues/1015
-- Date: 2025-10-08

-- Add original_commit_id column to comments table (idempotent)
ALTER TABLE public.comments
ADD COLUMN IF NOT EXISTS original_commit_id TEXT;

-- Add index for better query performance when looking up comments by original commit
-- Drop and recreate to ensure it exists with correct definition
DROP INDEX IF EXISTS idx_comments_original_commit_id;
CREATE INDEX idx_comments_original_commit_id
ON public.comments(original_commit_id)
WHERE original_commit_id IS NOT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.comments.original_commit_id IS
'The original commit ID for review comments. Used when a review comment becomes outdated due to new commits. Populated from GraphQL API pullRequest.reviewThreads.comments.originalCommit.oid field.';

-- Verify the column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'comments' 
    AND column_name = 'original_commit_id'
  ) THEN
    RAISE EXCEPTION 'Failed to add original_commit_id column to comments table';
  END IF;
  
  RAISE NOTICE 'Successfully verified original_commit_id column exists in comments table';
END $$;

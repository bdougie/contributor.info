-- Add repository_id column to comments table
-- This migration fixes the Inngest error: "Could not find the 'repository_id' column of 'comments' in the schema cache"
-- The column is needed to associate comments directly with repositories for better query performance

ALTER TABLE comments 
ADD COLUMN IF NOT EXISTS repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE;

-- Update existing comments to have repository_id from their pull request
UPDATE comments c
SET repository_id = pr.repository_id
FROM pull_requests pr
WHERE c.pull_request_id = pr.id
AND c.repository_id IS NULL;

-- Make the column NOT NULL after populating existing data
ALTER TABLE comments 
ALTER COLUMN repository_id SET NOT NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_comments_repository_id ON comments(repository_id);
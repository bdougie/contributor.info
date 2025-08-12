-- Add repository_id column to comments table
-- This migration fixes the Inngest error: "Could not find the 'repository_id' column of 'comments' in the schema cache"
-- The column is needed to associate comments directly with repositories for better query performance

-- Step 1: Add the column without the foreign key constraint
ALTER TABLE comments 
ADD COLUMN IF NOT EXISTS repository_id UUID;

-- Step 2: Update existing comments to have repository_id from their pull request
UPDATE comments c
SET repository_id = pr.repository_id
FROM pull_requests pr
WHERE c.pull_request_id = pr.id
AND c.repository_id IS NULL;

-- Step 3: Make the column NOT NULL after populating existing data
ALTER TABLE comments 
ALTER COLUMN repository_id SET NOT NULL;

-- Step 4: Add the foreign key constraint as a separate named constraint
-- This ensures the FK is created even if the column already existed
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_comments_repository'
        AND table_name = 'comments'
    ) THEN
        ALTER TABLE comments 
        ADD CONSTRAINT fk_comments_repository 
        FOREIGN KEY (repository_id) 
        REFERENCES repositories(id) 
        ON DELETE CASCADE;
    END IF;
END $$;

-- Step 5: Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_comments_repository_id ON comments(repository_id);
-- Add repository_id column to reviews table
-- This migration fixes the Inngest error: "Could not find the 'repository_id' column of 'reviews' in the schema cache"
-- The column is needed to associate reviews directly with repositories for better query performance
-- Follows the same pattern as comments table (20250812_add_repository_id_to_comments.sql)

-- Step 1: Add the column without the foreign key constraint
ALTER TABLE reviews
ADD COLUMN IF NOT EXISTS repository_id UUID;

-- Step 2: Update existing reviews to have repository_id from their pull request
UPDATE reviews r
SET repository_id = pr.repository_id
FROM pull_requests pr
WHERE r.pull_request_id = pr.id
AND r.repository_id IS NULL;

-- Step 3: Make the column NOT NULL after populating existing data
ALTER TABLE reviews
ALTER COLUMN repository_id SET NOT NULL;

-- Step 4: Add the foreign key constraint as a separate named constraint
-- This ensures the FK is created even if the column already existed
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_reviews_repository'
        AND table_name = 'reviews'
    ) THEN
        ALTER TABLE reviews
        ADD CONSTRAINT fk_reviews_repository
        FOREIGN KEY (repository_id)
        REFERENCES repositories(id)
        ON DELETE CASCADE;
    END IF;
END $$;

-- Step 5: Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_reviews_repository_id ON reviews(repository_id);

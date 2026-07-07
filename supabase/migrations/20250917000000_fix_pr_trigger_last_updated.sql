-- Fix PR trigger that's preventing inserts due to missing last_updated field
-- The update_last_updated_column() function expects a field that doesn't exist in pull_requests table

-- Add the missing last_updated field to pull_requests table
ALTER TABLE pull_requests
ADD COLUMN IF NOT EXISTS last_updated TIMESTAMPTZ DEFAULT NOW();

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_pull_requests_last_updated
ON pull_requests(last_updated);

-- Update comment to clarify the field's purpose
COMMENT ON COLUMN pull_requests.last_updated IS 'Timestamp when the PR record was last updated (different from last_synced_at which tracks sync operations)';

-- Optionally, if the trigger isn't needed for pull_requests, drop it
-- But keeping it for consistency with other tables
DO $$
BEGIN
    -- Check if trigger exists and recreate it properly
    IF EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_last_updated'
        AND tgrelid = 'pull_requests'::regclass
    ) THEN
        -- Trigger already exists, ensure it works with the new column
        NULL; -- No action needed, column addition fixes the issue
    ELSE
        -- Create trigger if it doesn't exist
        CREATE TRIGGER update_last_updated
        BEFORE UPDATE ON pull_requests
        FOR EACH ROW
        EXECUTE FUNCTION update_last_updated_column();
    END IF;
END $$;

-- Also ensure last_synced_at has an index for performance
CREATE INDEX IF NOT EXISTS idx_pull_requests_last_synced_at
ON pull_requests(last_synced_at);

-- Create composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_pull_requests_repo_created
ON pull_requests(repository_id, created_at DESC);

-- Add index for state-based queries
CREATE INDEX IF NOT EXISTS idx_pull_requests_state
ON pull_requests(state)
WHERE state IN ('open', 'closed');
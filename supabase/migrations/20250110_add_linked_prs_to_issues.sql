-- Add linked_prs column to issues table to store linked pull requests
-- This follows the same pattern as reviewer_data in pull_requests table

-- Add the column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'issues' 
        AND column_name = 'linked_prs'
    ) THEN
        ALTER TABLE issues 
        ADD COLUMN linked_prs JSONB;

        COMMENT ON COLUMN issues.linked_prs IS 'Cached linked pull requests from GitHub timeline API';
    END IF;
END $$;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_issues_linked_prs 
ON issues USING GIN (linked_prs);

-- Add last_synced_at column for tracking sync status
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'issues' 
        AND column_name = 'last_synced_at'
    ) THEN
        ALTER TABLE issues 
        ADD COLUMN last_synced_at TIMESTAMPTZ DEFAULT NOW();

        COMMENT ON COLUMN issues.last_synced_at IS 'Last time this issue was synced with GitHub API';

        -- Backfill for existing rows
        UPDATE issues SET last_synced_at = NOW() WHERE last_synced_at IS NULL;
    END IF;
END $$;

-- Add index for staleness checks
CREATE INDEX IF NOT EXISTS idx_issues_last_synced_at 
ON issues (last_synced_at);

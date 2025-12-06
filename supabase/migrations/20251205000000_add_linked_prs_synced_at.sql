-- Add linked_prs_synced_at column to track when linked PRs were last fetched
-- This allows us to skip fetching linked PRs for issues that were recently synced
-- Part of issue #1261: Cache linked PRs in database to reduce API calls

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'issues'
        AND column_name = 'linked_prs_synced_at'
    ) THEN
        ALTER TABLE issues
        ADD COLUMN linked_prs_synced_at TIMESTAMPTZ;

        COMMENT ON COLUMN issues.linked_prs_synced_at IS 'Last time linked PRs were fetched from GitHub GraphQL API for this issue';
    END IF;
END $$;

-- Add index for efficient staleness checks
CREATE INDEX IF NOT EXISTS idx_issues_linked_prs_synced_at
ON issues (linked_prs_synced_at);

-- Composite index for the common query pattern: open issues with stale linked_prs
CREATE INDEX IF NOT EXISTS idx_issues_state_linked_prs_synced
ON issues (state, linked_prs_synced_at)
WHERE state = 'open';

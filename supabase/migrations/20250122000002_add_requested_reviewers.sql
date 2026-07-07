-- Add table for tracking requested reviewers
-- This is separate from the reviews table which only contains submitted reviews

CREATE TABLE IF NOT EXISTS requested_reviewers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pull_request_id UUID NOT NULL REFERENCES pull_requests(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Prevent duplicate requested reviewers for the same PR
    UNIQUE(pull_request_id, reviewer_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_requested_reviewers_pull_request_id ON requested_reviewers(pull_request_id);
CREATE INDEX IF NOT EXISTS idx_requested_reviewers_reviewer_id ON requested_reviewers(reviewer_id);

-- Add RLS policies
ALTER TABLE requested_reviewers ENABLE ROW LEVEL SECURITY;

-- Allow all users to read requested reviewers
CREATE POLICY "requested_reviewers_read_policy" ON requested_reviewers
    FOR SELECT
    USING (true);

-- Only allow authenticated users to insert/update/delete
CREATE POLICY "requested_reviewers_write_policy" ON requested_reviewers
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- Add comment to table
COMMENT ON TABLE requested_reviewers IS 'Tracks reviewers who have been requested to review a pull request';
COMMENT ON COLUMN requested_reviewers.pull_request_id IS 'The pull request that needs review';
COMMENT ON COLUMN requested_reviewers.reviewer_id IS 'The contributor who has been requested to review';
COMMENT ON COLUMN requested_reviewers.requested_at IS 'When the review was requested';
-- Add responded_by and responded_at columns to pull_requests table
-- These columns track when a user marked a PR as responded to
-- This enables the Follow-ups feature to show PRs with new activity after response

-- Add responded_by column (references auth.users)
ALTER TABLE pull_requests
ADD COLUMN responded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add responded_at column (timestamp)
ALTER TABLE pull_requests
ADD COLUMN responded_at TIMESTAMP WITH TIME ZONE;

-- Add comments explaining these columns
COMMENT ON COLUMN pull_requests.responded_by IS 'User ID of the person who marked this PR as responded to';
COMMENT ON COLUMN pull_requests.responded_at IS 'Timestamp when user marked this PR as responded to';

-- Index for performance on follow-ups queries
CREATE INDEX idx_pull_requests_responded_by_updated_at
ON pull_requests(responded_by, updated_at DESC)
WHERE responded_by IS NOT NULL;

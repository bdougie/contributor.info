-- Add columns for storing PR reviewer data and sync metadata
ALTER TABLE pull_requests 
ADD COLUMN IF NOT EXISTS reviewer_data JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_pull_requests_last_synced 
  ON pull_requests(repository_id, last_synced_at DESC);

-- Create index for PR state queries
CREATE INDEX IF NOT EXISTS idx_pull_requests_state_updated 
  ON pull_requests(repository_id, state, updated_at DESC);

-- Create a function to check if PR data is stale
CREATE OR REPLACE FUNCTION is_pr_data_stale(
  last_sync TIMESTAMPTZ,
  max_age_minutes INT DEFAULT 60
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN (NOW() - last_sync) > (max_age_minutes || ' minutes')::INTERVAL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add comment for documentation
COMMENT ON COLUMN pull_requests.reviewer_data IS 'Stores reviewer and requested reviewer data from GitHub sync';
COMMENT ON COLUMN pull_requests.last_synced_at IS 'Timestamp of last sync from GitHub API';
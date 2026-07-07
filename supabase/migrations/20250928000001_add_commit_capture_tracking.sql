-- Add columns for tracking commit capture status
ALTER TABLE repositories
ADD COLUMN IF NOT EXISTS last_commit_capture_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS commit_capture_status TEXT NOT NULL DEFAULT 'pending' CHECK (commit_capture_status IN ('pending', 'processing', 'completed', 'failed'));

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_repositories_commit_capture
ON repositories (last_commit_capture_at, commit_capture_status);

-- Add comment for documentation
COMMENT ON COLUMN repositories.last_commit_capture_at IS 'Timestamp of the last successful commit capture for this repository';
COMMENT ON COLUMN repositories.commit_capture_status IS 'Current status of commit capture process for this repository';
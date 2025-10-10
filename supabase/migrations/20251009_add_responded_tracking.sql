-- Add responded tracking columns to issues and discussions tables
-- This allows maintainers to mark items as responded in their "My Work" section

-- Add responded_by and responded_at to issues table
ALTER TABLE issues
ADD COLUMN IF NOT EXISTS responded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ;

-- Add responded_by and responded_at to discussions table
ALTER TABLE discussions
ADD COLUMN IF NOT EXISTS responded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ;

-- Add indexes for efficient filtering in "My Work" queries
CREATE INDEX IF NOT EXISTS idx_issues_responded_by ON issues(responded_by) WHERE responded_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_discussions_responded_by ON discussions(responded_by) WHERE responded_by IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN issues.responded_by IS 'User ID of the maintainer who marked this issue as responded';
COMMENT ON COLUMN issues.responded_at IS 'Timestamp when the issue was marked as responded';
COMMENT ON COLUMN discussions.responded_by IS 'User ID of the maintainer who marked this discussion as responded';
COMMENT ON COLUMN discussions.responded_at IS 'Timestamp when the discussion was marked as responded';

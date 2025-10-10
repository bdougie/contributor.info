-- Migration: Fix respond tracking to use correct 'issues' table
-- Created: 2025-10-10
-- Purpose: Add responded_by and responded_at columns to the 'issues' table (not 'github_issues')
--
-- Context: PR #1060 added respond tracking, but the migration targeted 'github_issues' table
-- while the application code queries the 'issues' table. This migration fixes the discrepancy.

-- ============================================================================
-- ADD COLUMNS TO ISSUES TABLE
-- ============================================================================

-- Add responded_by column (references auth.users)
ALTER TABLE issues
ADD COLUMN IF NOT EXISTS responded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add responded_at timestamp
ALTER TABLE issues
ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ;

-- Add index for querying responded items
CREATE INDEX IF NOT EXISTS idx_issues_responded_by
ON issues(responded_by) WHERE responded_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_issues_responded_at
ON issues(responded_at DESC) WHERE responded_at IS NOT NULL;

-- Add composite index for filtering by repository and response status
CREATE INDEX IF NOT EXISTS idx_issues_repo_responded
ON issues(repository_id, responded_by) WHERE responded_by IS NOT NULL;

-- ============================================================================
-- TRIGGER FUNCTION TO RESTRICT COLUMN UPDATES
-- ============================================================================

-- Function to ensure only responded_by and responded_at can be updated in issues
CREATE OR REPLACE FUNCTION enforce_respond_columns_issues()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if any column other than responded_by and responded_at has changed
    IF (OLD.id IS DISTINCT FROM NEW.id OR
        OLD.github_id IS DISTINCT FROM NEW.github_id OR
        OLD.number IS DISTINCT FROM NEW.number OR
        OLD.title IS DISTINCT FROM NEW.title OR
        OLD.body IS DISTINCT FROM NEW.body OR
        OLD.state IS DISTINCT FROM NEW.state OR
        OLD.repository_id IS DISTINCT FROM NEW.repository_id OR
        OLD.author_id IS DISTINCT FROM NEW.author_id OR
        OLD.closed_at IS DISTINCT FROM NEW.closed_at OR
        OLD.labels IS DISTINCT FROM NEW.labels OR
        OLD.assignees IS DISTINCT FROM NEW.assignees OR
        OLD.comments_count IS DISTINCT FROM NEW.comments_count OR
        OLD.created_at IS DISTINCT FROM NEW.created_at OR
        OLD.updated_at IS DISTINCT FROM NEW.updated_at OR
        OLD.html_url IS DISTINCT FROM NEW.html_url) THEN

        RAISE EXCEPTION 'Only responded_by and responded_at columns can be updated by workspace members';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RLS POLICY FOR RESPOND FUNCTIONALITY
-- ============================================================================

-- Drop existing update policy if it exists to avoid conflicts
DROP POLICY IF EXISTS "Workspace members can mark issues as responded" ON issues;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS enforce_respond_columns_trigger ON issues;

-- ============================================================================
-- ISSUES: Allow workspace members to mark issues as responded
-- ============================================================================

CREATE POLICY "Workspace members can mark issues as responded"
ON issues FOR UPDATE
USING (
    -- User must be authenticated
    (SELECT auth.uid()) IS NOT NULL
    AND
    -- User must be a member of a workspace that contains this repository
    EXISTS (
        SELECT 1
        FROM workspace_repositories wr
        JOIN workspace_members wm ON wm.workspace_id = wr.workspace_id
        WHERE wr.repository_id = issues.repository_id
        AND wm.user_id = (SELECT auth.uid())
        AND wm.accepted_at IS NOT NULL
    )
)
WITH CHECK (
    -- User must be authenticated
    (SELECT auth.uid()) IS NOT NULL
    AND
    -- User must be a member of a workspace that contains this repository
    EXISTS (
        SELECT 1
        FROM workspace_repositories wr
        JOIN workspace_members wm ON wm.workspace_id = wr.workspace_id
        WHERE wr.repository_id = issues.repository_id
        AND wm.user_id = (SELECT auth.uid())
        AND wm.accepted_at IS NOT NULL
    )
    AND
    -- Only allow setting responded_by to the current user or NULL
    (responded_by = (SELECT auth.uid()) OR responded_by IS NULL)
);

-- Create trigger to enforce column restrictions
CREATE TRIGGER enforce_respond_columns_trigger
    BEFORE UPDATE ON issues
    FOR EACH ROW
    WHEN (
        -- Only run this trigger when the update is being done by a non-superuser
        -- (allows system processes and migrations to update all columns)
        (SELECT auth.uid()) IS NOT NULL
    )
    EXECUTE FUNCTION enforce_respond_columns_issues();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN issues.responded_by IS 'User ID of the workspace member who marked this issue as responded';
COMMENT ON COLUMN issues.responded_at IS 'Timestamp when this issue was marked as responded';

-- ============================================================================
-- VALIDATION
-- ============================================================================

DO $$
DECLARE
    issues_col_count INTEGER;
BEGIN
    -- Check if columns were added to issues
    SELECT COUNT(*) INTO issues_col_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'issues'
    AND column_name IN ('responded_by', 'responded_at');

    IF issues_col_count = 2 THEN
        RAISE NOTICE '✅ Respond logic migration fix completed successfully';
        RAISE NOTICE '   - Added responded_by and responded_at to issues table';
        RAISE NOTICE '   - Created indexes for performance';
        RAISE NOTICE '   - Applied RLS policies for workspace members';
    ELSE
        RAISE WARNING '⚠️ Migration validation failed - check column creation';
        RAISE WARNING '   issues columns: %', issues_col_count;
    END IF;
END $$;

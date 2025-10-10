-- Migration: Add respond logic to github_issues and discussions tables
-- Created: 2025-10-09
-- Purpose: Add responded_by and responded_at columns with workspace-based RLS policies
--
-- This migration:
-- 1. Adds responded_by (UUID) and responded_at (TIMESTAMPTZ) columns to github_issues and discussions
-- 2. Creates indexes for performance
-- 3. Implements RLS policies that only allow authenticated workspace members to mark items as responded

-- ============================================================================
-- ADD COLUMNS TO GITHUB_ISSUES
-- ============================================================================

-- Add responded_by column (references auth.users)
ALTER TABLE github_issues
ADD COLUMN IF NOT EXISTS responded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add responded_at timestamp
ALTER TABLE github_issues
ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ;

-- Add index for querying responded items
CREATE INDEX IF NOT EXISTS idx_github_issues_responded_by
ON github_issues(responded_by) WHERE responded_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_github_issues_responded_at
ON github_issues(responded_at DESC) WHERE responded_at IS NOT NULL;

-- Add composite index for filtering by repository and response status
CREATE INDEX IF NOT EXISTS idx_github_issues_repo_responded
ON github_issues(repository_id, responded_by) WHERE responded_by IS NOT NULL;

-- ============================================================================
-- ADD COLUMNS TO DISCUSSIONS
-- ============================================================================

-- Add responded_by column (references auth.users)
ALTER TABLE discussions
ADD COLUMN IF NOT EXISTS responded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add responded_at timestamp
ALTER TABLE discussions
ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ;

-- Add index for querying responded items
CREATE INDEX IF NOT EXISTS idx_discussions_responded_by
ON discussions(responded_by) WHERE responded_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_discussions_responded_at
ON discussions(responded_at DESC) WHERE responded_at IS NOT NULL;

-- Add composite index for filtering by repository and response status
CREATE INDEX IF NOT EXISTS idx_discussions_repo_responded
ON discussions(repository_id, responded_by) WHERE responded_by IS NOT NULL;

-- ============================================================================
-- TRIGGER FUNCTIONS TO RESTRICT COLUMN UPDATES
-- ============================================================================

-- Function to ensure only responded_by and responded_at can be updated in github_issues
CREATE OR REPLACE FUNCTION enforce_respond_columns_github_issues()
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
        OLD.closed_by_id IS DISTINCT FROM NEW.closed_by_id OR
        OLD.labels IS DISTINCT FROM NEW.labels OR
        OLD.assignees IS DISTINCT FROM NEW.assignees OR
        OLD.milestone IS DISTINCT FROM NEW.milestone OR
        OLD.comments_count IS DISTINCT FROM NEW.comments_count OR
        OLD.created_at IS DISTINCT FROM NEW.created_at OR
        OLD.updated_at IS DISTINCT FROM NEW.updated_at OR
        OLD.closed_at IS DISTINCT FROM NEW.closed_at OR
        OLD.html_url IS DISTINCT FROM NEW.html_url OR
        OLD.is_pull_request IS DISTINCT FROM NEW.is_pull_request OR
        OLD.linked_pr_id IS DISTINCT FROM NEW.linked_pr_id OR
        OLD._dlt_load_id IS DISTINCT FROM NEW._dlt_load_id OR
        OLD._dlt_id IS DISTINCT FROM NEW._dlt_id) THEN

        RAISE EXCEPTION 'Only responded_by and responded_at columns can be updated by workspace members';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to ensure only responded_by and responded_at can be updated in discussions
CREATE OR REPLACE FUNCTION enforce_respond_columns_discussions()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if any column other than responded_by and responded_at has changed
    -- Using a dynamic approach to avoid listing all columns
    IF (row(OLD.*) IS DISTINCT FROM row(NEW.*)) THEN
        -- Verify that ONLY responded_by or responded_at changed
        IF NOT (
            OLD.responded_by IS DISTINCT FROM NEW.responded_by OR
            OLD.responded_at IS DISTINCT FROM NEW.responded_at
        ) THEN
            -- Some other column changed when responded columns didn't change
            RAISE EXCEPTION 'Only responded_by and responded_at columns can be updated by workspace members';
        END IF;

        -- Reset all non-respond columns to their original values
        NEW.id := OLD.id;
        NEW.github_id := OLD.github_id;
        NEW.number := OLD.number;
        NEW.title := OLD.title;
        NEW.body := OLD.body;
        NEW.repository_id := OLD.repository_id;
        NEW.author_id := OLD.author_id;
        NEW.category := OLD.category;
        NEW.is_answered := OLD.is_answered;
        NEW.answer_chosen_at := OLD.answer_chosen_at;
        NEW.answer_chosen_by_id := OLD.answer_chosen_by_id;
        NEW.created_at := OLD.created_at;
        NEW.updated_at := OLD.updated_at;
        NEW.html_url := OLD.html_url;
        NEW._dlt_load_id := OLD._dlt_load_id;
        NEW._dlt_id := OLD._dlt_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RLS POLICIES FOR RESPOND FUNCTIONALITY
-- ============================================================================

-- Drop existing update policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Workspace members can mark issues as responded" ON github_issues;
DROP POLICY IF EXISTS "Workspace members can mark discussions as responded" ON discussions;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS enforce_respond_columns_trigger ON github_issues;
DROP TRIGGER IF EXISTS enforce_respond_columns_trigger ON discussions;

-- ============================================================================
-- GITHUB_ISSUES: Allow workspace members to mark issues as responded
-- ============================================================================

CREATE POLICY "Workspace members can mark issues as responded"
ON github_issues FOR UPDATE
USING (
    -- User must be authenticated
    (SELECT auth.uid()) IS NOT NULL
    AND
    -- User must be a member of a workspace that contains this repository
    EXISTS (
        SELECT 1
        FROM workspace_repositories wr
        JOIN workspace_members wm ON wm.workspace_id = wr.workspace_id
        WHERE wr.repository_id = github_issues.repository_id
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
        WHERE wr.repository_id = github_issues.repository_id
        AND wm.user_id = (SELECT auth.uid())
        AND wm.accepted_at IS NOT NULL
    )
    AND
    -- Only allow setting responded_by to the current user or NULL
    (responded_by = (SELECT auth.uid()) OR responded_by IS NULL)
);

-- Create trigger to enforce column restrictions
CREATE TRIGGER enforce_respond_columns_trigger
    BEFORE UPDATE ON github_issues
    FOR EACH ROW
    WHEN (
        -- Only run this trigger when the update is being done by a non-superuser
        -- (allows system processes and migrations to update all columns)
        (SELECT auth.uid()) IS NOT NULL
    )
    EXECUTE FUNCTION enforce_respond_columns_github_issues();

-- ============================================================================
-- DISCUSSIONS: Allow workspace members to mark discussions as responded
-- ============================================================================

CREATE POLICY "Workspace members can mark discussions as responded"
ON discussions FOR UPDATE
USING (
    -- User must be authenticated
    (SELECT auth.uid()) IS NOT NULL
    AND
    -- User must be a member of a workspace that contains this repository
    EXISTS (
        SELECT 1
        FROM workspace_repositories wr
        JOIN workspace_members wm ON wm.workspace_id = wr.workspace_id
        WHERE wr.repository_id = discussions.repository_id
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
        WHERE wr.repository_id = discussions.repository_id
        AND wm.user_id = (SELECT auth.uid())
        AND wm.accepted_at IS NOT NULL
    )
    AND
    -- Only allow setting responded_by to the current user or NULL
    (responded_by = (SELECT auth.uid()) OR responded_by IS NULL)
);

-- Create trigger to enforce column restrictions
CREATE TRIGGER enforce_respond_columns_trigger
    BEFORE UPDATE ON discussions
    FOR EACH ROW
    WHEN (
        -- Only run this trigger when the update is being done by a non-superuser
        -- (allows system processes and migrations to update all columns)
        (SELECT auth.uid()) IS NOT NULL
    )
    EXECUTE FUNCTION enforce_respond_columns_discussions();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN github_issues.responded_by IS 'User ID of the workspace member who marked this issue as responded';
COMMENT ON COLUMN github_issues.responded_at IS 'Timestamp when this issue was marked as responded';

COMMENT ON COLUMN discussions.responded_by IS 'User ID of the workspace member who marked this discussion as responded';
COMMENT ON COLUMN discussions.responded_at IS 'Timestamp when this discussion was marked as responded';

-- ============================================================================
-- VALIDATION
-- ============================================================================

DO $$
DECLARE
    issues_col_count INTEGER;
    discussions_col_count INTEGER;
BEGIN
    -- Check if columns were added to github_issues
    SELECT COUNT(*) INTO issues_col_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'github_issues'
    AND column_name IN ('responded_by', 'responded_at');

    -- Check if columns were added to discussions
    SELECT COUNT(*) INTO discussions_col_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'discussions'
    AND column_name IN ('responded_by', 'responded_at');

    IF issues_col_count = 2 AND discussions_col_count = 2 THEN
        RAISE NOTICE '✅ Respond logic migration completed successfully';
        RAISE NOTICE '   - Added responded_by and responded_at to github_issues';
        RAISE NOTICE '   - Added responded_by and responded_at to discussions';
        RAISE NOTICE '   - Created indexes for performance';
        RAISE NOTICE '   - Applied RLS policies for workspace members';
    ELSE
        RAISE WARNING '⚠️ Migration validation failed - check column creation';
        RAISE WARNING '   github_issues columns: %', issues_col_count;
        RAISE WARNING '   discussions columns: %', discussions_col_count;
    END IF;
END $$;

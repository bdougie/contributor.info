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
-- RLS POLICIES FOR RESPOND FUNCTIONALITY
-- ============================================================================

-- Drop existing update policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Workspace members can mark issues as responded" ON github_issues;
DROP POLICY IF EXISTS "Workspace members can mark discussions as responded" ON discussions;

-- ============================================================================
-- GITHUB_ISSUES: Allow workspace members to mark issues as responded
-- ============================================================================

CREATE POLICY "Workspace members can mark issues as responded"
ON github_issues FOR UPDATE
USING (
    -- User must be authenticated
    auth.uid() IS NOT NULL
    AND
    -- User must be a member of a workspace that contains this repository
    EXISTS (
        SELECT 1
        FROM workspace_repositories wr
        JOIN workspace_members wm ON wm.workspace_id = wr.workspace_id
        WHERE wr.repository_id = github_issues.repository_id
        AND wm.user_id = auth.uid()
        AND wm.accepted_at IS NOT NULL
    )
)
WITH CHECK (
    -- User must be authenticated
    auth.uid() IS NOT NULL
    AND
    -- User must be a member of a workspace that contains this repository
    EXISTS (
        SELECT 1
        FROM workspace_repositories wr
        JOIN workspace_members wm ON wm.workspace_id = wr.workspace_id
        WHERE wr.repository_id = github_issues.repository_id
        AND wm.user_id = auth.uid()
        AND wm.accepted_at IS NOT NULL
    )
    AND
    -- Only allow updating responded_by and responded_at columns
    (responded_by = auth.uid() OR responded_by IS NULL)
);

-- ============================================================================
-- DISCUSSIONS: Allow workspace members to mark discussions as responded
-- ============================================================================

CREATE POLICY "Workspace members can mark discussions as responded"
ON discussions FOR UPDATE
USING (
    -- User must be authenticated
    auth.uid() IS NOT NULL
    AND
    -- User must be a member of a workspace that contains this repository
    EXISTS (
        SELECT 1
        FROM workspace_repositories wr
        JOIN workspace_members wm ON wm.workspace_id = wr.workspace_id
        WHERE wr.repository_id = discussions.repository_id
        AND wm.user_id = auth.uid()
        AND wm.accepted_at IS NOT NULL
    )
)
WITH CHECK (
    -- User must be authenticated
    auth.uid() IS NOT NULL
    AND
    -- User must be a member of a workspace that contains this repository
    EXISTS (
        SELECT 1
        FROM workspace_repositories wr
        JOIN workspace_members wm ON wm.workspace_id = wr.workspace_id
        WHERE wr.repository_id = discussions.repository_id
        AND wm.user_id = auth.uid()
        AND wm.accepted_at IS NOT NULL
    )
    AND
    -- Only allow updating responded_by and responded_at columns
    (responded_by = auth.uid() OR responded_by IS NULL)
);

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

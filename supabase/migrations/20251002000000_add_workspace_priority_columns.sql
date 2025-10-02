-- Migration: Add workspace priority tracking to tracked_repositories
-- Created: 2025-10-02
-- Purpose: Support workspace-based repository prioritization system
-- Related: PR #907 - Workspace repository prioritization (Phase 2)

-- Step 1: Create repository_priority enum if it doesn't exist
DO $$ BEGIN
  CREATE TYPE repository_priority AS ENUM ('high', 'medium', 'low');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Step 2: Add workspace tracking columns
ALTER TABLE tracked_repositories
  ADD COLUMN IF NOT EXISTS is_workspace_repo BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS workspace_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS priority repository_priority DEFAULT 'medium';

-- Step 3: Create indexes for optimized priority queries
CREATE INDEX IF NOT EXISTS idx_tracked_repos_workspace_priority
  ON tracked_repositories (is_workspace_repo, priority, tracking_enabled);

CREATE INDEX IF NOT EXISTS idx_tracked_repositories_priority
  ON tracked_repositories (priority);

CREATE INDEX IF NOT EXISTS idx_tracked_repositories_size_priority
  ON tracked_repositories (size, priority);

-- Step 4: Backfill workspace repositories with high priority
-- Repositories in workspaces should have is_workspace_repo=true and priority=high
UPDATE tracked_repositories tr
SET
  is_workspace_repo = true,
  workspace_count = (
    SELECT COUNT(DISTINCT wr.workspace_id)
    FROM workspace_repositories wr
    WHERE wr.repository_id = tr.repository_id
  ),
  priority = 'high'
WHERE EXISTS (
  SELECT 1
  FROM workspace_repositories wr
  WHERE wr.repository_id = tr.repository_id
)
AND (is_workspace_repo IS NULL OR is_workspace_repo = false);

-- Step 5: Add comment for documentation
COMMENT ON COLUMN tracked_repositories.is_workspace_repo IS
  'Indicates if repository is in any workspace (updated by WorkspacePrioritySync)';

COMMENT ON COLUMN tracked_repositories.workspace_count IS
  'Number of workspaces this repository is in (updated by WorkspacePrioritySync)';

COMMENT ON COLUMN tracked_repositories.priority IS
  'Processing priority: high (workspace repos), medium (tracked-only), low (background tasks)';

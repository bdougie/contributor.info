-- Migration: Auto-sync workspace_tracked_repositories when repos are added/removed via UI
--
-- Root cause: The app writes to workspace_repositories (display junction table) but never
-- populates workspace_tracked_repositories (sync scheduling table). The cron that syncs
-- issues queries workspace_tracked_repositories — which has zero rows — so it always no-ops.
--
-- This migration:
-- 1. Creates a trigger function to sync workspace_tracked_repositories on INSERT/DELETE
-- 2. Backfills existing workspace_repositories entries that are missing from workspace_tracked_repositories

-- =============================================================================
-- 1. Trigger function: sync workspace_tracked_repositories on workspace_repositories changes
-- =============================================================================

CREATE OR REPLACE FUNCTION sync_workspace_tracked_repositories()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tracked_repo_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Look up tracked_repositories.id via repository_id
    SELECT id INTO v_tracked_repo_id
    FROM tracked_repositories
    WHERE repository_id = NEW.repository_id;

    IF v_tracked_repo_id IS NULL THEN
      RAISE NOTICE 'No tracked_repository found for repository_id %. Skipping workspace_tracked_repositories sync.', NEW.repository_id;
      RETURN NEW;
    END IF;

    -- Insert into workspace_tracked_repositories with sensible defaults
    INSERT INTO workspace_tracked_repositories (
      workspace_id,
      tracked_repository_id,
      added_by,
      fetch_issues,
      fetch_commits,
      fetch_reviews,
      fetch_comments,
      sync_frequency_hours,
      priority_score,
      next_sync_at,
      is_active
    ) VALUES (
      NEW.workspace_id,
      v_tracked_repo_id,
      NEW.added_by,
      TRUE,
      TRUE,
      TRUE,
      TRUE,
      24,
      50,
      NOW(),  -- Trigger immediate first sync
      TRUE
    )
    ON CONFLICT (workspace_id, tracked_repository_id) DO NOTHING;

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    -- Look up tracked_repositories.id via repository_id
    SELECT id INTO v_tracked_repo_id
    FROM tracked_repositories
    WHERE repository_id = OLD.repository_id;

    IF v_tracked_repo_id IS NULL THEN
      RETURN OLD;
    END IF;

    -- Only delete if the repo isn't referenced by any other workspace
    IF NOT EXISTS (
      SELECT 1
      FROM workspace_repositories
      WHERE repository_id = OLD.repository_id
        AND workspace_id != OLD.workspace_id
    ) THEN
      DELETE FROM workspace_tracked_repositories
      WHERE workspace_id = OLD.workspace_id
        AND tracked_repository_id = v_tracked_repo_id;
    END IF;

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

-- =============================================================================
-- 2. Create the trigger on workspace_repositories
-- =============================================================================

DROP TRIGGER IF EXISTS trg_sync_workspace_tracked_repos ON workspace_repositories;

CREATE TRIGGER trg_sync_workspace_tracked_repos
  AFTER INSERT OR DELETE ON workspace_repositories
  FOR EACH ROW
  EXECUTE FUNCTION sync_workspace_tracked_repositories();

-- =============================================================================
-- 3. Backfill: insert workspace_tracked_repositories for existing workspace_repositories
--    that don't already have a corresponding entry
-- =============================================================================

INSERT INTO workspace_tracked_repositories (
  workspace_id,
  tracked_repository_id,
  added_by,
  fetch_issues,
  fetch_commits,
  fetch_reviews,
  fetch_comments,
  sync_frequency_hours,
  priority_score,
  next_sync_at,
  is_active
)
SELECT
  wr.workspace_id,
  tr.id,
  wr.added_by,
  TRUE,
  TRUE,
  TRUE,
  TRUE,
  24,
  50,
  NOW(),
  TRUE
FROM workspace_repositories wr
JOIN tracked_repositories tr ON tr.repository_id = wr.repository_id
LEFT JOIN workspace_tracked_repositories wtr
  ON wtr.workspace_id = wr.workspace_id
  AND wtr.tracked_repository_id = tr.id
WHERE wtr.id IS NULL
ON CONFLICT (workspace_id, tracked_repository_id) DO NOTHING;

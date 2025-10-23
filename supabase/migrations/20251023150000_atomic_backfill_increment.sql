-- Migration: Add atomic increment functions for workspace backfill progress
-- Created: 2025-10-23
-- Description: Prevents race conditions when multiple repositories complete concurrently

-- Function to atomically increment completed repositories count
CREATE OR REPLACE FUNCTION increment_completed_repositories(p_job_id uuid)
RETURNS TABLE (
  completed_repositories integer,
  failed_repositories integer,
  total_repositories integer
) AS $$
DECLARE
  v_result RECORD;
BEGIN
  -- Atomically increment and return the updated values
  UPDATE workspace_backfill_jobs
  SET
    completed_repositories = completed_repositories + 1,
    updated_at = NOW()
  WHERE id = p_job_id
  RETURNING
    workspace_backfill_jobs.completed_repositories,
    workspace_backfill_jobs.failed_repositories,
    workspace_backfill_jobs.total_repositories
  INTO v_result;

  -- Return the result
  RETURN QUERY SELECT
    v_result.completed_repositories,
    v_result.failed_repositories,
    v_result.total_repositories;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to atomically increment failed repositories count
CREATE OR REPLACE FUNCTION increment_failed_repositories(p_job_id uuid)
RETURNS TABLE (
  completed_repositories integer,
  failed_repositories integer,
  total_repositories integer
) AS $$
DECLARE
  v_result RECORD;
BEGIN
  -- Atomically increment and return the updated values
  UPDATE workspace_backfill_jobs
  SET
    failed_repositories = failed_repositories + 1,
    updated_at = NOW()
  WHERE id = p_job_id
  RETURNING
    workspace_backfill_jobs.completed_repositories,
    workspace_backfill_jobs.failed_repositories,
    workspace_backfill_jobs.total_repositories
  INTO v_result;

  -- Return the result
  RETURN QUERY SELECT
    v_result.completed_repositories,
    v_result.failed_repositories,
    v_result.total_repositories;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION increment_completed_repositories(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_failed_repositories(uuid) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION increment_completed_repositories IS 'Atomically increments the completed repositories count for a backfill job, preventing race conditions';
COMMENT ON FUNCTION increment_failed_repositories IS 'Atomically increments the failed repositories count for a backfill job, preventing race conditions';

-- Migration: Add unique constraint for workspace backfill jobs
-- Created: 2025-10-23
-- Description: Prevents duplicate active backfill jobs per workspace/addon combination

-- Drop existing constraint if it exists (for idempotency)
ALTER TABLE workspace_backfill_jobs
DROP CONSTRAINT IF EXISTS unique_active_workspace_backfill;

-- Add unique constraint to prevent multiple pending/in_progress jobs for same workspace + addon
-- This constraint only applies when status is 'pending' or 'in_progress'
-- Completed/failed/canceled jobs can coexist
CREATE UNIQUE INDEX unique_active_workspace_backfill
ON workspace_backfill_jobs (workspace_id, subscription_addon_id)
WHERE status IN ('pending', 'in_progress');

-- Add comment for documentation
COMMENT ON INDEX unique_active_workspace_backfill IS 'Ensures only one active backfill job exists per workspace and addon combination, preventing race conditions from concurrent webhook deliveries';

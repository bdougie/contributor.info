-- Fix chart failures by syncing PR count columns and clearing stuck sync statuses
-- Addresses GitHub issue #694

-- Step 1: Refresh repository PR counts to ensure accuracy
SELECT refresh_all_repository_pull_request_counts();

-- Step 2: Sync total_pull_requests column to match pull_request_count
UPDATE repositories 
SET total_pull_requests = pull_request_count 
WHERE total_pull_requests != pull_request_count 
   OR total_pull_requests IS NULL;

-- Step 3: Clear any stuck sync statuses that prevent frontend from showing charts
UPDATE github_sync_status 
SET sync_status = 'completed',
    last_sync_at = NOW(),
    updated_at = NOW()
WHERE sync_status = 'in_progress' 
  AND last_sync_at < NOW() - INTERVAL '1 hour';
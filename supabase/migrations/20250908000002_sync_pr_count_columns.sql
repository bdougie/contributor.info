-- Sync total_pull_requests with pull_request_count to fix chart failures
-- Addresses GitHub issue #694

-- Step 1: Refresh repository PR counts to ensure accuracy
SELECT refresh_all_repository_pull_request_counts();

-- Step 2: Sync total_pull_requests column to match pull_request_count
UPDATE repositories 
SET total_pull_requests = pull_request_count 
WHERE total_pull_requests != pull_request_count 
   OR total_pull_requests IS NULL;
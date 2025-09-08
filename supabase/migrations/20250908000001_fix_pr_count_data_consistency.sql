-- Fix PR count data consistency issue
-- Addresses: Self Selection and Contributor Confidence charts failing due to 
-- inconsistent data between pull_request_count and total_pull_requests columns

-- Step 1: Refresh all repository PR counts to get accurate data
SELECT refresh_all_repository_pull_request_counts();

-- Step 2: Update total_pull_requests to match pull_request_count
-- This ensures both columns have the same accurate data
UPDATE repositories 
SET total_pull_requests = pull_request_count 
WHERE total_pull_requests != pull_request_count 
   OR total_pull_requests IS NULL;
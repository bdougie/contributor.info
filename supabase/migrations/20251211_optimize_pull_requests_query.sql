-- Add index for fetching PRs by repository and updated_at (used in workspace PRs tab)
CREATE INDEX IF NOT EXISTS idx_pull_requests_repo_updated
ON public.pull_requests (repository_id, updated_at DESC);

-- Note: idx_pull_requests_last_synced (repository_id, last_synced_at DESC) already exists
-- in 20240124_add_pr_reviewer_data.sql, no duplicate index needed

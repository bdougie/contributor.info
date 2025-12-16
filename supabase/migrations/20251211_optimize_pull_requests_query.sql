-- Add index for fetching PRs by repository and updated_at (used in workspace PRs tab)
CREATE INDEX IF NOT EXISTS idx_pull_requests_repo_updated
ON public.pull_requests (repository_id, updated_at DESC);

-- Add index for last_synced_at to speed up staleness check
CREATE INDEX IF NOT EXISTS idx_pull_requests_repo_synced
ON public.pull_requests (repository_id, last_synced_at);

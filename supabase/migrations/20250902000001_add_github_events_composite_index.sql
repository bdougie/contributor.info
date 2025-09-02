-- Add composite index for better query performance on github_events_cache table
-- This index optimizes queries that filter by repository and sort by created_at

CREATE INDEX IF NOT EXISTS idx_github_events_cache_repo_created 
  ON public.github_events_cache(repository_owner, repository_name, created_at DESC);

-- Add comment for documentation
COMMENT ON INDEX idx_github_events_cache_repo_created IS 'Composite index for efficient repository-specific event queries sorted by time';
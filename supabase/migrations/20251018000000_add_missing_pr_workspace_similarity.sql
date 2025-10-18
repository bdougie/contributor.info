-- Migration: Add missing find_similar_pull_requests_in_workspace function
-- Issue: #1128 - Include closed PRs in similarity search embeddings
-- Created: 2025-10-18
--
-- This migration adds the missing find_similar_pull_requests_in_workspace function
-- that enables PR similarity search across workspace repositories.
-- The function includes ALL PRs (open, closed, merged) in similarity search results.

-- ============================================================================
-- FUNCTION: find_similar_pull_requests_in_workspace
-- ============================================================================

CREATE OR REPLACE FUNCTION find_similar_pull_requests_in_workspace(
  query_embedding vector(384),
  repo_ids uuid[],
  match_count int DEFAULT 5,
  exclude_pr_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  number int,
  title text,
  state text,
  merged_at timestamptz,
  similarity float,
  html_url text,
  repository_name text
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pr.id,
    pr.number,
    pr.title,
    pr.state,
    pr.merged_at,
    (1 - (pr.embedding <=> query_embedding))::float as similarity,
    CONCAT('https://github.com/', r.full_name, '/pull/', pr.number) as html_url,
    r.full_name as repository_name
  FROM pull_requests pr
  JOIN repositories r ON pr.repository_id = r.id
  WHERE
    pr.repository_id = ANY(repo_ids)
    AND pr.embedding IS NOT NULL
    AND (exclude_pr_id IS NULL OR pr.id != exclude_pr_id)
  ORDER BY pr.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION find_similar_pull_requests_in_workspace(vector, uuid[], int, uuid) TO authenticated;

-- Grant to anonymous users for public repositories
GRANT EXECUTE ON FUNCTION find_similar_pull_requests_in_workspace(vector, uuid[], int, uuid) TO anon;

-- Grant to service role for backend operations
GRANT EXECUTE ON FUNCTION find_similar_pull_requests_in_workspace(vector, uuid[], int, uuid) TO service_role;

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION find_similar_pull_requests_in_workspace IS 
'Find pull requests similar to a query embedding within specified workspace repositories. Includes ALL PRs regardless of state (open, closed, merged) for comprehensive similarity search.';

-- ============================================================================
-- VALIDATION
-- ============================================================================

DO $$
DECLARE
  function_exists BOOLEAN;
BEGIN
  -- Check if function was created successfully
  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'find_similar_pull_requests_in_workspace'
  ) INTO function_exists;

  IF function_exists THEN
    RAISE NOTICE '✅ Function find_similar_pull_requests_in_workspace created successfully';
    RAISE NOTICE '   - Includes ALL PRs (open, closed, merged) in similarity search';
    RAISE NOTICE '   - Works across multiple workspace repositories';
    RAISE NOTICE '   - Permissions granted to authenticated, anon, and service_role';
  ELSE
    RAISE WARNING '⚠️ Function creation validation failed';
  END IF;
END $$;
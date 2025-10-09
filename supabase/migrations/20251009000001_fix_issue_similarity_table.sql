-- Fix find_similar_issues_in_workspace to use 'issues' table instead of 'github_issues'
-- The 'issues' table has embeddings, 'github_issues' does not

CREATE OR REPLACE FUNCTION find_similar_issues_in_workspace(
  query_embedding vector(384),
  repo_ids uuid[],
  match_count int DEFAULT 5,
  exclude_issue_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  number int,
  title text,
  state text,
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
    i.id,
    i.number,
    i.title,
    i.state,
    (1 - (i.embedding <=> query_embedding))::float as similarity,
    CONCAT('https://github.com/', r.full_name, '/issues/', i.number) as html_url,
    r.full_name as repository_name
  FROM issues i
  JOIN repositories r ON i.repository_id = r.id
  WHERE
    i.repository_id = ANY(repo_ids)
    AND i.embedding IS NOT NULL
    AND (exclude_issue_id IS NULL OR i.id != exclude_issue_id)
  ORDER BY i.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION find_similar_issues_in_workspace(vector, uuid[], int, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION find_similar_issues_in_workspace(vector, uuid[], int, uuid) TO anon;
GRANT EXECUTE ON FUNCTION find_similar_issues_in_workspace(vector, uuid[], int, uuid) TO service_role;

COMMENT ON FUNCTION find_similar_issues_in_workspace IS
  'Find similar issues within workspace repositories using vector similarity. Uses the issues table which has embeddings.';

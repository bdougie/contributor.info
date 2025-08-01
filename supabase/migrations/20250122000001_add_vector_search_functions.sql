-- Migration: Add vector search functions for issue/PR similarity
-- These functions enable semantic search using pgvector

-- Function to find similar issues using vector similarity
CREATE OR REPLACE FUNCTION find_similar_issues(
  query_embedding vector(1536),
  match_count int,
  repo_id uuid
)
RETURNS TABLE (
  id uuid,
  number int,
  title text,
  state text,
  similarity float,
  created_at timestamptz,
  html_url text
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
    1 - (i.embedding <=> query_embedding) as similarity,
    i.created_at,
    CONCAT('https://github.com/', r.full_name, '/issues/', i.number) as html_url
  FROM issues i
  JOIN repositories r ON i.repository_id = r.id
  WHERE 
    i.repository_id = repo_id
    AND i.embedding IS NOT NULL
  ORDER BY i.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to find similar pull requests using vector similarity
CREATE OR REPLACE FUNCTION find_similar_pull_requests(
  query_embedding vector(1536),
  match_count int,
  repo_id uuid,
  exclude_pr_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  number int,
  title text,
  state text,
  merged_at timestamptz,
  similarity float,
  created_at timestamptz,
  html_url text
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
    1 - (pr.embedding <=> query_embedding) as similarity,
    pr.created_at,
    CONCAT('https://github.com/', r.full_name, '/pull/', pr.number) as html_url
  FROM pull_requests pr
  JOIN repositories r ON pr.repository_id = r.id
  WHERE 
    pr.repository_id = repo_id
    AND pr.embedding IS NOT NULL
    AND (exclude_pr_id IS NULL OR pr.id != exclude_pr_id)
  ORDER BY pr.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION find_similar_issues(vector, int, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION find_similar_pull_requests(vector, int, uuid, uuid) TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION find_similar_issues IS 'Find issues similar to a given embedding vector using cosine similarity';
COMMENT ON FUNCTION find_similar_pull_requests IS 'Find pull requests similar to a given embedding vector using cosine similarity';
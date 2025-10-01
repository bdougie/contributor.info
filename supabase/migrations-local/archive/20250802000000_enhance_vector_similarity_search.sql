-- Local-safe version of 20250802000000_enhance_vector_similarity_search.sql
-- Generated: 2025-08-27T02:47:08.055Z
-- This migration has been modified to work without auth, roles, and extensions
-- Original migration may have different behavior in production

-- Transaction wrapper for safety
BEGIN;


-- Ensure anon exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon;
    RAISE NOTICE 'Created missing role: anon';
  END IF;
END $$;

-- Ensure authenticated exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated;
    RAISE NOTICE 'Created missing role: authenticated';
  END IF;
END $$;DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    

-- Migration: Enhanced vector similarity search functions
-- Adds similarity threshold filtering and performance improvements
-- for the issue similarity search feature

-- Enhanced function to find similar issues with similarity threshold
CREATE OR REPLACE FUNCTION find_similar_issues(
  query_embedding vector(384),
  match_count int DEFAULT 5,
  repo_id uuid DEFAULT NULL,
  similarity_threshold float DEFAULT 0.7,
  exclude_issue_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  github_id bigint,
  number int,
  title text,
  body_snippet text,
  state text,
  similarity float,
  created_at timestamptz,
  updated_at timestamptz,
  html_url text,
  author_login text
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.github_id,
    i.number,
    i.title,
    -- Return first 200 characters of body as snippet
    CASE 
      WHEN i.body IS NOT NULL AND LENGTH(i.body) > 200 
      THEN LEFT(i.body, 200) || '...'
      ELSE i.body
    END as body_snippet,
    i.state,
    (1 - (i.embedding <=> query_embedding))::float as similarity,
    i.created_at,
    i.updated_at,
    CONCAT('https://github.com/', r.full_name, '/issues/', i.number) as html_url,
    c.login as author_login
  FROM issues i
  JOIN repositories r ON i.repository_id = r.id
  LEFT JOIN contributors c ON i.author_id = c.id
  WHERE 
    i.embedding IS NOT NULL
    AND (repo_id IS NULL OR i.repository_id = repo_id)
    AND (exclude_issue_id IS NULL OR i.id != exclude_issue_id)
    AND (1 - (i.embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY i.embedding <=> query_embedding
  LIMIT match_count;
  ELSE
    RAISE NOTICE 'Extension vector not available, skipping dependent code';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error with vector extension: %', SQLERRM;
END $$;
END;
$$;DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    

-- Enhanced function for cross-repository similarity search
-- Useful for finding similar issues across an organization's repositories
CREATE OR REPLACE FUNCTION find_similar_issues_cross_repo(
  query_embedding vector(384),
  organization_name text,
  match_count int DEFAULT 5,
  similarity_threshold float DEFAULT 0.7,
  exclude_issue_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  github_id bigint,
  number int,
  title text,
  body_snippet text,
  state text,
  similarity float,
  created_at timestamptz,
  updated_at timestamptz,
  html_url text,
  author_login text,
  repository_name text,
  repository_full_name text
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.github_id,
    i.number,
    i.title,
    -- Return first 200 characters of body as snippet
    CASE 
      WHEN i.body IS NOT NULL AND LENGTH(i.body) > 200 
      THEN LEFT(i.body, 200) || '...'
      ELSE i.body
    END as body_snippet,
    i.state,
    (1 - (i.embedding <=> query_embedding))::float as similarity,
    i.created_at,
    i.updated_at,
    CONCAT('https://github.com/', r.full_name, '/issues/', i.number) as html_url,
    c.login as author_login,
    r.name as repository_name,
    r.full_name as repository_full_name
  FROM issues i
  JOIN repositories r ON i.repository_id = r.id
  LEFT JOIN contributors c ON i.author_id = c.id
  WHERE 
    i.embedding IS NOT NULL
    AND r.full_name LIKE (organization_name || '/%')
    AND (exclude_issue_id IS NULL OR i.id != exclude_issue_id)
    AND (1 - (i.embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY i.embedding <=> query_embedding
  LIMIT match_count;
  ELSE
    RAISE NOTICE 'Extension vector not available, skipping dependent code';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error with vector extension: %', SQLERRM;
END $$;
END;
$$;DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    

-- Function to find the most similar issue for a given text input
-- This is useful for duplicate detection
CREATE OR REPLACE FUNCTION find_most_similar_issue(
  query_embedding vector(384),
  repo_id uuid,
  exclude_issue_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  github_id bigint,
  number int,
  title text,
  similarity float,
  html_url text,
  is_duplicate_likely boolean
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.github_id,
    i.number,
    i.title,
    (1 - (i.embedding <=> query_embedding))::float as similarity,
    CONCAT('https://github.com/', r.full_name, '/issues/', i.number) as html_url,
    -- Consider similarity > 0.85 as likely duplicate
    (1 - (i.embedding <=> query_embedding)) > 0.85 as is_duplicate_likely
  FROM issues i
  JOIN repositories r ON i.repository_id = r.id
  WHERE 
    i.repository_id = repo_id
    AND i.embedding IS NOT NULL
    AND (exclude_issue_id IS NULL OR i.id != exclude_issue_id)
  ORDER BY i.embedding <=> query_embedding
  LIMIT 1;
  ELSE
    RAISE NOTICE 'Extension vector not available, skipping dependent code';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error with vector extension: %', SQLERRM;
END $$;
END;
$$;

-- Function to get similarity statistics for a repository
-- Useful for understanding the embedding quality and coverage
CREATE OR REPLACE FUNCTION get_repository_embedding_stats(repo_id uuid)
RETURNS TABLE (
  total_issues bigint,
  issues_with_embeddings bigint,
  embedding_coverage_percent numeric,
  avg_embedding_age_days numeric,
  oldest_embedding_date timestamptz,
  newest_embedding_date timestamptz
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_issues,
    COUNT(embedding) as issues_with_embeddings,
    ROUND((COUNT(embedding)::numeric / COUNT(*)::numeric) * 100, 2) as embedding_coverage_percent,
    ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - embedding_generated_at)) / 86400), 1) as avg_embedding_age_days,
    MIN(embedding_generated_at) as oldest_embedding_date,
    MAX(embedding_generated_at) as newest_embedding_date
  FROM issues
  WHERE repository_id = repo_id;
END;
$$;

-- Optimized function for batch similarity comparisons
-- Useful for finding clusters of similar issues
CREATE OR REPLACE FUNCTION find_issue_clusters(
  repo_id uuid,
  similarity_threshold float DEFAULT 0.8,
  min_cluster_size int DEFAULT 2
)
RETURNS TABLE (
  issue_id uuid,
  issue_number int,
  issue_title text,
  cluster_id int,
  cluster_size int,
  avg_similarity_in_cluster float
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  rec RECORD;
  cluster_counter int := 0;
  temp_cluster_id int;
BEGIN
  -- Create temporary table to store cluster assignments
  CREATE TEMP TABLE IF NOT EXISTS issue_clusters (
    issue_id uuid,
    issue_number int,
    issue_title text,
    cluster_id int,
    similarity float
  );

  -- Simple clustering: for each issue, find similar ones
  FOR rec IN 
    SELECT i.id, i.number, i.title, i.embedding
    FROM issues i
    WHERE i.repository_id = repo_id AND i.embedding IS NOT NULL
    ORDER BY i.created_at
  LOOP
    -- Check if this issue is already assigned to a cluster
    SELECT c.cluster_id INTO temp_cluster_id 
    FROM issue_clusters c 
    WHERE c.issue_id = rec.id;
    
    IF temp_cluster_id IS NULL THEN
      -- Start a new cluster
      cluster_counter := cluster_counter + 1;
      
      -- Add all similar issues to this cluster
      INSERT INTO issue_clusters (issue_id, issue_number, issue_title, cluster_id, similarity)
      SELECT 
        i.id,
        i.number,
        i.title,
        cluster_counter,
        (1 - (i.embedding <=> rec.embedding))::float
      FROM issues i
      WHERE 
        i.repository_id = repo_id
        AND i.embedding IS NOT NULL
        AND (1 - (i.embedding <=> rec.embedding)) >= similarity_threshold
        AND NOT EXISTS (
          SELECT 1 FROM issue_clusters c2 WHERE c2.issue_id = i.id
        );
    END IF;
  END LOOP;

  -- Return clusters with minimum size
  RETURN QUERY
  SELECT 
    c.issue_id,
    c.issue_number,
    c.issue_title,
    c.cluster_id,
    cluster_sizes.cluster_size,
    cluster_averages.avg_similarity
  FROM issue_clusters c
  JOIN (
    SELECT cluster_id, COUNT(*) as cluster_size
    FROM issue_clusters
    GROUP BY cluster_id
    HAVING COUNT(*) >= min_cluster_size
  ) cluster_sizes ON c.cluster_id = cluster_sizes.cluster_id
  JOIN (
    SELECT cluster_id, AVG(similarity) as avg_similarity
    FROM issue_clusters
    GROUP BY cluster_id
  ) cluster_averages ON c.cluster_id = cluster_averages.cluster_id
  ORDER BY c.cluster_id, c.similarity DESC;

  -- Clean up
  DROP TABLE IF EXISTS issue_clusters;
END;
$$;DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    

-- Add performance indexes for the new functionality
CREATE INDEX IF NOT EXISTS idx_issues_embedding_cosine_threshold 
ON issues USING ivfflat (embedding vector_cosine_ops) WITH (lists = 200)
WHERE embedding IS NOT NULL;
  ELSE
    RAISE NOTICE 'Extension vector not available, skipping dependent code';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error with vector extension: %', SQLERRM;
END $$;

-- Add index for repository lookups in cross-repo searches
CREATE INDEX IF NOT EXISTS idx_repositories_full_name_prefix 
ON repositories (full_name text_pattern_ops);DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    

-- DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION find_similar_issues(vector, int, uuid, float, uuid) TO authenticated;
  ELSE
    RAISE NOTICE 'Extension vector not available, skipping dependent code';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error with vector extension: %', SQLERRM;
END $$;
  ELSE
    RAISE NOTICE 'Role authenticated not found, skipping grant';
  END IF;
END $;DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION find_similar_issues_cross_repo(vector, text, int, float, uuid) TO authenticated;
  ELSE
    RAISE NOTICE 'Extension vector not available, skipping dependent code';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error with vector extension: %', SQLERRM;
END $$;
  ELSE
    RAISE NOTICE 'Role authenticated not found, skipping grant';
  END IF;
END $;DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION find_most_similar_issue(vector, uuid, uuid) TO authenticated;
  ELSE
    RAISE NOTICE 'Extension vector not available, skipping dependent code';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error with vector extension: %', SQLERRM;
END $$;
  ELSE
    RAISE NOTICE 'Role authenticated not found, skipping grant';
  END IF;
END $;
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION get_repository_embedding_stats(uuid) TO authenticated;
  ELSE
    RAISE NOTICE 'Role authenticated not found, skipping grant';
  END IF;
END $;
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION find_issue_clusters(uuid, float, int) TO authenticated;
  ELSE
    RAISE NOTICE 'Role authenticated not found, skipping grant';
  END IF;
END $;DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    

-- Also DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    grant to anonymous users for public repositories
GRANT EXECUTE ON FUNCTION find_similar_issues(vector, int, uuid, float, uuid) TO anon;
  ELSE
    RAISE NOTICE 'Extension vector not available, skipping dependent code';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error with vector extension: %', SQLERRM;
END $$;
  ELSE
    RAISE NOTICE 'Role anon not found, skipping grant';
  END IF;
END $;DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT EXECUTE ON FUNCTION find_similar_issues_cross_repo(vector, text, int, float, uuid) TO anon;
  ELSE
    RAISE NOTICE 'Extension vector not available, skipping dependent code';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error with vector extension: %', SQLERRM;
END $$;
  ELSE
    RAISE NOTICE 'Role anon not found, skipping grant';
  END IF;
END $;DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT EXECUTE ON FUNCTION find_most_similar_issue(vector, uuid, uuid) TO anon;
  ELSE
    RAISE NOTICE 'Extension vector not available, skipping dependent code';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error with vector extension: %', SQLERRM;
END $$;
  ELSE
    RAISE NOTICE 'Role anon not found, skipping grant';
  END IF;
END $;
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT EXECUTE ON FUNCTION get_repository_embedding_stats(uuid) TO anon;
  ELSE
    RAISE NOTICE 'Role anon not found, skipping grant';
  END IF;
END $;

-- Add comprehensive documentation
COMMENT ON FUNCTION find_similar_issues IS 'Enhanced function to find issues similar to a query embedding with similarity threshold filtering, optional repository scoping, and detailed metadata';DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    
COMMENT ON FUNCTION find_similar_issues_cross_repo IS 'Find similar issues across all repositories in an organization using vector similarity';
  ELSE
    RAISE NOTICE 'Extension vector not available, skipping dependent code';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error with vector extension: %', SQLERRM;
END $$;
COMMENT ON FUNCTION find_most_similar_issue IS 'Find the single most similar issue, useful for duplicate detection with confidence scoring';
COMMENT ON FUNCTION get_repository_embedding_stats IS 'Get embedding coverage statistics for a repository to monitor data quality';
COMMENT ON FUNCTION find_issue_clusters IS 'Find clusters of similar issues within a repository using similarity threshold-based grouping';

-- Create a helper view for common similarity search scenarios
CREATE OR REPLACE VIEW similar_issues_with_metadata AS
SELECT 
  i.id,
  i.github_id,
  i.repository_id,
  i.number,
  i.title,
  i.body,
  i.state,
  i.created_at,
  i.updated_at,
  i.embedding,
  r.full_name as repository_full_name,
  r.name as repository_name,
  c.login as author_login,
  CONCAT('https://github.com/', r.full_name, '/issues/', i.number) as html_url
FROM issues i
JOIN repositories r ON i.repository_id = r.id
LEFT JOIN contributors c ON i.author_id = c.id
WHERE i.embedding IS NOT NULL;

COMMENT ON VIEW similar_issues_with_metadata IS 'Pre-joined view of issues with embeddings and all related metadata for similarity searches';

COMMIT;

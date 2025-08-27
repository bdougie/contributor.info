-- Local-safe version of 20250122000001_add_vector_search_functions.sql
-- Generated: 2025-08-27T02:47:08.044Z
-- This migration has been modified to work without auth, roles, and extensions
-- Original migration may have different behavior in production

-- Transaction wrapper for safety
BEGIN;


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
    

-- DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION find_similar_issues(vector, int, uuid) TO authenticated;
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
    GRANT EXECUTE ON FUNCTION find_similar_pull_requests(vector, int, uuid, uuid) TO authenticated;
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
    

-- Add comments for documentation
COMMENT ON FUNCTION find_similar_issues IS 'Find issues similar to a given embedding vector using cosine similarity';
  ELSE
    RAISE NOTICE 'Extension vector not available, skipping dependent code';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error with vector extension: %', SQLERRM;
END $$;DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    
COMMENT ON FUNCTION find_similar_pull_requests IS 'Find pull requests similar to a given embedding vector using cosine similarity';
  ELSE
    RAISE NOTICE 'Extension vector not available, skipping dependent code';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error with vector extension: %', SQLERRM;
END $$;

COMMIT;
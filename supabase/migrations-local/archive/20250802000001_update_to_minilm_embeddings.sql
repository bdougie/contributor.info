-- Local-safe version of 20250802000001_update_to_minilm_embeddings.sql
-- Generated: 2025-08-27T02:47:08.056Z
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
    

-- Migration: Update from OpenAI embeddings (1536 dims) to MiniLM embeddings (384 dims)
-- This migration updates all vector columns and functions to use 384-dimensional embeddings

-- First, drop existing columns and recreate with new dimensions
-- Note: This will delete existing embeddings, they'll need to be regenerated

-- Update issues table
ALTER TABLE issues DROP COLUMN IF EXISTS embedding CASCADE;
  ELSE
    RAISE NOTICE 'Extension vector not available, skipping dependent code';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error with vector extension: %', SQLERRM;
END $$;DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    
ALTER TABLE issues ADD COLUMN embedding VECTOR(384);
  ELSE
    RAISE NOTICE 'Extension vector not available, skipping dependent code';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error with vector extension: %', SQLERRM;
END $$;

-- Update pull_requests table  
ALTER TABLE pull_requests DROP COLUMN IF EXISTS embedding CASCADE;DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    
ALTER TABLE pull_requests ADD COLUMN embedding VECTOR(384);
  ELSE
    RAISE NOTICE 'Extension vector not available, skipping dependent code';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error with vector extension: %', SQLERRM;
END $$;

-- Update repositories table (if it has embeddings)
ALTER TABLE repositories DROP COLUMN IF EXISTS embedding CASCADE;DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    
ALTER TABLE repositories ADD COLUMN embedding VECTOR(384);
  ELSE
    RAISE NOTICE 'Extension vector not available, skipping dependent code';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error with vector extension: %', SQLERRM;
END $$;

-- Drop and recreate indexes with new dimensions
DROP INDEX IF EXISTS idx_issues_embedding;
DROP INDEX IF EXISTS idx_pull_requests_embedding;
DROP INDEX IF EXISTS idx_issues_embedding_cosine_threshold;DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    

-- Recreate indexes for 384-dimensional vectors
CREATE INDEX IF NOT EXISTS idx_issues_embedding 
ON issues USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
WHERE embedding IS NOT NULL;
  ELSE
    RAISE NOTICE 'Extension vector not available, skipping dependent code';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error with vector extension: %', SQLERRM;
END $$;DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    

CREATE INDEX IF NOT EXISTS idx_pull_requests_embedding 
ON pull_requests USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
WHERE embedding IS NOT NULL;
  ELSE
    RAISE NOTICE 'Extension vector not available, skipping dependent code';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error with vector extension: %', SQLERRM;
END $$;DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    

-- Update all vector search functions to use 384 dimensions
DROP FUNCTION IF EXISTS find_similar_issues(vector, int, uuid, float, uuid);
  ELSE
    RAISE NOTICE 'Extension vector not available, skipping dependent code';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error with vector extension: %', SQLERRM;
END $$;DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    
DROP FUNCTION IF EXISTS find_similar_issues_cross_repo(vector, text, int, float, uuid);
  ELSE
    RAISE NOTICE 'Extension vector not available, skipping dependent code';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error with vector extension: %', SQLERRM;
END $$;DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    
DROP FUNCTION IF EXISTS find_most_similar_issue(vector, uuid, uuid);
  ELSE
    RAISE NOTICE 'Extension vector not available, skipping dependent code';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error with vector extension: %', SQLERRM;
END $$;DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    
DROP FUNCTION IF EXISTS find_similar_pull_requests(vector, int, uuid, uuid);
  ELSE
    RAISE NOTICE 'Extension vector not available, skipping dependent code';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error with vector extension: %', SQLERRM;
END $$;DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    

-- Recreate find_similar_issues with 384 dimensions
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
    

-- Recreate find_similar_issues_cross_repo with 384 dimensions
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
    AND r.full_name ILIKE (organization_name || '/%')
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
    

-- Recreate find_most_similar_issue with 384 dimensions
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
$$;DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    

-- Create similar function for pull requests
CREATE OR REPLACE FUNCTION find_similar_pull_requests(
  query_embedding vector(384),
  match_count int DEFAULT 5,
  repo_id uuid DEFAULT NULL,
  exclude_pr_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  github_id bigint,
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
    pr.github_id,
    pr.number,
    pr.title,
    pr.state,
    pr.merged_at,
    (1 - (pr.embedding <=> query_embedding))::float as similarity,
    pr.created_at,
    CONCAT('https://github.com/', r.full_name, '/pull/', pr.number) as html_url
  FROM pull_requests pr
  JOIN repositories r ON pr.repository_id = r.id
  WHERE 
    pr.embedding IS NOT NULL
    AND (repo_id IS NULL OR pr.repository_id = repo_id)
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
    Grant permissions
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
    

DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
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
END $;DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT EXECUTE ON FUNCTION find_similar_pull_requests(vector, int, uuid, uuid) TO anon;
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
    

-- Add comments
COMMENT ON COLUMN issues.embedding IS 'MiniLM embedding vector for semantic search (384 dimensions)';
  ELSE
    RAISE NOTICE 'Extension vector not available, skipping dependent code';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error with vector extension: %', SQLERRM;
END $$;DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    
COMMENT ON COLUMN pull_requests.embedding IS 'MiniLM embedding vector for semantic search (384 dimensions)';
  ELSE
    RAISE NOTICE 'Extension vector not available, skipping dependent code';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error with vector extension: %', SQLERRM;
END $$;DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    
COMMENT ON COLUMN repositories.embedding IS 'MiniLM embedding vector for semantic search (384 dimensions)';
  ELSE
    RAISE NOTICE 'Extension vector not available, skipping dependent code';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error with vector extension: %', SQLERRM;
END $$;

-- Note: After this migration, all embeddings need to be regenerated using the new MiniLM model

COMMIT;

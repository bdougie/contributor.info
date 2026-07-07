-- Migration: Add workspace discussion similarity search function
-- Issue: #1011 - Type mismatch in find_similar_discussions_in_workspace function
-- Created: 2025-10-07
--
-- This migration adds:
-- 1. Embedding column to discussions table for vector similarity search
-- 2. A vector similarity search function for discussions within workspaces
-- 3. Uses VARCHAR for exclude_discussion_id to match discussions.id type (GitHub GraphQL node IDs)

-- ============================================================================
-- SCHEMA UPDATES: Add embedding columns to discussions
-- ============================================================================

-- Add embedding column to discussions table
ALTER TABLE discussions
ADD COLUMN IF NOT EXISTS embedding vector(384),
ADD COLUMN IF NOT EXISTS embedding_generated_at timestamptz;

-- Add index for vector similarity searches
CREATE INDEX IF NOT EXISTS idx_discussions_embedding
ON discussions USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100)
WHERE embedding IS NOT NULL;

-- Add index for embedding generation tracking
CREATE INDEX IF NOT EXISTS idx_discussions_embedding_generated_at
ON discussions(embedding_generated_at)
WHERE embedding_generated_at IS NOT NULL;

COMMENT ON COLUMN discussions.embedding IS 'Vector embedding (384 dimensions) for semantic similarity search using MiniLM model';
COMMENT ON COLUMN discussions.embedding_generated_at IS 'Timestamp when the embedding was generated';

-- ============================================================================
-- FUNCTION: find_similar_discussions_in_workspace
-- ============================================================================

CREATE OR REPLACE FUNCTION find_similar_discussions_in_workspace(
  query_embedding vector(384),
  repo_ids uuid[],
  match_count integer DEFAULT 5,
  exclude_discussion_id varchar DEFAULT NULL  -- VARCHAR to match discussions.id type
)
RETURNS TABLE (
  id varchar,
  github_id varchar,
  repository_id uuid,
  number integer,
  title text,
  body_snippet text,
  category_name varchar,
  category_emoji varchar,
  author_login varchar,
  similarity float,
  created_at timestamptz,
  updated_at timestamptz,
  url varchar,
  is_answered boolean,
  upvote_count integer,
  comment_count integer
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.github_id,
    d.repository_id,
    d.number,
    d.title,
    -- Return first 200 characters of body as snippet
    CASE 
      WHEN d.body IS NOT NULL AND LENGTH(d.body) > 200 
      THEN LEFT(d.body, 200) || '...'
      ELSE d.body
    END as body_snippet,
    d.category_name,
    d.category_emoji,
    d.author_login,
    (1 - (d.embedding <=> query_embedding))::float as similarity,
    d.created_at,
    d.updated_at,
    d.url,
    d.is_answered,
    d.upvote_count,
    d.comment_count
  FROM discussions d
  WHERE 
    d.embedding IS NOT NULL
    AND d.repository_id = ANY(repo_ids)
    AND (exclude_discussion_id IS NULL OR d.id != exclude_discussion_id)
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION find_similar_discussions_in_workspace(vector, uuid[], integer, varchar) TO authenticated;

-- Grant to anonymous users for public repositories
GRANT EXECUTE ON FUNCTION find_similar_discussions_in_workspace(vector, uuid[], integer, varchar) TO anon;

-- Grant to service role for backend operations
GRANT EXECUTE ON FUNCTION find_similar_discussions_in_workspace(vector, uuid[], integer, varchar) TO service_role;

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION find_similar_discussions_in_workspace IS 
'Find discussions similar to a query embedding within specified workspace repositories. Uses VARCHAR for exclude_discussion_id to match discussions.id type (GitHub GraphQL node IDs like "D_kwDOJm0kOc4AiTSy").';

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
    AND p.proname = 'find_similar_discussions_in_workspace'
  ) INTO function_exists;

  IF function_exists THEN
    RAISE NOTICE '✅ Function find_similar_discussions_in_workspace created successfully';
    RAISE NOTICE '   - Uses VARCHAR for exclude_discussion_id (matches discussions.id type)';
    RAISE NOTICE '   - Permissions granted to authenticated, anon, and service_role';
  ELSE
    RAISE WARNING '⚠️ Function creation validation failed';
  END IF;
END $$;

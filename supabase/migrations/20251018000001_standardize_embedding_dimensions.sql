-- Migration: Standardize embedding dimensions to 384 across all entities
-- Issue: #1112 - Standardize embedding dimensions across issues, PRs, and discussions
-- Created: 2025-10-18
--
-- This migration standardizes all embeddings to 384 dimensions (MiniLM model):
-- 1. Updates similarity_cache table from VECTOR(1536) to VECTOR(384)
-- 2. Resolves discussions table dimension conflicts
-- 3. Updates all similarity search functions to use consistent dimensions
-- 4. Fixes schema type mismatches (UUID vs VARCHAR)

-- ============================================================================
-- STEP 1: Backup and clear existing embeddings
-- ============================================================================

-- Clear existing similarity cache (will be regenerated with new dimensions)
DELETE FROM similarity_cache;

-- Clear existing embeddings in all tables (will be regenerated)
UPDATE issues SET embedding = NULL, embedding_generated_at = NULL;
UPDATE pull_requests SET embedding = NULL, embedding_generated_at = NULL;
UPDATE discussions SET embedding = NULL, embedding_generated_at = NULL;

-- ============================================================================
-- STEP 2: Update similarity_cache table structure
-- ============================================================================

-- Drop the old embedding column and create a new one with 384 dimensions
ALTER TABLE similarity_cache DROP COLUMN IF EXISTS embedding;
ALTER TABLE similarity_cache ADD COLUMN embedding VECTOR(384);

-- Recreate the vector similarity index
DROP INDEX IF EXISTS idx_similarity_cache_embedding;
CREATE INDEX idx_similarity_cache_embedding
ON similarity_cache USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100)
WHERE embedding IS NOT NULL;

-- Update item_id column to support both UUID and VARCHAR types
-- This is needed because discussions use VARCHAR IDs but issues/PRs use UUID
ALTER TABLE similarity_cache ALTER COLUMN item_id TYPE TEXT;

-- Update the constraint to include discussions
ALTER TABLE similarity_cache
DROP CONSTRAINT IF EXISTS similarity_cache_item_type_check;

ALTER TABLE similarity_cache
ADD CONSTRAINT similarity_cache_item_type_check
CHECK (item_type IN ('issue', 'pull_request', 'discussion'));

-- ============================================================================
-- STEP 3: Standardize discussions table embeddings
-- ============================================================================

-- Drop any conflicting embedding columns
ALTER TABLE discussions DROP COLUMN IF EXISTS embedding;
ALTER TABLE discussions DROP COLUMN IF EXISTS embedding_generated_at;
ALTER TABLE discussions DROP COLUMN IF EXISTS content_hash;

-- Add standardized embedding columns (384 dimensions)
ALTER TABLE discussions
ADD COLUMN embedding VECTOR(384),
ADD COLUMN embedding_generated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN content_hash TEXT;

-- Recreate the vector similarity index for discussions
DROP INDEX IF EXISTS idx_discussions_embedding;
CREATE INDEX idx_discussions_embedding
ON discussions USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100)
WHERE embedding IS NOT NULL;

-- ============================================================================
-- STEP 4: Update all embedding columns to 384 dimensions
-- ============================================================================

-- Issues table
ALTER TABLE issues DROP COLUMN IF EXISTS embedding;
ALTER TABLE issues ADD COLUMN embedding VECTOR(384);

-- Pull requests table  
ALTER TABLE pull_requests DROP COLUMN IF EXISTS embedding;
ALTER TABLE pull_requests ADD COLUMN embedding VECTOR(384);

-- Recreate vector indexes for issues and pull_requests
DROP INDEX IF EXISTS idx_issues_embedding;
CREATE INDEX idx_issues_embedding
ON issues USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100)
WHERE embedding IS NOT NULL;

DROP INDEX IF EXISTS idx_pull_requests_embedding;
CREATE INDEX idx_pull_requests_embedding
ON pull_requests USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100)
WHERE embedding IS NOT NULL;

-- ============================================================================
-- STEP 5: Update similarity search functions
-- ============================================================================

-- Update find_similar_issues function to use 384 dimensions
CREATE OR REPLACE FUNCTION find_similar_issues(
    target_issue_id UUID,
    limit_count INTEGER DEFAULT 5
)
RETURNS TABLE (
    issue_id UUID,
    title TEXT,
    state TEXT,
    number INTEGER,
    similarity_score FLOAT
) AS $$
BEGIN
    RETURN QUERY
    WITH target_embedding AS (
        SELECT embedding
        FROM issues
        WHERE id = target_issue_id
        AND embedding IS NOT NULL
        LIMIT 1
    )
    SELECT
        i.id AS issue_id,
        i.title,
        i.state,
        i.number,
        1 - (i.embedding <=> te.embedding) AS similarity_score
    FROM issues i
    CROSS JOIN target_embedding te
    WHERE i.id != target_issue_id
    AND i.embedding IS NOT NULL
    ORDER BY i.embedding <=> te.embedding
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- The workspace similarity functions are already correct (using vector(384))
-- No need to update:
-- - find_similar_issues_in_workspace
-- - find_similar_pull_requests_in_workspace  
-- - find_similar_discussions_in_workspace

-- ============================================================================
-- STEP 6: Update items_needing_embeddings view
-- ============================================================================

-- Drop and recreate the items_needing_embeddings view
DROP VIEW IF EXISTS items_needing_embeddings;

CREATE OR REPLACE VIEW items_needing_embeddings AS
SELECT
    'issue' as item_type,
    id::text as id,  -- Cast to TEXT for consistency across all types
    repository_id,
    title,
    body,
    created_at,
    embedding_generated_at,
    content_hash
FROM issues
WHERE (embedding IS NULL OR embedding_generated_at < updated_at)
AND created_at > NOW() - INTERVAL '90 days'

UNION ALL

SELECT
    'pull_request' as item_type,
    id::text as id,  -- Cast to TEXT for consistency across all types
    repository_id,
    title,
    body,
    created_at,
    embedding_generated_at,
    content_hash
FROM pull_requests
WHERE (embedding IS NULL OR embedding_generated_at < updated_at)
AND created_at > NOW() - INTERVAL '90 days'

UNION ALL

SELECT
    'discussion' as item_type,
    id as id,  -- Already VARCHAR/TEXT
    repository_id,
    title,
    body,
    created_at,
    embedding_generated_at,
    content_hash
FROM discussions
WHERE (embedding IS NULL OR embedding_generated_at < updated_at)
AND created_at > NOW() - INTERVAL '90 days'

ORDER BY created_at DESC
LIMIT 100;

-- ============================================================================
-- STEP 7: Create cross-entity similarity function
-- ============================================================================

-- New function to find similar items across all entity types
CREATE OR REPLACE FUNCTION find_similar_items_cross_entity(
    query_embedding VECTOR(384),
    repo_ids UUID[],
    match_count INTEGER DEFAULT 5,
    exclude_item_type TEXT DEFAULT NULL,
    exclude_item_id TEXT DEFAULT NULL
)
RETURNS TABLE (
    item_type TEXT,
    id TEXT,
    title TEXT,
    number INTEGER,
    similarity FLOAT,
    url TEXT,
    state TEXT,
    repository_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'issue'::TEXT as item_type,
        i.id::TEXT as id,
        i.title,
        i.number,
        (1 - (i.embedding <=> query_embedding))::FLOAT as similarity,
        CONCAT('https://github.com/', r.full_name, '/issues/', i.number) as url,
        i.state,
        r.full_name as repository_name
    FROM issues i
    JOIN repositories r ON i.repository_id = r.id
    WHERE i.repository_id = ANY(repo_ids)
    AND i.embedding IS NOT NULL
    AND NOT (exclude_item_type IS NOT DISTINCT FROM 'issue' AND exclude_item_id IS NOT DISTINCT FROM i.id::TEXT)
    
    UNION ALL
    
    SELECT 
        'pull_request'::TEXT as item_type,
        pr.id::TEXT as id,
        pr.title,
        pr.number,
        (1 - (pr.embedding <=> query_embedding))::FLOAT as similarity,
        CONCAT('https://github.com/', r.full_name, '/pull/', pr.number) as url,
        pr.state,
        r.full_name as repository_name
    FROM pull_requests pr
    JOIN repositories r ON pr.repository_id = r.id
    WHERE pr.repository_id = ANY(repo_ids)
    AND pr.embedding IS NOT NULL
    AND NOT (exclude_item_type IS NOT DISTINCT FROM 'pull_request' AND exclude_item_id IS NOT DISTINCT FROM pr.id::TEXT)
    
    UNION ALL
    
    SELECT 
        'discussion'::TEXT as item_type,
        d.id as id,
        d.title,
        d.number,
        (1 - (d.embedding <=> query_embedding))::FLOAT as similarity,
        d.url,
        CASE WHEN d.is_answered THEN 'answered' ELSE 'open' END as state,
        r.full_name as repository_name
    FROM discussions d
    JOIN repositories r ON d.repository_id = r.id
    WHERE d.repository_id = ANY(repo_ids)
    AND d.embedding IS NOT NULL
    AND NOT (exclude_item_type IS NOT DISTINCT FROM 'discussion' AND exclude_item_id IS NOT DISTINCT FROM d.id)
    
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions for the new function
GRANT EXECUTE ON FUNCTION find_similar_items_cross_entity(VECTOR, UUID[], INTEGER, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION find_similar_items_cross_entity(VECTOR, UUID[], INTEGER, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION find_similar_items_cross_entity(VECTOR, UUID[], INTEGER, TEXT, TEXT) TO service_role;

-- ============================================================================
-- STEP 8: Update comments and documentation
-- ============================================================================

COMMENT ON TABLE similarity_cache IS 'Caches embeddings for issues, pull requests, and discussions (384 dimensions)';
COMMENT ON COLUMN similarity_cache.embedding IS 'Vector embedding (384 dimensions) for semantic similarity search using MiniLM model';
COMMENT ON COLUMN similarity_cache.item_id IS 'Item identifier (TEXT to support both UUID and VARCHAR types)';

COMMENT ON COLUMN issues.embedding IS 'Vector embedding (384 dimensions) for semantic similarity search using MiniLM model';
COMMENT ON COLUMN pull_requests.embedding IS 'Vector embedding (384 dimensions) for semantic similarity search using MiniLM model';
COMMENT ON COLUMN discussions.embedding IS 'Vector embedding (384 dimensions) for semantic similarity search using MiniLM model';

COMMENT ON FUNCTION find_similar_items_cross_entity IS 'Find similar items across all entity types (issues, pull requests, discussions) within workspace repositories using 384-dimension embeddings';

-- ============================================================================
-- VALIDATION
-- ============================================================================

DO $$
DECLARE
  cache_embedding_dims INTEGER;
  issues_embedding_dims INTEGER;
  prs_embedding_dims INTEGER;
  discussions_embedding_dims INTEGER;
  cross_function_exists BOOLEAN;
BEGIN
  -- Check embedding dimensions in all tables
  SELECT atttypmod INTO cache_embedding_dims
  FROM pg_attribute a
  JOIN pg_class c ON a.attrelid = c.oid
  WHERE c.relname = 'similarity_cache' AND a.attname = 'embedding';
  
  SELECT atttypmod INTO issues_embedding_dims
  FROM pg_attribute a
  JOIN pg_class c ON a.attrelid = c.oid
  WHERE c.relname = 'issues' AND a.attname = 'embedding';
  
  SELECT atttypmod INTO prs_embedding_dims
  FROM pg_attribute a
  JOIN pg_class c ON a.attrelid = c.oid
  WHERE c.relname = 'pull_requests' AND a.attname = 'embedding';
  
  SELECT atttypmod INTO discussions_embedding_dims
  FROM pg_attribute a
  JOIN pg_class c ON a.attrelid = c.oid
  WHERE c.relname = 'discussions' AND a.attname = 'embedding';

  -- Check if cross-entity function exists
  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'find_similar_items_cross_entity'
  ) INTO cross_function_exists;

  IF cache_embedding_dims = 388 AND issues_embedding_dims = 388 AND 
     prs_embedding_dims = 388 AND discussions_embedding_dims = 388 AND
     cross_function_exists THEN
    RAISE NOTICE '✅ Embedding dimensions standardization completed successfully';
    RAISE NOTICE '   - All tables now use 384-dimension embeddings';
    RAISE NOTICE '   - similarity_cache supports both UUID and VARCHAR item IDs';
    RAISE NOTICE '   - Cross-entity similarity search function created';
    RAISE NOTICE '   - All existing embeddings cleared for regeneration';
  ELSE
    RAISE WARNING '⚠️ Migration validation failed - check embedding dimensions and function creation';
    RAISE NOTICE 'Debug: cache=%,issues=%,prs=%,discussions=%,cross_func=%', 
                 cache_embedding_dims, issues_embedding_dims, prs_embedding_dims, 
                 discussions_embedding_dims, cross_function_exists;
  END IF;
END $$;
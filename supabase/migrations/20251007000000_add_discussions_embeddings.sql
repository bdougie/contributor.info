-- Migration: Add embedding support for discussions
-- This enables semantic search for discussions alongside issues and PRs
-- Related: Issue #1009 - Embedding generation system not running

-- Add embedding columns to discussions table
ALTER TABLE discussions
ADD COLUMN IF NOT EXISTS embedding VECTOR(1536),
ADD COLUMN IF NOT EXISTS embedding_generated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- Add comments for documentation
COMMENT ON COLUMN discussions.embedding IS 'OpenAI embedding vector for semantic search (1536 dimensions)';
COMMENT ON COLUMN discussions.embedding_generated_at IS 'Timestamp when embedding was last generated';
COMMENT ON COLUMN discussions.content_hash IS 'Hash of title+body to detect content changes';

-- Create vector similarity index for discussions
CREATE INDEX IF NOT EXISTS idx_discussions_embedding
ON discussions USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
WHERE embedding IS NOT NULL;

-- Drop and recreate the items_needing_embeddings view to include discussions
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

-- Update similarity_cache table to support discussions
-- The table already exists but we need to update the constraint to include 'discussion'
ALTER TABLE similarity_cache
DROP CONSTRAINT IF EXISTS similarity_cache_item_type_check;

ALTER TABLE similarity_cache
ADD CONSTRAINT similarity_cache_item_type_check
CHECK (item_type IN ('issue', 'pull_request', 'discussion'));

-- Validation
DO $$
DECLARE
  discussions_embedding_count INTEGER;
  view_count INTEGER;
BEGIN
  -- Check if embedding column exists
  SELECT COUNT(*) INTO discussions_embedding_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
  AND table_name = 'discussions'
  AND column_name = 'embedding';

  -- Check if view exists
  SELECT COUNT(*) INTO view_count
  FROM information_schema.views
  WHERE table_schema = 'public'
  AND table_name = 'items_needing_embeddings';

  IF discussions_embedding_count = 1 AND view_count = 1 THEN
    RAISE NOTICE '✅ Discussions embedding migration completed successfully';
    RAISE NOTICE '   - discussions.embedding column added';
    RAISE NOTICE '   - Vector similarity index created';
    RAISE NOTICE '   - items_needing_embeddings view updated to include discussions';
    RAISE NOTICE '   - similarity_cache constraint updated';
  ELSE
    RAISE WARNING '⚠️ Migration validation failed - check column and view creation';
  END IF;
END $$;

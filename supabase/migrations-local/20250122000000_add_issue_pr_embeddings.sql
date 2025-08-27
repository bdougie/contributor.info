-- Local-safe version of 20250122000000_add_issue_pr_embeddings.sql
-- Generated: 2025-08-27T02:47:08.043Z
-- This migration has been modified to work without auth, roles, and extensions
-- Original migration may have different behavior in production

-- Transaction wrapper for safety
BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    -- Migration: Add embeddings support for issues and pull requests
-- This enables semantic search for the .issues command feature

-- Add embedding columns to issues table
ALTER TABLE issues 
ADD COLUMN IF NOT EXISTS embedding VECTOR(1536),
ADD COLUMN IF NOT EXISTS embedding_generated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS content_hash TEXT;
  ELSE
    RAISE NOTICE 'Extension vector not available, skipping dependent code';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error with vector extension: %', SQLERRM;
END $$;DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
     -- To detect when content changes

-- Add embedding columns to pull_requests table
ALTER TABLE pull_requests 
ADD COLUMN IF NOT EXISTS embedding VECTOR(1536),
ADD COLUMN IF NOT EXISTS embedding_generated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS content_hash TEXT;
  ELSE
    RAISE NOTICE 'Extension vector not available, skipping dependent code';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error with vector extension: %', SQLERRM;
END $$;DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    

-- Create indexes for vector similarity search
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
END $$;

-- CREATE TABLE IF NOT EXISTS to track .issues command usage
CREATE TABLE IF NOT EXISTS comment_commands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    command TEXT NOT NULL CHECK (command IN ('.issues', '.related', '.context')),
    pull_request_id UUID REFERENCES pull_requests(id) ON DELETE CASCADE,
    comment_id BIGINT NOT NULL,
    comment_author_id UUID REFERENCES contributors(id),
    response_posted BOOLEAN DEFAULT FALSE,
    response_comment_id BIGINT,
    results_count INTEGER,
    processing_time_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_comment_command UNIQUE (comment_id)
);

-- CREATE INDEX IF NOT EXISTS for command lookups
CREATE INDEX IF NOT EXISTS idx_comment_commands_pr 
ON comment_commands(pull_request_id) 
WHERE response_posted = true;DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    

-- Add comments for documentation
COMMENT ON COLUMN issues.embedding IS 'OpenAI embedding vector for semantic search (1536 dimensions)';
  ELSE
    RAISE NOTICE 'Extension vector not available, skipping dependent code';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error with vector extension: %', SQLERRM;
END $$;
COMMENT ON COLUMN issues.embedding_generated_at IS 'Timestamp when embedding was last generated';
COMMENT ON COLUMN issues.content_hash IS 'Hash of title+body to detect content changes';DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    

COMMENT ON COLUMN pull_requests.embedding IS 'OpenAI embedding vector for semantic search (1536 dimensions)';
  ELSE
    RAISE NOTICE 'Extension vector not available, skipping dependent code';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error with vector extension: %', SQLERRM;
END $$;
COMMENT ON COLUMN pull_requests.embedding_generated_at IS 'Timestamp when embedding was last generated';
COMMENT ON COLUMN pull_requests.content_hash IS 'Hash of title+body to detect content changes';

COMMENT ON TABLE comment_commands IS 'Tracks usage of special commands like .issues in PR comments';

-- Create a view for recent issues/PRs that need embeddings
CREATE OR REPLACE VIEW items_needing_embeddings AS
SELECT 
    'issue' as item_type,
    id,
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
    id,
    repository_id,
    title,
    body,
    created_at,
    embedding_generated_at,
    content_hash
FROM pull_requests
WHERE (embedding IS NULL OR embedding_generated_at < updated_at)
AND created_at > NOW() - INTERVAL '90 days'
ORDER BY created_at DESC
LIMIT 100;

COMMIT;
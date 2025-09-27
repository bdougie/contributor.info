-- Local-safe version of 20250103000000_add_ai_summaries_support.sql
-- Generated: 2025-08-27T02:47:08.035Z
-- This migration has been modified to work without auth, roles, and extensions
-- Original migration may have different behavior in production

-- Transaction wrapper for safety
BEGIN;

-- Migration: Add AI Summaries and pgvector Support
-- Add pgvector extension and AI summary fields to repositories table

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Add AI summary fields to repositories table
ALTER TABLE repositories ADD COLUMN IF NOT EXISTS ai_summary TEXT;DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    
ALTER TABLE repositories ADD COLUMN IF NOT EXISTS embedding VECTOR(1536);
  ELSE
    RAISE NOTICE 'Extension vector not available, skipping dependent code';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error with vector extension: %', SQLERRM;
END $$; -- OpenAI embeddings are 1536 dimensions
ALTER TABLE repositories ADD COLUMN IF NOT EXISTS summary_generated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE repositories ADD COLUMN IF NOT EXISTS recent_activity_hash TEXT;DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    

-- CREATE INDEX IF NOT EXISTS for vector similarity search
CREATE INDEX IF NOT EXISTS idx_repositories_embedding ON repositories USING ivfflat (embedding vector_cosine_ops);
  ELSE
    RAISE NOTICE 'Extension vector not available, skipping dependent code';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error with vector extension: %', SQLERRM;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN repositories.ai_summary IS 'AI-generated summary of repository activity and recent PRs';DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    
COMMENT ON COLUMN repositories.embedding IS 'OpenAI embedding vector for semantic search (1536 dimensions)';
  ELSE
    RAISE NOTICE 'Extension vector not available, skipping dependent code';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error with vector extension: %', SQLERRM;
END $$;
COMMENT ON COLUMN repositories.summary_generated_at IS 'Timestamp when AI summary was last generated';
COMMENT ON COLUMN repositories.recent_activity_hash IS 'Hash of recent activity to detect when summary needs regeneration';

COMMIT;

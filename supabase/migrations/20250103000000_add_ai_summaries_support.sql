-- Migration: Add AI Summaries and pgvector Support
-- Add pgvector extension and AI summary fields to repositories table

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Add AI summary fields to repositories table
ALTER TABLE repositories ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE repositories ADD COLUMN IF NOT EXISTS embedding VECTOR(1536); -- OpenAI embeddings are 1536 dimensions
ALTER TABLE repositories ADD COLUMN IF NOT EXISTS summary_generated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE repositories ADD COLUMN IF NOT EXISTS recent_activity_hash TEXT;

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_repositories_embedding ON repositories USING ivfflat (embedding vector_cosine_ops);

-- Add comment for documentation
COMMENT ON COLUMN repositories.ai_summary IS 'AI-generated summary of repository activity and recent PRs';
COMMENT ON COLUMN repositories.embedding IS 'OpenAI embedding vector for semantic search (1536 dimensions)';
COMMENT ON COLUMN repositories.summary_generated_at IS 'Timestamp when AI summary was last generated';
COMMENT ON COLUMN repositories.recent_activity_hash IS 'Hash of recent activity to detect when summary needs regeneration';
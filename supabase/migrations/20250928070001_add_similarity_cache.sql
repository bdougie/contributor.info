-- Migration: Add similarity cache table for embedding storage
-- Purpose: Phase 2 of ML-powered similarity service enhancement (Issue #350)

-- Create similarity cache table
CREATE TABLE IF NOT EXISTS similarity_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL CHECK (item_type IN ('issue', 'pull_request')),
    item_id UUID NOT NULL,
    embedding VECTOR(1536) NOT NULL,
    content_hash TEXT NOT NULL,
    ttl_hours INTEGER DEFAULT 24,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    access_count INTEGER DEFAULT 1,

    -- Composite unique constraint for cache key
    CONSTRAINT unique_cache_item UNIQUE (repository_id, item_type, item_id)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_similarity_cache_repository
ON similarity_cache(repository_id);

CREATE INDEX IF NOT EXISTS idx_similarity_cache_item
ON similarity_cache(item_type, item_id);

CREATE INDEX IF NOT EXISTS idx_similarity_cache_content_hash
ON similarity_cache(content_hash);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_similarity_cache_expiry
ON similarity_cache(created_at, ttl_hours);

-- Index for LRU eviction
CREATE INDEX IF NOT EXISTS idx_similarity_cache_access
ON similarity_cache(accessed_at);

-- Vector similarity index for semantic search
CREATE INDEX IF NOT EXISTS idx_similarity_cache_embedding
ON similarity_cache USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100)
WHERE embedding IS NOT NULL;

-- Function to increment access count and update accessed_at
CREATE OR REPLACE FUNCTION increment_cache_access(cache_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE similarity_cache
    SET
        access_count = access_count + 1,
        accessed_at = CURRENT_TIMESTAMP
    WHERE id = cache_id;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM similarity_cache
    WHERE created_at + (ttl_hours || ' hours')::INTERVAL < CURRENT_TIMESTAMP;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get cache statistics
CREATE OR REPLACE FUNCTION get_cache_statistics()
RETURNS TABLE (
    total_entries BIGINT,
    total_repositories BIGINT,
    avg_access_count NUMERIC,
    oldest_entry TIMESTAMP WITH TIME ZONE,
    newest_entry TIMESTAMP WITH TIME ZONE,
    expired_entries BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT AS total_entries,
        COUNT(DISTINCT repository_id)::BIGINT AS total_repositories,
        AVG(access_count)::NUMERIC AS avg_access_count,
        MIN(created_at) AS oldest_entry,
        MAX(created_at) AS newest_entry,
        COUNT(*) FILTER (WHERE created_at + (ttl_hours || ' hours')::INTERVAL < CURRENT_TIMESTAMP)::BIGINT AS expired_entries
    FROM similarity_cache;
END;
$$ LANGUAGE plpgsql;

-- Create table for batch processing jobs
CREATE TABLE IF NOT EXISTS embedding_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    items_total INTEGER NOT NULL,
    items_processed INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for job queries
CREATE INDEX IF NOT EXISTS idx_embedding_jobs_status
ON embedding_jobs(status, created_at);

CREATE INDEX IF NOT EXISTS idx_embedding_jobs_repository
ON embedding_jobs(repository_id);

-- Function to update job progress
CREATE OR REPLACE FUNCTION update_embedding_job_progress(
    job_id UUID,
    processed_count INTEGER
)
RETURNS VOID AS $$
BEGIN
    UPDATE embedding_jobs
    SET
        items_processed = processed_count,
        status = CASE
            WHEN processed_count >= items_total THEN 'completed'
            ELSE 'processing'
        END,
        completed_at = CASE
            WHEN processed_count >= items_total THEN CURRENT_TIMESTAMP
            ELSE NULL
        END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = job_id;
END;
$$ LANGUAGE plpgsql;

-- Add RLS policies for similarity_cache
ALTER TABLE similarity_cache ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read cache entries
CREATE POLICY "similarity_cache_select_policy" ON similarity_cache
    FOR SELECT
    TO authenticated, anon
    USING (true);

-- Allow service role to manage cache
CREATE POLICY "similarity_cache_service_policy" ON similarity_cache
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Add RLS policies for embedding_jobs
ALTER TABLE embedding_jobs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their repository's jobs
CREATE POLICY "embedding_jobs_select_policy" ON embedding_jobs
    FOR SELECT
    TO authenticated
    USING (
        repository_id IN (
            SELECT id FROM repositories
            WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members
                WHERE user_id = auth.uid()
            )
        )
    );

-- Allow service role to manage jobs
CREATE POLICY "embedding_jobs_service_policy" ON embedding_jobs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Add comments for documentation
COMMENT ON TABLE similarity_cache IS 'Caches embeddings for issues and pull requests to reduce API calls';
COMMENT ON COLUMN similarity_cache.content_hash IS 'Hash of title+body to detect content changes';
COMMENT ON COLUMN similarity_cache.ttl_hours IS 'Time to live in hours before cache entry expires';
COMMENT ON COLUMN similarity_cache.access_count IS 'Number of times this cache entry has been accessed';

COMMENT ON TABLE embedding_jobs IS 'Tracks batch embedding generation jobs';
COMMENT ON FUNCTION cleanup_expired_cache() IS 'Removes cache entries that have exceeded their TTL';
COMMENT ON FUNCTION get_cache_statistics() IS 'Returns aggregate statistics about the cache';
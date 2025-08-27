-- Local-safe version of 20250113000000_add_repository_size_classification.sql
-- Generated: 2025-08-27T02:47:08.036Z
-- This migration has been modified to work without auth, roles, and extensions
-- Original migration may have different behavior in production

-- Transaction wrapper for safety
BEGIN;

-- Add repository size classification columns to tracked_repositories table
-- This migration adds support for intelligent size-based fetching strategies

-- Add enum types for size and priority
DO $
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'repository_size') THEN
    CREATE TYPE repository_size AS ENUM ('small', 'medium', 'large', 'xl');
DO $
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'repository_priority') THEN
    CREATE TYPE repository_priority AS ENUM ('high', 'medium', 'low');

-- Add new columns to tracked_repositories table
ALTER TABLE tracked_repositories
ADD COLUMN size repository_size,
ADD COLUMN priority repository_priority DEFAULT 'low',
ADD COLUMN metrics JSONB,
ADD COLUMN size_calculated_at TIMESTAMPTZ;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_tracked_repositories_size ON tracked_repositories(size);
CREATE INDEX IF NOT EXISTS idx_tracked_repositories_priority ON tracked_repositories(priority);
CREATE INDEX IF NOT EXISTS idx_tracked_repositories_size_priority ON tracked_repositories(size, priority);
CREATE INDEX IF NOT EXISTS idx_tracked_repositories_size_calculated ON tracked_repositories(size_calculated_at);

-- Add GIN index for JSONB metrics column for efficient querying
CREATE INDEX IF NOT EXISTS idx_tracked_repositories_metrics ON tracked_repositories USING GIN (metrics);

-- Add comments for documentation
COMMENT ON COLUMN tracked_repositories.size IS 'Repository size classification based on activity metrics (small/medium/large/xl)';
COMMENT ON COLUMN tracked_repositories.priority IS 'Processing priority for this repository (high/medium/low)';
COMMENT ON COLUMN tracked_repositories.metrics IS 'Cached repository metrics used for size classification';
COMMENT ON COLUMN tracked_repositories.size_calculated_at IS 'Timestamp when size classification was last calculated';

-- Function to help with size classification queries
CREATE OR REPLACE FUNCTION get_repositories_by_size(
    target_size repository_size DEFAULT NULL,
    min_priority repository_priority DEFAULT NULL
) RETURNS SETOF tracked_repositories AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM tracked_repositories
    WHERE 
        tracking_enabled = TRUE
        AND (target_size IS NULL OR size = target_size)
        AND (min_priority IS NULL OR 
            CASE 
                WHEN min_priority = 'low' THEN priority IN ('low', 'medium', 'high')
                WHEN min_priority = 'medium' THEN priority IN ('medium', 'high')
                WHEN min_priority = 'high' THEN priority = 'high'
            END
        )
    ORDER BY 
        CASE priority 
            WHEN 'high' THEN 1 
            WHEN 'medium' THEN 2 
            WHEN 'low' THEN 3 
        END,
        last_sync_at ASC NULLS FIRST;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_repositories_by_size IS 'Retrieves tracked repositories filtered by size and priority';

COMMIT;
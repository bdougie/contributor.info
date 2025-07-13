-- Add repository size classification columns to tracked_repositories table
-- This migration adds support for intelligent size-based fetching strategies

-- Add enum types for size and priority
CREATE TYPE repository_size AS ENUM ('small', 'medium', 'large', 'xl');
CREATE TYPE repository_priority AS ENUM ('high', 'medium', 'low');

-- Add new columns to tracked_repositories table
ALTER TABLE tracked_repositories
ADD COLUMN size repository_size,
ADD COLUMN priority repository_priority DEFAULT 'low',
ADD COLUMN metrics JSONB,
ADD COLUMN size_calculated_at TIMESTAMPTZ;

-- Create indexes for efficient querying
CREATE INDEX idx_tracked_repositories_size ON tracked_repositories(size);
CREATE INDEX idx_tracked_repositories_priority ON tracked_repositories(priority);
CREATE INDEX idx_tracked_repositories_size_priority ON tracked_repositories(size, priority);
CREATE INDEX idx_tracked_repositories_size_calculated ON tracked_repositories(size_calculated_at);

-- Add GIN index for JSONB metrics column for efficient querying
CREATE INDEX idx_tracked_repositories_metrics ON tracked_repositories USING GIN (metrics);

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
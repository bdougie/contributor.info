-- Add avatar caching fields to contributors table
-- This enables Supabase-based avatar caching with TTL for improved performance

-- Add new columns for avatar caching
ALTER TABLE contributors 
ADD COLUMN IF NOT EXISTS avatar_cached_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS avatar_cache_expires_at TIMESTAMPTZ;

-- Create index for efficient cache queries
CREATE INDEX IF NOT EXISTS idx_contributors_avatar_cache_expires 
ON contributors(avatar_cache_expires_at) 
WHERE avatar_cache_expires_at IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN contributors.avatar_cached_at IS 'Timestamp when avatar was last cached from GitHub';
COMMENT ON COLUMN contributors.avatar_cache_expires_at IS 'Timestamp when avatar cache expires (TTL-based invalidation)';

-- Function to check if avatar cache is valid
CREATE OR REPLACE FUNCTION is_avatar_cache_valid(
    cached_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN cached_at IS NOT NULL 
           AND expires_at IS NOT NULL 
           AND expires_at > NOW();
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get cached avatar URL if valid, null otherwise
CREATE OR REPLACE FUNCTION get_cached_avatar_url(
    contributor_github_id BIGINT
) RETURNS TEXT AS $$
DECLARE
    cached_url TEXT;
    cached_at TIMESTAMPTZ;
    expires_at TIMESTAMPTZ;
BEGIN
    SELECT avatar_url, avatar_cached_at, avatar_cache_expires_at
    INTO cached_url, cached_at, expires_at
    FROM contributors
    WHERE github_id = contributor_github_id;
    
    -- Return URL only if cache is valid
    IF is_avatar_cache_valid(cached_at, expires_at) THEN
        RETURN cached_url;
    ELSE
        RETURN NULL;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to update avatar cache with TTL
CREATE OR REPLACE FUNCTION update_avatar_cache(
    contributor_github_id BIGINT,
    new_avatar_url TEXT,
    cache_duration_days INTEGER DEFAULT 7
) RETURNS VOID AS $$
BEGIN
    UPDATE contributors
    SET 
        avatar_url = new_avatar_url,
        avatar_cached_at = NOW(),
        avatar_cache_expires_at = NOW() + (cache_duration_days || ' days')::interval,
        last_updated_at = NOW()
    WHERE github_id = contributor_github_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION is_avatar_cache_valid IS 'Checks if avatar cache is valid (not expired)';
COMMENT ON FUNCTION get_cached_avatar_url IS 'Returns cached avatar URL if valid, null if expired';
COMMENT ON FUNCTION update_avatar_cache IS 'Updates avatar cache with TTL expiration';
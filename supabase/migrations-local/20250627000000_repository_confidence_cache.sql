-- Local-safe version of 20250627000000_repository_confidence_cache.sql
-- Generated: 2025-08-27T02:47:08.049Z
-- This migration has been modified to work without auth, roles, and extensions
-- Original migration may have different behavior in production

-- Transaction wrapper for safety
BEGIN;


-- Ensure authenticated exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated;
    RAISE NOTICE 'Created missing role: authenticated';
  END IF;
END $$;

-- Ensure service_role exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role;
    RAISE NOTICE 'Created missing role: service_role';
  END IF;
END $$;

-- This migration requires auth schema
DO $$
BEGIN
  -- Check if auth schema and functions exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    RAISE NOTICE 'Auth schema not found. Skipping 20250627000000_repository_confidence_cache.sql';
    RETURN;
  END IF;
  
  -- Check for auth.uid() function
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'auth' AND p.proname = 'uid'
  ) THEN
    RAISE NOTICE 'Auth functions not available. Skipping 20250627000000_repository_confidence_cache.sql';
    RETURN;
  END IF;
END $$;

-- Original migration content (only runs if auth is available)
-- Repository Confidence Cache Table
-- Stores pre-calculated confidence scores to improve performance

CREATE TABLE IF NOT EXISTS repository_confidence_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Repository identification
  repository_owner text NOT NULL,
  repository_name text NOT NULL,
  
  -- Confidence score data
  confidence_score integer NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
  time_range_days integer NOT NULL CHECK (time_range_days > 0),
  
  -- Cache metadata
  calculated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  
  -- Data freshness tracking
  last_sync_at timestamptz,
  data_version integer DEFAULT 1,
  
  -- Performance tracking
  calculation_time_ms integer,
  
  -- Constraints
  UNIQUE(repository_owner, repository_name, time_range_days),
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_confidence_cache_repo_lookup 
  ON repository_confidence_cache(repository_owner, repository_name, time_range_days);

CREATE INDEX IF NOT EXISTS idx_confidence_cache_expires 
  ON repository_confidence_cache(expires_at);

CREATE INDEX IF NOT EXISTS idx_confidence_cache_freshness 
  ON repository_confidence_cache(calculated_at DESC);

-- RLS Policies (allow public read access similar to other tables)
ALTER TABLE repository_confidence_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to confidence cache" 
  ON repository_confidence_cache 
  FOR SELECT 
  USING (true);

CREATE POLICY "Allow authenticated insert/update to confidence cache" 
  ON repository_confidence_cache 
  FOR ALL 
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_confidence_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_confidence_cache_updated_at_trigger
  BEFORE UPDATE ON repository_confidence_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_confidence_cache_updated_at();

-- Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_confidence_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM repository_confidence_cache 
  WHERE expires_at < now() - interval '1 day';
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE repository_confidence_cache IS 'Caches pre-calculated repository confidence scores to improve performance';
COMMENT ON COLUMN repository_confidence_cache.confidence_score IS 'Cached confidence score (0-100)';
COMMENT ON COLUMN repository_confidence_cache.time_range_days IS 'Time range used for calculation (30, 90, 365 days)';
COMMENT ON COLUMN repository_confidence_cache.expires_at IS 'When this cache entry expires and needs recalculation';
COMMENT ON COLUMN repository_confidence_cache.last_sync_at IS 'Last time the repository was synced with GitHub';
COMMENT ON COLUMN repository_confidence_cache.data_version IS 'Version of the calculation algorithm used';
COMMENT ON COLUMN repository_confidence_cache.calculation_time_ms IS 'Time taken to calculate this score in milliseconds';

COMMIT;
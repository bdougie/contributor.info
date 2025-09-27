-- Local-safe version of 20250821001000_add_sync_monitoring.sql
-- Generated: 2025-08-27T02:47:08.064Z
-- This migration has been modified to work without auth, roles, and extensions
-- Original migration may have different behavior in production

-- Transaction wrapper for safety
BEGIN;


-- Ensure anon exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon;
    RAISE NOTICE 'Created missing role: anon';
  END IF;
END $$;

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
    RAISE NOTICE 'Auth schema not found. Skipping 20250821001000_add_sync_monitoring.sql';
    RETURN;
  END IF;
  
  -- Check for auth.uid() function
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'auth' AND p.proname = 'uid'
  ) THEN
    RAISE NOTICE 'Auth functions not available. Skipping 20250821001000_add_sync_monitoring.sql';
    RETURN;
  END IF;
END $$;

-- Original migration content (only runs if auth is available)
-- Migration for sync monitoring and progress tracking
-- Supports Supabase Edge Functions migration

-- Table for tracking sync progress (for resumable syncs)
CREATE TABLE IF NOT EXISTS sync_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE UNIQUE,
  last_cursor TEXT,
  last_sync_at TIMESTAMPTZ DEFAULT NOW(),
  prs_processed INTEGER DEFAULT 0,
  total_prs INTEGER,
  status TEXT CHECK (status IN ('partial', 'in_progress', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for batch processing progress
CREATE TABLE IF NOT EXISTS batch_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE UNIQUE,
  last_pr_number INTEGER,
  processed_count INTEGER DEFAULT 0,
  total_count INTEGER,
  status TEXT CHECK (status IN ('partial', 'in_progress', 'completed', 'failed')),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for sync metrics and monitoring
CREATE TABLE IF NOT EXISTS sync_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name TEXT NOT NULL,
  repository TEXT NOT NULL,
  execution_time DECIMAL(10, 2) NOT NULL, -- in seconds
  success BOOLEAN DEFAULT false,
  processed INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  timed_out BOOLEAN DEFAULT false,
  router TEXT CHECK (router IN ('supabase', 'netlify', 'inngest')),
  error_details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add sync status to repositories if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'repositories' 
    AND column_name = 'sync_status'
  ) THEN
    ALTER TABLE repositories 
    ADD COLUMN sync_status TEXT DEFAULT 'idle' 
    CHECK (sync_status IN ('idle', 'syncing', 'completed', 'failed', 'partial'));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'repositories' 
    AND column_name = 'last_synced_at'
  ) THEN
    ALTER TABLE repositories 
    ADD COLUMN last_synced_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'repositories' 
    AND column_name = 'total_pull_requests'
  ) THEN
    ALTER TABLE repositories 
    ADD COLUMN total_pull_requests INTEGER DEFAULT 0;
  END IF;
END $$;

-- Add last_synced_at to pull_requests if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pull_requests' 
    AND column_name = 'last_synced_at'
  ) THEN
    ALTER TABLE pull_requests 
    ADD COLUMN last_synced_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sync_progress_repository 
ON sync_progress(repository_id, status);

CREATE INDEX IF NOT EXISTS idx_batch_progress_repository 
ON batch_progress(repository_id, status);

CREATE INDEX IF NOT EXISTS idx_sync_metrics_repository 
ON sync_metrics(repository, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_metrics_timeouts 
ON sync_metrics(timed_out, created_at DESC) 
WHERE timed_out = true;

CREATE INDEX IF NOT EXISTS idx_repositories_sync_status 
ON repositories(sync_status) 
WHERE sync_status != 'idle';

-- Function to get sync statistics
CREATE OR REPLACE FUNCTION get_sync_statistics(
  repo_name TEXT DEFAULT NULL,
  days_back INTEGER DEFAULT 7
)
RETURNS TABLE (
  total_syncs BIGINT,
  successful_syncs BIGINT,
  failed_syncs BIGINT,
  timeouts BIGINT,
  avg_execution_time DECIMAL,
  max_execution_time DECIMAL,
  supabase_usage BIGINT,
  netlify_usage BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_syncs,
    COUNT(*) FILTER (WHERE success = true)::BIGINT as successful_syncs,
    COUNT(*) FILTER (WHERE success = false)::BIGINT as failed_syncs,
    COUNT(*) FILTER (WHERE timed_out = true)::BIGINT as timeouts,
    AVG(execution_time)::DECIMAL as avg_execution_time,
    MAX(execution_time)::DECIMAL as max_execution_time,
    COUNT(*) FILTER (WHERE router = 'supabase')::BIGINT as supabase_usage,
    COUNT(*) FILTER (WHERE router IN ('netlify', 'inngest'))::BIGINT as netlify_usage
  FROM sync_metrics
  WHERE 
    created_at >= NOW() - INTERVAL '1 day' * days_back
    AND (repo_name IS NULL OR repository = repo_name);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check if repository should use Supabase
CREATE OR REPLACE FUNCTION should_use_supabase(repo_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  recent_timeouts INTEGER;
  avg_time DECIMAL;
BEGIN
  -- Check for recent timeouts
  SELECT COUNT(*) INTO recent_timeouts
  FROM sync_metrics
  WHERE 
    repository = repo_name
    AND timed_out = true
    AND router IN ('netlify', 'inngest')
    AND created_at >= NOW() - INTERVAL '30 days';
  
  IF recent_timeouts > 0 THEN
    RETURN true;
  END IF;
  
  -- Check average execution time
  SELECT AVG(execution_time) INTO avg_time
  FROM sync_metrics
  WHERE 
    repository = repo_name
    AND created_at >= NOW() - INTERVAL '30 days';
  
  IF avg_time > 20 THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE;

-- RLS policies for monitoring tables
ALTER TABLE sync_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_metrics ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can read sync metrics (prevents data leakage)
CREATE POLICY "Authenticated users can read sync metrics" 
ON sync_metrics FOR SELECT 
USING (auth.role() IN ('authenticated', 'service_role'));

-- Only service role can write to monitoring tables
CREATE POLICY "Service role can manage sync progress" 
ON sync_progress FOR ALL 
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can manage batch progress" 
ON batch_progress FOR ALL 
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can insert sync metrics" 
ON sync_metrics FOR INSERT 
WITH CHECK (auth.role() = 'service_role');

-- DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    Grant permissions (only authenticated, not anon)
GRANT SELECT ON sync_metrics TO authenticated;
  ELSE
    RAISE NOTICE 'Role authenticated not found, skipping grant';
  END IF;
END $;
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON sync_progress TO service_role;
  ELSE
    RAISE NOTICE 'Role service_role not found, skipping grant';
  END IF;
END $;
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON batch_progress TO service_role;
  ELSE
    RAISE NOTICE 'Role service_role not found, skipping grant';
  END IF;
END $;
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON sync_metrics TO service_role;
  ELSE
    RAISE NOTICE 'Role service_role not found, skipping grant';
  END IF;
END $;

COMMIT;

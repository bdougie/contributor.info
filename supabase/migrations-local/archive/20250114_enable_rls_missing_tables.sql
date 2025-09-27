-- Local-safe version of 20250114_enable_rls_missing_tables.sql
-- Generated: 2025-08-27T02:47:08.037Z
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

-- Enable RLS on missing tables to fix security advisories
-- Applied on 2025-01-14

-- Enable RLS on missing tables
ALTER TABLE rate_limit_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_capture_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE commits ENABLE ROW LEVEL SECURITY;

-- Rate Limit Tracking - Public read access (view rate limit status)
CREATE POLICY "public_read_rate_limit_tracking"
ON rate_limit_tracking FOR SELECT
USING (true);

-- Rate Limit Tracking - Only service role can modify
CREATE POLICY "service_manage_rate_limit_tracking"
ON rate_limit_tracking FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Data Capture Queue - Only service role can access (internal queue)
CREATE POLICY "service_manage_data_capture_queue"
ON data_capture_queue FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Commits - Public read access
CREATE POLICY "public_read_commits"
ON commits FOR SELECT
USING (true);

-- Commits - Authenticated users can insert/update
CREATE POLICY "auth_insert_commits"
ON commits FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "auth_update_commits"
ON commits FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Commits - Service role can delete
CREATE POLICY "service_delete_commits"
ON commits FOR DELETE
TO service_role
USING (true);

COMMIT;

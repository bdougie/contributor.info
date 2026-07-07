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
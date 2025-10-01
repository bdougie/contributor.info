-- Cleanup Stuck Progressive Capture Jobs
-- Run this in Supabase SQL Editor after switching Inngest back to Netlify

-- 1. Check current state (before cleanup)
SELECT
  status,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE started_at < NOW() - INTERVAL '10 minutes') as stuck_count,
  MIN(started_at) as oldest_job,
  MAX(started_at) as newest_job
FROM progressive_capture_jobs
WHERE status = 'processing'
GROUP BY status;

-- 2. Mark all stuck jobs as failed
UPDATE progressive_capture_jobs
SET
  status = 'failed',
  completed_at = NOW(),
  error = 'Job stuck in processing - Inngest endpoint was misconfigured (switched back to Netlify)'
WHERE status = 'processing'
  AND started_at < NOW() - INTERVAL '10 minutes';

-- 3. Verify cleanup
SELECT
  status,
  COUNT(*) as count
FROM progressive_capture_jobs
WHERE created_at >= NOW() - INTERVAL '1 day'
GROUP BY status
ORDER BY status;

-- 4. Get job summary for monitoring
SELECT
  job_type,
  status,
  COUNT(*) as count,
  metadata->>'repository_name' as repository,
  MAX(created_at) as latest_attempt
FROM progressive_capture_jobs
WHERE created_at >= NOW() - INTERVAL '2 hours'
GROUP BY job_type, status, metadata->>'repository_name'
ORDER BY latest_attempt DESC
LIMIT 20;

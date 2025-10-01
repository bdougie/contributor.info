-- Automated Stuck Job Cleanup
-- Runs every 15 minutes to mark stuck jobs as failed
-- Prevents jobs from hanging indefinitely when webhook is misconfigured

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Drop existing job if it exists (for idempotency)
SELECT cron.unschedule('cleanup-stuck-jobs') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-stuck-jobs'
);

-- Schedule cleanup to run every 15 minutes
SELECT cron.schedule(
  'cleanup-stuck-jobs',
  '*/15 * * * *', -- Every 15 minutes
  $$
  -- Mark jobs stuck in processing for >10 minutes as failed
  UPDATE progressive_capture_jobs
  SET
    status = 'failed',
    completed_at = NOW(),
    error = 'Job stuck in processing for >10 minutes - likely webhook misconfiguration'
  WHERE status = 'processing'
    AND started_at < NOW() - INTERVAL '10 minutes';
  $$
);

-- Create monitoring view for stuck job detection
CREATE OR REPLACE VIEW stuck_jobs_monitor AS
SELECT
  job_type,
  COUNT(*) as stuck_count,
  MIN(started_at) as oldest_stuck_job,
  EXTRACT(EPOCH FROM (NOW() - MIN(started_at)))/60 as oldest_age_minutes,
  ARRAY_AGG(metadata->>'repository_name' ORDER BY started_at) FILTER (WHERE metadata->>'repository_name' IS NOT NULL) as affected_repositories
FROM progressive_capture_jobs
WHERE status = 'processing'
  AND started_at < NOW() - INTERVAL '5 minutes'
GROUP BY job_type
ORDER BY stuck_count DESC;

-- Grant access to monitoring view
GRANT SELECT ON stuck_jobs_monitor TO authenticated;
GRANT SELECT ON stuck_jobs_monitor TO anon;

-- Create function to get stuck job summary (for health checks)
CREATE OR REPLACE FUNCTION get_stuck_job_summary()
RETURNS TABLE (
  total_stuck BIGINT,
  oldest_age_minutes NUMERIC,
  needs_attention BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_stuck,
    COALESCE(MAX(EXTRACT(EPOCH FROM (NOW() - started_at))/60), 0)::NUMERIC as oldest_age_minutes,
    (COUNT(*) > 10 OR COALESCE(MAX(EXTRACT(EPOCH FROM (NOW() - started_at))/60), 0) > 30)::BOOLEAN as needs_attention
  FROM progressive_capture_jobs
  WHERE status = 'processing'
    AND started_at < NOW() - INTERVAL '5 minutes';
END;
$$;

-- Grant execute to service_role for health checks
GRANT EXECUTE ON FUNCTION get_stuck_job_summary() TO service_role;
GRANT EXECUTE ON FUNCTION get_stuck_job_summary() TO authenticated;

COMMENT ON FUNCTION get_stuck_job_summary IS
'Returns summary of stuck jobs for monitoring. needs_attention=true indicates >10 stuck jobs or jobs stuck >30min';

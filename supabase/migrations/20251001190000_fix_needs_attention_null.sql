-- Fix needs_attention returning NULL instead of false
-- When there are zero stuck jobs, MAX() returns NULL causing the OR expression to evaluate to NULL

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

COMMENT ON FUNCTION get_stuck_job_summary IS
'Returns summary of stuck jobs for monitoring. needs_attention=true indicates >10 stuck jobs or jobs stuck >30min. Fixed to return false instead of NULL when no jobs are stuck.';

-- Job Monitoring Queries for Background Jobs
-- Use these queries to monitor and analyze job performance

-- 1. Current job queue status
SELECT
  status,
  COUNT(*) as count
FROM background_jobs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status
ORDER BY count DESC;

-- 2. Failed jobs in the last hour (for alerting)
SELECT
  id,
  type,
  error,
  created_at,
  failed_at,
  retry_count,
  payload
FROM background_jobs
WHERE
  status = 'failed'
  AND failed_at > NOW() - INTERVAL '1 hour'
ORDER BY failed_at DESC;

-- 3. Average processing time by job type (last 7 days)
SELECT
  type,
  COUNT(*) as total_jobs,
  COUNT(*) FILTER (WHERE status = 'completed') as successful,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  ROUND(AVG(duration_ms) FILTER (WHERE status = 'completed')) as avg_duration_ms,
  ROUND(MIN(duration_ms) FILTER (WHERE status = 'completed')) as min_duration_ms,
  ROUND(MAX(duration_ms) FILTER (WHERE status = 'completed')) as max_duration_ms,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms) FILTER (WHERE status = 'completed')) as median_duration_ms,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) FILTER (WHERE status = 'completed')) as p95_duration_ms,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status = 'completed') /
    NULLIF(COUNT(*), 0), 2
  ) as success_rate
FROM background_jobs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY type
ORDER BY total_jobs DESC;

-- 4. Jobs currently processing (to detect stuck jobs)
SELECT
  id,
  type,
  EXTRACT(EPOCH FROM (NOW() - started_at)) as seconds_running,
  started_at,
  payload
FROM background_jobs
WHERE status = 'processing'
ORDER BY started_at ASC;

-- 5. Job throughput by hour (last 24 hours)
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as total_jobs,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  ROUND(AVG(duration_ms) FILTER (WHERE status = 'completed')) as avg_duration_ms
FROM background_jobs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;

-- 6. Repository sync status
SELECT
  r.full_name,
  r.id as repository_id,
  COUNT(j.id) as total_jobs,
  COUNT(j.id) FILTER (WHERE j.status = 'completed') as completed_jobs,
  COUNT(j.id) FILTER (WHERE j.status = 'failed') as failed_jobs,
  MAX(j.created_at) as last_job_created,
  MAX(j.completed_at) as last_job_completed
FROM repositories r
LEFT JOIN background_jobs j ON j.repository_id = r.id
WHERE j.created_at > NOW() - INTERVAL '7 days'
GROUP BY r.id, r.full_name
ORDER BY total_jobs DESC;

-- 7. Jobs requiring retry
SELECT
  id,
  type,
  retry_count,
  max_retries,
  error,
  failed_at
FROM background_jobs
WHERE
  status = 'failed'
  AND retry_count < max_retries
  AND failed_at > NOW() - INTERVAL '1 hour'
ORDER BY failed_at DESC;

-- 8. Long-running job detection (jobs taking > 60s)
SELECT
  id,
  type,
  duration_ms / 1000.0 as duration_seconds,
  created_at,
  completed_at,
  payload
FROM background_jobs
WHERE
  status = 'completed'
  AND duration_ms > 60000
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY duration_ms DESC;

-- 9. Job success rate trend (daily for last 30 days)
SELECT
  DATE(created_at) as date,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'completed') as successful,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status = 'completed') /
    NULLIF(COUNT(*), 0), 2
  ) as success_rate
FROM background_jobs
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- 10. Inngest event correlation
SELECT
  inngest_event_id,
  COUNT(*) as job_count,
  STRING_AGG(DISTINCT type, ', ') as job_types,
  STRING_AGG(DISTINCT status, ', ') as statuses,
  MIN(created_at) as first_job,
  MAX(created_at) as last_job
FROM background_jobs
WHERE
  inngest_event_id IS NOT NULL
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY inngest_event_id
HAVING COUNT(*) > 1
ORDER BY job_count DESC;

-- Helper function: Get job statistics summary
CREATE OR REPLACE FUNCTION get_job_statistics_summary()
RETURNS TABLE (
  metric TEXT,
  value TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT
      COUNT(*) as total_jobs,
      COUNT(*) FILTER (WHERE status = 'queued') as queued,
      COUNT(*) FILTER (WHERE status = 'processing') as processing,
      COUNT(*) FILTER (WHERE status = 'completed') as completed,
      COUNT(*) FILTER (WHERE status = 'failed') as failed,
      ROUND(AVG(duration_ms) FILTER (WHERE status = 'completed')) as avg_duration,
      ROUND(
        100.0 * COUNT(*) FILTER (WHERE status = 'completed') /
        NULLIF(COUNT(*), 0), 2
      ) as success_rate
    FROM background_jobs
    WHERE created_at > NOW() - INTERVAL '24 hours'
  )
  SELECT 'Total Jobs (24h)', total_jobs::TEXT FROM stats
  UNION ALL
  SELECT 'Queued', queued::TEXT FROM stats
  UNION ALL
  SELECT 'Processing', processing::TEXT FROM stats
  UNION ALL
  SELECT 'Completed', completed::TEXT FROM stats
  UNION ALL
  SELECT 'Failed', failed::TEXT FROM stats
  UNION ALL
  SELECT 'Success Rate', success_rate || '%' FROM stats
  UNION ALL
  SELECT 'Avg Duration',
    CASE
      WHEN avg_duration IS NULL THEN 'N/A'
      WHEN avg_duration < 1000 THEN avg_duration || 'ms'
      ELSE ROUND(avg_duration / 1000.0, 1) || 's'
    END
  FROM stats;
END;
$$;

-- Usage: SELECT * FROM get_job_statistics_summary();
-- Monitor Inngest Sync Status
-- Run this periodically to ensure sync is working after Netlify switch

-- 1. Recent job status (last 1 hour)
SELECT
  job_type,
  status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds,
  MAX(created_at) as last_run
FROM progressive_capture_jobs
WHERE created_at >= NOW() - INTERVAL '1 hour'
GROUP BY job_type, status
ORDER BY last_run DESC;

-- 2. Check for stuck jobs (currently processing > 5 minutes)
SELECT
  job_type,
  metadata->>'repository_name' as repository,
  status,
  created_at,
  started_at,
  EXTRACT(EPOCH FROM (NOW() - started_at))/60 as minutes_processing,
  error
FROM progressive_capture_jobs
WHERE status = 'processing'
  AND started_at < NOW() - INTERVAL '5 minutes'
ORDER BY started_at ASC
LIMIT 10;

-- 3. Recent PR data (confirm data is being synced)
SELECT
  r.full_name as repository,
  COUNT(*) as total_prs,
  COUNT(*) FILTER (WHERE pr.created_at >= NOW() - INTERVAL '1 day') as prs_last_24h,
  COUNT(*) FILTER (WHERE pr.created_at >= NOW() - INTERVAL '5 days') as prs_last_5_days,
  MAX(pr.last_synced_at) as last_sync,
  EXTRACT(EPOCH FROM (NOW() - MAX(pr.last_synced_at)))/60 as minutes_since_sync
FROM pull_requests pr
JOIN repositories r ON pr.repository_id = r.id
WHERE pr.last_synced_at >= NOW() - INTERVAL '2 hours'
GROUP BY r.full_name
ORDER BY last_sync DESC
LIMIT 10;

-- 4. Failed jobs in last hour (watch for patterns)
SELECT
  job_type,
  metadata->>'repository_name' as repository,
  error,
  COUNT(*) as failure_count,
  MAX(completed_at) as last_failure
FROM progressive_capture_jobs
WHERE status = 'failed'
  AND completed_at >= NOW() - INTERVAL '1 hour'
GROUP BY job_type, metadata->>'repository_name', error
ORDER BY failure_count DESC
LIMIT 10;

-- 5. Overall health check
SELECT
  'Last Hour Jobs' as metric,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  COUNT(*) FILTER (WHERE status = 'processing') as processing,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'completed') / NULLIF(COUNT(*), 0), 2) as success_rate
FROM progressive_capture_jobs
WHERE created_at >= NOW() - INTERVAL '1 hour';

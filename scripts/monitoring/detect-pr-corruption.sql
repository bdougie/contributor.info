-- Automated PR Data Corruption Detection Queries
-- Run these queries periodically to detect and alert on data corruption

-- 1. Daily corruption detection summary
WITH daily_corruption AS (
  SELECT 
    r.owner,
    r.name,
    DATE(pr.created_at) as date,
    COUNT(*) FILTER (WHERE pr.additions = 0 AND pr.deletions = 0 AND pr.changed_files = 0 AND pr.commits = 0) as corrupted_count,
    COUNT(*) as total_count,
    ROUND(
      COUNT(*) FILTER (WHERE pr.additions = 0 AND pr.deletions = 0 AND pr.changed_files = 0 AND pr.commits = 0)::numeric 
      / COUNT(*)::numeric * 100, 2
    ) as corruption_percentage
  FROM pull_requests pr
  JOIN repositories r ON pr.repository_id = r.id
  WHERE pr.created_at >= NOW() - INTERVAL '7 days'
  GROUP BY r.owner, r.name, DATE(pr.created_at)
  HAVING COUNT(*) FILTER (WHERE pr.additions = 0 AND pr.deletions = 0 AND pr.changed_files = 0 AND pr.commits = 0) > 0
)
SELECT * FROM daily_corruption
WHERE corruption_percentage > 10  -- Alert if more than 10% of PRs are corrupted
ORDER BY date DESC, corruption_percentage DESC;

-- 2. Real-time corruption detection (last hour)
WITH recent_corruption AS (
  SELECT 
    r.owner,
    r.name,
    pr.number,
    pr.title,
    pr.created_at,
    pr.additions,
    pr.deletions,
    pr.changed_files,
    pr.commits,
    CASE 
      WHEN pr.additions = 0 AND pr.deletions = 0 AND pr.changed_files = 0 AND pr.commits = 0 
      THEN 'CORRUPTED'
      ELSE 'OK'
    END as status
  FROM pull_requests pr
  JOIN repositories r ON pr.repository_id = r.id
  WHERE pr.created_at >= NOW() - INTERVAL '1 hour'
)
SELECT 
  owner,
  name,
  COUNT(*) FILTER (WHERE status = 'CORRUPTED') as corrupted_count,
  COUNT(*) as total_count,
  STRING_AGG(CASE WHEN status = 'CORRUPTED' THEN '#' || number::text END, ', ') as corrupted_pr_numbers
FROM recent_corruption
GROUP BY owner, name
HAVING COUNT(*) FILTER (WHERE status = 'CORRUPTED') > 0;

-- 3. Repository health check - identify repos with chronic corruption issues
WITH repo_health AS (
  SELECT 
    r.id,
    r.owner,
    r.name,
    r.last_updated_at,
    COUNT(pr.id) FILTER (WHERE pr.created_at >= NOW() - INTERVAL '7 days') as total_prs_last_week,
    COUNT(*) FILTER (
      WHERE pr.additions = 0 
        AND pr.deletions = 0 
        AND pr.changed_files = 0 
        AND pr.commits = 0
        AND pr.created_at >= NOW() - INTERVAL '7 days'
    ) as corrupted_prs_last_week,
    MAX(pr.created_at) FILTER (
      WHERE pr.additions = 0 
        AND pr.deletions = 0 
        AND pr.changed_files = 0 
        AND pr.commits = 0
    ) as last_corruption_time
  FROM repositories r
  LEFT JOIN pull_requests pr ON pr.repository_id = r.id
  WHERE r.is_active = true
  GROUP BY r.id, r.owner, r.name, r.last_updated_at
)
SELECT 
  owner,
  name,
  total_prs_last_week,
  corrupted_prs_last_week,
  ROUND(corrupted_prs_last_week::numeric / NULLIF(total_prs_last_week, 0)::numeric * 100, 2) as corruption_rate,
  last_corruption_time,
  EXTRACT(EPOCH FROM (NOW() - last_corruption_time))/3600 as hours_since_last_corruption
FROM repo_health
WHERE corrupted_prs_last_week > 0
ORDER BY corruption_rate DESC, corrupted_prs_last_week DESC;

-- 4. Corruption trend analysis - detect if corruption is increasing
WITH hourly_stats AS (
  SELECT 
    DATE_TRUNC('hour', pr.created_at) as hour,
    COUNT(*) as total_prs,
    COUNT(*) FILTER (
      WHERE pr.additions = 0 
        AND pr.deletions = 0 
        AND pr.changed_files = 0 
        AND pr.commits = 0
    ) as corrupted_prs
  FROM pull_requests pr
  WHERE pr.created_at >= NOW() - INTERVAL '24 hours'
  GROUP BY DATE_TRUNC('hour', pr.created_at)
)
SELECT 
  hour,
  total_prs,
  corrupted_prs,
  ROUND(corrupted_prs::numeric / NULLIF(total_prs, 0)::numeric * 100, 2) as corruption_rate,
  LAG(corrupted_prs, 1) OVER (ORDER BY hour) as prev_hour_corrupted,
  corrupted_prs - LAG(corrupted_prs, 1) OVER (ORDER BY hour) as corruption_delta
FROM hourly_stats
ORDER BY hour DESC;

-- 5. Alert query - returns true if immediate action needed
SELECT 
  CASE 
    WHEN EXISTS (
      -- More than 20 corrupted PRs in the last hour
      SELECT 1
      FROM pull_requests pr
      WHERE pr.created_at >= NOW() - INTERVAL '1 hour'
        AND pr.additions = 0 
        AND pr.deletions = 0 
        AND pr.changed_files = 0 
        AND pr.commits = 0
      HAVING COUNT(*) > 20
    ) THEN 'CRITICAL: More than 20 corrupted PRs in the last hour'
    
    WHEN EXISTS (
      -- Corruption rate > 50% for any active repository
      SELECT 1
      FROM repositories r
      JOIN pull_requests pr ON pr.repository_id = r.id
      WHERE r.is_active = true
        AND pr.created_at >= NOW() - INTERVAL '2 hours'
      GROUP BY r.id
      HAVING COUNT(*) FILTER (
        WHERE pr.additions = 0 
          AND pr.deletions = 0 
          AND pr.changed_files = 0 
          AND pr.commits = 0
      )::numeric / COUNT(*)::numeric > 0.5
    ) THEN 'WARNING: Corruption rate > 50% detected'
    
    ELSE 'OK: No significant corruption detected'
  END as alert_status,
  NOW() as check_time;
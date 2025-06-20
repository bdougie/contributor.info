-- Migration: Self-Selection Rate Analytics
-- Description: Functions and views for calculating internal vs external contribution rates

-- Create function to calculate self-selection rate
CREATE OR REPLACE FUNCTION calculate_self_selection_rate(
  p_repository_owner TEXT,
  p_repository_name TEXT,
  p_days_back INT DEFAULT 30
)
RETURNS TABLE (
  repository_owner TEXT,
  repository_name TEXT,
  external_contribution_rate NUMERIC,
  internal_contribution_rate NUMERIC,
  external_contributors INT,
  internal_contributors INT,
  total_contributors INT,
  external_prs INT,
  internal_prs INT,
  total_prs INT,
  analysis_period_days INT,
  analysis_start_date TIMESTAMPTZ,
  analysis_end_date TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  WITH pr_stats AS (
    SELECT 
      pr.user_id,
      pr.id as pr_id,
      COALESCE(cr.role, 'contributor') as contributor_type,
      COALESCE(cr.confidence_score, 0) as confidence_score,
      pr.created_at
    FROM pull_requests pr
    LEFT JOIN contributor_roles cr 
      ON pr.user_id = cr.user_id 
      AND pr.repository_owner = cr.repository_owner 
      AND pr.repository_name = cr.repository_name
    WHERE pr.repository_owner = p_repository_owner
      AND pr.repository_name = p_repository_name
      AND pr.created_at >= NOW() - (p_days_back || ' days')::INTERVAL
  ),
  contribution_summary AS (
    SELECT
      COUNT(DISTINCT CASE 
        WHEN contributor_type IN ('owner', 'maintainer') 
        THEN user_id 
      END) as internal_contributors,
      COUNT(DISTINCT CASE 
        WHEN contributor_type = 'contributor' 
        THEN user_id 
      END) as external_contributors,
      COUNT(DISTINCT user_id) as total_contributors,
      COUNT(DISTINCT CASE 
        WHEN contributor_type IN ('owner', 'maintainer') 
        THEN pr_id 
      END) as internal_prs,
      COUNT(DISTINCT CASE 
        WHEN contributor_type = 'contributor' 
        THEN pr_id 
      END) as external_prs,
      COUNT(DISTINCT pr_id) as total_prs,
      MIN(created_at) as start_date,
      MAX(created_at) as end_date
    FROM pr_stats
  )
  SELECT 
    p_repository_owner,
    p_repository_name,
    ROUND(100.0 * external_prs / NULLIF(total_prs, 0), 2) as external_contribution_rate,
    ROUND(100.0 * internal_prs / NULLIF(total_prs, 0), 2) as internal_contribution_rate,
    external_contributors,
    internal_contributors,
    total_contributors,
    external_prs,
    internal_prs,
    total_prs,
    p_days_back as analysis_period_days,
    start_date as analysis_start_date,
    end_date as analysis_end_date
  FROM contribution_summary;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create materialized view for repository contribution stats
CREATE MATERIALIZED VIEW IF NOT EXISTS repository_contribution_stats AS
WITH recent_contributions AS (
  SELECT 
    pr.repository_owner,
    pr.repository_name,
    pr.user_id,
    pr.id as pr_id,
    COALESCE(cr.role, 'contributor') as contributor_type,
    COALESCE(cr.confidence_score, 0) as confidence_score,
    pr.created_at,
    DATE_TRUNC('month', pr.created_at) as contribution_month
  FROM pull_requests pr
  LEFT JOIN contributor_roles cr 
    ON pr.user_id = cr.user_id 
    AND pr.repository_owner = cr.repository_owner 
    AND pr.repository_name = cr.repository_name
  WHERE pr.created_at >= NOW() - INTERVAL '6 months'
),
monthly_stats AS (
  SELECT
    repository_owner,
    repository_name,
    contribution_month,
    COUNT(DISTINCT CASE 
      WHEN contributor_type IN ('owner', 'maintainer') 
      THEN user_id 
    END) as internal_contributors,
    COUNT(DISTINCT CASE 
      WHEN contributor_type = 'contributor' 
      THEN user_id 
    END) as external_contributors,
    COUNT(CASE 
      WHEN contributor_type IN ('owner', 'maintainer') 
      THEN pr_id 
    END) as internal_prs,
    COUNT(CASE 
      WHEN contributor_type = 'contributor' 
      THEN pr_id 
    END) as external_prs,
    COUNT(pr_id) as total_prs
  FROM recent_contributions
  GROUP BY repository_owner, repository_name, contribution_month
)
SELECT 
  repository_owner,
  repository_name,
  contribution_month,
  internal_contributors,
  external_contributors,
  internal_contributors + external_contributors as total_contributors,
  internal_prs,
  external_prs,
  total_prs,
  ROUND(100.0 * external_prs / NULLIF(total_prs, 0), 2) as external_contribution_rate,
  ROUND(100.0 * internal_prs / NULLIF(total_prs, 0), 2) as internal_contribution_rate
FROM monthly_stats
ORDER BY repository_owner, repository_name, contribution_month DESC;

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_contribution_stats_repo_month 
  ON repository_contribution_stats(repository_owner, repository_name, contribution_month);

-- Create function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_contribution_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY repository_contribution_stats;
END;
$$ LANGUAGE plpgsql;

-- Schedule refresh of materialized view (daily at 4 AM)
SELECT cron.schedule(
  'refresh-contribution-stats-daily',
  '0 4 * * *', -- Daily at 4:00 AM
  $$
  SELECT refresh_contribution_stats();
  $$
);

-- Create view for maintainer effectiveness metrics
CREATE OR REPLACE VIEW maintainer_effectiveness AS
WITH maintainer_activity AS (
  SELECT 
    cr.user_id,
    cr.repository_owner,
    cr.repository_name,
    cr.role,
    cr.confidence_score,
    COUNT(DISTINCT ec.id) as total_events,
    COUNT(DISTINCT CASE WHEN ec.is_privileged THEN ec.id END) as privileged_events,
    COUNT(DISTINCT ec.event_type) as event_diversity,
    MAX(ec.created_at) as last_active_at,
    MIN(ec.created_at) as first_active_at
  FROM contributor_roles cr
  INNER JOIN github_events_cache ec
    ON cr.user_id = ec.actor_login
    AND cr.repository_owner = ec.repository_owner
    AND cr.repository_name = ec.repository_name
  WHERE cr.role IN ('owner', 'maintainer')
    AND ec.created_at >= NOW() - INTERVAL '90 days'
  GROUP BY cr.user_id, cr.repository_owner, cr.repository_name, cr.role, cr.confidence_score
)
SELECT 
  user_id,
  repository_owner,
  repository_name,
  role,
  confidence_score,
  total_events,
  privileged_events,
  ROUND(100.0 * privileged_events / NULLIF(total_events, 0), 2) as privileged_event_rate,
  event_diversity,
  DATE_PART('day', NOW() - last_active_at) as days_since_last_active,
  DATE_PART('day', last_active_at - first_active_at) as active_period_days
FROM maintainer_activity
ORDER BY confidence_score DESC, privileged_events DESC;

-- Grant permissions
GRANT SELECT ON repository_contribution_stats TO authenticated;
GRANT SELECT ON maintainer_effectiveness TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_self_selection_rate TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_contribution_stats TO authenticated;

-- Comments
COMMENT ON FUNCTION calculate_self_selection_rate IS 'Calculate the rate of external vs internal contributions for a repository';
COMMENT ON MATERIALIZED VIEW repository_contribution_stats IS 'Pre-calculated monthly contribution statistics for all repositories';
COMMENT ON VIEW maintainer_effectiveness IS 'Metrics showing maintainer activity and effectiveness';
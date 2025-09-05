-- Migration: Workspace Events Integration
-- Adds SQL functions to support GitHub events cache integration with workspaces

-- =====================================================
-- WORKSPACE REPOSITORY EVENT SUMMARIES FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION get_workspace_repository_event_summaries(
  p_workspace_id UUID,
  p_start_date TIMESTAMP WITH TIME ZONE,
  p_end_date TIMESTAMP WITH TIME ZONE,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  repository_owner TEXT,
  repository_name TEXT,
  star_events BIGINT,
  fork_events BIGINT,
  total_events BIGINT,
  last_activity TIMESTAMP WITH TIME ZONE,
  unique_actors BIGINT
) AS $$
BEGIN
  -- Validate input parameters
  IF p_limit <= 0 OR p_limit > 1000 THEN
    RAISE EXCEPTION 'Limit must be between 1 and 1000, got %', p_limit;
  END IF;
  
  IF p_offset < 0 THEN
    RAISE EXCEPTION 'Offset cannot be negative, got %', p_offset;
  END IF;

  RETURN QUERY
  WITH workspace_repos AS (
    SELECT 
      r.owner,
      r.name
    FROM workspace_repositories wr
    JOIN repositories r ON wr.repository_id = r.id
    WHERE wr.workspace_id = p_workspace_id
  ),
  event_summaries AS (
    SELECT 
      gec.repository_owner,
      gec.repository_name,
      COUNT(*) FILTER (WHERE gec.event_type = 'WatchEvent') as star_events,
      COUNT(*) FILTER (WHERE gec.event_type = 'ForkEvent') as fork_events,
      COUNT(*) as total_events,
      MAX(gec.created_at) as last_activity,
      COUNT(DISTINCT gec.actor_login) as unique_actors
    FROM github_events_cache gec
    JOIN workspace_repos wr ON (
      gec.repository_owner = wr.owner AND 
      gec.repository_name = wr.name
    )
    WHERE 
      gec.created_at >= p_start_date 
      AND gec.created_at <= p_end_date
      AND gec.event_type IN ('WatchEvent', 'ForkEvent', 'PullRequestEvent', 'IssuesEvent')
    GROUP BY gec.repository_owner, gec.repository_name
  )
  SELECT 
    es.repository_owner,
    es.repository_name,
    COALESCE(es.star_events, 0)::BIGINT,
    COALESCE(es.fork_events, 0)::BIGINT,
    COALESCE(es.total_events, 0)::BIGINT,
    es.last_activity,
    COALESCE(es.unique_actors, 0)::BIGINT
  FROM event_summaries es
  ORDER BY es.total_events DESC, es.last_activity DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- WORKSPACE EVENT METRICS AGGREGATION FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION get_workspace_event_metrics_aggregated(
  p_workspace_id UUID,
  p_start_date TIMESTAMP WITH TIME ZONE,
  p_end_date TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
  total_star_events BIGINT,
  total_fork_events BIGINT,
  total_pr_events BIGINT,
  total_issue_events BIGINT,
  unique_actors BIGINT,
  most_active_repo_owner TEXT,
  most_active_repo_name TEXT,
  most_active_repo_events BIGINT,
  daily_timeline JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH workspace_repos AS (
    SELECT 
      r.owner,
      r.name
    FROM workspace_repositories wr
    JOIN repositories r ON wr.repository_id = r.id
    WHERE wr.workspace_id = p_workspace_id
  ),
  workspace_events AS (
    SELECT 
      gec.*
    FROM github_events_cache gec
    JOIN workspace_repos wr ON (
      gec.repository_owner = wr.owner AND 
      gec.repository_name = wr.name
    )
    WHERE 
      gec.created_at >= p_start_date 
      AND gec.created_at <= p_end_date
  ),
  event_counts AS (
    SELECT 
      COUNT(*) FILTER (WHERE event_type = 'WatchEvent') as star_events,
      COUNT(*) FILTER (WHERE event_type = 'ForkEvent') as fork_events,
      COUNT(*) FILTER (WHERE event_type = 'PullRequestEvent') as pr_events,
      COUNT(*) FILTER (WHERE event_type = 'IssuesEvent') as issue_events,
      COUNT(DISTINCT actor_login) as unique_actors
    FROM workspace_events
  ),
  most_active AS (
    SELECT 
      repository_owner,
      repository_name,
      COUNT(*) as event_count
    FROM workspace_events
    GROUP BY repository_owner, repository_name
    ORDER BY COUNT(*) DESC
    LIMIT 1
  ),
  daily_timeline AS (
    SELECT 
      jsonb_agg(
        jsonb_build_object(
          'date', day_date,
          'stars', COALESCE(star_count, 0),
          'forks', COALESCE(fork_count, 0),
          'prs', COALESCE(pr_count, 0),
          'issues', COALESCE(issue_count, 0),
          'total', COALESCE(total_count, 0)
        ) ORDER BY day_date
      ) as timeline_json
    FROM (
      SELECT 
        DATE(created_at) as day_date,
        COUNT(*) FILTER (WHERE event_type = 'WatchEvent') as star_count,
        COUNT(*) FILTER (WHERE event_type = 'ForkEvent') as fork_count,
        COUNT(*) FILTER (WHERE event_type = 'PullRequestEvent') as pr_count,
        COUNT(*) FILTER (WHERE event_type = 'IssuesEvent') as issue_count,
        COUNT(*) as total_count
      FROM workspace_events
      GROUP BY DATE(created_at)
    ) daily_data
  )
  SELECT 
    ec.star_events,
    ec.fork_events,
    ec.pr_events,
    ec.issue_events,
    ec.unique_actors,
    ma.repository_owner,
    ma.repository_name,
    COALESCE(ma.event_count, 0)::BIGINT,
    COALESCE(dt.timeline_json, '[]'::jsonb)
  FROM event_counts ec
  CROSS JOIN daily_timeline dt
  LEFT JOIN most_active ma ON true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- WORKSPACE ACTIVITY VELOCITY FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION get_workspace_activity_velocity(
  p_workspace_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  period_start TIMESTAMP WITH TIME ZONE,
  period_end TIMESTAMP WITH TIME ZONE,
  total_events BIGINT,
  daily_average NUMERIC(10,2),
  star_velocity NUMERIC(10,2),
  fork_velocity NUMERIC(10,2),
  growth_trend TEXT,
  peak_activity_date DATE,
  peak_activity_count BIGINT
) AS $$
DECLARE
  start_date TIMESTAMP WITH TIME ZONE;
  end_date TIMESTAMP WITH TIME ZONE;
BEGIN
  end_date := NOW();
  start_date := end_date - (p_days || ' days')::INTERVAL;
  
  RETURN QUERY
  WITH workspace_repos AS (
    SELECT 
      r.owner,
      r.name
    FROM workspace_repositories wr
    JOIN repositories r ON wr.repository_id = r.id
    WHERE wr.workspace_id = p_workspace_id
  ),
  workspace_events AS (
    SELECT 
      gec.*
    FROM github_events_cache gec
    JOIN workspace_repos wr ON (
      gec.repository_owner = wr.owner AND 
      gec.repository_name = wr.name
    )
    WHERE 
      gec.created_at >= start_date 
      AND gec.created_at <= end_date
      AND gec.event_type IN ('WatchEvent', 'ForkEvent')
  ),
  velocity_metrics AS (
    SELECT 
      COUNT(*) as total_events,
      COUNT(*) FILTER (WHERE event_type = 'WatchEvent') as star_events,
      COUNT(*) FILTER (WHERE event_type = 'ForkEvent') as fork_events
    FROM workspace_events
  ),
  daily_activity AS (
    SELECT 
      DATE(created_at) as activity_date,
      COUNT(*) as daily_count
    FROM workspace_events
    GROUP BY DATE(created_at)
  ),
  peak_day AS (
    SELECT 
      activity_date,
      daily_count
    FROM daily_activity
    ORDER BY daily_count DESC
    LIMIT 1
  ),
  trend_analysis AS (
    SELECT 
      CASE 
        WHEN COUNT(*) = 0 THEN 'stable'
        WHEN COUNT(*) FILTER (WHERE DATE(created_at) >= CURRENT_DATE - 7) > 
             COUNT(*) FILTER (WHERE DATE(created_at) >= CURRENT_DATE - 14 AND DATE(created_at) < CURRENT_DATE - 7) 
        THEN 'up'
        WHEN COUNT(*) FILTER (WHERE DATE(created_at) >= CURRENT_DATE - 7) < 
             COUNT(*) FILTER (WHERE DATE(created_at) >= CURRENT_DATE - 14 AND DATE(created_at) < CURRENT_DATE - 7) 
        THEN 'down'
        ELSE 'stable'
      END as trend
    FROM workspace_events
  )
  SELECT 
    start_date,
    end_date,
    vm.total_events,
    ROUND(vm.total_events::NUMERIC / GREATEST(p_days, 1), 2),
    ROUND(vm.star_events::NUMERIC / GREATEST(p_days, 1), 2),
    ROUND(vm.fork_events::NUMERIC / GREATEST(p_days, 1), 2),
    ta.trend,
    pd.activity_date,
    COALESCE(pd.daily_count, 0)::BIGINT
  FROM velocity_metrics vm
  CROSS JOIN trend_analysis ta
  LEFT JOIN peak_day pd ON true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Composite index for workspace event queries
CREATE INDEX IF NOT EXISTS idx_github_events_workspace_lookup 
ON github_events_cache (repository_owner, repository_name, event_type, created_at DESC);

-- Index for activity timeline queries
CREATE INDEX IF NOT EXISTS idx_github_events_timeline 
ON github_events_cache (created_at, event_type) 
WHERE event_type IN ('WatchEvent', 'ForkEvent', 'PullRequestEvent', 'IssuesEvent');

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- Grant execute permissions to authenticated users and service role
GRANT EXECUTE ON FUNCTION get_workspace_repository_event_summaries(UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) 
TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION get_workspace_event_metrics_aggregated(UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) 
TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION get_workspace_activity_velocity(UUID, INTEGER) 
TO authenticated, service_role;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON FUNCTION get_workspace_repository_event_summaries IS 
'Returns event summaries for all repositories in a workspace within a date range';

COMMENT ON FUNCTION get_workspace_event_metrics_aggregated IS 
'Returns aggregated event metrics and timeline data for a workspace';

COMMENT ON FUNCTION get_workspace_activity_velocity IS 
'Calculates activity velocity and growth trends for a workspace over specified days';
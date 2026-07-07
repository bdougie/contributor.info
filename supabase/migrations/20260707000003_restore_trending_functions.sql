-- Migration: Restore trending functions dropped in 20260707000002
-- Purpose: netlify/functions/api-trending-repositories.mts (the /trending page
--          API, anon key) calls get_trending_repositories_with_fallback and
--          get_trending_statistics. The usage sweep behind 20260707000002
--          missed .mts files, so all three trending functions were dropped
--          as unreferenced.
--
-- get_trending_repositories and get_trending_statistics are restored verbatim
-- from 20250824000000_enhance_trending_capture.sql with the search_path
-- hardening from 20260428163616 applied.
--
-- get_trending_repositories_with_fallback was never committed to the repo
-- (applied to prod out-of-band by PR #1254); it is reconstructed from that
-- PR's documented behavior: return trending results, falling back to top
-- repositories by stars when no recent metrics data exists.

CREATE OR REPLACE FUNCTION get_trending_repositories(
  p_time_period INTERVAL DEFAULT INTERVAL '7 days',
  p_limit INTEGER DEFAULT 50,
  p_language TEXT DEFAULT NULL,
  p_min_stars INTEGER DEFAULT 0
) RETURNS TABLE (
  repository_id UUID,
  owner TEXT,
  name TEXT,
  description TEXT,
  language TEXT,
  stars INTEGER,
  trending_score DECIMAL,
  star_change DECIMAL,
  pr_change DECIMAL,
  contributor_change DECIMAL,
  last_activity TIMESTAMP WITH TIME ZONE,
  avatar_url TEXT,
  html_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id as repository_id,
    r.owner,
    r.name,
    r.description,
    r.language,
    r.stargazers_count as stars,
    COALESCE(metrics.total_change_score, 0)::DECIMAL as trending_score,
    COALESCE(metrics.star_change, 0)::DECIMAL as star_change,
    COALESCE(metrics.pr_change, 0)::DECIMAL as pr_change,
    COALESCE(metrics.contributor_change, 0)::DECIMAL as contributor_change,
    GREATEST(r.last_updated_at, COALESCE(metrics.last_update, r.first_tracked_at)) as last_activity,
    '' as avatar_url,  -- Avatar URL not available in repositories table
    CONCAT('https://github.com/', r.owner, '/', r.name) as html_url
  FROM repositories r
  LEFT JOIN LATERAL (
    SELECT
      rmh.repository_id,
      -- Enhanced scoring algorithm that weighs different metrics appropriately
      SUM(CASE
        WHEN metric_type = 'stars' THEN
          CASE
            -- If gained 100+ stars in the last day, give massive boost
            WHEN p_time_period <= INTERVAL '24 hours' AND change_amount >= 100 THEN
              1000.0 + (change_amount * 2.0)
            -- If gained 100+ stars recently (scaled by time period)
            WHEN change_amount >= 100 THEN
              500.0 + (change_amount * 1.5) + (change_percentage * 10.0)
            -- High percentage changes get boosted (for smaller repos growing fast)
            WHEN change_percentage >= 50 THEN
              200.0 + (change_percentage * 5.0)
            WHEN change_percentage >= 20 THEN
              100.0 + (change_percentage * 3.0)
            WHEN change_percentage > 0 THEN
              LEAST(change_percentage * 2.0, 100.0) * (1 + LOG(GREATEST(current_value, 1)) / 10.0)
            ELSE 0
          END
        WHEN metric_type = 'pull_requests' AND change_percentage > 0 THEN
          LEAST(change_percentage * 1.5, 75.0) * 1.2
        WHEN metric_type = 'contributors' AND change_percentage > 0 THEN
          LEAST(change_percentage * 3.0, 150.0) * 1.1
        WHEN metric_type = 'forks' AND change_percentage > 0 THEN
          LEAST(change_percentage * 1.0, 50.0)
        WHEN metric_type = 'watchers' AND change_percentage > 0 THEN
          LEAST(change_percentage * 0.8, 40.0)
        ELSE 0
      END) as total_change_score,
      MAX(CASE WHEN metric_type = 'stars' THEN change_percentage ELSE 0 END) as star_change,
      MAX(CASE WHEN metric_type = 'pull_requests' THEN change_percentage ELSE 0 END) as pr_change,
      MAX(CASE WHEN metric_type = 'contributors' THEN change_percentage ELSE 0 END) as contributor_change,
      MAX(captured_at) as last_update
    FROM repository_metrics_history rmh
    WHERE
      rmh.repository_id = r.id
      AND rmh.captured_at > NOW() - p_time_period
      AND rmh.is_significant = TRUE
    GROUP BY rmh.repository_id
  ) metrics ON true
  WHERE
    r.stargazers_count >= p_min_stars
    AND (p_language IS NULL OR r.language = p_language)
    AND metrics.total_change_score > 0
    AND r.is_private = FALSE  -- Use is_private column instead of visibility
  ORDER BY metrics.total_change_score DESC, r.stargazers_count DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog, pg_temp;

CREATE OR REPLACE FUNCTION get_trending_statistics(
  p_time_period INTERVAL DEFAULT INTERVAL '7 days'
) RETURNS TABLE (
  total_trending_repos INTEGER,
  avg_trending_score DECIMAL,
  top_language TEXT,
  total_star_growth INTEGER,
  total_new_contributors INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT rmh.repository_id)::INTEGER as total_trending_repos,
    ROUND(AVG(rmh.change_percentage)::NUMERIC, 2) as avg_trending_score,
    (
      SELECT r.language
      FROM repository_metrics_history rmh2
      JOIN repositories r ON r.id = rmh2.repository_id
      WHERE rmh2.captured_at > NOW() - p_time_period
        AND rmh2.is_significant = TRUE
        AND r.language IS NOT NULL
      GROUP BY r.language
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) as top_language,
    COALESCE(SUM(CASE WHEN rmh.metric_type = 'stars' THEN rmh.change_amount ELSE 0 END), 0)::INTEGER as total_star_growth,
    COALESCE(SUM(CASE WHEN rmh.metric_type = 'contributors' THEN rmh.change_amount ELSE 0 END), 0)::INTEGER as total_new_contributors
  FROM repository_metrics_history rmh
  WHERE
    rmh.captured_at > NOW() - p_time_period
    AND rmh.is_significant = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog, pg_temp;

CREATE OR REPLACE FUNCTION get_trending_repositories_with_fallback(
  p_time_period INTERVAL DEFAULT INTERVAL '7 days',
  p_limit INTEGER DEFAULT 50,
  p_language TEXT DEFAULT NULL,
  p_min_stars INTEGER DEFAULT 0
) RETURNS TABLE (
  repository_id UUID,
  owner TEXT,
  name TEXT,
  description TEXT,
  language TEXT,
  stars INTEGER,
  trending_score DECIMAL,
  star_change DECIMAL,
  pr_change DECIMAL,
  contributor_change DECIMAL,
  last_activity TIMESTAMP WITH TIME ZONE,
  avatar_url TEXT,
  html_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM get_trending_repositories(p_time_period, p_limit, p_language, p_min_stars);

  -- No recent trending data: fall back to top repositories by stars so the
  -- /trending page always shows content (PR #1254)
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      r.id as repository_id,
      r.owner,
      r.name,
      r.description,
      r.language,
      r.stargazers_count as stars,
      0::DECIMAL as trending_score,
      0::DECIMAL as star_change,
      0::DECIMAL as pr_change,
      0::DECIMAL as contributor_change,
      GREATEST(r.last_updated_at, r.first_tracked_at) as last_activity,
      '' as avatar_url,
      CONCAT('https://github.com/', r.owner, '/', r.name) as html_url
    FROM repositories r
    WHERE
      r.stargazers_count >= p_min_stars
      AND (p_language IS NULL OR r.language = p_language)
      AND r.is_private = FALSE
    ORDER BY r.stargazers_count DESC
    LIMIT p_limit;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog, pg_temp;

-- api-trending-repositories.mts calls these with the anon key
GRANT EXECUTE ON FUNCTION get_trending_repositories(INTERVAL, INTEGER, TEXT, INTEGER) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_trending_repositories_with_fallback(INTERVAL, INTEGER, TEXT, INTEGER) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_trending_statistics(INTERVAL) TO anon, authenticated, service_role;

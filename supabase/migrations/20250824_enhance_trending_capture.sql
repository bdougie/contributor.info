-- Enhanced trending capture system for comprehensive trend detection
-- This migration adds additional functionality for trend capture and analysis

-- Create a function to capture repository metrics with better error handling
CREATE OR REPLACE FUNCTION capture_repository_metrics(
  p_repository_id UUID,
  p_metric_type TEXT,
  p_current_value INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  v_previous_value INTEGER;
  v_exists BOOLEAN;
BEGIN
  -- Validate input parameters
  IF p_repository_id IS NULL OR p_metric_type IS NULL OR p_current_value IS NULL THEN
    RAISE EXCEPTION 'All parameters are required for metrics capture';
  END IF;

  -- Check if repository exists
  SELECT EXISTS(SELECT 1 FROM repositories WHERE id = p_repository_id) INTO v_exists;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'Repository with id % does not exist', p_repository_id;
  END IF;

  -- Get the most recent value for this metric
  SELECT current_value INTO v_previous_value
  FROM repository_metrics_history 
  WHERE repository_id = p_repository_id 
    AND metric_type = p_metric_type 
  ORDER BY captured_at DESC 
  LIMIT 1;

  -- Only insert if value has changed or this is the first capture
  IF v_previous_value IS NULL OR v_previous_value != p_current_value THEN
    INSERT INTO repository_metrics_history (
      repository_id,
      metric_type,
      previous_value,
      current_value,
      captured_at
    ) VALUES (
      p_repository_id,
      p_metric_type,
      v_previous_value,
      p_current_value,
      NOW()
    );
    
    RETURN TRUE;
  END IF;
  
  RETURN FALSE; -- No change detected
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get trending repositories with improved scoring
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
    COALESCE(metrics.total_change_score, 0) as trending_score,
    COALESCE(metrics.star_change, 0) as star_change,
    COALESCE(metrics.pr_change, 0) as pr_change,
    COALESCE(metrics.contributor_change, 0) as contributor_change,
    GREATEST(r.last_updated_at, COALESCE(metrics.last_update, r.first_tracked_at)) as last_activity,
    '' as avatar_url,  -- Avatar URL not available in repositories table
    CONCAT('https://github.com/', r.owner, '/', r.name) as html_url
  FROM repositories r
  LEFT JOIN LATERAL (
    SELECT 
      repository_id,
      -- Enhanced scoring algorithm that weighs different metrics appropriately
      SUM(CASE 
        WHEN metric_type = 'stars' AND change_percentage > 0 THEN 
          LEAST(change_percentage * 2.0, 100.0) * (1 + LOG(GREATEST(current_value, 1)) / 10.0)
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
    FROM repository_metrics_history
    WHERE 
      repository_id = r.id
      AND captured_at > NOW() - p_time_period
      AND is_significant = TRUE
    GROUP BY repository_id
  ) metrics ON true
  WHERE 
    r.stargazers_count >= p_min_stars
    AND (p_language IS NULL OR r.language = p_language)
    AND metrics.total_change_score > 0
    AND r.is_private = FALSE  -- Use is_private column instead of visibility
  ORDER BY metrics.total_change_score DESC, r.stargazers_count DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get trending statistics summary
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
    ROUND(AVG(rmh.change_percentage), 2) as avg_trending_score,
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a view for trending repositories with time-based filtering
CREATE OR REPLACE VIEW trending_repositories_24h AS
SELECT * FROM get_trending_repositories(INTERVAL '24 hours');

CREATE OR REPLACE VIEW trending_repositories_30d AS
SELECT * FROM get_trending_repositories(INTERVAL '30 days');

-- Create index for faster trending queries
CREATE INDEX IF NOT EXISTS idx_metrics_history_trending_composite_enhanced 
ON repository_metrics_history (repository_id, metric_type, captured_at DESC, is_significant) 
WHERE is_significant = TRUE;

-- Create a trigger to update repository last_activity when metrics change
CREATE OR REPLACE FUNCTION update_repository_last_activity() 
RETURNS TRIGGER AS $$
BEGIN
  -- Update the repository's last_updated_at when significant metrics change
  IF NEW.is_significant = TRUE THEN
    UPDATE repositories 
    SET last_updated_at = NEW.captured_at 
    WHERE id = NEW.repository_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_repository_activity ON repository_metrics_history;
CREATE TRIGGER trigger_update_repository_activity
  AFTER INSERT ON repository_metrics_history
  FOR EACH ROW
  WHEN (NEW.is_significant = TRUE)
  EXECUTE FUNCTION update_repository_last_activity();

-- Create a function to batch capture metrics (for bulk updates)
CREATE OR REPLACE FUNCTION batch_capture_metrics(
  metrics_data JSONB
) RETURNS INTEGER AS $$
DECLARE
  metric_record RECORD;
  inserted_count INTEGER := 0;
BEGIN
  -- Loop through each metric in the JSON array
  FOR metric_record IN 
    SELECT 
      (item->>'repository_id')::UUID as repository_id,
      item->>'metric_type' as metric_type,
      (item->>'current_value')::INTEGER as current_value
    FROM jsonb_array_elements(metrics_data) as item
  LOOP
    -- Use the existing capture function
    IF capture_repository_metrics(
      metric_record.repository_id,
      metric_record.metric_type,
      metric_record.current_value
    ) THEN
      inserted_count := inserted_count + 1;
    END IF;
  END LOOP;
  
  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add RLS policies for the new functions
CREATE POLICY "Public can read trending data" ON repository_metrics_history
  FOR SELECT USING (true);

-- Grant execute permissions for the functions to appropriate roles
GRANT EXECUTE ON FUNCTION capture_repository_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION get_trending_repositories TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_trending_statistics TO anon, authenticated;
GRANT EXECUTE ON FUNCTION batch_capture_metrics TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION capture_repository_metrics IS 'Captures repository metrics with validation and change detection';
COMMENT ON FUNCTION get_trending_repositories IS 'Returns trending repositories with enhanced scoring algorithm';
COMMENT ON FUNCTION get_trending_statistics IS 'Provides summary statistics for trending repositories';
COMMENT ON FUNCTION batch_capture_metrics IS 'Batch capture multiple repository metrics from JSON data';
COMMENT ON VIEW trending_repositories_24h IS 'Trending repositories in the last 24 hours';
COMMENT ON VIEW trending_repositories_30d IS 'Trending repositories in the last 30 days';
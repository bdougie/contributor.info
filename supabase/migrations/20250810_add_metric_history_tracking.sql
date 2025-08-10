-- Create table for tracking repository metric changes over time
-- This enables content freshness signals and trending detection

CREATE TABLE IF NOT EXISTS repository_metrics_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('stars', 'forks', 'pull_requests', 'contributors', 'issues', 'watchers')),
  previous_value INTEGER,
  current_value INTEGER NOT NULL,
  change_amount INTEGER GENERATED ALWAYS AS (current_value - COALESCE(previous_value, 0)) STORED,
  change_percentage DECIMAL(10, 2) GENERATED ALWAYS AS (
    CASE 
      WHEN previous_value IS NULL OR previous_value = 0 THEN NULL
      ELSE ((current_value - previous_value)::DECIMAL / previous_value * 100)
    END
  ) STORED,
  is_significant BOOLEAN DEFAULT FALSE,
  captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Index for efficient queries
  CONSTRAINT unique_metric_capture UNIQUE (repository_id, metric_type, captured_at)
);

-- Create indexes for performance
CREATE INDEX idx_repository_metrics_history_repo ON repository_metrics_history(repository_id);
CREATE INDEX idx_repository_metrics_history_type ON repository_metrics_history(metric_type);
CREATE INDEX idx_repository_metrics_history_captured ON repository_metrics_history(captured_at DESC);
CREATE INDEX idx_repository_metrics_history_significant ON repository_metrics_history(is_significant) WHERE is_significant = TRUE;
CREATE INDEX idx_repository_metrics_history_trending ON repository_metrics_history(change_percentage DESC) WHERE change_percentage > 5;
-- Composite index for trending queries optimization
CREATE INDEX idx_metrics_trending_composite ON repository_metrics_history 
  (captured_at DESC, is_significant, change_percentage DESC) 
  WHERE captured_at > NOW() - INTERVAL '7 days';

-- Create table for repository changelog entries (auto-generated from significant changes)
CREATE TABLE IF NOT EXISTS repository_changelogs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  change_type TEXT NOT NULL CHECK (change_type IN ('milestone', 'trending', 'activity_spike', 'contributor_surge', 'release')),
  metadata JSONB DEFAULT '{}',
  importance_score INTEGER DEFAULT 0 CHECK (importance_score >= 0 AND importance_score <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure we don't duplicate entries
  CONSTRAINT unique_changelog_entry UNIQUE (repository_id, title, created_at)
);

-- Create indexes for changelog
CREATE INDEX idx_repository_changelogs_repo ON repository_changelogs(repository_id);
CREATE INDEX idx_repository_changelogs_created ON repository_changelogs(created_at DESC);
CREATE INDEX idx_repository_changelogs_type ON repository_changelogs(change_type);
CREATE INDEX idx_repository_changelogs_importance ON repository_changelogs(importance_score DESC);

-- Create a function to detect significant changes
CREATE OR REPLACE FUNCTION detect_significant_metric_change()
RETURNS TRIGGER AS $$
DECLARE
  v_threshold DECIMAL := 5.0; -- 5% change threshold for determining significant changes (adjustable based on metric volatility)
  v_changelog_title TEXT;
  v_changelog_description TEXT;
  v_change_type TEXT;
  v_importance INTEGER;
BEGIN
  -- Mark as significant if change is > threshold
  IF NEW.change_percentage IS NOT NULL AND ABS(NEW.change_percentage) > v_threshold THEN
    NEW.is_significant := TRUE;
    
    -- Generate changelog entry for significant changes
    CASE NEW.metric_type
      WHEN 'stars' THEN
        v_changelog_title := 
          CASE 
            WHEN NEW.change_percentage > 0 THEN 'Repository gained ' || NEW.change_amount || ' stars'
            ELSE 'Repository lost ' || ABS(NEW.change_amount) || ' stars'
          END;
        v_change_type := CASE WHEN NEW.change_percentage > 20 THEN 'trending' ELSE 'activity_spike' END;
        v_importance := LEAST(100, ABS(NEW.change_percentage)::INTEGER * 2);
        
      WHEN 'contributors' THEN
        v_changelog_title := NEW.change_amount || ' new contributors joined';
        v_change_type := 'contributor_surge';
        v_importance := LEAST(100, NEW.change_amount * 10);
        
      WHEN 'pull_requests' THEN
        v_changelog_title := 'PR activity ' || 
          CASE 
            WHEN NEW.change_percentage > 0 THEN 'increased by ' || ROUND(NEW.change_percentage) || '%'
            ELSE 'decreased by ' || ROUND(ABS(NEW.change_percentage)) || '%'
          END;
        v_change_type := 'activity_spike';
        v_importance := LEAST(100, ABS(NEW.change_percentage)::INTEGER);
        
      ELSE
        v_changelog_title := NEW.metric_type || ' changed by ' || ROUND(NEW.change_percentage) || '%';
        v_change_type := 'activity_spike';
        v_importance := LEAST(100, ABS(NEW.change_percentage)::INTEGER);
    END CASE;
    
    -- Use format() for safer string concatenation to prevent injection
    v_changelog_description := format('Metric changed from %s to %s (%s%% change)', 
                               COALESCE(NEW.previous_value::TEXT, 'unknown'),
                               NEW.current_value, 
                               CASE 
                                 WHEN NEW.change_percentage > 0 THEN '+' || ROUND(NEW.change_percentage)
                                 ELSE ROUND(NEW.change_percentage)::TEXT
                               END);
    
    -- Insert changelog entry (ignore conflicts)
    INSERT INTO repository_changelogs (
      repository_id,
      title,
      description,
      change_type,
      metadata,
      importance_score
    ) VALUES (
      NEW.repository_id,
      v_changelog_title,
      v_changelog_description,
      v_change_type,
      jsonb_build_object(
        'metric_type', NEW.metric_type,
        'previous_value', NEW.previous_value,
        'current_value', NEW.current_value,
        'change_percentage', NEW.change_percentage
      ),
      v_importance
    ) ON CONFLICT (repository_id, title, created_at) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic detection
CREATE TRIGGER detect_significant_changes
  BEFORE INSERT ON repository_metrics_history
  FOR EACH ROW
  EXECUTE FUNCTION detect_significant_metric_change();

-- Create a view for trending repositories (last 7 days)
CREATE OR REPLACE VIEW trending_repositories AS
SELECT 
  r.id,
  r.owner,
  r.name,
  r.description,
  r.stargazers_count as stars,
  r.language,
  COALESCE(metrics.total_change_score, 0) as trending_score,
  COALESCE(metrics.star_change, 0) as star_change,
  COALESCE(metrics.pr_change, 0) as pr_change,
  COALESCE(metrics.contributor_change, 0) as contributor_change,
  GREATEST(r.last_updated_at, metrics.last_update) as last_activity
FROM repositories r
LEFT JOIN LATERAL (
  SELECT 
    repository_id,
    SUM(CASE 
      WHEN metric_type = 'stars' AND change_percentage > 0 THEN change_percentage * 2
      WHEN metric_type = 'pull_requests' AND change_percentage > 0 THEN change_percentage * 1.5
      WHEN metric_type = 'contributors' AND change_percentage > 0 THEN change_percentage * 3
      ELSE 0
    END) as total_change_score,
    MAX(CASE WHEN metric_type = 'stars' THEN change_percentage ELSE 0 END) as star_change,
    MAX(CASE WHEN metric_type = 'pull_requests' THEN change_percentage ELSE 0 END) as pr_change,
    MAX(CASE WHEN metric_type = 'contributors' THEN change_percentage ELSE 0 END) as contributor_change,
    MAX(captured_at) as last_update
  FROM repository_metrics_history
  WHERE 
    repository_id = r.id
    AND captured_at > NOW() - INTERVAL '7 days'
    AND is_significant = TRUE
  GROUP BY repository_id
) metrics ON true
WHERE metrics.total_change_score > 0
ORDER BY metrics.total_change_score DESC;

-- Create a function to get repository freshness
CREATE OR REPLACE FUNCTION get_repository_freshness(p_repository_id UUID)
RETURNS TABLE (
  freshness_status TEXT,
  last_data_update TIMESTAMP WITH TIME ZONE,
  hours_since_update NUMERIC,
  has_recent_activity BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN MAX(captured_at) > NOW() - INTERVAL '24 hours' THEN 'fresh'
      WHEN MAX(captured_at) > NOW() - INTERVAL '7 days' THEN 'stale'
      ELSE 'old'
    END as freshness_status,
    MAX(captured_at) as last_data_update,
    EXTRACT(EPOCH FROM (NOW() - MAX(captured_at))) / 3600 as hours_since_update,
    EXISTS(
      SELECT 1 
      FROM repository_metrics_history 
      WHERE repository_id = p_repository_id 
        AND captured_at > NOW() - INTERVAL '24 hours'
    ) as has_recent_activity
  FROM repository_metrics_history
  WHERE repository_id = p_repository_id;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE repository_metrics_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE repository_changelogs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (public read, authenticated write)
CREATE POLICY "Public can read metrics history" ON repository_metrics_history
  FOR SELECT USING (true);

CREATE POLICY "System can insert metrics history" ON repository_metrics_history
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can read changelogs" ON repository_changelogs
  FOR SELECT USING (true);

CREATE POLICY "System can insert changelogs" ON repository_changelogs
  FOR INSERT WITH CHECK (true);

-- Add comments for documentation
COMMENT ON TABLE repository_metrics_history IS 'Tracks changes in repository metrics over time for trend detection and freshness signals';
COMMENT ON TABLE repository_changelogs IS 'Auto-generated changelog entries for significant repository changes';
COMMENT ON VIEW trending_repositories IS 'Shows repositories with significant positive metric changes in the last 7 days';
COMMENT ON FUNCTION get_repository_freshness IS 'Returns the data freshness status for a repository';

-- Create a function for cleaning up old metric history (data older than 6 months)
CREATE OR REPLACE FUNCTION cleanup_old_metrics_history()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Delete metric history older than 6 months, keeping significant changes for 1 year
  DELETE FROM repository_metrics_history
  WHERE 
    (captured_at < NOW() - INTERVAL '6 months' AND is_significant = FALSE)
    OR (captured_at < NOW() - INTERVAL '1 year');
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  -- Also cleanup old changelog entries (keep for 1 year)
  DELETE FROM repository_changelogs
  WHERE created_at < NOW() - INTERVAL '1 year';
  
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_metrics_history IS 'Removes old metric history data to manage storage. Keeps significant changes for 1 year, others for 6 months.';
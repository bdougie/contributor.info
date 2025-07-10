-- Add rollout configuration tables for hybrid progressive capture
-- This enables gradual rollout with safety controls and monitoring

-- Create rollout configuration table
CREATE TABLE IF NOT EXISTS rollout_configuration (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feature_name VARCHAR(100) NOT NULL,
  rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  is_active BOOLEAN DEFAULT false,
  target_repositories TEXT[] DEFAULT '{}', -- Array of repository IDs for whitelist
  excluded_repositories TEXT[] DEFAULT '{}', -- Array of repository IDs for blacklist
  rollout_strategy VARCHAR(50) DEFAULT 'percentage', -- 'percentage', 'whitelist', 'repository_size'
  max_error_rate DECIMAL(5,2) DEFAULT 5.0, -- Maximum error rate before auto-rollback
  monitoring_window_hours INTEGER DEFAULT 24, -- Window for monitoring rollout health
  auto_rollback_enabled BOOLEAN DEFAULT true,
  emergency_stop BOOLEAN DEFAULT false, -- Manual emergency stop
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create repository categorization table
CREATE TABLE IF NOT EXISTS repository_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE,
  category VARCHAR(20) NOT NULL, -- 'test', 'small', 'medium', 'large', 'enterprise'
  priority_level INTEGER DEFAULT 0, -- 0 = lowest priority, 100 = highest priority
  is_test_repository BOOLEAN DEFAULT false,
  star_count INTEGER DEFAULT 0,
  contributor_count INTEGER DEFAULT 0,
  pr_count INTEGER DEFAULT 0,
  monthly_activity_score INTEGER DEFAULT 0,
  last_categorized_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(repository_id)
);

-- Create rollout metrics table for monitoring
CREATE TABLE IF NOT EXISTS rollout_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rollout_config_id UUID REFERENCES rollout_configuration(id) ON DELETE CASCADE,
  repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE,
  processor_type VARCHAR(20) NOT NULL, -- 'inngest' or 'github_actions'
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  total_jobs INTEGER DEFAULT 0,
  average_processing_time DECIMAL(10,2), -- in seconds
  last_error_message TEXT,
  last_error_at TIMESTAMP WITH TIME ZONE,
  metrics_window_start TIMESTAMP WITH TIME ZONE,
  metrics_window_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create rollout history table for audit trail
CREATE TABLE IF NOT EXISTS rollout_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rollout_config_id UUID REFERENCES rollout_configuration(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL, -- 'created', 'updated', 'rollback', 'emergency_stop'
  previous_percentage INTEGER,
  new_percentage INTEGER,
  reason TEXT,
  triggered_by VARCHAR(100), -- 'manual', 'auto_rollback', 'schedule'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_rollout_config_feature_active 
ON rollout_configuration(feature_name, is_active);

CREATE INDEX IF NOT EXISTS idx_rollout_config_emergency_stop 
ON rollout_configuration(emergency_stop, is_active);

CREATE INDEX IF NOT EXISTS idx_repo_categories_category 
ON repository_categories(category, priority_level);

CREATE INDEX IF NOT EXISTS idx_repo_categories_test 
ON repository_categories(is_test_repository, priority_level);

CREATE INDEX IF NOT EXISTS idx_rollout_metrics_config_repo 
ON rollout_metrics(rollout_config_id, repository_id, created_at);

CREATE INDEX IF NOT EXISTS idx_rollout_metrics_errors 
ON rollout_metrics(error_count, created_at) 
WHERE error_count > 0;

CREATE INDEX IF NOT EXISTS idx_rollout_history_config_action 
ON rollout_history(rollout_config_id, action, created_at);

-- Add RLS policies
ALTER TABLE rollout_configuration ENABLE ROW LEVEL SECURITY;
ALTER TABLE repository_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE rollout_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE rollout_history ENABLE ROW LEVEL SECURITY;

-- Allow public read access for monitoring
CREATE POLICY "rollout_config_public_read" 
ON rollout_configuration FOR SELECT 
TO public 
USING (true);

CREATE POLICY "repo_categories_public_read" 
ON repository_categories FOR SELECT 
TO public 
USING (true);

CREATE POLICY "rollout_metrics_public_read" 
ON rollout_metrics FOR SELECT 
TO public 
USING (true);

CREATE POLICY "rollout_history_public_read" 
ON rollout_history FOR SELECT 
TO public 
USING (true);

-- Insert initial rollout configuration for hybrid progressive capture
INSERT INTO rollout_configuration (
  feature_name,
  rollout_percentage,
  is_active,
  rollout_strategy,
  max_error_rate,
  monitoring_window_hours,
  auto_rollback_enabled,
  emergency_stop,
  metadata
) VALUES (
  'hybrid_progressive_capture',
  0, -- Start with 0% rollout
  true,
  'percentage',
  5.0,
  24,
  true,
  false,
  '{"description": "Hybrid progressive capture system with Inngest + GitHub Actions routing"}'
) ON CONFLICT DO NOTHING;

-- Function to automatically categorize repositories
CREATE OR REPLACE FUNCTION categorize_repository(repo_id UUID)
RETURNS TEXT AS $$
DECLARE
  star_count INTEGER;
  contributor_count INTEGER;
  pr_count INTEGER;
  category TEXT;
  priority INTEGER;
BEGIN
  -- Get repository stats
  SELECT 
    COALESCE(r.stargazers_count, 0),
    COALESCE(r.contributors_count, 0),
    COALESCE(pr_stats.pr_count, 0)
  INTO star_count, contributor_count, pr_count
  FROM repositories r
  LEFT JOIN (
    SELECT repository_id, COUNT(*) as pr_count
    FROM pull_requests
    WHERE repository_id = repo_id
    GROUP BY repository_id
  ) pr_stats ON r.id = pr_stats.repository_id
  WHERE r.id = repo_id;

  -- Categorize based on activity and size
  IF star_count = 0 AND contributor_count <= 2 AND pr_count <= 10 THEN
    category := 'test';
    priority := 100; -- Highest priority for testing
  ELSIF star_count <= 50 AND contributor_count <= 10 AND pr_count <= 100 THEN
    category := 'small';
    priority := 80;
  ELSIF star_count <= 500 AND contributor_count <= 50 AND pr_count <= 1000 THEN
    category := 'medium';
    priority := 60;
  ELSIF star_count <= 5000 AND contributor_count <= 200 AND pr_count <= 10000 THEN
    category := 'large';
    priority := 40;
  ELSE
    category := 'enterprise';
    priority := 20; -- Lowest priority for enterprise repos
  END IF;

  -- Insert or update categorization
  INSERT INTO repository_categories (
    repository_id,
    category,
    priority_level,
    is_test_repository,
    star_count,
    contributor_count,
    pr_count,
    monthly_activity_score
  ) VALUES (
    repo_id,
    category,
    priority,
    category = 'test',
    star_count,
    contributor_count,
    pr_count,
    LEAST(100, star_count + contributor_count + (pr_count / 10))
  )
  ON CONFLICT (repository_id) DO UPDATE SET
    category = EXCLUDED.category,
    priority_level = EXCLUDED.priority_level,
    is_test_repository = EXCLUDED.is_test_repository,
    star_count = EXCLUDED.star_count,
    contributor_count = EXCLUDED.contributor_count,
    pr_count = EXCLUDED.pr_count,
    monthly_activity_score = EXCLUDED.monthly_activity_score,
    last_categorized_at = NOW(),
    updated_at = NOW();

  RETURN category;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate rollout eligibility
CREATE OR REPLACE FUNCTION is_repository_eligible_for_rollout(
  repo_id UUID,
  feature_name TEXT DEFAULT 'hybrid_progressive_capture'
)
RETURNS BOOLEAN AS $$
DECLARE
  config_record RECORD;
  repo_category TEXT;
  is_eligible BOOLEAN := false;
BEGIN
  -- Get rollout configuration
  SELECT * INTO config_record
  FROM rollout_configuration
  WHERE rollout_configuration.feature_name = is_repository_eligible_for_rollout.feature_name
    AND is_active = true
    AND emergency_stop = false;

  -- If no active configuration, return false
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Check if explicitly excluded
  IF repo_id::TEXT = ANY(config_record.excluded_repositories) THEN
    RETURN false;
  END IF;

  -- Check if explicitly included (whitelist)
  IF repo_id::TEXT = ANY(config_record.target_repositories) THEN
    RETURN true;
  END IF;

  -- If whitelist strategy and not in whitelist, return false
  IF config_record.rollout_strategy = 'whitelist' AND 
     NOT (repo_id::TEXT = ANY(config_record.target_repositories)) THEN
    RETURN false;
  END IF;

  -- Get repository category
  SELECT category INTO repo_category
  FROM repository_categories
  WHERE repository_id = repo_id;

  -- If no category, categorize now
  IF NOT FOUND THEN
    repo_category := categorize_repository(repo_id);
  END IF;

  -- Apply rollout percentage based on category and strategy
  IF config_record.rollout_strategy = 'percentage' THEN
    -- Use hash-based deterministic selection
    is_eligible := (hashtext(repo_id::TEXT) % 100) < config_record.rollout_percentage;
  ELSIF config_record.rollout_strategy = 'repository_size' THEN
    -- Start with test repositories, then small, then larger
    CASE config_record.rollout_percentage
      WHEN 0 THEN is_eligible := false;
      WHEN 10 THEN is_eligible := repo_category = 'test';
      WHEN 25 THEN is_eligible := repo_category IN ('test', 'small');
      WHEN 50 THEN is_eligible := repo_category IN ('test', 'small', 'medium');
      WHEN 75 THEN is_eligible := repo_category IN ('test', 'small', 'medium', 'large');
      ELSE is_eligible := true; -- 100% includes all categories
    END CASE;
  END IF;

  RETURN is_eligible;
END;
$$ LANGUAGE plpgsql;
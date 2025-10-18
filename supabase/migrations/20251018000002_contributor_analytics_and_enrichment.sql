-- Migration: Contributor Analytics and AI Enrichment
-- Issue: #803 Phase 2 - AI-powered activity summarization and intelligent contributor insights
-- Created: 2025-10-18
--
-- This migration creates infrastructure for:
-- 1. Topic clustering (content + contributor clustering)
-- 2. Contribution trend analysis (7-day and 30-day windows)
-- 3. Engagement quality scoring (discussion, review, issue, mentor metrics)
-- 4. Historical analytics tracking

-- ============================================================================
-- STEP 1: Create contributor_analytics table for time-series data
-- ============================================================================

CREATE TABLE IF NOT EXISTS contributor_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contributor_id UUID NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Topic Clustering Data
  primary_topics TEXT[], -- Top 3-5 topics (e.g., ["authentication", "performance", "ui"])
  topic_confidence FLOAT CHECK (topic_confidence >= 0 AND topic_confidence <= 1), -- 0-1 confidence
  topic_embedding VECTOR(384), -- Aggregated topic vector for similarity

  -- Trend Data (short-term: 7-30 days)
  contribution_velocity JSONB, -- {7d: 5, 30d: 20, 7d_prev: 3, 30d_prev: 18}
  topic_shifts JSONB, -- {"from": ["frontend"], "to": ["backend", "api"]}
  engagement_pattern TEXT CHECK (engagement_pattern IN ('increasing', 'stable', 'decreasing')),

  -- Quality Metrics (0-100 scores)
  quality_score FLOAT CHECK (quality_score >= 0 AND quality_score <= 100),
  discussion_impact_score FLOAT CHECK (discussion_impact_score >= 0 AND discussion_impact_score <= 100),
  code_review_depth_score FLOAT CHECK (code_review_depth_score >= 0 AND code_review_depth_score <= 100),
  issue_quality_score FLOAT CHECK (issue_quality_score >= 0 AND issue_quality_score <= 100),
  mentor_score FLOAT CHECK (mentor_score >= 0 AND mentor_score <= 100),

  -- Persona Detection
  detected_persona TEXT[], -- ["enterprise", "security_focused", "performance_oriented"]
  persona_confidence FLOAT CHECK (persona_confidence >= 0 AND persona_confidence <= 1),
  contribution_style TEXT CHECK (contribution_style IN ('code', 'discussion', 'mixed')),
  engagement_pattern_type TEXT CHECK (engagement_pattern_type IN ('mentor', 'learner', 'reporter', 'builder')),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one snapshot per contributor per workspace per day
  UNIQUE(contributor_id, workspace_id, snapshot_date)
);

-- Add indexes for performance
CREATE INDEX idx_contributor_analytics_contributor ON contributor_analytics(contributor_id);
CREATE INDEX idx_contributor_analytics_workspace ON contributor_analytics(workspace_id, snapshot_date DESC);
CREATE INDEX idx_contributor_analytics_quality ON contributor_analytics(quality_score DESC) WHERE quality_score IS NOT NULL;
CREATE INDEX idx_contributor_analytics_date ON contributor_analytics(snapshot_date DESC);
CREATE INDEX idx_contributor_analytics_persona ON contributor_analytics USING GIN(detected_persona) WHERE detected_persona IS NOT NULL;

-- Vector similarity index for topic embeddings
CREATE INDEX idx_contributor_analytics_topic_embedding
ON contributor_analytics USING ivfflat (topic_embedding vector_cosine_ops)
WITH (lists = 100)
WHERE topic_embedding IS NOT NULL;

-- ============================================================================
-- STEP 2: Add computed columns to contributors table
-- ============================================================================

-- Add columns for current analytics state (most recent snapshot)
ALTER TABLE contributors
ADD COLUMN IF NOT EXISTS current_topics TEXT[],
ADD COLUMN IF NOT EXISTS quality_score FLOAT CHECK (quality_score >= 0 AND quality_score <= 100),
ADD COLUMN IF NOT EXISTS engagement_trend TEXT CHECK (engagement_trend IN ('rising_star', 'steady', 'declining', 'new')),
ADD COLUMN IF NOT EXISTS detected_persona TEXT[],
ADD COLUMN IF NOT EXISTS last_analytics_update TIMESTAMPTZ;

-- Create GIN index for topic array searches
CREATE INDEX IF NOT EXISTS idx_contributors_current_topics
ON contributors USING GIN(current_topics)
WHERE current_topics IS NOT NULL;

-- Create index for quality score filtering
CREATE INDEX IF NOT EXISTS idx_contributors_quality_score
ON contributors(quality_score DESC)
WHERE quality_score IS NOT NULL;

-- Create index for engagement trend
CREATE INDEX IF NOT EXISTS idx_contributors_engagement_trend
ON contributors(engagement_trend)
WHERE engagement_trend IS NOT NULL;

-- ============================================================================
-- STEP 3: Create function to calculate quality score
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_contributor_quality_score(
  p_contributor_id UUID,
  p_workspace_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_discussion_score FLOAT := 0;
  v_review_score FLOAT := 0;
  v_issue_score FLOAT := 0;
  v_mentor_score FLOAT := 0;
  v_overall_score FLOAT;

  -- Get workspace repository IDs
  v_repo_ids UUID[];
BEGIN
  -- Get repository IDs for this workspace
  SELECT ARRAY_AGG(repository_id)
  INTO v_repo_ids
  FROM workspace_repositories
  WHERE workspace_id = p_workspace_id;

  IF v_repo_ids IS NULL OR ARRAY_LENGTH(v_repo_ids, 1) = 0 THEN
    RETURN jsonb_build_object(
      'overall', 0,
      'discussion_impact', 0,
      'code_review_depth', 0,
      'issue_quality', 0,
      'mentor_score', 0
    );
  END IF;

  -- Calculate Discussion Impact Score (0-100)
  -- Based on: answered discussions, reactions, comment quality
  WITH discussion_metrics AS (
    SELECT
      COUNT(*) FILTER (WHERE is_answered AND author_id = p_contributor_id) as answered_count,
      COUNT(*) FILTER (WHERE is_answered AND author_id != p_contributor_id) as provided_answer_count,
      AVG(comment_count) as avg_comments
    FROM discussions
    WHERE repository_id = ANY(v_repo_ids)
      AND (author_id = p_contributor_id OR id IN (
        SELECT discussion_id
        FROM discussion_comments
        WHERE author_id = p_contributor_id
      ))
      AND created_at > NOW() - INTERVAL '90 days'
  )
  SELECT LEAST(
    (answered_count * 10) +
    (provided_answer_count * 15) +
    (avg_comments * 2),
    100
  )::FLOAT
  INTO v_discussion_score
  FROM discussion_metrics;

  -- Calculate Code Review Depth Score (0-100)
  -- Based on: review detail, inline comments, security/performance concerns
  WITH review_metrics AS (
    SELECT
      COUNT(*) as total_reviews,
      COUNT(*) FILTER (WHERE state = 'APPROVED' AND LENGTH(body) > 50) as detailed_reviews,
      COUNT(*) FILTER (WHERE state = 'CHANGES_REQUESTED') as change_requests,
      AVG(LENGTH(body)) as avg_body_length
    FROM reviews
    WHERE reviewer_id = p_contributor_id
      AND pull_request_id IN (
        SELECT id FROM pull_requests WHERE repository_id = ANY(v_repo_ids)
      )
      AND submitted_at > NOW() - INTERVAL '90 days'
  )
  SELECT LEAST(
    (detailed_reviews * 8) +
    (change_requests * 10) +
    (CASE WHEN avg_body_length > 100 THEN 20 ELSE avg_body_length / 5 END),
    100
  )::FLOAT
  INTO v_review_score
  FROM review_metrics;

  -- Calculate Issue Quality Score (0-100)
  -- Based on: completeness, clarity, labels
  WITH issue_metrics AS (
    SELECT
      COUNT(*) as total_issues,
      COUNT(*) FILTER (WHERE body IS NOT NULL AND LENGTH(body) > 200) as detailed_issues,
      COUNT(*) FILTER (WHERE body LIKE '%```%') as issues_with_code,
      AVG(LENGTH(body)) as avg_body_length
    FROM issues
    WHERE author_id = p_contributor_id
      AND repository_id = ANY(v_repo_ids)
      AND created_at > NOW() - INTERVAL '90 days'
  )
  SELECT LEAST(
    (detailed_issues::FLOAT / NULLIF(total_issues, 0) * 50) +
    (issues_with_code::FLOAT / NULLIF(total_issues, 0) * 30) +
    (CASE WHEN avg_body_length > 200 THEN 20 ELSE avg_body_length / 10 END),
    100
  )::FLOAT
  INTO v_issue_score
  FROM issue_metrics;

  -- Calculate Mentor Score (0-100)
  -- Based on: helping others, documentation, welcoming behavior
  WITH mentor_metrics AS (
    SELECT
      -- Discussions where they provided answers
      (SELECT COUNT(*)
       FROM discussions d
       JOIN discussion_comments dc ON d.id = dc.discussion_id
       WHERE dc.author_id = p_contributor_id
         AND d.author_id != p_contributor_id
         AND d.is_answered = true
         AND d.repository_id = ANY(v_repo_ids)
         AND dc.created_at > NOW() - INTERVAL '90 days'
      ) as answer_count,
      -- Comments on others' issues
      (SELECT COUNT(*)
       FROM comments c
       JOIN issues i ON c.issue_id = i.id
       WHERE c.commenter_id = p_contributor_id
         AND i.author_id != p_contributor_id
         AND i.repository_id = ANY(v_repo_ids)
         AND c.created_at > NOW() - INTERVAL '90 days'
      ) as helpful_comments,
      -- Documentation PRs
      (SELECT COUNT(*)
       FROM pull_requests
       WHERE author_id = p_contributor_id
         AND repository_id = ANY(v_repo_ids)
         AND (title ILIKE '%doc%' OR title ILIKE '%readme%')
         AND created_at > NOW() - INTERVAL '90 days'
      ) as doc_prs
  )
  SELECT LEAST(
    (answer_count * 5) +
    (helpful_comments * 3) +
    (doc_prs * 3),
    100
  )::FLOAT
  INTO v_mentor_score
  FROM mentor_metrics;

  -- Calculate weighted overall score
  v_overall_score := (
    COALESCE(v_discussion_score, 0) * 0.25 +
    COALESCE(v_review_score, 0) * 0.30 +
    COALESCE(v_issue_score, 0) * 0.25 +
    COALESCE(v_mentor_score, 0) * 0.20
  );

  RETURN jsonb_build_object(
    'overall', ROUND(v_overall_score::NUMERIC, 2),
    'discussion_impact', ROUND(COALESCE(v_discussion_score, 0)::NUMERIC, 2),
    'code_review_depth', ROUND(COALESCE(v_review_score, 0)::NUMERIC, 2),
    'issue_quality', ROUND(COALESCE(v_issue_score, 0)::NUMERIC, 2),
    'mentor_score', ROUND(COALESCE(v_mentor_score, 0)::NUMERIC, 2)
  );
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION calculate_contributor_quality_score(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_contributor_quality_score(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION calculate_contributor_quality_score(UUID, UUID) TO service_role;

-- ============================================================================
-- STEP 4: Create function to get contributor activity velocity
-- ============================================================================

CREATE OR REPLACE FUNCTION get_contributor_velocity(
  p_contributor_id UUID,
  p_workspace_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_repo_ids UUID[];
  v_7d_current INTEGER;
  v_7d_previous INTEGER;
  v_30d_current INTEGER;
  v_30d_previous INTEGER;
BEGIN
  -- Get repository IDs for this workspace
  SELECT ARRAY_AGG(repository_id)
  INTO v_repo_ids
  FROM workspace_repositories
  WHERE workspace_id = p_workspace_id;

  IF v_repo_ids IS NULL OR ARRAY_LENGTH(v_repo_ids, 1) = 0 THEN
    RETURN jsonb_build_object(
      '7d_current', 0,
      '7d_previous', 0,
      '30d_current', 0,
      '30d_previous', 0
    );
  END IF;

  -- Count contributions in last 7 days (PRs + Issues)
  SELECT
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days'),
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days'),
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days'),
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '60 days' AND created_at < NOW() - INTERVAL '30 days')
  INTO v_7d_current, v_7d_previous, v_30d_current, v_30d_previous
  FROM (
    SELECT created_at FROM pull_requests
    WHERE author_id = p_contributor_id
      AND repository_id = ANY(v_repo_ids)
    UNION ALL
    SELECT created_at FROM issues
    WHERE author_id = p_contributor_id
      AND repository_id = ANY(v_repo_ids)
  ) contributions;

  RETURN jsonb_build_object(
    '7d_current', v_7d_current,
    '7d_previous', v_7d_previous,
    '30d_current', v_30d_current,
    '30d_previous', v_30d_previous,
    'trend', CASE
      WHEN v_7d_current > v_7d_previous * 1.2 THEN 'accelerating'
      WHEN v_7d_current < v_7d_previous * 0.8 THEN 'declining'
      ELSE 'steady'
    END
  );
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_contributor_velocity(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_contributor_velocity(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_contributor_velocity(UUID, UUID) TO service_role;

-- ============================================================================
-- STEP 5: Create materialized views for performance
-- ============================================================================

-- Workspace topic distribution
CREATE MATERIALIZED VIEW IF NOT EXISTS workspace_topic_clusters AS
SELECT
  ca.workspace_id,
  UNNEST(ca.primary_topics) as topic,
  COUNT(DISTINCT ca.contributor_id) as contributor_count,
  AVG(ca.topic_confidence) as avg_confidence,
  ARRAY_AGG(DISTINCT c.username ORDER BY c.username) FILTER (WHERE c.username IS NOT NULL) as contributors
FROM contributor_analytics ca
JOIN contributors c ON ca.contributor_id = c.id
WHERE ca.primary_topics IS NOT NULL
  AND ca.snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY ca.workspace_id, UNNEST(ca.primary_topics);

CREATE UNIQUE INDEX idx_workspace_topic_clusters_unique
ON workspace_topic_clusters(workspace_id, topic);

-- Quality score rankings
CREATE MATERIALIZED VIEW IF NOT EXISTS quality_score_rankings AS
SELECT
  ca.workspace_id,
  ca.contributor_id,
  c.username,
  ca.quality_score,
  ca.discussion_impact_score,
  ca.code_review_depth_score,
  ca.issue_quality_score,
  ca.mentor_score,
  ca.detected_persona,
  RANK() OVER (PARTITION BY ca.workspace_id ORDER BY ca.quality_score DESC) as rank,
  ca.snapshot_date
FROM contributor_analytics ca
JOIN contributors c ON ca.contributor_id = c.id
WHERE ca.quality_score IS NOT NULL
  AND ca.snapshot_date = (
    -- Get most recent snapshot for each contributor
    SELECT MAX(snapshot_date)
    FROM contributor_analytics ca2
    WHERE ca2.contributor_id = ca.contributor_id
      AND ca2.workspace_id = ca.workspace_id
  );

CREATE UNIQUE INDEX idx_quality_rankings_unique
ON quality_score_rankings(workspace_id, contributor_id);

CREATE INDEX idx_quality_rankings_score
ON quality_score_rankings(workspace_id, quality_score DESC);

-- ============================================================================
-- STEP 6: Create function to refresh materialized views
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
  -- Note: CONCURRENTLY cannot be used within plpgsql functions
  -- Callers should use REFRESH MATERIALIZED VIEW CONCURRENTLY directly if needed
  REFRESH MATERIALIZED VIEW workspace_topic_clusters;
  REFRESH MATERIALIZED VIEW quality_score_rankings;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION refresh_analytics_views() TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_analytics_views() TO service_role;

-- ============================================================================
-- STEP 7: Create trigger to update contributors table from analytics
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_contributor_analytics_to_contributors()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the contributors table with latest analytics
  UPDATE contributors
  SET
    current_topics = NEW.primary_topics,
    quality_score = NEW.quality_score,
    engagement_trend = CASE
      WHEN NEW.contribution_velocity->>'trend' = 'accelerating' AND NEW.quality_score > 70 THEN 'rising_star'
      WHEN NEW.contribution_velocity->>'trend' = 'declining' THEN 'declining'
      WHEN NEW.contribution_velocity->>'7d_current' = '0' AND NEW.contribution_velocity->>'30d_current' = '0' THEN 'new'
      ELSE 'steady'
    END,
    detected_persona = NEW.detected_persona,
    last_analytics_update = NEW.updated_at
  WHERE id = NEW.contributor_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_analytics_to_contributors
AFTER INSERT OR UPDATE ON contributor_analytics
FOR EACH ROW
EXECUTE FUNCTION sync_contributor_analytics_to_contributors();

-- ============================================================================
-- STEP 8: Add comments for documentation
-- ============================================================================

COMMENT ON TABLE contributor_analytics IS 'Time-series analytics snapshots for contributor intelligence';
COMMENT ON COLUMN contributor_analytics.primary_topics IS 'Top 3-5 topics extracted from contributor activity (e.g., ["authentication", "performance"])';
COMMENT ON COLUMN contributor_analytics.topic_embedding IS 'Aggregated 384-dimension embedding vector representing contributor expertise';
COMMENT ON COLUMN contributor_analytics.contribution_velocity IS 'JSON object with 7d/30d contribution counts and trends';
COMMENT ON COLUMN contributor_analytics.quality_score IS 'Composite quality score (0-100) based on weighted category scores';
COMMENT ON COLUMN contributor_analytics.detected_persona IS 'AI-detected contributor personas (e.g., ["enterprise", "security_focused"])';

COMMENT ON COLUMN contributors.current_topics IS 'Current primary topics from most recent analytics snapshot';
COMMENT ON COLUMN contributors.quality_score IS 'Current quality score from most recent analytics snapshot';
COMMENT ON COLUMN contributors.engagement_trend IS 'Engagement trend classification: rising_star, steady, declining, new';

COMMENT ON FUNCTION calculate_contributor_quality_score IS 'Calculate multi-factor quality score based on discussion, review, issue, and mentor metrics';
COMMENT ON FUNCTION get_contributor_velocity IS 'Get contribution velocity metrics for 7-day and 30-day windows';
COMMENT ON FUNCTION refresh_analytics_views IS 'Refresh materialized views for workspace topic clusters and quality rankings';

-- ============================================================================
-- VALIDATION
-- ============================================================================

DO $$
DECLARE
  analytics_table_exists BOOLEAN;
  computed_columns_exist BOOLEAN;
  quality_function_exists BOOLEAN;
  velocity_function_exists BOOLEAN;
  materialized_views_exist BOOLEAN;
BEGIN
  -- Check if contributor_analytics table exists
  SELECT EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'contributor_analytics'
  ) INTO analytics_table_exists;

  -- Check if computed columns exist
  SELECT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'contributors'
      AND column_name IN ('current_topics', 'quality_score', 'engagement_trend', 'detected_persona', 'last_analytics_update')
  ) INTO computed_columns_exist;

  -- Check if quality function exists
  SELECT EXISTS (
    SELECT FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'calculate_contributor_quality_score'
  ) INTO quality_function_exists;

  -- Check if velocity function exists
  SELECT EXISTS (
    SELECT FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'get_contributor_velocity'
  ) INTO velocity_function_exists;

  -- Check if materialized views exist
  SELECT EXISTS (
    SELECT FROM pg_matviews
    WHERE schemaname = 'public' AND matviewname IN ('workspace_topic_clusters', 'quality_score_rankings')
  ) INTO materialized_views_exist;

  IF analytics_table_exists AND computed_columns_exist AND quality_function_exists AND velocity_function_exists AND materialized_views_exist THEN
    RAISE NOTICE '✅ Contributor analytics migration completed successfully';
    RAISE NOTICE '   - contributor_analytics table created';
    RAISE NOTICE '   - Computed columns added to contributors table';
    RAISE NOTICE '   - Quality scoring function created';
    RAISE NOTICE '   - Velocity tracking function created';
    RAISE NOTICE '   - Materialized views created';
    RAISE NOTICE '   - Indexes and triggers configured';
  ELSE
    RAISE WARNING '⚠️ Migration validation failed';
    RAISE NOTICE 'Debug: table=%,columns=%,quality_fn=%,velocity_fn=%,views=%',
                 analytics_table_exists, computed_columns_exist, quality_function_exists,
                 velocity_function_exists, materialized_views_exist;
  END IF;
END $$;

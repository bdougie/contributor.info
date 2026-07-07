-- Fix the calculate_self_selection_rate function to use correct column names

DROP FUNCTION IF EXISTS calculate_self_selection_rate(TEXT, TEXT, INT);

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
  WITH repo_info AS (
    -- First get the repository ID
    SELECT id as repo_id
    FROM repositories
    WHERE owner = p_repository_owner
      AND name = p_repository_name
    LIMIT 1
  ),
  pr_stats AS (
    SELECT 
      pr.author_id,
      pr.id as pr_id,
      c.username,
      COALESCE(cr.role, 'contributor') as contributor_type,
      COALESCE(cr.confidence_score, 0) as confidence_score,
      pr.created_at
    FROM pull_requests pr
    CROSS JOIN repo_info ri
    LEFT JOIN contributors c ON pr.author_id = c.id
    LEFT JOIN contributor_roles cr 
      ON c.username = cr.contributor_username
      AND cr.repository_owner = p_repository_owner 
      AND cr.repository_name = p_repository_name
    WHERE pr.repository_id = ri.repo_id
      AND pr.created_at >= NOW() - (p_days_back || ' days')::INTERVAL
  ),
  contribution_summary AS (
    SELECT
      COUNT(DISTINCT CASE 
        WHEN contributor_type IN ('owner', 'maintainer') 
        THEN author_id 
      END) as internal_contributors,
      COUNT(DISTINCT CASE 
        WHEN contributor_type = 'contributor' 
        THEN author_id 
      END) as external_contributors,
      COUNT(DISTINCT author_id) as total_contributors,
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION calculate_self_selection_rate(TEXT, TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_self_selection_rate(TEXT, TEXT, INT) TO anon;
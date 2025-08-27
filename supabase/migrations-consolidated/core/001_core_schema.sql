-- Core Schema Migration
-- This migration creates all basic tables and relationships
-- No auth or extension dependencies

CREATE OR REPLACE FUNCTION get_next_chunk_number(p_backfill_state_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_chunk_number INTEGER;
BEGIN
  -- Get the next value from the sequence
  v_chunk_number := nextval('backfill_chunk_number_seq');
  
  -- Optionally, we could also track per-backfill sequences in a table
  -- This would allow resetting sequences per backfill if needed
  
  RETURN v_chunk_number;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_repositories_by_size(
    target_size repository_size DEFAULT NULL,
    min_priority repository_priority DEFAULT NULL
) RETURNS SETOF tracked_repositories AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM tracked_repositories
    WHERE 
        tracking_enabled = TRUE
        AND (target_size IS NULL OR size = target_size)
        AND (min_priority IS NULL OR 
            CASE 
                WHEN min_priority = 'low' THEN priority IN ('low', 'medium', 'high')
                WHEN min_priority = 'medium' THEN priority IN ('medium', 'high')
                WHEN min_priority = 'high' THEN priority = 'high'
            END
        )
    ORDER BY 
        CASE priority 
            WHEN 'high' THEN 1 
            WHEN 'medium' THEN 2 
            WHEN 'low' THEN 3 
        END,
        last_sync_at ASC NULLS FIRST;
END;
$$ LANGUAGE plpgsql STABLE;

Create function to calculate self-selection rate
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

CREATE OR REPLACE FUNCTION update_workspace_tier_limits()
RETURNS TRIGGER AS $$
BEGIN
    -- Update limits based on new tier
    CASE NEW.tier
        WHEN 'private' THEN 
            NEW.max_repositories := 999;  -- Effectively unlimited
            NEW.data_retention_days := 365;
        WHEN 'pro' THEN 
            NEW.max_repositories := 50;
            NEW.data_retention_days := 90;
        WHEN 'free' THEN 
            NEW.max_repositories := 10;
            NEW.data_retention_days := 30;
    END CASE;
    
    -- If downgrading, check if current repos exceed new limit
    IF NEW.current_repository_count > NEW.max_repositories THEN
        RAISE EXCEPTION 'Cannot downgrade tier: workspace has % repositories but new tier allows only %', 
            NEW.current_repository_count, NEW.max_repositories;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_workspace_repository_count()
RETURNS TRIGGER AS $$
DECLARE
    v_workspace_id UUID;
    v_count INTEGER;
BEGIN
    -- Determine workspace_id based on operation
    IF TG_OP = 'DELETE' THEN
        v_workspace_id := OLD.workspace_id;
    ELSE
        v_workspace_id := NEW.workspace_id;
    END IF;
    
    -- Count repositories for this workspace
    SELECT COUNT(*) INTO v_count
    FROM workspace_repositories
    WHERE workspace_id = v_workspace_id;
    
    -- Update the count
    UPDATE workspaces
    SET current_repository_count = v_count
    WHERE id = v_workspace_id;
    
    -- For INSERT, check if limit is exceeded
    IF TG_OP = 'INSERT' THEN
        DECLARE
            v_max_repos INTEGER;
        BEGIN
            SELECT max_repositories INTO v_max_repos
            FROM workspaces
            WHERE id = v_workspace_id;
            
            IF v_count > v_max_repos THEN
                RAISE EXCEPTION 'Repository limit exceeded for workspace. Maximum allowed: %', v_max_repos;
            END IF;
        END;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calculate_workspace_repo_priority(
    p_workspace_id UUID,
    p_tracked_repository_id UUID
) RETURNS INTEGER AS $$
DECLARE
    v_priority INTEGER := 50; -- Base priority
    v_workspace_tier TEXT;
    v_last_sync_interval INTERVAL;
    v_repo_stars INTEGER;
BEGIN
    -- Get workspace tier
    SELECT tier INTO v_workspace_tier
    FROM workspaces
    WHERE id = p_workspace_id;
    
    -- Adjust for tier
    CASE v_workspace_tier
        WHEN 'private' THEN v_priority := v_priority + 30;
        WHEN 'pro' THEN v_priority := v_priority + 20;
        WHEN 'free' THEN v_priority := v_priority + 0;
    END CASE;
    
    -- Get last sync time
    SELECT NOW() - last_sync_at INTO v_last_sync_interval
    FROM workspace_tracked_repositories
    WHERE workspace_id = p_workspace_id 
    AND tracked_repository_id = p_tracked_repository_id;
    
    -- Increase priority for stale data
    IF v_last_sync_interval > INTERVAL '7 days' THEN
        v_priority := v_priority + 20;
    ELSIF v_last_sync_interval > INTERVAL '3 days' THEN
        v_priority := v_priority + 10;
    END IF;
    
    -- Get repository popularity
    SELECT r.stargazers_count INTO v_repo_stars
    FROM repositories r
    JOIN tracked_repositories tr ON tr.repository_id = r.id
    WHERE tr.id = p_tracked_repository_id;
    
    -- Adjust for repository popularity
    IF v_repo_stars > 1000 THEN
        v_priority := v_priority + 10;
    ELSIF v_repo_stars > 100 THEN
        v_priority := v_priority + 5;
    END IF;
    
    -- Ensure priority stays within bounds
    RETURN LEAST(GREATEST(v_priority, 0), 100);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_workspace_repo_priorities()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE workspace_tracked_repositories
    SET priority_score = calculate_workspace_repo_priority(NEW.id, tracked_repository_id)
    WHERE workspace_id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_repository_pull_request_count(repository_uuid UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE repositories 
    SET pull_request_count = (
        SELECT COUNT(*) 
        FROM pull_requests 
        WHERE repository_id = repository_uuid
    )
    WHERE id = repository_uuid;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION refresh_all_repository_pull_request_counts()
RETURNS VOID AS $$
BEGIN
    UPDATE repositories 
    SET pull_request_count = pr_counts.count
    FROM (
        SELECT 
            repository_id,
            COUNT(*) as count
        FROM pull_requests 
        GROUP BY repository_id
    ) pr_counts
    WHERE repositories.id = pr_counts.repository_id;
    
    -- Set count to 0 for repositories with no PRs
    UPDATE repositories 
    SET pull_request_count = 0 
    WHERE pull_request_count IS NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_repository_pr_count_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle INSERT
    IF TG_OP = 'INSERT' THEN
        UPDATE repositories 
        SET pull_request_count = pull_request_count + 1
        WHERE id = NEW.repository_id;
        RETURN NEW;
    END IF;
    
    -- Handle DELETE  
    IF TG_OP = 'DELETE' THEN
        UPDATE repositories 
        SET pull_request_count = GREATEST(pull_request_count - 1, 0)
        WHERE id = OLD.repository_id;
        RETURN OLD;
    END IF;
    
    -- Handle UPDATE (if repository_id changes)
    IF TG_OP = 'UPDATE' AND OLD.repository_id \!= NEW.repository_id THEN
        -- Decrease count for old repository
        UPDATE repositories 
        SET pull_request_count = GREATEST(pull_request_count - 1, 0)
        WHERE id = OLD.repository_id;
        
        -- Increase count for new repository
        UPDATE repositories 
        SET pull_request_count = pull_request_count + 1
        WHERE id = NEW.repository_id;
        
        RETURN NEW;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

Create function for atomic increment of repository count
CREATE OR REPLACE FUNCTION increment_repository_count(workspace_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE workspaces 
  SET current_repository_count = COALESCE(current_repository_count, 0) + 1,
      updated_at = NOW()
  WHERE id = workspace_uuid
  RETURNING current_repository_count INTO new_count;
  
  RETURN new_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_workspace_repo_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM increment_repository_count(NEW.workspace_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM decrement_repository_count(OLD.workspace_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;


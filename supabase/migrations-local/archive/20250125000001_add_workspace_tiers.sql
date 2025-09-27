-- Local-safe version of 20250125000001_add_workspace_tiers.sql
-- Generated: 2025-08-27T02:47:08.046Z
-- This migration has been modified to work without auth, roles, and extensions
-- Original migration may have different behavior in production

-- Transaction wrapper for safety
BEGIN;

-- Migration: Add Workspace Tiers and Limits
-- This migration adds missing tier and limit columns to the workspaces table
-- These columns are required for the workspace data fetching feature

-- =====================================================
-- ADD MISSING COLUMNS TO WORKSPACES TABLE
-- =====================================================

ALTER TABLE workspaces 
ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'private')),
ADD COLUMN IF NOT EXISTS max_repositories INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS current_repository_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS data_retention_days INTEGER DEFAULT 30;

-- Add constraint to ensure repository count doesn't exceed max
ALTER TABLE workspaces 
ADD CONSTRAINT workspace_repo_limit CHECK (current_repository_count <= max_repositories);

-- =====================================================
-- UPDATE DEFAULT VALUES BASED ON TIER
-- =====================================================

-- Set appropriate defaults for any existing workspaces
UPDATE workspaces 
SET 
    max_repositories = CASE 
        WHEN tier = 'private' THEN 999  -- Effectively unlimited
        WHEN tier = 'pro' THEN 50
        ELSE 10  -- free tier
    END,
    data_retention_days = CASE 
        WHEN tier = 'private' THEN 365
        WHEN tier = 'pro' THEN 90
        ELSE 30  -- free tier
    END
WHERE tier IS NOT NULL;

-- =====================================================
-- CREATE TIER MANAGEMENT FUNCTIONS
-- =====================================================

-- Function to update workspace limits when tier changes
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

-- Apply trigger for tier changes
CREATE TRIGGER update_tier_limits
BEFORE UPDATE OF tier ON workspaces
FOR EACH ROW
WHEN (OLD.tier IS DISTINCT FROM NEW.tier)
EXECUTE FUNCTION update_workspace_tier_limits();

-- =====================================================
-- UPDATE REPOSITORY COUNT FUNCTION
-- =====================================================

-- Function to maintain accurate repository count
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

-- Apply trigger to maintain repository count
CREATE TRIGGER maintain_repository_count
AFTER INSERT OR DELETE ON workspace_repositories
FOR EACH ROW
EXECUTE FUNCTION update_workspace_repository_count();

-- =====================================================
-- RECREATE TIER-BASED PRIORITY FUNCTION
-- =====================================================

-- Now we can create the full priority calculation with tier support
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

-- =====================================================
-- ADD TIER-BASED TRIGGER FOR PRIORITY UPDATES
-- =====================================================

-- Function to update workspace repo priorities when tier changes
CREATE OR REPLACE FUNCTION update_workspace_repo_priorities()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE workspace_tracked_repositories
    SET priority_score = calculate_workspace_repo_priority(NEW.id, tracked_repository_id)
    WHERE workspace_id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for tier changes (now that tier column exists)
CREATE TRIGGER update_priorities_on_tier_change
AFTER UPDATE OF tier ON workspaces
FOR EACH ROW
WHEN (OLD.tier IS DISTINCT FROM NEW.tier)
EXECUTE FUNCTION update_workspace_repo_priorities();

-- =====================================================
-- UPDATE SYNC FREQUENCIES FOR EXISTING RECORDS
-- =====================================================

-- Update any existing workspace_tracked_repositories based on workspace tier
UPDATE workspace_tracked_repositories wtr
SET 
    sync_frequency_hours = CASE 
        WHEN w.tier = 'private' THEN 6   -- 4x daily for enterprise
        WHEN w.tier = 'pro' THEN 12      -- 2x daily for pro
        ELSE 24                           -- Daily for free
    END,
    data_retention_days = CASE 
        WHEN w.tier = 'private' THEN 365  -- 1 year for enterprise
        WHEN w.tier = 'pro' THEN 90       -- 3 months for pro
        ELSE 30                            -- 1 month for free
    END,
    priority_score = calculate_workspace_repo_priority(wtr.workspace_id, wtr.tracked_repository_id)
FROM workspaces w
WHERE wtr.workspace_id = w.id;

-- =====================================================
-- INDEXES
-- =====================================================

-- Add index for tier-based queries
CREATE INDEX IF NOT EXISTS idx_workspaces_tier 
ON workspaces(tier) 
WHERE is_active = TRUE;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON COLUMN workspaces.tier IS 'Subscription tier: free (10 repos, 30d retention), pro (50 repos, 90d), private (unlimited, 365d)';
COMMENT ON COLUMN workspaces.max_repositories IS 'Maximum repositories allowed for this workspace based on tier';
COMMENT ON COLUMN workspaces.current_repository_count IS 'Current number of repositories in this workspace (maintained by trigger)';
COMMENT ON COLUMN workspaces.data_retention_days IS 'How long to keep detailed data for this workspace';

COMMENT ON FUNCTION update_workspace_tier_limits IS 'Automatically updates repository limits and retention when tier changes';
COMMENT ON FUNCTION update_workspace_repository_count IS 'Maintains accurate repository count and enforces limits';

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Verify the columns were added
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'workspaces' AND column_name = 'tier') THEN
        RAISE EXCEPTION 'Migration failed: tier column was not added';
    END IF;
    
    RAISE NOTICE 'Workspace tier migration completed successfully';
END $$;

COMMIT;

-- Helper script to link existing tracked repositories to workspaces
-- This should be run after the migration to establish initial connections

-- This query helps identify which repositories should be linked to which workspaces
-- based on the workspace_repositories table

-- Create initial links between workspaces and tracked repositories
INSERT INTO workspace_tracked_repositories (
    workspace_id,
    tracked_repository_id,
    added_by,
    sync_frequency_hours,
    data_retention_days,
    priority_score,
    fetch_issues,
    fetch_commits,
    fetch_reviews,
    fetch_comments
)
SELECT DISTINCT
    wr.workspace_id,
    tr.id as tracked_repository_id,
    w.owner_id as added_by,
    -- Set sync frequency based on workspace tier
    CASE 
        WHEN w.tier = 'private' THEN 6  -- 4x daily for enterprise
        WHEN w.tier = 'pro' THEN 12     -- 2x daily for pro
        ELSE 24                          -- Daily for free
    END as sync_frequency_hours,
    -- Set retention based on workspace tier
    CASE 
        WHEN w.tier = 'private' THEN 365  -- 1 year for enterprise
        WHEN w.tier = 'pro' THEN 90       -- 3 months for pro
        ELSE 30                            -- 1 month for free
    END as data_retention_days,
    -- Calculate initial priority
    CASE 
        WHEN w.tier = 'private' THEN 80
        WHEN w.tier = 'pro' THEN 60
        ELSE 40
    END as priority_score,
    -- Enable all features by default
    TRUE as fetch_issues,
    TRUE as fetch_commits,
    TRUE as fetch_reviews,
    TRUE as fetch_comments
FROM workspace_repositories wr
JOIN workspaces w ON w.id = wr.workspace_id
JOIN tracked_repositories tr ON tr.repository_id = wr.repository_id
WHERE w.is_active = TRUE
AND NOT EXISTS (
    -- Don't create duplicates
    SELECT 1 
    FROM workspace_tracked_repositories wtr
    WHERE wtr.workspace_id = wr.workspace_id
    AND wtr.tracked_repository_id = tr.id
)
ON CONFLICT (workspace_id, tracked_repository_id) DO NOTHING;

-- Report on what was linked
SELECT 
    w.name as workspace_name,
    w.tier as workspace_tier,
    COUNT(wtr.id) as linked_repos_count,
    MIN(wtr.sync_frequency_hours) as min_sync_hours,
    MAX(wtr.data_retention_days) as max_retention_days
FROM workspaces w
LEFT JOIN workspace_tracked_repositories wtr ON wtr.workspace_id = w.id
WHERE w.is_active = TRUE
GROUP BY w.id, w.name, w.tier
ORDER BY w.tier DESC, w.name;
-- Check workspace discussions data for My Work feature
-- Run this in your Supabase SQL editor to debug why discussions aren't showing

-- 1. Check if discussions table has data
SELECT COUNT(*) as total_discussions 
FROM discussions;

-- 2. Check unanswered discussions
SELECT COUNT(*) as unanswered_discussions 
FROM discussions 
WHERE is_answered = false;

-- 3. Check workspace repositories (replace with your workspace ID)
-- Get workspace ID first
SELECT id, name, slug 
FROM workspaces 
WHERE slug = 'continue';  -- Replace with your workspace slug

-- 4. Check discussions in workspace repositories
-- Replace 'your-workspace-id' with the actual UUID from above query
WITH workspace_repos AS (
  SELECT repository_id 
  FROM workspace_repositories 
  WHERE workspace_id = 'your-workspace-id'  -- Replace this
)
SELECT 
  d.id,
  d.number,
  d.title,
  d.is_answered,
  d.author_login,
  d.updated_at,
  r.full_name as repository
FROM discussions d
JOIN repositories r ON d.repository_id = r.id
WHERE d.repository_id IN (SELECT repository_id FROM workspace_repos)
  AND d.is_answered = false
ORDER BY d.updated_at DESC
LIMIT 20;

-- 5. Check if repositories table is properly joined
SELECT 
  d.id,
  d.repository_id,
  r.id as repo_id,
  r.full_name,
  r.owner,
  r.name
FROM discussions d
LEFT JOIN repositories r ON d.repository_id = r.id
WHERE d.is_answered = false
LIMIT 5;

-- 6. Debug: Check raw discussion data structure
SELECT * 
FROM discussions 
LIMIT 1;

-- 7. Check if your user exists in contributors
SELECT id, username, avatar_url 
FROM contributors 
WHERE username = 'bdougie';  -- Replace with your GitHub username

-- 8. Check workspace repositories join
SELECT 
  wr.workspace_id,
  wr.repository_id,
  r.full_name
FROM workspace_repositories wr
JOIN repositories r ON wr.repository_id = r.id
WHERE wr.workspace_id IN (
  SELECT id FROM workspaces WHERE slug = 'continue'
);
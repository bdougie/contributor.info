-- Debug queries to understand why self-selection rate shows 0%

-- 1. Check if repository exists
SELECT id, owner, name, full_name 
FROM repositories 
WHERE owner = 'continuedev' AND name = 'continue';

-- 2. Check contributor roles
SELECT * FROM contributor_roles 
WHERE repository_owner = 'continuedev' 
  AND repository_name = 'continue'
LIMIT 10;

-- 3. Check if we have any pull requests for this repo
SELECT COUNT(*) as pr_count
FROM pull_requests pr
JOIN repositories r ON pr.repository_id = r.id
WHERE r.owner = 'continuedev' AND r.name = 'continue';

-- 4. Check github events cache
SELECT COUNT(*) as event_count, 
       MIN(created_at) as oldest_event,
       MAX(created_at) as newest_event
FROM github_events_cache
WHERE repository_owner = 'continuedev' 
  AND repository_name = 'continue';

-- 5. Test the current RPC function
SELECT * FROM calculate_self_selection_rate('continuedev', 'continue', 30);

-- 6. Check if pull_requests table has the columns the function expects
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'pull_requests'
ORDER BY ordinal_position;
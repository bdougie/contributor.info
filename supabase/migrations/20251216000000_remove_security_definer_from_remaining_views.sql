-- Remove SECURITY DEFINER from remaining views flagged by Supabase security advisor
-- Issue: https://github.com/open-sauced/contributor.info/issues/1362
-- These views bypass RLS when owned by postgres user, which is a security risk

-- 1. Drop and recreate stuck_jobs_monitor view
DROP VIEW IF EXISTS stuck_jobs_monitor;
CREATE VIEW stuck_jobs_monitor AS
SELECT
  job_type,
  count(*) AS stuck_count,
  min(started_at) AS oldest_stuck_job,
  EXTRACT(epoch FROM (now() - min(started_at)::timestamp with time zone)) / 60::numeric AS oldest_age_minutes,
  array_agg((metadata ->> 'repository_name'::text) ORDER BY started_at)
    FILTER (WHERE ((metadata ->> 'repository_name'::text) IS NOT NULL)) AS affected_repositories
FROM progressive_capture_jobs
WHERE status::text = 'processing'::text
  AND started_at < (now() - '00:05:00'::interval)
GROUP BY job_type
ORDER BY count(*) DESC;

GRANT SELECT ON stuck_jobs_monitor TO anon, authenticated, service_role;
COMMENT ON VIEW stuck_jobs_monitor IS 'Monitors jobs stuck in processing status for >5 minutes without SECURITY DEFINER';

-- 2. Drop and recreate items_needing_embeddings view
DROP VIEW IF EXISTS items_needing_embeddings;
CREATE VIEW items_needing_embeddings AS
SELECT
  combined.item_type,
  combined.id,
  combined.repository_id,
  combined.title,
  combined.body,
  combined.created_at,
  combined.embedding_generated_at,
  combined.content_hash,
  combined.priority
FROM (
  SELECT
    'issue'::text AS item_type,
    id::text AS id,
    repository_id,
    title,
    body,
    created_at,
    embedding_generated_at,
    content_hash,
    2 AS priority
  FROM issues
  WHERE (embedding IS NULL OR embedding_generated_at < updated_at)
    AND created_at > (now() - '90 days'::interval)
    AND repository_id IN (SELECT repository_id FROM workspace_repositories)

  UNION ALL

  SELECT
    'pull_request'::text AS item_type,
    id::text AS id,
    repository_id,
    title,
    body,
    created_at,
    embedding_generated_at,
    content_hash,
    3 AS priority
  FROM pull_requests
  WHERE (embedding IS NULL OR embedding_generated_at < updated_at)
    AND created_at > (now() - '90 days'::interval)
    AND repository_id IN (SELECT repository_id FROM workspace_repositories)

  UNION ALL

  SELECT
    'discussion'::text AS item_type,
    id,
    repository_id,
    title,
    body,
    created_at,
    embedding_generated_at,
    content_hash,
    1 AS priority
  FROM discussions
  WHERE (embedding IS NULL OR embedding_generated_at < updated_at)
    AND created_at > (now() - '90 days'::interval)
    AND repository_id IN (SELECT repository_id FROM workspace_repositories)
) combined
ORDER BY combined.priority, combined.created_at DESC
LIMIT 200;

GRANT SELECT ON items_needing_embeddings TO anon, authenticated, service_role;
COMMENT ON VIEW items_needing_embeddings IS 'Items needing embeddings from workspace repositories without SECURITY DEFINER';

-- 3. Drop and recreate items_needing_embeddings_priority view
DROP VIEW IF EXISTS items_needing_embeddings_priority;
CREATE VIEW items_needing_embeddings_priority AS
WITH workspace_repos AS (
  SELECT DISTINCT wr.repository_id
  FROM workspace_repositories wr
  JOIN workspaces w ON wr.workspace_id = w.id
  WHERE w.is_active = true
),
prioritized_items AS (
  SELECT
    'issue'::text AS item_type,
    i.id::text AS id,
    i.repository_id,
    i.title,
    i.body,
    i.created_at,
    i.updated_at,
    i.embedding_generated_at,
    i.content_hash,
    3 AS priority_score
  FROM issues i
  JOIN workspace_repos wr ON i.repository_id = wr.repository_id
  WHERE i.embedding IS NULL OR i.embedding_generated_at < i.updated_at

  UNION ALL

  SELECT
    'pull_request'::text AS item_type,
    pr.id::text AS id,
    pr.repository_id,
    pr.title,
    pr.body,
    pr.created_at,
    pr.updated_at,
    pr.embedding_generated_at,
    pr.content_hash,
    2 AS priority_score
  FROM pull_requests pr
  JOIN workspace_repos wr ON pr.repository_id = wr.repository_id
  WHERE pr.embedding IS NULL OR pr.embedding_generated_at < pr.updated_at

  UNION ALL

  SELECT
    'discussion'::text AS item_type,
    d.id::text AS id,
    d.repository_id,
    d.title,
    d.body,
    d.created_at,
    d.updated_at,
    d.embedding_generated_at,
    NULL::text AS content_hash,
    2 AS priority_score
  FROM discussions d
  JOIN workspace_repos wr ON d.repository_id = wr.repository_id
  WHERE d.embedding IS NULL OR d.embedding_generated_at < d.updated_at
)
SELECT
  item_type,
  id,
  repository_id,
  title,
  body,
  created_at,
  updated_at,
  embedding_generated_at,
  content_hash,
  priority_score
FROM prioritized_items
ORDER BY priority_score DESC, updated_at DESC
LIMIT 200;

GRANT SELECT ON items_needing_embeddings_priority TO anon, authenticated, service_role;
COMMENT ON VIEW items_needing_embeddings_priority IS 'Priority-ordered items needing embeddings from active workspaces without SECURITY DEFINER';

-- 4. Drop and recreate users view
DROP VIEW IF EXISTS users;
CREATE VIEW users AS
SELECT
  id,
  auth_user_id,
  email,
  display_name,
  avatar_url,
  created_at,
  updated_at
FROM app_users;

GRANT SELECT ON users TO anon, authenticated, service_role;
COMMENT ON VIEW users IS 'PostgREST compatibility view mapping app_users to users without SECURITY DEFINER';

-- 5. Drop and recreate codeowners_with_repository view
DROP VIEW IF EXISTS codeowners_with_repository;
CREATE VIEW codeowners_with_repository AS
SELECT
  c.id,
  c.repository_id,
  c.file_path,
  c.content,
  c.rules,
  c.sha,
  c.fetched_at,
  c.created_at,
  c.updated_at,
  r.full_name AS repository_name,
  r.owner AS repository_owner,
  r.name AS repository_repo
FROM codeowners c
JOIN repositories r ON c.repository_id = r.id;

GRANT SELECT ON codeowners_with_repository TO anon, authenticated, service_role;
COMMENT ON VIEW codeowners_with_repository IS 'Codeowners with repository context without SECURITY DEFINER';

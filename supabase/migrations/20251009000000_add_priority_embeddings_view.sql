-- Migration: Add priority-based embeddings view for backfill
-- Created: 2025-10-09
-- Issue: PRs and issues have extremely low embedding coverage (0.07% and 38.83%)
--
-- This migration adds:
-- 1. Priority view that removes 90-day restriction for backfill
-- 2. Workspace-based prioritization (items in workspaces first)
-- 3. Item type prioritization (issues > PRs > discussions)
-- 4. Larger batch sizes for faster backfill

-- ============================================================================
-- VIEW: items_needing_embeddings_priority
-- ============================================================================

CREATE OR REPLACE VIEW items_needing_embeddings_priority AS
WITH workspace_repos AS (
  -- Get repositories that are in active workspaces (highest priority)
  SELECT DISTINCT wr.repository_id
  FROM workspace_repositories wr
  JOIN workspaces w ON wr.workspace_id = w.id
  WHERE w.is_active = true
),
prioritized_items AS (
  -- Issues (highest priority)
  SELECT
    'issue' as item_type,
    i.id::text as id,
    i.repository_id,
    i.title,
    i.body,
    i.created_at,
    i.updated_at,
    i.embedding_generated_at,
    i.content_hash,
    -- Priority scoring: workspace repos get higher priority
    CASE
      WHEN wr.repository_id IS NOT NULL THEN 3  -- Workspace issues
      ELSE 1                                      -- Other issues
    END as priority_score
  FROM issues i
  LEFT JOIN workspace_repos wr ON i.repository_id = wr.repository_id
  WHERE (
    i.embedding IS NULL
    OR i.embedding_generated_at < i.updated_at
  )

  UNION ALL

  -- Pull Requests (medium priority)
  SELECT
    'pull_request' as item_type,
    pr.id::text as id,
    pr.repository_id,
    pr.title,
    pr.body,
    pr.created_at,
    pr.updated_at,
    pr.embedding_generated_at,
    pr.content_hash,
    -- Priority scoring: workspace repos get higher priority
    CASE
      WHEN wr.repository_id IS NOT NULL THEN 2  -- Workspace PRs
      ELSE 0                                      -- Other PRs (lowest)
    END as priority_score
  FROM pull_requests pr
  LEFT JOIN workspace_repos wr ON pr.repository_id = wr.repository_id
  WHERE (
    pr.embedding IS NULL
    OR pr.embedding_generated_at < pr.updated_at
  )

  UNION ALL

  -- Discussions (already working well, but included for completeness)
  SELECT
    'discussion' as item_type,
    d.id::text as id,
    d.repository_id,
    d.title,
    d.body,
    d.created_at,
    d.updated_at,
    d.embedding_generated_at,
    NULL as content_hash, -- discussions don't have content_hash
    -- Priority scoring: workspace repos get higher priority
    CASE
      WHEN wr.repository_id IS NOT NULL THEN 2  -- Workspace discussions
      ELSE 0                                      -- Other discussions
    END as priority_score
  FROM discussions d
  LEFT JOIN workspace_repos wr ON d.repository_id = wr.repository_id
  WHERE (
    d.embedding IS NULL
    OR d.embedding_generated_at < d.updated_at
  )
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
ORDER BY
  priority_score DESC,  -- Highest priority first
  updated_at DESC       -- Most recently updated first
LIMIT 200;              -- Larger batch for backfill (was 100)

-- Add documentation
COMMENT ON VIEW items_needing_embeddings_priority IS
'Priority-based view for embedding backfill. Prioritizes: 1) Workspace items, 2) Issues over PRs, 3) Recently updated. No 90-day restriction for backfill.';

-- ============================================================================
-- VALIDATION
-- ============================================================================

DO $$
DECLARE
  view_exists BOOLEAN;
BEGIN
  -- Check if view was created successfully
  SELECT EXISTS (
    SELECT 1
    FROM pg_views
    WHERE schemaname = 'public'
    AND viewname = 'items_needing_embeddings_priority'
  ) INTO view_exists;

  IF view_exists THEN
    RAISE NOTICE '✅ View items_needing_embeddings_priority created successfully';
    RAISE NOTICE '   - Prioritizes workspace items';
    RAISE NOTICE '   - Issues ranked higher than PRs';
    RAISE NOTICE '   - No 90-day restriction';
    RAISE NOTICE '   - Batch size: 200 items';
  ELSE
    RAISE WARNING '⚠️  View creation validation failed';
  END IF;
END $$;

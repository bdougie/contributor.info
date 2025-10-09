-- Migration: Add workspace-only embeddings view for backfill
-- Created: 2025-10-09
-- Issue: PRs and issues have extremely low embedding coverage (0.07% and 38.83%)
--
-- CRITICAL: Only workspace items get embeddings - non-workspace items are excluded
--
-- This migration adds:
-- 1. Workspace-only view using INNER JOIN (no non-workspace items)
-- 2. Item type prioritization (issues > PRs > discussions)
-- 3. Larger batch sizes for faster backfill (200 vs 100)

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
    3 as priority_score  -- Workspace issues only
  FROM issues i
  INNER JOIN workspace_repos wr ON i.repository_id = wr.repository_id
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
    2 as priority_score  -- Workspace PRs only
  FROM pull_requests pr
  INNER JOIN workspace_repos wr ON pr.repository_id = wr.repository_id
  WHERE (
    pr.embedding IS NULL
    OR pr.embedding_generated_at < pr.updated_at
  )

  UNION ALL

  -- Discussions
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
    2 as priority_score  -- Workspace discussions only
  FROM discussions d
  INNER JOIN workspace_repos wr ON d.repository_id = wr.repository_id
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
'Workspace-only embeddings view. ONLY processes items in active workspaces (INNER JOIN). Priority: Issues (3) > PRs (2) > Discussions (2). Batch size: 200 items.';

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
    RAISE NOTICE '   - WORKSPACE ITEMS ONLY (INNER JOIN)';
    RAISE NOTICE '   - Priority: Issues (3) > PRs (2) > Discussions (2)';
    RAISE NOTICE '   - Batch size: 200 items';
    RAISE NOTICE '   - Non-workspace items excluded';
  ELSE
    RAISE WARNING '⚠️  View creation validation failed';
  END IF;
END $$;

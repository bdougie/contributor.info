-- Manually trigger embeddings computation for items
-- This bypasses Inngest and processes embeddings directly

-- First, let's see what needs embeddings
SELECT
  type,
  id,
  title,
  LEFT(body, 50) as preview,
  repository_id
FROM items_needing_embeddings
LIMIT 10;

-- To manually compute embeddings, you would need to:
-- 1. Get the items from above query
-- 2. Call OpenAI API to generate embeddings for each
-- 3. Update the corresponding table (issues/pull_requests/discussions)

-- For now, this shows you what items need processing
-- Run this in Supabase SQL Editor to see the queue

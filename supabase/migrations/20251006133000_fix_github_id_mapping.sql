-- Migration: Fix GitHub ID Column Mapping
-- Created: 2025-10-06
-- Issue: github_id is NOT NULL but gh-datapipe doesn't send this field
--
-- GitHub GraphQL returns:
--   - id: GraphQL node ID (string) - e.g., "D_kwDOJm0kOc4AiTSy"
--   - databaseId: Numeric database ID (integer) - e.g., 8991922
--   - number: Discussion number (integer) - e.g., 8105
--
-- Mapping:
--   - id → id (VARCHAR, already correct)
--   - databaseId → github_id (change to BIGINT)
--   - number → number (INTEGER, already correct)

-- Fix discussions table
ALTER TABLE discussions
  ALTER COLUMN github_id TYPE BIGINT USING github_id::BIGINT;

-- Fix discussion_comments table
ALTER TABLE discussion_comments
  ALTER COLUMN github_id TYPE BIGINT USING github_id::BIGINT;

-- Add helpful comments
COMMENT ON COLUMN discussions.github_id IS 'GitHub numeric database ID (databaseId from GraphQL API)';
COMMENT ON COLUMN discussion_comments.github_id IS 'GitHub numeric database ID (databaseId from GraphQL API)';

-- Validation
DO $$
DECLARE
  discussions_github_id_type TEXT;
  comments_github_id_type TEXT;
BEGIN
  SELECT data_type INTO discussions_github_id_type
  FROM information_schema.columns
  WHERE table_name = 'discussions'
    AND column_name = 'github_id'
    AND table_schema = 'public';

  SELECT data_type INTO comments_github_id_type
  FROM information_schema.columns
  WHERE table_name = 'discussion_comments'
    AND column_name = 'github_id'
    AND table_schema = 'public';

  IF discussions_github_id_type = 'bigint' AND comments_github_id_type = 'bigint' THEN
    RAISE NOTICE '✅ GitHub ID mapping fix completed successfully';
    RAISE NOTICE '   - discussions.github_id → BIGINT (stores databaseId)';
    RAISE NOTICE '   - discussion_comments.github_id → BIGINT (stores databaseId)';
  ELSE
    RAISE WARNING '⚠️ Migration validation failed';
    RAISE WARNING '   discussions.github_id type: %', discussions_github_id_type;
    RAISE WARNING '   discussion_comments.github_id type: %', comments_github_id_type;
  END IF;
END $$;

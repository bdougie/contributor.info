-- Migration: Fix Discussions Author ID Type
-- Created: 2025-10-06
-- Issue: author_id should be BIGINT (GitHub database ID) not UUID
--
-- GitHub GraphQL API returns numeric database IDs (e.g., 26348718)
-- for author_id, not UUIDs. Also making repository_id nullable since
-- gh-datapipe doesn't populate it.

-- Drop foreign key constraints first
ALTER TABLE discussions
  DROP CONSTRAINT IF EXISTS discussions_author_id_fkey;

ALTER TABLE discussion_comments
  DROP CONSTRAINT IF EXISTS discussion_comments_author_id_fkey;

-- Fix discussions table
ALTER TABLE discussions
  ALTER COLUMN author_id TYPE BIGINT USING NULL;

ALTER TABLE discussions
  ALTER COLUMN repository_id DROP NOT NULL;

-- Fix discussion_comments table
ALTER TABLE discussion_comments
  ALTER COLUMN author_id TYPE BIGINT USING NULL;

-- Add helpful comments
COMMENT ON COLUMN discussions.author_id IS 'GitHub numeric database ID of the discussion author';
COMMENT ON COLUMN discussion_comments.author_id IS 'GitHub numeric database ID of the comment author';
COMMENT ON COLUMN discussions.repository_id IS 'Optional UUID reference to repositories table - nullable as gh-datapipe sends repository_full_name instead';

-- Validation
DO $$
DECLARE
  discussions_author_type TEXT;
  comments_author_type TEXT;
BEGIN
  SELECT data_type INTO discussions_author_type
  FROM information_schema.columns
  WHERE table_name = 'discussions'
    AND column_name = 'author_id'
    AND table_schema = 'public';

  SELECT data_type INTO comments_author_type
  FROM information_schema.columns
  WHERE table_name = 'discussion_comments'
    AND column_name = 'author_id'
    AND table_schema = 'public';

  IF discussions_author_type = 'bigint' AND comments_author_type = 'bigint' THEN
    RAISE NOTICE '✅ Author ID type fix completed successfully';
    RAISE NOTICE '   - discussions.author_id → BIGINT';
    RAISE NOTICE '   - discussion_comments.author_id → BIGINT';
    RAISE NOTICE '   - repository_id made nullable';
  ELSE
    RAISE WARNING '⚠️ Migration validation failed';
    RAISE WARNING '   discussions.author_id type: %', discussions_author_type;
    RAISE WARNING '   discussion_comments.author_id type: %', comments_author_type;
  END IF;
END $$;

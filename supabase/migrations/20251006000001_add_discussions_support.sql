-- Migration: Add GitHub Discussions Support
-- Created: 2025-10-06
-- Issue: https://github.com/open-source-ready/gh-datapipe/issues/160
--
-- This migration adds tables for GitHub Discussions data collected via GraphQL API
-- Supports: discussions, discussion comments, categories, answers, and engagement metrics

-- ============================================================================
-- DEPENDENCY CHECKS
-- ============================================================================

-- Create required roles if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon;
    RAISE NOTICE 'Created role: anon';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated;
    RAISE NOTICE 'Created role: authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role;
    RAISE NOTICE 'Created role: service_role';
  END IF;
END $$;

-- ============================================================================
-- TABLES
-- ============================================================================

-- Discussions Table
CREATE TABLE IF NOT EXISTS public.discussions (
  id VARCHAR PRIMARY KEY NOT NULL,  -- GitHub GraphQL node ID (e.g., "D_kwDOJm0kOc4AiTSy")
  github_id VARCHAR UNIQUE NOT NULL,
  repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT,

  -- Category information
  category_id VARCHAR,
  category_name VARCHAR,
  category_description TEXT,
  category_emoji VARCHAR(10),

  -- Author information
  author_id UUID REFERENCES contributors(id) ON DELETE SET NULL,
  author_login VARCHAR,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,

  -- Answer tracking (for Q&A discussions)
  is_answered BOOLEAN DEFAULT FALSE,
  answer_id VARCHAR,  -- References discussion_comments.id
  answer_chosen_at TIMESTAMPTZ,
  answer_chosen_by VARCHAR,

  -- Engagement metrics
  upvote_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,

  -- Metadata
  url VARCHAR NOT NULL,
  locked BOOLEAN DEFAULT FALSE,

  -- Audit timestamps
  synced_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT discussions_repo_number_unique UNIQUE (repository_id, number)
);

COMMENT ON TABLE public.discussions IS 'GitHub Discussions collected via GraphQL API';
COMMENT ON COLUMN public.discussions.id IS 'GitHub GraphQL global node ID for the discussion';
COMMENT ON COLUMN public.discussions.is_answered IS 'For Q&A discussions, indicates if an answer has been chosen';
COMMENT ON COLUMN public.discussions.answer_id IS 'GitHub node ID of the comment marked as the answer';

-- Discussion Comments Table
CREATE TABLE IF NOT EXISTS public.discussion_comments (
  id VARCHAR PRIMARY KEY NOT NULL,  -- GitHub GraphQL node ID (e.g., "DC_kwDOJm0kOc4AiTSy")
  github_id VARCHAR UNIQUE NOT NULL,

  -- Parent references
  discussion_id VARCHAR NOT NULL,
  discussion_number INTEGER NOT NULL,
  parent_comment_id VARCHAR,  -- For nested replies

  -- Author information
  author_id UUID REFERENCES contributors(id) ON DELETE SET NULL,
  author_login VARCHAR,

  -- Content
  body TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,

  -- Metadata
  is_answer BOOLEAN DEFAULT FALSE,
  upvote_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,

  -- Audit
  synced_at TIMESTAMPTZ DEFAULT NOW(),

  -- Foreign key constraints
  CONSTRAINT fk_discussion FOREIGN KEY (discussion_id) REFERENCES discussions(id) ON DELETE CASCADE,
  CONSTRAINT fk_parent_comment FOREIGN KEY (parent_comment_id) REFERENCES discussion_comments(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.discussion_comments IS 'Comments on GitHub Discussions, supports nested replies';
COMMENT ON COLUMN public.discussion_comments.id IS 'GitHub GraphQL global node ID for the comment';
COMMENT ON COLUMN public.discussion_comments.parent_comment_id IS 'Links to parent comment for nested thread structure';
COMMENT ON COLUMN public.discussion_comments.is_answer IS 'Indicates if this comment was marked as the answer to a Q&A discussion';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Discussions indexes
CREATE INDEX IF NOT EXISTS idx_discussions_repository ON discussions(repository_id);
CREATE INDEX IF NOT EXISTS idx_discussions_author ON discussions(author_id);
CREATE INDEX IF NOT EXISTS idx_discussions_category ON discussions(category_name);
CREATE INDEX IF NOT EXISTS idx_discussions_created_at ON discussions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discussions_updated_at ON discussions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_discussions_is_answered ON discussions(is_answered) WHERE is_answered = TRUE;

-- Discussion comments indexes
CREATE INDEX IF NOT EXISTS idx_discussion_comments_discussion ON discussion_comments(discussion_id);
CREATE INDEX IF NOT EXISTS idx_discussion_comments_author ON discussion_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_discussion_comments_parent ON discussion_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_discussion_comments_created_at ON discussion_comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discussion_comments_is_answer ON discussion_comments(is_answer) WHERE is_answer = TRUE;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Enable RLS on discussions
ALTER TABLE discussions ENABLE ROW LEVEL SECURITY;

-- Public read access for discussions
DO $$
BEGIN
  -- Drop existing policy for idempotency
  DROP POLICY IF EXISTS "Public discussions are viewable by everyone" ON discussions;

  -- Create policy
  CREATE POLICY "Public discussions are viewable by everyone"
    ON discussions FOR SELECT
    USING (true);
END $$;

-- Service role can insert/update discussions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    DROP POLICY IF EXISTS "Service role can insert discussions" ON discussions;

    CREATE POLICY "Service role can insert discussions"
      ON discussions FOR INSERT
      TO service_role
      WITH CHECK (true);

    DROP POLICY IF EXISTS "Service role can update discussions" ON discussions;

    CREATE POLICY "Service role can update discussions"
      ON discussions FOR UPDATE
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Enable RLS on discussion_comments
ALTER TABLE discussion_comments ENABLE ROW LEVEL SECURITY;

-- Public read access for discussion comments
DO $$
BEGIN
  -- Drop existing policy for idempotency
  DROP POLICY IF EXISTS "Discussion comments are viewable by everyone" ON discussion_comments;

  -- Create policy
  CREATE POLICY "Discussion comments are viewable by everyone"
    ON discussion_comments FOR SELECT
    USING (true);
END $$;

-- Service role can insert/update discussion comments
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    DROP POLICY IF EXISTS "Service role can insert discussion comments" ON discussion_comments;

    CREATE POLICY "Service role can insert discussion comments"
      ON discussion_comments FOR INSERT
      TO service_role
      WITH CHECK (true);

    DROP POLICY IF EXISTS "Service role can update discussion comments" ON discussion_comments;

    CREATE POLICY "Service role can update discussion comments"
      ON discussion_comments FOR UPDATE
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ============================================================================
-- GRANTS
-- ============================================================================

-- Grant permissions to roles
DO $$
BEGIN
  -- Anon can read discussions
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT ON discussions TO anon;
    GRANT SELECT ON discussion_comments TO anon;
  END IF;

  -- Authenticated users can read discussions
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT ON discussions TO authenticated;
    GRANT SELECT ON discussion_comments TO authenticated;
  END IF;

  -- Service role has full access
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON discussions TO service_role;
    GRANT ALL ON discussion_comments TO service_role;
  END IF;
END $$;

-- ============================================================================
-- VALIDATION
-- ============================================================================

DO $$
DECLARE
  discussions_count INTEGER;
  comments_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO discussions_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'discussions';

  SELECT COUNT(*) INTO comments_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'discussion_comments';

  IF discussions_count = 1 AND comments_count = 1 THEN
    RAISE NOTICE '✅ Discussions migration completed successfully';
    RAISE NOTICE '   - discussions table created';
    RAISE NOTICE '   - discussion_comments table created';
    RAISE NOTICE '   - RLS policies applied';
    RAISE NOTICE '   - Indexes created for optimal query performance';
  ELSE
    RAISE WARNING '⚠️ Migration validation failed - check table creation';
  END IF;
END $$;

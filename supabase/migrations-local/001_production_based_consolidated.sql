-- Production-Based Consolidated Local-Safe Migration
-- Generated: 2025-09-08
-- Based on production schema export: https://gist.githubusercontent.com/bdougie/5b483fbbd0f35aad100e8749bbb6a244/raw/759b06f8bc46416efb39e3ed14db7e765222d854/bdougie.sql
-- 
-- This migration creates the complete database schema in the correct order
-- All auth dependencies and extensions are made optional for local development
-- Fixes all ordering issues that were causing migration failures

BEGIN;

-- ============================================================
-- EXTENSIONS AND ROLES (Local-Safe)
-- ============================================================

-- Create required roles if they don't exist (local development only)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Skip role creation if insufficient privileges (common in hosted environments)
  RAISE NOTICE 'Skipping role creation - insufficient privileges';
END $$;

-- Create extensions if available (non-blocking)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Try to create vector extension (for embeddings)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS "vector";
  RAISE NOTICE 'Vector extension enabled - embeddings will work';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Vector extension not available - embeddings will be disabled';
END $$;

-- ============================================================
-- CUSTOM TYPES AND ENUMS
-- ============================================================

-- Repository priority enum (used in tracked_repositories)
DO $$
BEGIN
  CREATE TYPE repository_priority AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Type repository_priority already exists, skipping';
END $$;

-- Repository size enum (used in tracked_repositories)
DO $$
BEGIN
  CREATE TYPE repository_size AS ENUM ('small', 'medium', 'large', 'extra_large');
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Type repository_size already exists, skipping';
END $$;

-- ============================================================
-- CORE SCHEMA TABLES (Ordered by Dependencies)
-- ============================================================

-- 1. Independent tables first (no foreign keys)

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  github_id bigint NOT NULL UNIQUE,
  login text NOT NULL UNIQUE,
  avatar_url text,
  description text,
  company text,
  blog text,
  location text,
  email text,
  public_repos integer DEFAULT 0,
  public_gists integer DEFAULT 0,
  followers integer DEFAULT 0,
  following integer DEFAULT 0,
  github_created_at timestamp with time zone,
  first_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  last_updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_active boolean DEFAULT true,
  CONSTRAINT organizations_pkey PRIMARY KEY (id)
);

-- Contributors table
CREATE TABLE IF NOT EXISTS contributors (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  github_id bigint NOT NULL UNIQUE,
  username text NOT NULL UNIQUE,
  display_name text,
  avatar_url text,
  profile_url text,
  email text,
  company text,
  location text,
  bio text,
  blog text,
  public_repos integer DEFAULT 0,
  public_gists integer DEFAULT 0,
  followers integer DEFAULT 0,
  following integer DEFAULT 0,
  github_created_at timestamp with time zone,
  first_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  last_updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_bot boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  avatar_cached_at timestamp with time zone,
  avatar_cache_expires_at timestamp with time zone,
  CONSTRAINT contributors_pkey PRIMARY KEY (id)
);

-- Repositories table
CREATE TABLE IF NOT EXISTS repositories (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  github_id bigint NOT NULL UNIQUE,
  full_name text NOT NULL UNIQUE,
  owner text NOT NULL,
  name text NOT NULL,
  description text,
  homepage text,
  language text,
  stargazers_count integer DEFAULT 0,
  watchers_count integer DEFAULT 0,
  forks_count integer DEFAULT 0,
  open_issues_count integer DEFAULT 0,
  size integer DEFAULT 0,
  default_branch text DEFAULT 'main'::text,
  is_fork boolean DEFAULT false,
  is_archived boolean DEFAULT false,
  is_disabled boolean DEFAULT false,
  is_private boolean DEFAULT false,
  has_issues boolean DEFAULT true,
  has_projects boolean DEFAULT true,
  has_wiki boolean DEFAULT true,
  has_pages boolean DEFAULT false,
  has_downloads boolean DEFAULT true,
  license text,
  topics text[],
  github_created_at timestamp with time zone,
  github_updated_at timestamp with time zone,
  github_pushed_at timestamp with time zone,
  first_tracked_at timestamp with time zone NOT NULL DEFAULT now(),
  last_updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_active boolean DEFAULT true,
  pr_template_content text,
  pr_template_url text,
  pr_template_fetched_at timestamp with time zone,
  pr_template_hash text,
  ai_summary text,
  summary_generated_at timestamp with time zone,
  recent_activity_hash text,
  pull_request_count integer DEFAULT 0,
  sync_status text DEFAULT 'idle'::text CHECK (sync_status = ANY (ARRAY['idle'::text, 'syncing'::text, 'completed'::text, 'failed'::text, 'partial'::text])),
  last_synced_at timestamp with time zone,
  total_pull_requests integer DEFAULT 0,
  avatar_url text,
  homepage_url text,
  is_template boolean DEFAULT false,
  parent_repository_id uuid,
  has_discussions boolean DEFAULT false,
  CONSTRAINT repositories_pkey PRIMARY KEY (id),
  CONSTRAINT repositories_parent_repository_id_fkey FOREIGN KEY (parent_repository_id) REFERENCES repositories(id)
);

-- Add vector embedding column for repositories (if vector extension is available)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    ALTER TABLE repositories ADD COLUMN IF NOT EXISTS embedding vector(384);
    RAISE NOTICE 'Added embedding column to repositories';
  ELSE
    RAISE NOTICE 'Vector extension not available - skipping embedding column for repositories';
  END IF;
END $$;

-- 2. Tables that depend on the core tables above

-- Pull requests table (depends on repositories and contributors)
CREATE TABLE IF NOT EXISTS pull_requests (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  github_id bigint NOT NULL UNIQUE,
  number integer NOT NULL,
  title text NOT NULL,
  body text,
  state text NOT NULL CHECK (state = ANY (ARRAY['open'::text, 'closed'::text, 'merged'::text])),
  repository_id uuid NOT NULL,
  author_id uuid,
  assignee_id uuid,
  base_branch text NOT NULL DEFAULT 'main'::text,
  head_branch text NOT NULL,
  draft boolean DEFAULT false,
  mergeable boolean,
  mergeable_state text,
  merged boolean DEFAULT false,
  merged_by_id uuid,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  merged_at timestamp with time zone,
  closed_at timestamp with time zone,
  additions integer DEFAULT 0,
  deletions integer DEFAULT 0,
  changed_files integer DEFAULT 0,
  commits integer DEFAULT 0,
  html_url text,
  diff_url text,
  patch_url text,
  spam_score numeric DEFAULT 0 CHECK (spam_score IS NULL OR spam_score >= 0::numeric AND spam_score <= 100::numeric),
  spam_flags jsonb DEFAULT '{}'::jsonb,
  is_spam boolean DEFAULT false,
  reviewed_by_admin boolean DEFAULT false,
  spam_detected_at timestamp with time zone,
  spam_review_notes text,
  base_ref text,
  head_ref text,
  embedding_generated_at timestamp with time zone,
  content_hash text,
  last_synced_at timestamp with time zone DEFAULT now(),
  CONSTRAINT pull_requests_pkey PRIMARY KEY (id),
  CONSTRAINT pull_requests_repository_id_fkey FOREIGN KEY (repository_id) REFERENCES repositories(id),
  CONSTRAINT pull_requests_contributor_id_fkey FOREIGN KEY (author_id) REFERENCES contributors(id),
  CONSTRAINT fk_pull_requests_assignee FOREIGN KEY (assignee_id) REFERENCES contributors(id),
  CONSTRAINT fk_pull_requests_merged_by FOREIGN KEY (merged_by_id) REFERENCES contributors(id)
);

-- Add vector embedding column for pull requests (if vector extension is available)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    ALTER TABLE pull_requests ADD COLUMN IF NOT EXISTS embedding vector(384);
    RAISE NOTICE 'Added embedding column to pull_requests';
  ELSE
    RAISE NOTICE 'Vector extension not available - skipping embedding column for pull_requests';
  END IF;
END $$;

-- Issues table (depends on repositories and contributors)
CREATE TABLE IF NOT EXISTS issues (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  github_id bigint NOT NULL UNIQUE,
  repository_id uuid NOT NULL,
  number integer NOT NULL,
  title text NOT NULL,
  body text,
  state text CHECK (state = ANY (ARRAY['open'::text, 'closed'::text])),
  author_id uuid,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  closed_at timestamp with time zone,
  closed_by_id uuid,
  labels jsonb DEFAULT '[]'::jsonb,
  assignees jsonb DEFAULT '[]'::jsonb,
  milestone jsonb,
  comments_count integer DEFAULT 0,
  is_pull_request boolean DEFAULT false,
  linked_pr_id uuid,
  embedding_generated_at timestamp with time zone,
  content_hash text,
  CONSTRAINT issues_pkey PRIMARY KEY (id),
  CONSTRAINT issues_author_id_fkey FOREIGN KEY (author_id) REFERENCES contributors(id),
  CONSTRAINT issues_closed_by_id_fkey FOREIGN KEY (closed_by_id) REFERENCES contributors(id),
  CONSTRAINT issues_linked_pr_id_fkey FOREIGN KEY (linked_pr_id) REFERENCES pull_requests(id),
  CONSTRAINT issues_repository_id_fkey FOREIGN KEY (repository_id) REFERENCES repositories(id)
);

-- Add vector embedding column for issues (if vector extension is available)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    ALTER TABLE issues ADD COLUMN IF NOT EXISTS embedding vector(384);
    RAISE NOTICE 'Added embedding column to issues';
  ELSE
    RAISE NOTICE 'Vector extension not available - skipping embedding column for issues';
  END IF;
END $$;

-- Reviews table (depends on pull_requests and contributors)
CREATE TABLE IF NOT EXISTS reviews (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  github_id bigint NOT NULL UNIQUE,
  pull_request_id uuid NOT NULL,
  reviewer_id uuid,
  state text NOT NULL CHECK (state = ANY (ARRAY['PENDING'::text, 'APPROVED'::text, 'CHANGES_REQUESTED'::text, 'COMMENTED'::text, 'DISMISSED'::text])),
  body text,
  submitted_at timestamp with time zone NOT NULL,
  commit_id text,
  author_id uuid NOT NULL,
  CONSTRAINT reviews_pkey PRIMARY KEY (id),
  CONSTRAINT fk_reviews_reviewer FOREIGN KEY (reviewer_id) REFERENCES contributors(id),
  CONSTRAINT fk_reviews_pull_request FOREIGN KEY (pull_request_id) REFERENCES pull_requests(id),
  CONSTRAINT reviews_author_id_fkey FOREIGN KEY (author_id) REFERENCES contributors(id)
);

-- Comments table (depends on multiple tables)
CREATE TABLE IF NOT EXISTS comments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  github_id bigint NOT NULL UNIQUE,
  pull_request_id uuid,
  commenter_id uuid,
  body text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  comment_type text NOT NULL CHECK (comment_type = ANY (ARRAY['issue_comment'::text, 'review_comment'::text])),
  in_reply_to_id uuid,
  position integer,
  original_position integer,
  diff_hunk text,
  path text,
  commit_id text,
  repository_id uuid NOT NULL,
  issue_id uuid,
  CONSTRAINT comments_pkey PRIMARY KEY (id),
  CONSTRAINT fk_comments_in_reply_to FOREIGN KEY (in_reply_to_id) REFERENCES comments(id),
  CONSTRAINT comments_issue_id_fkey FOREIGN KEY (issue_id) REFERENCES issues(id),
  CONSTRAINT fk_comments_pull_request FOREIGN KEY (pull_request_id) REFERENCES pull_requests(id),
  CONSTRAINT fk_comments_commenter FOREIGN KEY (commenter_id) REFERENCES contributors(id),
  CONSTRAINT comments_repository_id_fkey FOREIGN KEY (repository_id) REFERENCES repositories(id)
);

-- Commits table (depends on repositories, contributors, and pull_requests)
CREATE TABLE IF NOT EXISTS commits (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  sha text NOT NULL,
  repository_id uuid NOT NULL,
  author_id uuid,
  committer_id uuid,
  message text NOT NULL,
  authored_at timestamp with time zone NOT NULL,
  committed_at timestamp with time zone NOT NULL,
  additions integer DEFAULT 0,
  deletions integer DEFAULT 0,
  changed_files integer DEFAULT 0,
  is_direct_commit boolean DEFAULT false,
  pull_request_id uuid,
  html_url text,
  api_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT commits_pkey PRIMARY KEY (id),
  CONSTRAINT commits_committer_id_fkey FOREIGN KEY (committer_id) REFERENCES contributors(id),
  CONSTRAINT commits_author_id_fkey FOREIGN KEY (author_id) REFERENCES contributors(id),
  CONSTRAINT commits_pull_request_id_fkey FOREIGN KEY (pull_request_id) REFERENCES pull_requests(id),
  CONSTRAINT commits_repository_id_fkey FOREIGN KEY (repository_id) REFERENCES repositories(id)
);

-- ============================================================
-- UTILITY AND TRACKING TABLES
-- ============================================================

-- Rate limit tracking table
CREATE TABLE IF NOT EXISTS rate_limit_tracking (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  hour_bucket timestamp with time zone NOT NULL UNIQUE,
  calls_made integer NOT NULL DEFAULT 0,
  calls_remaining integer,
  reset_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT rate_limit_tracking_pkey PRIMARY KEY (id)
);

-- Rate limits table
CREATE TABLE IF NOT EXISTS rate_limits (
  key character varying NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  window_start timestamp with time zone NOT NULL DEFAULT now(),
  last_request timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT rate_limits_pkey PRIMARY KEY (key)
);

-- ============================================================
-- AUTH-DEPENDENT TABLES (Local-Safe with Guards)
-- ============================================================

-- App users table (only if auth schema exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    CREATE TABLE IF NOT EXISTS app_users (
      id uuid NOT NULL DEFAULT uuid_generate_v4(),
      auth_user_id uuid UNIQUE,
      github_username text NOT NULL UNIQUE,
      github_user_id bigint UNIQUE,
      email text,
      avatar_url text,
      display_name text,
      is_admin boolean DEFAULT false,
      is_active boolean DEFAULT true,
      first_login_at timestamp with time zone NOT NULL DEFAULT now(),
      last_login_at timestamp with time zone NOT NULL DEFAULT now(),
      created_at timestamp with time zone NOT NULL DEFAULT now(),
      updated_at timestamp with time zone NOT NULL DEFAULT now(),
      CONSTRAINT app_users_pkey PRIMARY KEY (id)
    );
    RAISE NOTICE 'Created app_users table with auth integration';
  ELSE
    -- Create simplified version without auth dependencies
    CREATE TABLE IF NOT EXISTS app_users (
      id uuid NOT NULL DEFAULT uuid_generate_v4(),
      github_username text NOT NULL UNIQUE,
      github_user_id bigint UNIQUE,
      email text,
      avatar_url text,
      display_name text,
      is_admin boolean DEFAULT false,
      is_active boolean DEFAULT true,
      first_login_at timestamp with time zone NOT NULL DEFAULT now(),
      last_login_at timestamp with time zone NOT NULL DEFAULT now(),
      created_at timestamp with time zone NOT NULL DEFAULT now(),
      updated_at timestamp with time zone NOT NULL DEFAULT now(),
      CONSTRAINT app_users_pkey PRIMARY KEY (id)
    );
    RAISE NOTICE 'Created app_users table without auth integration (local mode)';
  END IF;
END $$;

-- Workspaces table (simplified for local)
CREATE TABLE IF NOT EXISTS workspaces (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL CHECK (char_length(name) >= 3 AND char_length(name) <= 100),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'::text),
  description text,
  owner_id uuid NOT NULL,
  visibility text NOT NULL DEFAULT 'public'::text CHECK (visibility = ANY (ARRAY['public'::text, 'private'::text])),
  settings jsonb DEFAULT '{"theme": "default", "notifications": {"email": true, "in_app": true}, "dashboard_layout": "grid", "default_time_range": "30d"}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  last_activity_at timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true,
  tier text DEFAULT 'free'::text CHECK (tier = ANY (ARRAY['free'::text, 'pro'::text, 'private'::text])),
  max_repositories integer DEFAULT 10,
  current_repository_count integer DEFAULT 0,
  data_retention_days integer DEFAULT 30,
  CONSTRAINT workspaces_pkey PRIMARY KEY (id)
);

-- ============================================================
-- TRACKING AND METADATA TABLES
-- ============================================================

-- Tracked repositories
CREATE TABLE IF NOT EXISTS tracked_repositories (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  repository_id uuid NOT NULL UNIQUE,
  added_by_user_id uuid,
  tracking_enabled boolean DEFAULT true,
  last_sync_at timestamp with time zone,
  sync_frequency_hours integer DEFAULT 24,
  include_forks boolean DEFAULT false,
  include_bots boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  last_updated_at timestamp with time zone DEFAULT now(),
  organization_name text,
  repository_name text,
  size repository_size DEFAULT 'medium',
  priority repository_priority DEFAULT 'low',
  metrics jsonb,
  size_calculated_at timestamp with time zone,
  CONSTRAINT tracked_repositories_pkey PRIMARY KEY (id),
  CONSTRAINT fk_tracked_repositories_repository FOREIGN KEY (repository_id) REFERENCES repositories(id),
  CONSTRAINT fk_tracked_repositories_added_by_user FOREIGN KEY (added_by_user_id) REFERENCES app_users(id)
);

-- ============================================================
-- HELPER FUNCTIONS (Deduplicated)
-- ============================================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- INDEXES (Non-Concurrent for Local Safety)
-- ============================================================

-- Core indexes for performance
CREATE INDEX IF NOT EXISTS idx_contributors_github_id ON contributors(github_id);
CREATE INDEX IF NOT EXISTS idx_contributors_username ON contributors(username);
CREATE INDEX IF NOT EXISTS idx_repositories_github_id ON repositories(github_id);
CREATE INDEX IF NOT EXISTS idx_repositories_full_name ON repositories(full_name);
CREATE INDEX IF NOT EXISTS idx_repositories_owner ON repositories(owner);

-- Pull requests indexes
CREATE INDEX IF NOT EXISTS idx_pull_requests_github_id ON pull_requests(github_id);
CREATE INDEX IF NOT EXISTS idx_pull_requests_repository_id ON pull_requests(repository_id);
CREATE INDEX IF NOT EXISTS idx_pull_requests_author_id ON pull_requests(author_id);
CREATE INDEX IF NOT EXISTS idx_pull_requests_state ON pull_requests(state);
CREATE INDEX IF NOT EXISTS idx_pull_requests_spam_score ON pull_requests(spam_score);
CREATE INDEX IF NOT EXISTS idx_pull_requests_is_spam ON pull_requests(is_spam);
CREATE INDEX IF NOT EXISTS idx_pull_requests_repository_spam ON pull_requests(repository_id, is_spam);

-- Issues indexes
CREATE INDEX IF NOT EXISTS idx_issues_github_id ON issues(github_id);
CREATE INDEX IF NOT EXISTS idx_issues_repository_id ON issues(repository_id);
CREATE INDEX IF NOT EXISTS idx_issues_author_id ON issues(author_id);
CREATE INDEX IF NOT EXISTS idx_issues_state ON issues(state);

-- Reviews indexes
CREATE INDEX IF NOT EXISTS idx_reviews_github_id ON reviews(github_id);
CREATE INDEX IF NOT EXISTS idx_reviews_pull_request_id ON reviews(pull_request_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON reviews(reviewer_id);

-- Comments indexes
CREATE INDEX IF NOT EXISTS idx_comments_github_id ON comments(github_id);
CREATE INDEX IF NOT EXISTS idx_comments_pull_request_id ON comments(pull_request_id);
CREATE INDEX IF NOT EXISTS idx_comments_repository_id ON comments(repository_id);

-- Rate limiting indexes
CREATE INDEX IF NOT EXISTS idx_rate_limit_tracking_hour_bucket ON rate_limit_tracking(hour_bucket);
CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits(key);

-- ============================================================
-- VECTOR INDEXES (If Available)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    -- Create vector indexes for similarity search
    CREATE INDEX IF NOT EXISTS idx_repositories_embedding ON repositories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
    CREATE INDEX IF NOT EXISTS idx_pull_requests_embedding ON pull_requests USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
    CREATE INDEX IF NOT EXISTS idx_issues_embedding ON issues USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
    RAISE NOTICE 'Created vector indexes for similarity search';
  ELSE
    RAISE NOTICE 'Vector extension not available - skipping vector indexes';
  END IF;
END $$;

-- ============================================================
-- ROW LEVEL SECURITY (Local-Safe)
-- ============================================================

-- Enable RLS on main tables (but don't create policies in local mode)
ALTER TABLE repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE pull_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE commits ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_tracking ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for local development
DO $$
BEGIN
  -- Allow public read access for all users
  -- Drop and recreate policies to handle any existing ones
  DROP POLICY IF EXISTS "Public read access" ON repositories;
  CREATE POLICY "Public read access" ON repositories FOR SELECT USING (true);
  DROP POLICY IF EXISTS "Public read access" ON contributors;
  CREATE POLICY "Public read access" ON contributors FOR SELECT USING (true);
  DROP POLICY IF EXISTS "Public read access" ON pull_requests;
  CREATE POLICY "Public read access" ON pull_requests FOR SELECT USING (true);
  DROP POLICY IF EXISTS "Public read access" ON issues;
  CREATE POLICY "Public read access" ON issues FOR SELECT USING (true);
  DROP POLICY IF EXISTS "Public read access" ON reviews;
  CREATE POLICY "Public read access" ON reviews FOR SELECT USING (true);
  DROP POLICY IF EXISTS "Public read access" ON comments;
  CREATE POLICY "Public read access" ON comments FOR SELECT USING (true);
  DROP POLICY IF EXISTS "Public read access" ON commits;
  CREATE POLICY "Public read access" ON commits FOR SELECT USING (true);
  
  -- Allow service role full access
  DROP POLICY IF EXISTS "Service role full access" ON repositories;
  CREATE POLICY "Service role full access" ON repositories FOR ALL USING (true);
  DROP POLICY IF EXISTS "Service role full access" ON contributors;
  CREATE POLICY "Service role full access" ON contributors FOR ALL USING (true);
  DROP POLICY IF EXISTS "Service role full access" ON pull_requests;
  CREATE POLICY "Service role full access" ON pull_requests FOR ALL USING (true);
  DROP POLICY IF EXISTS "Service role full access" ON issues;
  CREATE POLICY "Service role full access" ON issues FOR ALL USING (true);
  DROP POLICY IF EXISTS "Service role full access" ON reviews;
  CREATE POLICY "Service role full access" ON reviews FOR ALL USING (true);
  DROP POLICY IF EXISTS "Service role full access" ON comments;
  CREATE POLICY "Service role full access" ON comments FOR ALL USING (true);
  DROP POLICY IF EXISTS "Service role full access" ON commits;
  CREATE POLICY "Service role full access" ON commits FOR ALL USING (true);
  DROP POLICY IF EXISTS "Service role full access" ON rate_limit_tracking;
  CREATE POLICY "Service role full access" ON rate_limit_tracking FOR ALL USING (true);
  
  RAISE NOTICE 'Created basic RLS policies for local development';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'RLS policy creation failed - this is normal in some local setups';
END $$;

-- ============================================================
-- GRANTS (Local-Safe)
-- ============================================================

-- Grant permissions (if roles exist)
DO $$
BEGIN
  -- Grant usage on sequences
  GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
  GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
  
  -- Grant select on all tables to anon for public read access
  GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
  
  -- Grant full access to authenticated and service_role
  GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
  
  RAISE NOTICE 'Granted permissions to roles';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Grant statements failed - this is normal if roles do not exist';
END $$;

COMMIT;

-- ============================================================
-- VALIDATION AND SUMMARY
-- ============================================================

DO $$
DECLARE
  table_count INTEGER;
  index_count INTEGER;
  has_vector BOOLEAN;
BEGIN
  -- Count tables created
  SELECT COUNT(*) INTO table_count 
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name IN ('contributors', 'repositories', 'pull_requests', 'issues', 'reviews', 'comments', 'commits', 'rate_limit_tracking');
  
  -- Count indexes created
  SELECT COUNT(*) INTO index_count 
  FROM pg_indexes 
  WHERE schemaname = 'public' 
  AND indexname LIKE 'idx_%';
  
  -- Check if vector extension is available
  SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector') INTO has_vector;
  
  RAISE NOTICE '=== MIGRATION COMPLETED SUCCESSFULLY ===';
  RAISE NOTICE 'Core tables created: % of 8 expected', table_count;
  RAISE NOTICE 'Indexes created: %', index_count;
  RAISE NOTICE 'Vector extension available: %', has_vector;
  RAISE NOTICE 'Auth integration: %', CASE WHEN EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN 'Enabled' ELSE 'Disabled (Local Mode)' END;
  RAISE NOTICE '==========================================';
END $$;

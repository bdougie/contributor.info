-- Private Repository Read Protection
--
-- Private repositories are opted in via the contributor.info GitHub App and
-- synced with installation tokens. Until now every content table was
-- publicly readable (USING (true)). This migration restricts reads so rows
-- belonging to a private repository are only visible to members (or owners)
-- of a workspace containing that repository.
--
-- Notes:
-- - The service role bypasses RLS, so sync/backend paths are unaffected.
-- - Helper functions are SECURITY DEFINER: the privacy check itself must see
--   repositories/workspace tables without the caller's RLS applied,
--   otherwise a row the caller cannot see would read as "not private".

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION public.can_view_private_repository(repo_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM workspace_repositories wr
    JOIN workspaces w ON w.id = wr.workspace_id
    WHERE wr.repository_id = repo_id
      AND (
        w.owner_id = (SELECT id FROM app_users WHERE auth_user_id = auth.uid())
        OR EXISTS (
          SELECT 1
          FROM workspace_members wm
          WHERE wm.workspace_id = w.id
            AND wm.user_id = (SELECT id FROM app_users WHERE auth_user_id = auth.uid())
            AND wm.accepted_at IS NOT NULL
        )
      )
  );
$$;

COMMENT ON FUNCTION public.can_view_private_repository(UUID) IS
  'True when the current user owns or is an accepted member of a workspace containing the repository';

CREATE OR REPLACE FUNCTION public.repository_is_readable(repo_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM repositories r
    WHERE r.id = repo_id
      AND (
        r.is_private IS DISTINCT FROM TRUE
        OR public.can_view_private_repository(repo_id)
      )
  );
$$;

COMMENT ON FUNCTION public.repository_is_readable(UUID) IS
  'True when the repository is public, or private and readable by the current user';

GRANT EXECUTE ON FUNCTION public.can_view_private_repository(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.repository_is_readable(UUID) TO anon, authenticated;

-- =====================================================
-- REPLACE SELECT POLICIES ON REPOSITORY-SCOPED TABLES
-- =====================================================

-- Drop every existing SELECT policy on the content tables (their names have
-- drifted across migrations: public_read_*, consolidated_read_*,
-- public_read_only, ...) and install one canonical privacy-aware policy per
-- table.
DO $$
DECLARE
  t TEXT;
  pol RECORD;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'repositories',
    'pull_requests',
    'reviews',
    'comments',
    'commits',
    'issues',
    'github_issues',
    'discussions'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;

    FOR pol IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND cmd = 'SELECT'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;
  END LOOP;
END $$;

-- Repositories: public rows for everyone, private rows for workspace members
CREATE POLICY "read_repositories_respect_privacy" ON public.repositories
  FOR SELECT
  USING (
    is_private IS DISTINCT FROM TRUE
    OR public.can_view_private_repository(id)
  );

-- Child tables: gate on the owning repository's visibility.
-- Legacy rows with NULL repository_id predate private repo support and are
-- treated as public.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'pull_requests',
    'reviews',
    'comments',
    'commits',
    'issues',
    'github_issues',
    'discussions'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (repository_id IS NULL OR public.repository_is_readable(repository_id))',
      'read_' || t || '_respect_privacy',
      t
    );
  END LOOP;
END $$;

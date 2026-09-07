-- Local QA only: existing-table contracts needed by the real review-label API
-- and app header. Supabase creates the real Auth schema and runs real GoTrue.
CREATE TABLE public.app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  github_id bigint NOT NULL UNIQUE,
  github_username text NOT NULL UNIQUE,
  display_name text,
  avatar_url text,
  email text,
  is_admin boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  owner_id uuid NOT NULL REFERENCES public.app_users(id),
  visibility text DEFAULT 'private',
  is_active boolean DEFAULT true,
  tier text DEFAULT 'team',
  max_repositories integer DEFAULT 5,
  current_repository_count integer DEFAULT 2,
  data_retention_days integer DEFAULT 365,
  settings jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.app_users(id),
  role text NOT NULL CHECK (role IN ('owner','maintainer','contributor')),
  invited_by uuid REFERENCES public.app_users(id),
  invited_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  UNIQUE(workspace_id,user_id)
);
CREATE TABLE public.repositories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL UNIQUE,
  name text NOT NULL,
  owner text NOT NULL,
  description text,
  is_private boolean DEFAULT false,
  language text,
  stargazers_count integer DEFAULT 0,
  github_pushed_at timestamptz,
  pull_request_count integer DEFAULT 0,
  open_issues_count integer DEFAULT 0,
  avatar_url text
);
CREATE TABLE public.workspace_repositories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  repository_id uuid REFERENCES public.repositories(id),
  is_pinned boolean DEFAULT false,
  added_by uuid REFERENCES public.app_users(id),
  UNIQUE(workspace_id,repository_id)
);
CREATE TABLE public.rate_limits (
  key text PRIMARY KEY,
  request_count integer,
  window_start timestamptz,
  last_request timestamptz
);

-- Header reads remain scoped to the local signed-in account.
CREATE FUNCTION public.qa_workspace_access(p_workspace uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public,pg_catalog,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM workspaces w JOIN app_users au ON au.auth_user_id=auth.uid()
    WHERE w.id=p_workspace AND (w.owner_id=au.id OR EXISTS(SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id=w.id AND wm.user_id=au.id AND wm.accepted_at IS NOT NULL)));
$$;
REVOKE ALL ON FUNCTION public.qa_workspace_access(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.qa_workspace_access(uuid) TO authenticated;

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon,authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT ON public.app_users,public.workspaces,public.workspace_members,
  public.repositories,public.workspace_repositories TO authenticated;
CREATE POLICY self_read ON public.app_users FOR SELECT TO authenticated USING(auth_user_id=auth.uid());
CREATE POLICY member_read ON public.workspaces FOR SELECT TO authenticated USING(public.qa_workspace_access(id));
CREATE POLICY member_read ON public.workspace_members FOR SELECT TO authenticated USING(public.qa_workspace_access(workspace_id));
CREATE POLICY member_read ON public.workspace_repositories FOR SELECT TO authenticated USING(public.qa_workspace_access(workspace_id));
CREATE POLICY member_read ON public.repositories FOR SELECT TO authenticated USING(EXISTS(
  SELECT 1 FROM public.workspace_repositories wr WHERE wr.repository_id=repositories.id AND public.qa_workspace_access(wr.workspace_id)));
CREATE VIEW public.workspace_preview_stats_secure WITH(security_invoker=true) AS
SELECT w.id AS workspace_id,
  (SELECT count(*) FROM public.workspace_repositories wr WHERE wr.workspace_id=w.id) AS repository_count,
  (SELECT count(*) FROM public.workspace_members wm WHERE wm.workspace_id=w.id AND wm.accepted_at IS NOT NULL) AS member_count
FROM public.workspaces w;
GRANT SELECT ON public.workspace_preview_stats_secure TO authenticated;

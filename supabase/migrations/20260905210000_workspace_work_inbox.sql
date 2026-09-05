-- Account-wide personal work state. Workspace IDs are eligibility, never identity.
CREATE TABLE public.workspace_work_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  repository_id uuid NOT NULL REFERENCES public.repositories(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('awaiting_reply', 'review_requested')),
  subject_key text NOT NULL CHECK (length(subject_key) BETWEEN 1 AND 300),
  source_version text NOT NULL CHECK (length(source_version) BETWEEN 1 AND 1000),
  revision bigint NOT NULL DEFAULT 1,
  title text NOT NULL CHECK (length(title) <= 1000),
  url text NOT NULL CHECK (length(url) <= 2000),
  actor text NOT NULL DEFAULT '',
  preview text NOT NULL DEFAULT '',
  occurred_at timestamptz NOT NULL,
  is_pending boolean NOT NULL DEFAULT true,
  is_read boolean NOT NULL DEFAULT true,
  last_observed_at timestamptz NOT NULL,
  UNIQUE (user_id, repository_id, category, subject_key)
);

CREATE TABLE public.workspace_work_cursors (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  repository_id uuid NOT NULL REFERENCES public.repositories(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('awaiting_reply', 'review_requested')),
  initialized boolean NOT NULL DEFAULT false,
  observed_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, repository_id, category)
);

CREATE INDEX workspace_work_unread ON public.workspace_work_inbox(user_id, occurred_at DESC)
  WHERE is_pending;
ALTER TABLE public.workspace_work_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_work_cursors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workspace_work_inbox, public.workspace_work_cursors FROM anon, authenticated;
GRANT SELECT ON public.workspace_work_inbox TO authenticated;

CREATE FUNCTION public.can_receive_workspace_work(p_repository_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_repositories wr
    JOIN public.workspaces w ON w.id = wr.workspace_id AND w.is_active = true
    JOIN public.app_users au ON au.auth_user_id = auth.uid()
    WHERE wr.repository_id = p_repository_id AND (
      w.owner_id = au.id OR EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = w.id AND wm.user_id = au.id AND wm.accepted_at IS NOT NULL
      )
    )
  );
$$;
REVOKE ALL ON FUNCTION public.can_receive_workspace_work(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_receive_workspace_work(uuid) TO authenticated;

CREATE POLICY workspace_work_read_own ON public.workspace_work_inbox FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) AND public.can_receive_workspace_work(repository_id));

-- A new server timestamp on every scan orders concurrent tabs without trusting browser clocks.
CREATE FUNCTION public.begin_workspace_work_scan()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp AS $$
  WITH eligible AS (
    SELECT w.id, w.name FROM public.workspaces w
    JOIN public.app_users au ON au.auth_user_id = auth.uid()
    WHERE w.is_active = true AND (w.owner_id = au.id OR EXISTS (
      SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = w.id
        AND wm.user_id = au.id AND wm.accepted_at IS NOT NULL
    ))
  ), repos AS (
    SELECT DISTINCT r.id, r.full_name FROM eligible e
    JOIN public.workspace_repositories wr ON wr.workspace_id = e.id
    JOIN public.repositories r ON r.id = wr.repository_id
  )
  SELECT jsonb_build_object(
    'observed_at', clock_timestamp(),
    'workspace_count', (SELECT count(*) FROM eligible),
    'repositories', COALESCE((SELECT jsonb_agg(to_jsonb(repos) ORDER BY full_name) FROM repos), '[]'::jsonb)
  );
$$;
REVOKE ALL ON FUNCTION public.begin_workspace_work_scan() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.begin_workspace_work_scan() TO authenticated;

CREATE FUNCTION public.record_workspace_work_snapshot(
  p_repository_id uuid, p_category text, p_observed_at timestamptz,
  p_items jsonb, p_complete boolean
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp AS $$
DECLARE
  v_user uuid := auth.uid();
  v_cursor public.workspace_work_cursors%ROWTYPE;
  v_repo text;
  v_item jsonb;
BEGIN
  IF v_user IS NULL OR NOT public.can_receive_workspace_work(p_repository_id) THEN
    RAISE EXCEPTION 'Workspace repository access required' USING ERRCODE = '42501';
  END IF;
  IF p_category IS NULL OR p_category NOT IN ('awaiting_reply', 'review_requested')
    OR p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) > 1000
    OR p_complete IS NULL OR p_observed_at IS NULL OR p_observed_at > clock_timestamp() THEN
    RAISE EXCEPTION 'Invalid work snapshot';
  END IF;
  SELECT full_name INTO v_repo FROM public.repositories WHERE id = p_repository_id;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user::text || p_repository_id::text || p_category, 0));
  SELECT * INTO v_cursor FROM public.workspace_work_cursors
    WHERE user_id = v_user AND repository_id = p_repository_id AND category = p_category;
  IF v_cursor.observed_at IS NOT NULL AND p_observed_at <= v_cursor.observed_at THEN RETURN; END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF v_item->>'url' IS NULL OR NOT (
      starts_with(v_item->>'url', 'https://github.com/' || v_repo || '/pull/') OR
      starts_with(v_item->>'url', 'https://github.com/' || v_repo || '/issues/')
    ) OR length(COALESCE(v_item->>'preview', '')) > 500 OR length(COALESCE(v_item->>'actor', '')) > 100 THEN
      RAISE EXCEPTION 'Invalid work item';
    END IF;
    INSERT INTO public.workspace_work_inbox AS old (
      user_id, repository_id, category, subject_key, source_version, title, url, actor, preview,
      occurred_at, is_pending, is_read, last_observed_at
    ) VALUES (
      v_user, p_repository_id, p_category, v_item->>'subject_key', v_item->>'source_version',
      v_item->>'title', v_item->>'url', COALESCE(v_item->>'actor',''), COALESCE(v_item->>'preview',''),
      (v_item->>'occurred_at')::timestamptz, true, NOT COALESCE(v_cursor.initialized, false), p_observed_at
    ) ON CONFLICT (user_id, repository_id, category, subject_key) DO UPDATE SET
      revision = CASE WHEN old.source_version IS DISTINCT FROM EXCLUDED.source_version OR NOT old.is_pending
        THEN old.revision + 1 ELSE old.revision END,
      is_read = CASE
        WHEN old.source_version IS DISTINCT FROM EXCLUDED.source_version OR NOT old.is_pending
          THEN NOT COALESCE(v_cursor.initialized, false)
        ELSE old.is_read END,
      source_version = EXCLUDED.source_version, title = EXCLUDED.title, url = EXCLUDED.url,
      actor = EXCLUDED.actor, preview = EXCLUDED.preview, occurred_at = EXCLUDED.occurred_at,
      is_pending = true, last_observed_at = EXCLUDED.last_observed_at;
  END LOOP;
  -- Partial/failed searches must never resolve work just because it wasn't returned.
  IF p_complete THEN
    UPDATE public.workspace_work_inbox SET is_pending = false, last_observed_at = p_observed_at
      WHERE user_id = v_user AND repository_id = p_repository_id AND category = p_category
      AND last_observed_at < p_observed_at;
  END IF;
  INSERT INTO public.workspace_work_cursors VALUES
    (v_user, p_repository_id, p_category, p_complete, p_observed_at)
  ON CONFLICT (user_id, repository_id, category) DO UPDATE SET
    initialized = workspace_work_cursors.initialized OR EXCLUDED.initialized,
    observed_at = EXCLUDED.observed_at;
END;
$$;
REVOKE ALL ON FUNCTION public.record_workspace_work_snapshot(uuid,text,timestamptz,jsonb,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_workspace_work_snapshot(uuid,text,timestamptz,jsonb,boolean) TO authenticated;

CREATE FUNCTION public.read_workspace_work(p_id uuid, p_revision bigint)
RETURNS void LANGUAGE sql SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp AS $$
  UPDATE public.workspace_work_inbox SET is_read = true
  WHERE id = p_id AND user_id = auth.uid() AND revision = p_revision
    AND public.can_receive_workspace_work(repository_id);
$$;
REVOKE ALL ON FUNCTION public.read_workspace_work(uuid,bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.read_workspace_work(uuid,bigint) TO authenticated;

COMMENT ON TABLE public.workspace_work_inbox IS
  'Personal follow-up suggestions, deduplicated across workspaces. Read is not resolved. Browser-observed GitHub state, not authoritative webhook events.';

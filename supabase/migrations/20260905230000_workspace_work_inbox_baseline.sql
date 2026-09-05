-- Baseline on the first snapshot even when it is partial, and accept GitHub's
-- canonical URL casing. Only the resolve sweep still requires a complete scan.
CREATE OR REPLACE FUNCTION public.record_workspace_work_snapshot(
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
  SELECT lower(full_name) INTO v_repo FROM public.repositories WHERE id = p_repository_id;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user::text || p_repository_id::text || p_category, 0));
  SELECT * INTO v_cursor FROM public.workspace_work_cursors
    WHERE user_id = v_user AND repository_id = p_repository_id AND category = p_category;
  IF v_cursor.observed_at IS NOT NULL AND p_observed_at <= v_cursor.observed_at THEN RETURN; END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    -- GitHub names are case-insensitive; stored names may not match GitHub's casing.
    IF v_item->>'url' IS NULL OR NOT (
      starts_with(lower(v_item->>'url'), 'https://github.com/' || v_repo || '/pull/') OR
      starts_with(lower(v_item->>'url'), 'https://github.com/' || v_repo || '/issues/')
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
  -- The first snapshot, complete or not, is the quiet baseline. Later changes alert.
  INSERT INTO public.workspace_work_cursors VALUES
    (v_user, p_repository_id, p_category, true, p_observed_at)
  ON CONFLICT (user_id, repository_id, category) DO UPDATE SET
    initialized = true, observed_at = EXCLUDED.observed_at;
END;
$$;

COMMENT ON COLUMN public.workspace_work_cursors.initialized IS
  'True once any snapshot was recorded for this user, repository, and category. Items seen in that first snapshot are read; later changes are unread.';

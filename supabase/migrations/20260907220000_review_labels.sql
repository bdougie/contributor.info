-- Review labeling is served through authenticated Netlify endpoints. No direct
-- browser access, including workspace owners reading another person's labels.
CREATE TABLE public.review_label_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  repository_ids uuid[] NOT NULL CHECK (cardinality(repository_ids) BETWEEN 1 AND 5),
  cutoff timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.review_label_campaigns(workspace_id);

CREATE TABLE public.review_label_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.review_label_campaigns(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  reviewer_github_id text NOT NULL CHECK (reviewer_github_id ~ '^[0-9]+$'),
  reviewer_login text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer NOT NULL DEFAULT 0,
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id),
  revoked_at timestamptz
);
CREATE INDEX ON public.review_label_invites(campaign_id);

CREATE TABLE public.review_label_invite_views (
  invite_id uuid NOT NULL REFERENCES public.review_label_invites(id) ON DELETE CASCADE,
  visit_id uuid NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(invite_id, visit_id)
);

CREATE TABLE public.review_label_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.review_label_campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewer_github_id text NOT NULL,
  reviewer_login text NOT NULL,
  consent_id uuid,
  consent_at timestamptz,
  consent_version text,
  scan_repo integer NOT NULL DEFAULT 0,
  scan_page integer NOT NULL DEFAULT 1,
  scan_done boolean NOT NULL DEFAULT false,
  UNIQUE(campaign_id, user_id)
);
CREATE INDEX ON public.review_label_enrollments(user_id);

CREATE TABLE public.review_label_prs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.review_label_enrollments(id) ON DELETE CASCADE,
  repository_id uuid NOT NULL REFERENCES public.repositories(id),
  pr_number integer NOT NULL CHECK (pr_number > 0),
  payload jsonb NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(enrollment_id, repository_id, pr_number)
);
CREATE TABLE public.review_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.review_label_enrollments(id) ON DELETE CASCADE,
  pr_id uuid NOT NULL REFERENCES public.review_label_prs(id) ON DELETE CASCADE,
  target_key text NOT NULL,
  record jsonb NOT NULL,
  UNIQUE(enrollment_id, pr_id, target_key)
);
CREATE TABLE public.review_label_consent_revocations (
  consent_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.review_label_campaigns(id) ON DELETE CASCADE,
  revoked_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['review_label_campaigns','review_label_invites',
    'review_label_invite_views','review_label_enrollments','review_label_prs',
    'review_labels','review_label_consent_revocations'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

-- A browser visit is a session-level observation, not proof the intended
-- recipient viewed it. The unique key prevents reload/OAuth/StrictMode doubles.
CREATE FUNCTION public.record_review_invite_view(p_hash text, p_visit uuid)
RETURNS void LANGUAGE plpgsql SET search_path = public, pg_catalog, pg_temp AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM review_label_invites
    WHERE token_hash = p_hash AND revoked_at IS NULL AND expires_at > now();
  IF v_id IS NULL THEN RETURN; END IF;
  INSERT INTO review_label_invite_views(invite_id, visit_id) VALUES(v_id, p_visit)
    ON CONFLICT DO NOTHING;
  IF FOUND THEN
    UPDATE review_label_invites SET first_viewed_at = coalesce(first_viewed_at, now()),
      last_viewed_at = now(), view_count = view_count + 1 WHERE id = v_id;
  END IF;
END $$;

-- Called only by the service endpoint after verifying the Supabase session.
-- Identity is checked again against auth.identities, never editable metadata.
CREATE FUNCTION public.accept_review_label_invite(p_hash text, p_user uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog, pg_temp AS $$
DECLARE i review_label_invites; w workspaces; v_app uuid; v_enrollment uuid;
  v_limit integer; v_count integer;
BEGIN
  SELECT * INTO i FROM review_label_invites WHERE token_hash = p_hash FOR UPDATE;
  IF i.id IS NULL OR i.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'Invitation unavailable'; END IF;
  IF NOT EXISTS(SELECT 1 FROM auth.identities WHERE user_id = p_user
    AND provider = 'github' AND provider_id = i.reviewer_github_id) THEN
    RAISE EXCEPTION 'Sign in with the invited GitHub account';
  END IF;
  IF i.accepted_by IS NOT NULL AND i.accepted_by <> p_user THEN
    RAISE EXCEPTION 'Invitation already accepted';
  END IF;
  IF i.accepted_at IS NULL AND i.expires_at <= now() THEN RAISE EXCEPTION 'Invitation expired'; END IF;
  SELECT * INTO w FROM workspaces WHERE id = (
    SELECT workspace_id FROM review_label_campaigns WHERE id = i.campaign_id
  ) AND is_active FOR UPDATE;
  IF w.id IS NULL THEN RAISE EXCEPTION 'Workspace unavailable'; END IF;
  SELECT id INTO v_app FROM app_users WHERE auth_user_id = p_user;
  IF v_app IS NULL THEN RAISE EXCEPTION 'Finish creating your account, then try again'; END IF;
  -- A retry may resume an accepted invitation, but cannot restore a removed member.
  IF i.accepted_at IS NOT NULL THEN
    IF w.owner_id <> v_app AND NOT EXISTS(SELECT 1 FROM workspace_members
      WHERE workspace_id = w.id AND user_id = v_app AND accepted_at IS NOT NULL) THEN
      RAISE EXCEPTION 'Workspace membership required';
    END IF;
  ELSIF w.owner_id <> v_app AND NOT EXISTS(SELECT 1 FROM workspace_members
    WHERE workspace_id = w.id AND user_id = v_app AND accepted_at IS NOT NULL) THEN
    v_limit := CASE w.tier WHEN 'team' THEN 5 WHEN 'enterprise' THEN 999 WHEN 'pro' THEN 1 ELSE 0 END;
    SELECT count(*) INTO v_count FROM (SELECT user_id FROM workspace_members
      WHERE workspace_id = w.id AND accepted_at IS NOT NULL UNION SELECT w.owner_id) members;
    IF v_count >= v_limit THEN RAISE EXCEPTION 'Workspace member limit reached'; END IF;
    INSERT INTO workspace_members(workspace_id, user_id, role, invited_by, accepted_at)
      VALUES(w.id, v_app, 'contributor', (SELECT id FROM app_users WHERE auth_user_id=i.created_by), now())
      ON CONFLICT(workspace_id,user_id) DO UPDATE SET accepted_at = now();
  END IF;
  INSERT INTO review_label_enrollments(campaign_id,user_id,reviewer_github_id,reviewer_login)
    VALUES(i.campaign_id,p_user,i.reviewer_github_id,i.reviewer_login)
    ON CONFLICT(campaign_id,user_id) DO NOTHING;
  SELECT id INTO v_enrollment FROM review_label_enrollments WHERE campaign_id=i.campaign_id AND user_id=p_user;
  UPDATE review_label_invites SET accepted_at=coalesce(accepted_at,now()), accepted_by=p_user WHERE id=i.id;
  RETURN v_enrollment;
END $$;

-- Construct the export record from the stored GitHub snapshot in this transaction.
-- Client-provided author, login, hunk, comment, timestamp or consent are never used.
CREATE FUNCTION public.save_review_label(p_user uuid, p_pr uuid, p_target text,
  p_label text, p_note text DEFAULT NULL, p_consent_version text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public, pg_catalog, pg_temp AS $$
DECLARE e review_label_enrollments; pr review_label_prs; h jsonb; c jsonb;
  v_id uuid; v_record jsonb; v_key text;
BEGIN
  IF p_label NOT IN ('good','bad','skip','missed') THEN RAISE EXCEPTION 'Invalid label'; END IF;
  SELECT * INTO pr FROM review_label_prs WHERE id=p_pr;
  SELECT * INTO e FROM review_label_enrollments WHERE id=pr.enrollment_id AND user_id=p_user FOR UPDATE;
  IF e.id IS NULL THEN RAISE EXCEPTION 'Review not available to this account'; END IF;
  IF NOT EXISTS(SELECT 1 FROM review_label_campaigns rc JOIN workspaces w ON w.id=rc.workspace_id
    JOIN app_users au ON au.auth_user_id=p_user WHERE rc.id=e.campaign_id AND w.is_active
    AND (w.owner_id=au.id OR EXISTS(SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id=w.id AND wm.user_id=au.id AND wm.accepted_at IS NOT NULL))) THEN
    RAISE EXCEPTION 'Workspace membership required';
  END IF;
  IF p_label='missed' THEN
    IF p_note IS NULL OR length(btrim(p_note)) NOT BETWEEN 1 AND 280 OR p_note ~ E'[\n\r]' THEN
      RAISE EXCEPTION 'Enter one line, up to 280 characters';
    END IF;
    SELECT value INTO h FROM jsonb_array_elements(pr.payload->'hunks') WHERE value->>'id'=p_target;
    v_key := 'hunk:' || p_target;
  ELSE
    IF p_note IS NOT NULL THEN RAISE EXCEPTION 'Notes are only for missed entries'; END IF;
    SELECT value INTO c FROM jsonb_array_elements(pr.payload->'comments') WHERE value->>'id'=p_target;
    SELECT value INTO h FROM jsonb_array_elements(pr.payload->'hunks') WHERE value->>'id'=c->>'hunkId';
    v_key := 'comment:' || p_target;
  END IF;
  IF h IS NULL THEN RAISE EXCEPTION 'Original hunk unavailable'; END IF;
  IF p_label <> 'skip' AND e.consent_at IS NULL THEN
    IF p_consent_version IS DISTINCT FROM '2026-09-07-v1' THEN RAISE EXCEPTION 'Read the current consent notice'; END IF;
    UPDATE review_label_enrollments SET consent_id=gen_random_uuid(),consent_at=now(),consent_version=p_consent_version
      WHERE id=e.id RETURNING * INTO e;
  END IF;
  SELECT id INTO v_id FROM review_labels WHERE enrollment_id=e.id AND pr_id=p_pr AND target_key=v_key;
  v_id := coalesce(v_id,gen_random_uuid());
  v_record := jsonb_build_object('id',v_id,'schema_version',1,'reviewer_login',e.reviewer_login,
    'reviewer_github_id',e.reviewer_github_id,'repo',pr.payload->>'repo','pr_number',pr.pr_number,
    'pr_id',pr.id,'file_path',h->>'path','hunk',h->>'diff','hunk_id',h->>'id',
    'comment',c,'label',p_label,'note',p_note,'timestamp',now(),
    'consent_id',e.consent_id,'consent_version',e.consent_version,'campaign_id',e.campaign_id);
  INSERT INTO review_labels(id,enrollment_id,pr_id,target_key,record) VALUES(v_id,e.id,p_pr,v_key,v_record)
    ON CONFLICT(enrollment_id,pr_id,target_key) DO UPDATE SET record=excluded.record;
  RETURN v_record;
END $$;

CREATE FUNCTION public.withdraw_review_label_consent(p_user uuid, p_enrollment uuid)
RETURNS void LANGUAGE plpgsql SET search_path = public, pg_catalog, pg_temp AS $$
DECLARE e review_label_enrollments;
BEGIN
  SELECT * INTO e FROM review_label_enrollments WHERE id=p_enrollment AND user_id=p_user FOR UPDATE;
  IF e.id IS NULL THEN RAISE EXCEPTION 'Enrollment not found'; END IF;
  IF e.consent_id IS NOT NULL THEN
    INSERT INTO review_label_consent_revocations(consent_id,user_id,campaign_id)
      VALUES(e.consent_id,p_user,e.campaign_id) ON CONFLICT DO NOTHING;
  END IF;
  DELETE FROM review_labels WHERE enrollment_id=e.id;
  UPDATE review_label_enrollments SET consent_id=NULL,consent_at=NULL,consent_version=NULL WHERE id=e.id;
END $$;

REVOKE ALL ON FUNCTION public.record_review_invite_view(text,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.accept_review_label_invite(text,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.save_review_label(uuid,uuid,text,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.withdraw_review_label_consent(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_review_invite_view(text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.accept_review_label_invite(text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_review_label(uuid,uuid,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.withdraw_review_label_consent(uuid,uuid) TO service_role;

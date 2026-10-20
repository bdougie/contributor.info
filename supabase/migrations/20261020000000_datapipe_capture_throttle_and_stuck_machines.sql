-- Issue #1870: gh-datapipe machines exhausted the owner's GitHub rate limit.
--
-- 1. datapipe_start_machine(): a sync/daily job that has been "running" for
--    more than three hours is wedged (in practice: asleep on a rate limit).
--    Requesting another start is a no-op on Fly (previous_state "started") and
--    only leaves a `queued` row behind. Instead: fail the stuck row, ask Fly to
--    stop the machine, and let the next tick start it fresh. Queued rows older
--    than 20 minutes (a start Fly ignored) are failed before a new request.
-- 2. datapipe_claim_capture(): one place that decides whether a capture for a
--    repository needs a new machine. It serialises callers per repository with
--    an advisory lock, so two page loads 0.6 s apart no longer each start a
--    30-day backfill, and it caps the number of capture machines that may be
--    active at once. The edge functions call it instead of inserting the row.

-- ============================================================================
-- datapipe_start_machine(job_type, job_params)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.datapipe_start_machine(
  job_type TEXT,
  job_params JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  machine_name TEXT;
  machine TEXT;
  fly_token TEXT;
  new_job_id UUID;
  stuck_job_id UUID;
  request_id BIGINT;
BEGIN
  PERFORM public.datapipe_assert_service_caller();

  machine_name := CASE job_type
    WHEN 'sync' THEN 'hourly-sync'
    WHEN 'daily' THEN 'daily'
    ELSE NULL
  END;

  IF machine_name IS NULL THEN
    RAISE EXCEPTION 'datapipe_start_machine: unknown job_type %', job_type;
  END IF;

  SELECT m.fly_machine_id INTO machine
  FROM public.datapipe_machines m
  WHERE m.name = machine_name;

  IF machine IS NULL THEN
    RAISE NOTICE 'datapipe_start_machine: no datapipe_machines row for %, nothing started', machine_name;
    RETURN NULL;
  END IF;

  SELECT decrypted_secret INTO fly_token
  FROM vault.decrypted_secrets
  WHERE name = 'fly_datapipe_token'
  LIMIT 1;

  IF fly_token IS NULL THEN
    RAISE NOTICE 'datapipe_start_machine: vault secret fly_datapipe_token missing, nothing started';
    RETURN NULL;
  END IF;

  -- One start per machine at a time. The hourly and freshness crons can both
  -- target the sync machine, and pg_net is asynchronous, so a row that is
  -- still queued (start requested, machine not yet claimed it) counts as
  -- active for 20 minutes. Serialise concurrent callers on the machine id.
  PERFORM pg_advisory_xact_lock(hashtext('datapipe_start_machine:' || machine));

  -- A start that Fly answered with previous_state "started" (or that never
  -- booted) leaves its row queued; the machine claims only the newest row when
  -- it next boots. Close those before deciding anything else.
  UPDATE public.datapipe_jobs
  SET status = 'failed',
      error = 'start request not claimed within 20 minutes (machine was already started or never booted)',
      completed_at = NOW()
  WHERE fly_machine_id = machine
    AND status = 'queued'
    AND created_at <= NOW() - INTERVAL '20 minutes';

  IF EXISTS (
    SELECT 1 FROM public.datapipe_jobs j
    WHERE j.fly_machine_id = machine
      AND (
        (j.status = 'running' AND j.started_at > NOW() - INTERVAL '3 hours')
        OR (j.status = 'queued' AND j.created_at > NOW() - INTERVAL '20 minutes')
      )
  ) THEN
    RAISE NOTICE 'datapipe_start_machine: % already has a queued or running job, skipping', machine_name;
    RETURN NULL;
  END IF;

  -- No sync or daily run takes three hours. A row still running after that
  -- means the machine is wedged, and a start request would be a no-op.
  -- Fail the row, stop the machine, and let the next tick start it fresh.
  SELECT j.id INTO stuck_job_id
  FROM public.datapipe_jobs j
  WHERE j.fly_machine_id = machine AND j.status = 'running'
  ORDER BY j.started_at DESC NULLS LAST
  LIMIT 1;

  IF stuck_job_id IS NOT NULL THEN
    UPDATE public.datapipe_jobs
    SET status = 'failed',
        error = 'running for more than 3 hours; scheduler stopped the machine',
        completed_at = NOW()
    WHERE id = stuck_job_id;

    SELECT net.http_post(
      url := 'https://api.machines.dev/v1/apps/gh-datapipe-sync/machines/' || machine || '/stop',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || fly_token,
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 15000
    ) INTO request_id;

    RAISE NOTICE 'datapipe_start_machine: % job % ran for more than 3 hours, stop requested (pg_net %), start deferred to the next tick',
      machine_name, stuck_job_id, request_id;
    RETURN NULL;
  END IF;

  INSERT INTO public.datapipe_jobs (type, params, fly_machine_id)
  VALUES (job_type, COALESCE(job_params, '{}'::jsonb), machine)
  RETURNING id INTO new_job_id;

  -- Fire and forget. The outcome is read from datapipe_jobs; the HTTP
  -- response is kept for ~6 h in net._http_response for debugging.
  SELECT net.http_post(
    url := 'https://api.machines.dev/v1/apps/gh-datapipe-sync/machines/' || machine || '/start',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || fly_token,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  ) INTO request_id;

  UPDATE public.datapipe_jobs
  SET progress = jsonb_build_object('step', 'start_requested', 'pg_net_request_id', request_id)
  WHERE id = new_job_id;

  RETURN new_job_id;
END;
$$;

REVOKE ALL ON FUNCTION public.datapipe_start_machine(TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.datapipe_start_machine(TEXT, JSONB) TO service_role, postgres;

COMMENT ON FUNCTION public.datapipe_start_machine(TEXT, JSONB) IS
  'Insert a datapipe_jobs row and start the matching stopped Fly machine (sync -> hourly-sync, daily -> daily) through pg_net. Returns the job id, or NULL when not configured, already running, or when a job stuck running for more than 3 hours was failed and the machine asked to stop instead.';

-- ============================================================================
-- datapipe_claim_capture(repository, sources, days, params)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.datapipe_claim_capture(
  p_repository TEXT,
  p_sources TEXT[],
  p_days INT,
  p_params JSONB
)
RETURNS TABLE (job_id UUID, reused BOOLEAN, fly_machine_id TEXT, days INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  -- Capture machines that may run at the same time. Each one is a 30-day
  -- backfill that shares the GitHub App rate limits with the hourly sync.
  max_active CONSTANT INT := 2;
  active_count INT;
  existing RECORD;
  new_id UUID;
BEGIN
  PERFORM public.datapipe_assert_service_caller();

  IF p_repository IS NULL OR p_repository !~ '^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$' THEN
    RAISE EXCEPTION 'datapipe_claim_capture: repository must be a GitHub-shaped owner/name';
  END IF;
  IF p_sources IS NULL OR cardinality(p_sources) = 0 THEN
    RAISE EXCEPTION 'datapipe_claim_capture: at least one source is required';
  END IF;

  -- Two requests for the same repository 0.6 s apart used to both pass a
  -- read-then-insert check and start two machines. Serialise per repository.
  PERFORM pg_advisory_xact_lock(hashtext('datapipe_capture:' || p_repository));

  -- An active capture for this repository that already covers the requested
  -- sources and window is reused; the datapipe syncs the whole window anyway.
  SELECT j.id, j.fly_machine_id, COALESCE((j.params ->> 'days')::int, 0) AS days
  INTO existing
  FROM public.datapipe_jobs j
  WHERE j.type = 'capture'
    AND j.params ->> 'repository' = p_repository
    AND (
      (j.status = 'queued' AND j.created_at > NOW() - INTERVAL '20 minutes')
      OR (j.status = 'running' AND j.started_at > NOW() - INTERVAL '3 hours')
    )
    AND COALESCE((j.params ->> 'days')::int, 0) >= p_days
    AND (
      SELECT array_agg(s)
      FROM jsonb_array_elements_text(COALESCE(j.params -> 'sources', '[]'::jsonb)) AS s
    ) @> p_sources
  ORDER BY j.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT existing.id, TRUE, existing.fly_machine_id, existing.days;
    RETURN;
  END IF;

  SELECT count(*) INTO active_count
  FROM public.datapipe_jobs j
  WHERE j.type = 'capture'
    AND (
      (j.status = 'queued' AND j.created_at > NOW() - INTERVAL '20 minutes')
      OR (j.status = 'running' AND j.started_at > NOW() - INTERVAL '3 hours')
    );

  IF active_count >= max_active THEN
    -- The edge functions map this message to HTTP 429.
    RAISE EXCEPTION 'capture_capacity_reached: % capture machines are already active (limit %), retry later',
      active_count, max_active
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.datapipe_jobs (type, status, params)
  VALUES ('capture', 'queued', COALESCE(p_params, '{}'::jsonb))
  RETURNING id INTO new_id;

  RETURN QUERY SELECT new_id, FALSE, NULL::TEXT, p_days;
END;
$$;

REVOKE ALL ON FUNCTION public.datapipe_claim_capture(TEXT, TEXT[], INT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.datapipe_claim_capture(TEXT, TEXT[], INT, JSONB) TO service_role, postgres;

COMMENT ON FUNCTION public.datapipe_claim_capture(TEXT, TEXT[], INT, JSONB) IS
  'Per-repository dedupe and global concurrency cap for gh-datapipe capture machines. Returns the active job to reuse (reused = true) or a new queued datapipe_jobs row the caller must start a machine for. Raises capture_capacity_reached when the cap is hit.';

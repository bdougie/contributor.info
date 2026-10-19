-- gh-datapipe scale-to-zero: job state and scheduling in Supabase
--
-- Plan: open-source-ready/gh-datapipe#265 and bdougie/contributor.info#1853.
-- Supabase is the clock. pg_cron calls datapipe_start_machine(), which inserts
-- a datapipe_jobs row and asks the Fly Machines API (through pg_net) to start a
-- stopped machine. The machine claims the queued row by its FLY_MACHINE_ID and
-- writes status back as it runs. Nothing runs on Fly between jobs.
--
-- Operator setup after applying (see gh-datapipe/docs/fly-deployment.md):
--   select vault.create_secret('<fly deploy token>', 'fly_datapipe_token');
--   insert into datapipe_machines (name, fly_machine_id)
--   values ('hourly-sync', '<id>'), ('daily', '<id>')
--   on conflict (name) do update set fly_machine_id = excluded.fly_machine_id;
-- Until both exist the cron jobs run, log a NOTICE, and start nothing.

-- ============================================================================
-- EXTENSIONS (optional locally)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  ELSE
    RAISE NOTICE 'pg_cron not available - datapipe schedules will be skipped';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_net') THEN
    -- pg_cron can only live in its own `cron` schema; pg_net goes in
    -- `extensions` like every other extension on this project.
    CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
  ELSE
    RAISE NOTICE 'pg_net not available - datapipe_start_machine will fail at call time';
  END IF;
END $$;

-- ============================================================================
-- TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.datapipe_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('sync', 'daily', 'backfill', 'capture')),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  fly_machine_id TEXT,
  progress JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

COMMENT ON TABLE public.datapipe_jobs IS
  'One row per gh-datapipe machine run (hourly sync, daily archive, on-demand backfill, capture). Written by the machine via --job-id; read by contributor.info and the freshness cron.';

CREATE INDEX IF NOT EXISTS idx_datapipe_jobs_active
  ON public.datapipe_jobs (fly_machine_id, created_at DESC)
  WHERE status IN ('queued', 'running');
CREATE INDEX IF NOT EXISTS idx_datapipe_jobs_created
  ON public.datapipe_jobs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_datapipe_jobs_repository
  ON public.datapipe_jobs ((params ->> 'repository'))
  WHERE params ? 'repository';

CREATE TABLE IF NOT EXISTS public.datapipe_machines (
  name TEXT PRIMARY KEY,
  fly_machine_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.datapipe_machines IS
  'Fly machine IDs of the stopped scheduler machines on gh-datapipe-sync, keyed by name (hourly-sync, daily). Updated after every ./scripts/deploy-to-fly.sh.';

-- ============================================================================
-- RLS: service role only
-- ============================================================================

ALTER TABLE public.datapipe_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datapipe_machines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "datapipe_jobs service role" ON public.datapipe_jobs;
CREATE POLICY "datapipe_jobs service role" ON public.datapipe_jobs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "datapipe_machines service role" ON public.datapipe_machines;
CREATE POLICY "datapipe_machines service role" ON public.datapipe_machines
  FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON public.datapipe_jobs FROM anon, authenticated;
REVOKE ALL ON public.datapipe_machines FROM anon, authenticated;
GRANT ALL ON public.datapipe_jobs TO service_role;
GRANT ALL ON public.datapipe_machines TO service_role;

-- ============================================================================
-- Caller check shared by the SECURITY DEFINER functions below
-- ============================================================================
-- Grants already limit EXECUTE to service_role and postgres, but a definer
-- function should not rely on grants alone. pg_cron runs as postgres;
-- PostgREST calls carry the JWT role claim.

CREATE OR REPLACE FUNCTION public.datapipe_assert_service_caller()
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public, pg_catalog, pg_temp
AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN;
  END IF;
  IF session_user IN ('postgres', 'supabase_admin') THEN
    RETURN;
  END IF;
  RAISE EXCEPTION 'datapipe functions may only be called by service_role or cron'
    USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION public.datapipe_assert_service_caller() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.datapipe_assert_service_caller() TO service_role, postgres;

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
  'Insert a datapipe_jobs row and start the matching stopped Fly machine (sync -> hourly-sync, daily -> daily) through pg_net. Returns the job id, or NULL when not configured or already running.';

-- ============================================================================
-- Freshness safety net (Phase 3)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.datapipe_freshness_check(stale_after INTERVAL DEFAULT INTERVAL '30 hours')
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  newest_event TIMESTAMPTZ;
  newest_pr TIMESTAMPTZ;
  newest_issue TIMESTAMPTZ;
  newest_comment TIMESTAMPTZ;
  oldest_table TEXT;
  oldest_ts TIMESTAMPTZ;
BEGIN
  PERFORM public.datapipe_assert_service_caller();

  -- This is a net for a dead schedule, not for quiet data. If any sync job was
  -- created in the last 3 hours the hourly cron is alive and there is nothing
  -- for this function to add (a quiet table cannot be made fresher by
  -- re-running the sync, and a failing sync is visible in datapipe_jobs).
  IF EXISTS (
    SELECT 1 FROM public.datapipe_jobs
    WHERE type = 'sync' AND created_at > NOW() - INTERVAL '3 hours'
  ) THEN
    RETURN NULL;
  END IF;

  SELECT MAX(created_at) INTO newest_event FROM public.github_events_cache;
  SELECT MAX(created_at) INTO newest_pr FROM public.pull_requests;
  SELECT MAX(created_at) INTO newest_issue FROM public.issues;
  SELECT MAX(created_at) INTO newest_comment FROM public.comments;

  SELECT t, ts INTO oldest_table, oldest_ts
  FROM (VALUES
    ('github_events_cache', newest_event),
    ('pull_requests', newest_pr),
    ('issues', newest_issue),
    ('comments', newest_comment)
  ) AS v(t, ts)
  ORDER BY ts ASC NULLS FIRST
  LIMIT 1;

  -- An empty table (NULL) is treated as stale: it has never been synced.
  IF oldest_ts IS NOT NULL AND oldest_ts > NOW() - stale_after THEN
    RETURN NULL; -- fresh
  END IF;

  RAISE NOTICE 'datapipe_freshness_check: % newest row is % (older than %), starting sync',
    oldest_table, oldest_ts, stale_after;

  RETURN public.datapipe_start_machine(
    'sync',
    jsonb_build_object('reason', 'freshness', 'stale_table', oldest_table, 'stale_since', oldest_ts)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.datapipe_freshness_check(INTERVAL) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.datapipe_freshness_check(INTERVAL) TO service_role, postgres;

-- ============================================================================
-- Housekeeping: stuck rows and 30-day purge
-- ============================================================================

CREATE OR REPLACE FUNCTION public.datapipe_housekeeping()
RETURNS TABLE (never_started INT, stopped_silently INT, purged INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  n_never INT;
  n_silent INT;
  n_purged INT;
BEGIN
  PERFORM public.datapipe_assert_service_caller();

  -- queued but the machine never claimed it (start request failed)
  UPDATE public.datapipe_jobs
  SET status = 'failed', error = 'machine never started (no claim within 2 hours)', completed_at = NOW()
  WHERE status = 'queued' AND created_at < NOW() - INTERVAL '2 hours';
  GET DIAGNOSTICS n_never = ROW_COUNT;

  -- running far longer than any job takes: the machine died without reporting
  UPDATE public.datapipe_jobs
  SET status = 'failed', error = 'machine stopped without reporting (running > 6 hours)', completed_at = NOW()
  WHERE status = 'running' AND started_at < NOW() - INTERVAL '6 hours';
  GET DIAGNOSTICS n_silent = ROW_COUNT;

  DELETE FROM public.datapipe_jobs
  WHERE created_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS n_purged = ROW_COUNT;

  RETURN QUERY SELECT n_never, n_silent, n_purged;
END;
$$;

REVOKE ALL ON FUNCTION public.datapipe_housekeeping() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.datapipe_housekeeping() TO service_role, postgres;

-- ============================================================================
-- SCHEDULES (pg_cron)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron missing - skipping datapipe schedules';
    RETURN;
  END IF;

  PERFORM cron.unschedule(jobid) FROM cron.job
   WHERE jobname IN ('datapipe-hourly', 'datapipe-daily', 'datapipe-freshness', 'datapipe-housekeeping');

  -- Hourly sync at :07 (off the hour so it does not collide with other crons)
  PERFORM cron.schedule('datapipe-hourly', '7 * * * *',
    $cron$ SELECT public.datapipe_start_machine('sync', '{"reason":"schedule"}'::jsonb) $cron$);

  -- Daily archive + 48 h catch-up at 02:00 UTC
  PERFORM cron.schedule('datapipe-daily', '0 2 * * *',
    $cron$ SELECT public.datapipe_start_machine('daily', '{"reason":"schedule"}'::jsonb) $cron$);

  -- Freshness safety net every 3 h, independent of the hourly job
  PERFORM cron.schedule('datapipe-freshness', '23 */3 * * *',
    $cron$ SELECT public.datapipe_freshness_check() $cron$);

  -- Stuck-row cleanup and 30-day purge
  PERFORM cron.schedule('datapipe-housekeeping', '41 3 * * *',
    $cron$ SELECT * FROM public.datapipe_housekeeping() $cron$);
END $$;

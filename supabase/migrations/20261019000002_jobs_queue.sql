-- Phase 3b of docs/infrastructure/cost-reduction-plan.md (#1853, #1859).
--
-- Inngest's event transport becomes a pgmq queue named `jobs`, fed by
-- `enqueue_job()` and drained by the `process-job` edge function. Each message
-- has a companion row in `background_jobs` (recreated here; it was dropped by
-- 20260428000007_drop_dead_tables.sql while `process-job`, `process-webhook`
-- and `health-jobs` still referenced it).
--
--   caller ──▶ enqueue_job(type, payload) ──▶ background_jobs row (queued)
--                                         └─▶ pgmq.send('jobs', {job_id,type,payload})
--   pg_cron every minute ──▶ drain_jobs_queue() ──pg_net──▶ edge process-job
--   process-job ──▶ jobs_read() ──▶ dispatch ──▶ jobs_delete() | jobs_set_vt() | jobs_archive()
--
-- This migration also moves `invoke_edge_function()` (20250120000003) off the
-- `app.service_role_key` GUC, which was never set, onto Vault.
--
-- Operator setup after applying:
--   select vault.create_secret('<service role key>', 'service_role_key');
-- Optional (defaults to this project's URL):
--   select vault.create_secret('https://<ref>.supabase.co', 'supabase_url');
-- Until the key exists the cron runs, logs a NOTICE, and calls nothing.

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pgmq') THEN
    CREATE EXTENSION IF NOT EXISTS pgmq;
  ELSE
    RAISE NOTICE 'pgmq not available - jobs queue functions will fail at call time';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_net') THEN
    CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgmq') THEN
    IF NOT EXISTS (SELECT 1 FROM pgmq.list_queues() WHERE queue_name = 'jobs') THEN
      PERFORM pgmq.create('jobs');
    END IF;
  END IF;
END $$;

-- ============================================================================
-- background_jobs (recreated)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.background_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  result JSONB,
  error TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 3,
  pgmq_msg_id BIGINT,
  source TEXT,
  repository_id UUID REFERENCES public.repositories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  duration_ms INT GENERATED ALWAYS AS (
    CASE
      WHEN completed_at IS NOT NULL AND started_at IS NOT NULL
        THEN (EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000)::INT
      WHEN failed_at IS NOT NULL AND started_at IS NOT NULL
        THEN (EXTRACT(EPOCH FROM (failed_at - started_at)) * 1000)::INT
      ELSE NULL
    END
  ) STORED
);

COMMENT ON TABLE public.background_jobs IS
  'One row per job on the pgmq `jobs` queue (former Inngest events). Written by enqueue_job() and the process-job edge function.';
COMMENT ON COLUMN public.background_jobs.type IS
  'Job type, same namespace as the former Inngest event names (capture/*, classify/*, embeddings/*, workspace/*, cron/*).';
COMMENT ON COLUMN public.background_jobs.pgmq_msg_id IS
  'Message id in pgmq.q_jobs while the job is queued; kept after delete/archive for tracing.';

CREATE INDEX IF NOT EXISTS idx_background_jobs_active
  ON public.background_jobs (status, created_at)
  WHERE status IN ('queued', 'processing');
CREATE INDEX IF NOT EXISTS idx_background_jobs_created
  ON public.background_jobs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_background_jobs_type_created
  ON public.background_jobs (type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_background_jobs_repository
  ON public.background_jobs (repository_id)
  WHERE repository_id IS NOT NULL;

ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "background_jobs service role" ON public.background_jobs;
CREATE POLICY "background_jobs service role" ON public.background_jobs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON public.background_jobs FROM anon, authenticated;
GRANT ALL ON public.background_jobs TO service_role;

-- ============================================================================
-- Caller check (same rule as datapipe_assert_service_caller)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.jobs_assert_service_caller()
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
  RAISE EXCEPTION 'jobs functions may only be called by service_role or cron'
    USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION public.jobs_assert_service_caller() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jobs_assert_service_caller() TO service_role, postgres;

-- ============================================================================
-- invoke_edge_function: service key from Vault instead of a GUC
-- ============================================================================
-- Returns the pg_net request id (the original returned JSONB, which net.http_post
-- never produced). Nothing in the repo reads the return value.

DROP FUNCTION IF EXISTS public.invoke_edge_function(TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.invoke_edge_function(
  function_name TEXT,
  payload JSONB DEFAULT '{}'::jsonb
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  service_role_key TEXT;
  project_url TEXT;
  request_id BIGINT;
BEGIN
  PERFORM public.jobs_assert_service_caller();

  SELECT decrypted_secret INTO service_role_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  IF service_role_key IS NULL THEN
    RAISE NOTICE 'invoke_edge_function: vault secret service_role_key missing, % not called', function_name;
    RETURN NULL;
  END IF;

  SELECT decrypted_secret INTO project_url
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_url'
  LIMIT 1;

  project_url := COALESCE(
    project_url,
    NULLIF(current_setting('app.supabase_url', true), ''),
    'https://egcxzonpmmcirmgqdrla.supabase.co'
  );

  SELECT net.http_post(
    url := project_url || '/functions/v1/' || function_name,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || service_role_key,
      'Content-Type', 'application/json'
    ),
    body := COALESCE(payload, '{}'::jsonb),
    timeout_milliseconds := 5000
  ) INTO request_id;

  RETURN request_id;
END;
$$;

COMMENT ON FUNCTION public.invoke_edge_function(TEXT, JSONB) IS
  'Fire-and-forget POST to a Supabase Edge Function via pg_net, authenticated with the service_role_key Vault secret. Used by pg_cron.';

REVOKE ALL ON FUNCTION public.invoke_edge_function(TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invoke_edge_function(TEXT, JSONB) TO service_role, postgres;

-- ============================================================================
-- enqueue_job(type, payload, repository_id, source, dedupe_window)
-- ============================================================================
-- Inserts the tracking row and the queue message in one transaction. With
-- dedupe_window, an identical job (same type and repositoryId) that is still
-- queued or processing and younger than the window is returned instead of a
-- new one; the crons use this so a stalled worker cannot pile up duplicates.

CREATE OR REPLACE FUNCTION public.enqueue_job(
  job_type TEXT,
  job_payload JSONB DEFAULT '{}'::jsonb,
  p_repository_id UUID DEFAULT NULL,
  p_source TEXT DEFAULT NULL,
  dedupe_window INTERVAL DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  new_job_id UUID;
  msg_id BIGINT;
  repo_key TEXT;
BEGIN
  PERFORM public.jobs_assert_service_caller();

  IF job_type IS NULL OR length(job_type) = 0 OR length(job_type) > 200 THEN
    RAISE EXCEPTION 'enqueue_job: invalid job_type' USING ERRCODE = '22023';
  END IF;

  job_payload := COALESCE(job_payload, '{}'::jsonb);
  IF jsonb_typeof(job_payload) <> 'object' THEN
    RAISE EXCEPTION 'enqueue_job: payload must be a JSON object' USING ERRCODE = '22023';
  END IF;

  IF dedupe_window IS NOT NULL THEN
    repo_key := COALESCE(job_payload ->> 'repositoryId', p_repository_id::TEXT, '');
    SELECT id INTO new_job_id
    FROM public.background_jobs j
    WHERE j.type = job_type
      AND j.status IN ('queued', 'processing')
      AND j.created_at > NOW() - dedupe_window
      AND COALESCE(j.payload ->> 'repositoryId', j.repository_id::TEXT, '') = repo_key
    ORDER BY j.created_at DESC
    LIMIT 1;
    IF new_job_id IS NOT NULL THEN
      RAISE NOTICE 'enqueue_job: % already active as %, not enqueued again', job_type, new_job_id;
      RETURN new_job_id;
    END IF;
  END IF;

  INSERT INTO public.background_jobs (type, payload, repository_id, source)
  VALUES (job_type, job_payload, p_repository_id, p_source)
  RETURNING id INTO new_job_id;

  SELECT pgmq.send(
    'jobs',
    jsonb_build_object('job_id', new_job_id, 'type', job_type, 'payload', job_payload)
  ) INTO msg_id;

  UPDATE public.background_jobs SET pgmq_msg_id = msg_id WHERE id = new_job_id;

  RETURN new_job_id;
END;
$$;

COMMENT ON FUNCTION public.enqueue_job(TEXT, JSONB, UUID, TEXT, INTERVAL) IS
  'Queue a job for the process-job edge function: background_jobs row + pgmq message. dedupe_window skips an identical active job.';

REVOKE ALL ON FUNCTION public.enqueue_job(TEXT, JSONB, UUID, TEXT, INTERVAL) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_job(TEXT, JSONB, UUID, TEXT, INTERVAL) TO service_role, postgres;

-- ============================================================================
-- pgmq wrappers for the worker (pgmq itself is not exposed through PostgREST)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.jobs_read(p_vt INT DEFAULT 600, p_qty INT DEFAULT 5)
RETURNS TABLE (msg_id BIGINT, read_ct INT, enqueued_at TIMESTAMPTZ, vt TIMESTAMPTZ, message JSONB)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
BEGIN
  PERFORM public.jobs_assert_service_caller();
  RETURN QUERY
    SELECT r.msg_id, r.read_ct, r.enqueued_at, r.vt, r.message
    FROM pgmq.read('jobs', GREATEST(p_vt, 1), LEAST(GREATEST(p_qty, 1), 50)) r;
END;
$$;

CREATE OR REPLACE FUNCTION public.jobs_delete(p_msg_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
BEGIN
  PERFORM public.jobs_assert_service_caller();
  RETURN pgmq.delete('jobs', p_msg_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.jobs_archive(p_msg_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
BEGIN
  PERFORM public.jobs_assert_service_caller();
  RETURN pgmq.archive('jobs', p_msg_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.jobs_set_vt(p_msg_id BIGINT, vt_offset INT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
BEGIN
  PERFORM public.jobs_assert_service_caller();
  PERFORM pgmq.set_vt('jobs', p_msg_id, GREATEST(vt_offset, 1));
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.jobs_queue_depth()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  depth BIGINT;
BEGIN
  PERFORM public.jobs_assert_service_caller();
  SELECT queue_length INTO depth FROM pgmq.metrics('jobs');
  RETURN COALESCE(depth, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.jobs_read(INT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.jobs_delete(BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.jobs_archive(BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.jobs_set_vt(BIGINT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.jobs_queue_depth() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jobs_read(INT, INT) TO service_role, postgres;
GRANT EXECUTE ON FUNCTION public.jobs_delete(BIGINT) TO service_role, postgres;
GRANT EXECUTE ON FUNCTION public.jobs_archive(BIGINT) TO service_role, postgres;
GRANT EXECUTE ON FUNCTION public.jobs_set_vt(BIGINT, INT) TO service_role, postgres;
GRANT EXECUTE ON FUNCTION public.jobs_queue_depth() TO service_role, postgres;

-- ============================================================================
-- drain_jobs_queue(): the one-minute tick
-- ============================================================================
-- Only invokes process-job when the queue has visible messages, so an idle
-- system costs no edge invocations.

CREATE OR REPLACE FUNCTION public.drain_jobs_queue()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  depth BIGINT;
BEGIN
  PERFORM public.jobs_assert_service_caller();
  depth := public.jobs_queue_depth();
  IF depth = 0 THEN
    RETURN NULL;
  END IF;
  RETURN public.invoke_edge_function(
    'process-job',
    jsonb_build_object('source', 'cron', 'queue_depth', depth)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.drain_jobs_queue() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.drain_jobs_queue() TO service_role, postgres;

-- ============================================================================
-- Housekeeping: stuck rows, 30-day purge, archive purge
-- ============================================================================

CREATE OR REPLACE FUNCTION public.jobs_housekeeping()
RETURNS TABLE (stuck INT, purged INT, archived_purged INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  n_stuck INT;
  n_purged INT;
  n_archive INT;
BEGIN
  PERFORM public.jobs_assert_service_caller();

  -- A worker that died mid-job leaves the row `processing`; the message is
  -- redelivered by pgmq after its visibility timeout, so the row just needs
  -- to go back to a state the next read accepts. Rows nothing redelivers
  -- (message already deleted) are marked failed after an hour.
  UPDATE public.background_jobs j
  SET status = 'failed',
      error = COALESCE(error, 'worker stopped without reporting (processing > 1 hour)'),
      failed_at = NOW()
  WHERE j.status = 'processing'
    AND j.started_at < NOW() - INTERVAL '1 hour'
    AND NOT EXISTS (SELECT 1 FROM pgmq.q_jobs q WHERE q.msg_id = j.pgmq_msg_id);
  GET DIAGNOSTICS n_stuck = ROW_COUNT;

  DELETE FROM public.background_jobs
  WHERE created_at < NOW() - INTERVAL '30 days'
    AND status IN ('completed', 'failed', 'cancelled');
  GET DIAGNOSTICS n_purged = ROW_COUNT;

  DELETE FROM pgmq.a_jobs WHERE archived_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS n_archive = ROW_COUNT;

  RETURN QUERY SELECT n_stuck, n_purged, n_archive;
END;
$$;

REVOKE ALL ON FUNCTION public.jobs_housekeeping() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jobs_housekeeping() TO service_role, postgres;

-- ============================================================================
-- SCHEDULES
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron missing - skipping jobs queue schedules';
    RETURN;
  END IF;

  PERFORM cron.unschedule(jobid) FROM cron.job
   WHERE jobname IN ('process-jobs-queue', 'jobs-housekeeping');

  PERFORM cron.schedule('process-jobs-queue', '* * * * *',
    $cron$ SELECT public.drain_jobs_queue() $cron$);

  PERFORM cron.schedule('jobs-housekeeping', '53 3 * * *',
    $cron$ SELECT * FROM public.jobs_housekeeping() $cron$);
END $$;

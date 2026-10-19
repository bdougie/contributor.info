-- Fix the caller check used by the jobs and datapipe SECURITY DEFINER functions.
--
-- The check read current_setting('request.jwt.claim.role'), the legacy
-- per-claim GUC that current PostgREST no longer sets; it sets
-- request.jwt.claims (one JSON object). Inside a SECURITY DEFINER function
-- current_user is the owner and session_user is `authenticator`, so neither
-- role name identifies the caller either. Result: every jobs_read() /
-- enqueue_job() call from the process-job and queue-event edge functions
-- failed with "jobs functions may only be called by service_role or cron"
-- (found on the first smoke test after deploying #1866). pg_cron callers
-- were unaffected (session_user = postgres).

CREATE OR REPLACE FUNCTION public.jobs_assert_service_caller()
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  claims JSONB;
BEGIN
  IF session_user IN ('postgres', 'supabase_admin') THEN
    RETURN; -- pg_cron, migrations, dashboard
  END IF;
  claims := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
  IF claims ->> 'role' = 'service_role'
     OR current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN;
  END IF;
  RAISE EXCEPTION 'jobs functions may only be called by service_role or cron'
    USING ERRCODE = '42501';
END;
$$;

CREATE OR REPLACE FUNCTION public.datapipe_assert_service_caller()
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  claims JSONB;
BEGIN
  IF session_user IN ('postgres', 'supabase_admin') THEN
    RETURN;
  END IF;
  claims := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
  IF claims ->> 'role' = 'service_role'
     OR current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN;
  END IF;
  RAISE EXCEPTION 'datapipe functions may only be called by service_role or cron'
    USING ERRCODE = '42501';
END;
$$;

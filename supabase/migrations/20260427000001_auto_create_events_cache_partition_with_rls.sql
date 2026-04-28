-- Fix: auto-create monthly github_events_cache partitions with RLS enabled
--
-- Background: create_monthly_partition() existed in migration 20250120 but is
-- not present in production (likely dropped at some point). New monthly
-- partitions have been created manually, and many were created without RLS
-- enabled, exposing them via PostgREST. The current month (2026_04) is also
-- missing, which means any insert with a current-month timestamp errors with
-- "no partition of relation github_events_cache found for row" — a likely
-- contributor to gh-datapipe / Inngest write failures.
--
-- This migration:
--   1. Restores ensure_events_cache_partition(date) — idempotent helper that
--      creates one month's partition with RLS + policies in a single call.
--   2. Restores create_monthly_partition() to call the helper for next month.
--   3. Calls the helper for current month (2026-04) and next month (2026-05)
--      to close the immediate gap.
--   4. Schedules a pg_cron job on the 25th of every month to keep the
--      following month's partition pre-staged.
--
-- Policies match the _2025_10 pattern: service_role manages, public can read.

BEGIN;

-- =====================================================
-- STEP 1: Idempotent partition helper
-- =====================================================

CREATE OR REPLACE FUNCTION public.ensure_events_cache_partition(target_date date)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  start_date     date := date_trunc('month', target_date)::date;
  end_date       date := (date_trunc('month', target_date) + interval '1 month')::date;
  partition_name text := 'github_events_cache_' || to_char(start_date, 'YYYY_MM');
  manage_policy  text := 'service_role_manage_' || partition_name;
  read_policy    text := 'public_read_' || partition_name;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = partition_name
  ) THEN
    EXECUTE format(
      'CREATE TABLE public.%I PARTITION OF public.github_events_cache FOR VALUES FROM (%L) TO (%L)',
      partition_name, start_date, end_date
    );
  END IF;

  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', partition_name);

  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', manage_policy, partition_name);
  EXECUTE format(
    'CREATE POLICY %I ON public.%I FOR ALL TO public USING ((SELECT auth.role()) = ''service_role'')',
    manage_policy, partition_name
  );

  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', read_policy, partition_name);
  EXECUTE format(
    'CREATE POLICY %I ON public.%I FOR SELECT TO public USING (true)',
    read_policy, partition_name
  );

  RETURN partition_name;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_events_cache_partition(date) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_events_cache_partition(date) TO service_role;

-- =====================================================
-- STEP 2: Restore create_monthly_partition() to call the helper
-- =====================================================

CREATE OR REPLACE FUNCTION public.create_monthly_partition()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.ensure_events_cache_partition((CURRENT_DATE + interval '1 month')::date);
END;
$$;

REVOKE ALL ON FUNCTION public.create_monthly_partition() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_monthly_partition() TO service_role;

-- =====================================================
-- STEP 3: Close the current-month gap
-- =====================================================
-- 2026-04 partition is missing in production; current-month inserts have been
-- failing. Create it now along with 2026-05 to pre-stage next month.

SELECT public.ensure_events_cache_partition(CURRENT_DATE);
SELECT public.ensure_events_cache_partition((CURRENT_DATE + interval '1 month')::date);

-- =====================================================
-- STEP 4: Schedule monthly auto-creation
-- =====================================================
-- Runs on the 25th at 00:00 UTC, well before month-end so the next partition
-- is in place before any insert needs it.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'create-events-cache-partition') THEN
      PERFORM cron.unschedule('create-events-cache-partition');
    END IF;

    PERFORM cron.schedule(
      'create-events-cache-partition',
      '0 0 25 * *',
      $cmd$ SELECT public.create_monthly_partition(); $cmd$
    );
  END IF;
END $$;

COMMIT;

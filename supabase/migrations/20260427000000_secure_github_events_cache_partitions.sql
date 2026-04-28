-- Fix: RLS disabled on github_events_cache partitions (security advisor: rls_disabled_in_public)
--
-- Background: github_events_cache is a partitioned table. RLS was enabled on
-- the parent and on partitions through 2025_10, but the migration that creates
-- new monthly partitions did not enable RLS on subsequent children. The
-- security advisor flagged 9 partitions exposed via PostgREST without RLS.
--
-- Of those 9, four are empty (0 rows, 0 inserts since stats reset 2025-04-08)
-- plus _2025_11 which is also empty. The remaining four hold real data and
-- continue to receive writes from gh-datapipe (via service_role).
--
-- This migration:
--   1. Enables RLS on the four active partitions and adds policies that
--      mirror _2025_10 (service_role manages, public reads).
--   2. Drops five confirmed-empty partitions (_2025_04, _05, _07, _08, _11)
--      that have never received data and are exposing 96kB each with no RLS.
--
-- Note: gh-datapipe writes via the service_role key, which bypasses RLS, so
-- enabling RLS does not affect ingestion.

BEGIN;

-- =====================================================
-- STEP 1: Enable RLS + policies on active partitions
-- =====================================================

DO $$
DECLARE
  partition_name text;
BEGIN
  FOREACH partition_name IN ARRAY ARRAY[
    'github_events_cache_2025_12',
    'github_events_cache_2026_01',
    'github_events_cache_2026_02',
    'github_events_cache_2026_03'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', partition_name);

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      'service_role_manage_' || partition_name,
      partition_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO public USING ((SELECT auth.role()) = ''service_role'')',
      'service_role_manage_' || partition_name,
      partition_name
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      'public_read_' || partition_name,
      partition_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO public USING (true)',
      'public_read_' || partition_name,
      partition_name
    );
  END LOOP;
END $$;

-- =====================================================
-- STEP 2: Drop empty partitions with no RLS
-- =====================================================
-- Each was verified empty: 0 live tuples and 0 inserts since the stats reset
-- on 2025-04-08. Detaching first lets us DROP without affecting the parent.

ALTER TABLE public.github_events_cache DETACH PARTITION public.github_events_cache_2025_04;
DROP TABLE public.github_events_cache_2025_04;

ALTER TABLE public.github_events_cache DETACH PARTITION public.github_events_cache_2025_05;
DROP TABLE public.github_events_cache_2025_05;

ALTER TABLE public.github_events_cache DETACH PARTITION public.github_events_cache_2025_07;
DROP TABLE public.github_events_cache_2025_07;

ALTER TABLE public.github_events_cache DETACH PARTITION public.github_events_cache_2025_08;
DROP TABLE public.github_events_cache_2025_08;

ALTER TABLE public.github_events_cache DETACH PARTITION public.github_events_cache_2025_11;
DROP TABLE public.github_events_cache_2025_11;

COMMIT;

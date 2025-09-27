-- Phase 3: Secure Critical System Tables
-- These tables should NEVER have public access - service role only
-- Date: 2025-01-27

-- ============================================
-- 1. PROGRESSIVE CAPTURE TABLES
-- ============================================

-- progressive_capture_jobs - Remove ALL public/authenticated access
DROP POLICY IF EXISTS "progressive_capture_jobs_public_read" ON public.progressive_capture_jobs;
DROP POLICY IF EXISTS "progressive_capture_jobs_public_insert" ON public.progressive_capture_jobs;
DROP POLICY IF EXISTS "progressive_capture_jobs_public_update" ON public.progressive_capture_jobs;
DROP POLICY IF EXISTS "progressive_capture_jobs_public_delete" ON public.progressive_capture_jobs;
DROP POLICY IF EXISTS "progressive_capture_jobs_authenticated_insert" ON public.progressive_capture_jobs;
DROP POLICY IF EXISTS "progressive_capture_jobs_authenticated_update" ON public.progressive_capture_jobs;
DROP POLICY IF EXISTS "progressive_capture_jobs_authenticated_delete" ON public.progressive_capture_jobs;
DROP POLICY IF EXISTS "progressive_capture_jobs_select" ON public.progressive_capture_jobs;

-- Keep only service role
DROP POLICY IF EXISTS "progressive_capture_jobs_service" ON public.progressive_capture_jobs;
CREATE POLICY "service_only_all" ON public.progressive_capture_jobs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- progressive_capture_progress - Remove ALL public/authenticated access
DROP POLICY IF EXISTS "progressive_capture_progress_public_read" ON public.progressive_capture_progress;
DROP POLICY IF EXISTS "progressive_capture_progress_public_insert" ON public.progressive_capture_progress;
DROP POLICY IF EXISTS "progressive_capture_progress_public_update" ON public.progressive_capture_progress;
DROP POLICY IF EXISTS "progressive_capture_progress_public_delete" ON public.progressive_capture_progress;
DROP POLICY IF EXISTS "progressive_capture_progress_authenticated_insert" ON public.progressive_capture_progress;
DROP POLICY IF EXISTS "progressive_capture_progress_authenticated_update" ON public.progressive_capture_progress;
DROP POLICY IF EXISTS "progressive_capture_progress_authenticated_delete" ON public.progressive_capture_progress;
DROP POLICY IF EXISTS "progressive_capture_progress_select" ON public.progressive_capture_progress;

-- Keep only service role
DROP POLICY IF EXISTS "progressive_capture_progress_service" ON public.progressive_capture_progress;
CREATE POLICY "service_only_all" ON public.progressive_capture_progress
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- progressive_backfill_state - Remove authenticated read access
DROP POLICY IF EXISTS "Authenticated users can read backfill state" ON public.progressive_backfill_state;
DROP POLICY IF EXISTS "Service role can manage backfill state" ON public.progressive_backfill_state;

CREATE POLICY "service_only_all" ON public.progressive_backfill_state
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- 2. QUEUE TABLES
-- ============================================

-- data_capture_queue - Already correct (service_role only)
-- Just ensure the policy is correct
DROP POLICY IF EXISTS "service_manage_data_capture_queue" ON public.data_capture_queue;
CREATE POLICY "service_only_all" ON public.data_capture_queue
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- dead_letter_queue - Remove authenticated read access
DROP POLICY IF EXISTS "dead_letter_queue_select_policy" ON public.dead_letter_queue;
DROP POLICY IF EXISTS "dead_letter_queue_insert_policy" ON public.dead_letter_queue;
DROP POLICY IF EXISTS "dead_letter_queue_update_policy" ON public.dead_letter_queue;

CREATE POLICY "service_only_all" ON public.dead_letter_queue
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- queue_metrics - Remove ALL public access
DROP POLICY IF EXISTS "queue_metrics_public_read" ON public.queue_metrics;
DROP POLICY IF EXISTS "queue_metrics_authenticated_insert" ON public.queue_metrics;
DROP POLICY IF EXISTS "queue_metrics_authenticated_update" ON public.queue_metrics;

CREATE POLICY "service_only_all" ON public.queue_metrics
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- 3. RATE LIMIT TABLES
-- ============================================

-- rate_limits - CRITICAL: Currently allows PUBLIC ALL operations!
DROP POLICY IF EXISTS "Service role can manage rate limits" ON public.rate_limits;

CREATE POLICY "service_only_all" ON public.rate_limits
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- rate_limit_tracking - Remove public read
DROP POLICY IF EXISTS "public_read_rate_limit_tracking" ON public.rate_limit_tracking;
DROP POLICY IF EXISTS "service_manage_rate_limit_tracking" ON public.rate_limit_tracking;

CREATE POLICY "service_only_all" ON public.rate_limit_tracking
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- 4. SYNC LOGS
-- ============================================

-- sync_logs - Remove anon and public access
DROP POLICY IF EXISTS "public_read_sync_logs" ON public.sync_logs;
DROP POLICY IF EXISTS "anon_manage_sync_logs" ON public.sync_logs;
DROP POLICY IF EXISTS "service_manage_sync_logs" ON public.sync_logs;

CREATE POLICY "service_only_all" ON public.sync_logs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- 5. ROLLOUT TABLES
-- ============================================

-- rollout_configuration - Remove ALL public/authenticated access
DROP POLICY IF EXISTS "rollout_config_public_read" ON public.rollout_configuration;
DROP POLICY IF EXISTS "rollout_config_public_insert" ON public.rollout_configuration;
DROP POLICY IF EXISTS "rollout_config_public_update" ON public.rollout_configuration;
DROP POLICY IF EXISTS "rollout_config_public_delete" ON public.rollout_configuration;
DROP POLICY IF EXISTS "rollout_config_authenticated_insert" ON public.rollout_configuration;
DROP POLICY IF EXISTS "rollout_config_authenticated_update" ON public.rollout_configuration;
DROP POLICY IF EXISTS "rollout_config_authenticated_delete" ON public.rollout_configuration;

CREATE POLICY "service_only_all" ON public.rollout_configuration
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- rollout_history - Remove ALL public/authenticated access
DROP POLICY IF EXISTS "rollout_history_public_read" ON public.rollout_history;
DROP POLICY IF EXISTS "rollout_history_public_insert" ON public.rollout_history;
DROP POLICY IF EXISTS "rollout_history_public_update" ON public.rollout_history;
DROP POLICY IF EXISTS "rollout_history_public_delete" ON public.rollout_history;
DROP POLICY IF EXISTS "rollout_history_authenticated_insert" ON public.rollout_history;
DROP POLICY IF EXISTS "rollout_history_authenticated_update" ON public.rollout_history;
DROP POLICY IF EXISTS "rollout_history_authenticated_delete" ON public.rollout_history;

CREATE POLICY "service_only_all" ON public.rollout_history
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- rollout_metrics - Remove ALL public/authenticated access
DROP POLICY IF EXISTS "rollout_metrics_public_read" ON public.rollout_metrics;
DROP POLICY IF EXISTS "rollout_metrics_public_insert" ON public.rollout_metrics;
DROP POLICY IF EXISTS "rollout_metrics_public_update" ON public.rollout_metrics;
DROP POLICY IF EXISTS "rollout_metrics_public_delete" ON public.rollout_metrics;
DROP POLICY IF EXISTS "rollout_metrics_authenticated_insert" ON public.rollout_metrics;
DROP POLICY IF EXISTS "rollout_metrics_authenticated_update" ON public.rollout_metrics;
DROP POLICY IF EXISTS "rollout_metrics_authenticated_delete" ON public.rollout_metrics;

CREATE POLICY "service_only_all" ON public.rollout_metrics
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- 6. SPAM DETECTION
-- ============================================

-- spam_detections - CRITICAL: Currently allows PUBLIC ALL operations!
DROP POLICY IF EXISTS "Allow public read access to spam detections" ON public.spam_detections;
DROP POLICY IF EXISTS "Allow spam detection writes" ON public.spam_detections;

CREATE POLICY "service_only_all" ON public.spam_detections
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- VERIFICATION QUERY
-- ============================================
-- Run this after migration to verify all tables are secured:
/*
SELECT
  tablename,
  COUNT(CASE WHEN roles::text LIKE '%public%' THEN 1 END) as public_policies,
  COUNT(CASE WHEN roles::text LIKE '%authenticated%' THEN 1 END) as auth_policies,
  COUNT(CASE WHEN roles::text LIKE '%service_role%' THEN 1 END) as service_policies,
  COUNT(*) as total_policies
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'progressive_capture_jobs', 'progressive_capture_progress',
    'data_capture_queue', 'dead_letter_queue',
    'rate_limit_tracking', 'rate_limits',
    'sync_logs', 'queue_metrics',
    'rollout_configuration', 'rollout_history', 'rollout_metrics',
    'progressive_backfill_state', 'spam_detections'
  )
GROUP BY tablename
ORDER BY tablename;

-- Expected result: 0 public_policies, 0 auth_policies, 1 service_policies for each table
*/
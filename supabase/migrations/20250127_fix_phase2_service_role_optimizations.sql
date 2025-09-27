-- Phase 2: Service Role Optimizations
-- GitHub Issue: #820
--
-- This migration optimizes service role policies by ensuring auth.role() function
-- is evaluated once per query instead of once per row, significantly improving performance.
--
-- Pattern: Replace auth.role() with (SELECT auth.role())

-- ============================================================================
-- SECTION 1: HIGH-PRIORITY TABLES FROM ISSUE #820
-- ============================================================================

-- 1. REVIEWS TABLE
DROP POLICY IF EXISTS "service_role_all" ON reviews;
CREATE POLICY "service_role_all"
ON reviews
FOR ALL
TO public
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- 2. ORGANIZATIONS TABLE
DROP POLICY IF EXISTS "service_role_all" ON organizations;
CREATE POLICY "service_role_all"
ON organizations
FOR ALL
TO public
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- 3. REPOSITORY_CATEGORIES TABLE
DROP POLICY IF EXISTS "service_role_all" ON repository_categories;
CREATE POLICY "service_role_all"
ON repository_categories
FOR ALL
TO public
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- 4. WEB_VITALS_EVENTS TABLE
DROP POLICY IF EXISTS "Service role full access to web_vitals_events" ON web_vitals_events;
CREATE POLICY "Service role full access to web_vitals_events"
ON web_vitals_events
FOR ALL
TO public
USING ((SELECT auth.role()) = 'service_role'::text);

-- 5. PERFORMANCE_ALERTS TABLE
DROP POLICY IF EXISTS "Service role full access to performance_alerts" ON performance_alerts;
CREATE POLICY "Service role full access to performance_alerts"
ON performance_alerts
FOR ALL
TO public
USING ((SELECT auth.role()) = 'service_role'::text);

-- 6. REFERRAL_TRAFFIC TABLE
DROP POLICY IF EXISTS "Service role full access to referral_traffic" ON referral_traffic;
CREATE POLICY "Service role full access to referral_traffic"
ON referral_traffic
FOR ALL
TO public
USING ((SELECT auth.role()) = 'service_role'::text);

-- 7. QUERY_PATTERNS TABLE
DROP POLICY IF EXISTS "Service role full access to query_patterns" ON query_patterns;
CREATE POLICY "Service role full access to query_patterns"
ON query_patterns
FOR ALL
TO public
USING ((SELECT auth.role()) = 'service_role'::text);

-- 8. SYNC_PROGRESS TABLE
DROP POLICY IF EXISTS "Service role can manage sync progress" ON sync_progress;
CREATE POLICY "Service role can manage sync progress"
ON sync_progress
FOR ALL
TO public
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- 9. SYNC_METRICS TABLE (if exists)
-- Note: sync_metrics wasn't in the query results, checking if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'sync_metrics') THEN
        -- Drop any existing service role policy
        DROP POLICY IF EXISTS "service_role_all" ON sync_metrics;
        DROP POLICY IF EXISTS "Service role can manage sync metrics" ON sync_metrics;

        -- Create optimized policy
        CREATE POLICY "Service role can manage sync metrics"
        ON sync_metrics
        FOR ALL
        TO public
        USING ((SELECT auth.role()) = 'service_role'::text)
        WITH CHECK ((SELECT auth.role()) = 'service_role'::text);
    END IF;
END $$;

-- ============================================================================
-- SECTION 2: ADDITIONAL SERVICE ROLE POLICIES WITH UNOPTIMIZED auth.role()
-- ============================================================================

-- AUTH_ERRORS TABLE
DROP POLICY IF EXISTS "service_role_insert_auth_errors" ON auth_errors;
CREATE POLICY "service_role_insert_auth_errors"
ON auth_errors
FOR INSERT
TO public
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- BACKFILL_CHUNKS TABLE
DROP POLICY IF EXISTS "service_role_all_backfill_chunks" ON backfill_chunks;
CREATE POLICY "service_role_all_backfill_chunks"
ON backfill_chunks
FOR ALL
TO public
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- BATCH_PROGRESS TABLE
DROP POLICY IF EXISTS "Service role can manage batch progress" ON batch_progress;
CREATE POLICY "Service role can manage batch progress"
ON batch_progress
FOR ALL
TO public
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- CONTRIBUTORS_BACKUP TABLE
DROP POLICY IF EXISTS "service_role_only_all" ON contributors_backup;
CREATE POLICY "service_role_only_all"
ON contributors_backup
FOR ALL
TO public
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- CONTRIBUTORS_REPLICA TABLE
DROP POLICY IF EXISTS "service_role_only_all" ON contributors_replica;
CREATE POLICY "service_role_only_all"
ON contributors_replica
FOR ALL
TO public
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- DAILY_ACTIVITY_SNAPSHOTS TABLE
DROP POLICY IF EXISTS "service_role_all" ON daily_activity_snapshots;
CREATE POLICY "service_role_all"
ON daily_activity_snapshots
FOR ALL
TO public
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- DATA_CAPTURE_QUEUE TABLE
DROP POLICY IF EXISTS "service_only_all" ON data_capture_queue;
CREATE POLICY "service_only_all"
ON data_capture_queue
FOR ALL
TO public
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- DATA_CONSISTENCY_CHECKS TABLE
DROP POLICY IF EXISTS "Service role can manage consistency checks" ON data_consistency_checks;
CREATE POLICY "Service role can manage consistency checks"
ON data_consistency_checks
FOR ALL
TO public
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- DEAD_LETTER_QUEUE TABLE
DROP POLICY IF EXISTS "service_only_all" ON dead_letter_queue;
CREATE POLICY "service_only_all"
ON dead_letter_queue
FOR ALL
TO public
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- GITHUB_EVENTS_CACHE_2025_09 TABLE (partitioned table)
DROP POLICY IF EXISTS "service_delete_github_events_cache_2025_09" ON github_events_cache_2025_09;
DROP POLICY IF EXISTS "service_update_github_events_cache_2025_09" ON github_events_cache_2025_09;

-- Consolidate into single service role policy
CREATE POLICY "service_role_manage_github_events_2025_09"
ON github_events_cache_2025_09
FOR ALL
TO public
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- IDEMPOTENCY_KEYS TABLE
DROP POLICY IF EXISTS "Edge Functions can manage idempotency keys" ON idempotency_keys;
DROP POLICY IF EXISTS "Users can view their own idempotency keys" ON idempotency_keys;

-- Recreate with optimized auth functions
CREATE POLICY "Edge Functions can manage idempotency keys"
ON idempotency_keys
FOR ALL
TO public
USING ((SELECT auth.role()) = 'service_role'::text);

CREATE POLICY "Users can view their own idempotency keys"
ON idempotency_keys
FOR SELECT
TO public
USING (
    ((SELECT auth.role()) = 'anon'::text)
    AND
    ((user_id IS NULL) OR (user_id = (SELECT auth.uid())))
);

-- ISSUES_BACKUP TABLE
DROP POLICY IF EXISTS "service_role_only_all" ON issues_backup;
CREATE POLICY "service_role_only_all"
ON issues_backup
FOR ALL
TO public
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- ISSUES_REPLICA TABLE
DROP POLICY IF EXISTS "service_role_only_all" ON issues_replica;
CREATE POLICY "service_role_only_all"
ON issues_replica
FOR ALL
TO public
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- PRIORITY_QUEUE TABLE
DROP POLICY IF EXISTS "Service role manages priority queue" ON priority_queue;
CREATE POLICY "Service role manages priority queue"
ON priority_queue
FOR ALL
TO public
USING ((SELECT auth.role()) = 'service_role'::text);

-- PROGRESSIVE_BACKFILL_STATE TABLE
DROP POLICY IF EXISTS "service_only_all" ON progressive_backfill_state;
CREATE POLICY "service_only_all"
ON progressive_backfill_state
FOR ALL
TO public
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- PROGRESSIVE_CAPTURE_JOBS TABLE
DROP POLICY IF EXISTS "service_only_all" ON progressive_capture_jobs;
CREATE POLICY "service_only_all"
ON progressive_capture_jobs
FOR ALL
TO public
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- PROGRESSIVE_CAPTURE_PROGRESS TABLE
DROP POLICY IF EXISTS "service_only_all" ON progressive_capture_progress;
CREATE POLICY "service_only_all"
ON progressive_capture_progress
FOR ALL
TO public
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- PULL_REQUESTS_BACKUP TABLE
DROP POLICY IF EXISTS "service_role_only_all" ON pull_requests_backup;
CREATE POLICY "service_role_only_all"
ON pull_requests_backup
FOR ALL
TO public
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- PULL_REQUESTS_REPLICA TABLE
DROP POLICY IF EXISTS "service_role_only_all" ON pull_requests_replica;
CREATE POLICY "service_role_only_all"
ON pull_requests_replica
FOR ALL
TO public
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- _DLT_VERSION TABLE
DROP POLICY IF EXISTS "service_role_only_all" ON _dlt_version;
CREATE POLICY "service_role_only_all"
ON _dlt_version
FOR ALL
TO public
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- After applying this migration, run these queries to verify the fixes:
--
-- 1. Check for remaining unoptimized auth.role() calls:
-- SELECT tablename, policyname, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND qual LIKE '%auth.role()%'
--   AND qual NOT LIKE '%(SELECT auth.role()%';
--
-- 2. Count optimized service role policies:
-- SELECT COUNT(*) as optimized_policies
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND qual LIKE '%(SELECT auth.role())%service_role%';
--
-- 3. Test query performance on affected tables
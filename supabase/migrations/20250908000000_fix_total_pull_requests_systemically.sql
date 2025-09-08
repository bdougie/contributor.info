-- Migration: Comprehensive fix for total_pull_requests data consistency issues
-- Addresses GitHub issue #694: Self Selection and Contributor Confidence failing 
-- This migration ensures robust data consistency and prevents future issues

-- =====================================================
-- PHASE 1: DATA CONSISTENCY FIXES
-- =====================================================

-- 1. Ensure all repositories have correct pull_request_count
-- This function already exists but we'll run it to fix any inconsistencies
SELECT refresh_all_repository_pull_request_counts();

-- 2. Fix the total_pull_requests column to use the same data as pull_request_count
-- The total_pull_requests column was added later but never properly maintained
-- We'll update it to match pull_request_count for consistency
UPDATE repositories 
SET total_pull_requests = pull_request_count 
WHERE total_pull_requests != pull_request_count 
   OR total_pull_requests IS NULL;

-- =====================================================
-- PHASE 2: TRIGGER IMPROVEMENTS FOR ROBUSTNESS
-- =====================================================

-- 3. Enhanced trigger function with better error handling and logging
CREATE OR REPLACE FUNCTION update_repository_pr_count_trigger()
RETURNS TRIGGER AS $$
DECLARE
    old_repo_id UUID;
    new_repo_id UUID;
BEGIN
    -- Handle INSERT
    IF TG_OP = 'INSERT' THEN
        -- Update both columns for consistency
        UPDATE repositories 
        SET pull_request_count = pull_request_count + 1,
            total_pull_requests = total_pull_requests + 1
        WHERE id = NEW.repository_id;
        
        -- Log the operation for monitoring
        INSERT INTO sync_logs (sync_type, repository_id, status, records_processed, metadata)
        SELECT 'repository_sync', NEW.repository_id, 'completed', 1, 
               jsonb_build_object('operation', 'pr_count_increment', 'pr_id', NEW.id)
        WHERE EXISTS (SELECT 1 FROM repositories WHERE id = NEW.repository_id);
        
        RETURN NEW;
    END IF;
    
    -- Handle DELETE  
    IF TG_OP = 'DELETE' THEN
        -- Update both columns for consistency
        UPDATE repositories 
        SET pull_request_count = GREATEST(pull_request_count - 1, 0),
            total_pull_requests = GREATEST(total_pull_requests - 1, 0)
        WHERE id = OLD.repository_id;
        
        -- Log the operation for monitoring
        INSERT INTO sync_logs (sync_type, repository_id, status, records_processed, metadata)
        SELECT 'repository_sync', OLD.repository_id, 'completed', 1, 
               jsonb_build_object('operation', 'pr_count_decrement', 'pr_id', OLD.id)
        WHERE EXISTS (SELECT 1 FROM repositories WHERE id = OLD.repository_id);
        
        RETURN OLD;
    END IF;
    
    -- Handle UPDATE (if repository_id changes)
    IF TG_OP = 'UPDATE' AND OLD.repository_id != NEW.repository_id THEN
        old_repo_id := OLD.repository_id;
        new_repo_id := NEW.repository_id;
        
        -- Decrease count for old repository
        UPDATE repositories 
        SET pull_request_count = GREATEST(pull_request_count - 1, 0),
            total_pull_requests = GREATEST(total_pull_requests - 1, 0)
        WHERE id = old_repo_id;
        
        -- Increase count for new repository
        UPDATE repositories 
        SET pull_request_count = pull_request_count + 1,
            total_pull_requests = total_pull_requests + 1
        WHERE id = new_repo_id;
        
        -- Log both operations
        INSERT INTO sync_logs (sync_type, repository_id, status, records_processed, metadata)
        SELECT 'repository_sync', old_repo_id, 'completed', 1, 
               jsonb_build_object('operation', 'pr_move_decrement', 'pr_id', NEW.id);
        
        INSERT INTO sync_logs (sync_type, repository_id, status, records_processed, metadata)
        SELECT 'repository_sync', new_repo_id, 'completed', 1, 
               jsonb_build_object('operation', 'pr_move_increment', 'pr_id', NEW.id);
        
        RETURN NEW;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't fail the original operation
        INSERT INTO sync_logs (sync_type, repository_id, status, error_message, metadata)
        VALUES ('repository_sync', 
                COALESCE(NEW.repository_id, OLD.repository_id), 
                'failed', 
                SQLERRM, 
                jsonb_build_object('operation', TG_OP, 'error_context', 'pr_count_trigger'));
        
        -- Re-raise the error to ensure data integrity
        RAISE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PHASE 3: DATA VALIDATION FUNCTIONS
-- =====================================================

-- 4. Function to detect and report data inconsistencies
CREATE OR REPLACE FUNCTION check_repository_pr_count_consistency()
RETURNS TABLE (
    repository_name TEXT,
    stored_pull_request_count INTEGER,
    stored_total_pull_requests INTEGER,
    actual_pr_count BIGINT,
    count_difference INTEGER,
    consistency_status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.full_name,
        r.pull_request_count,
        r.total_pull_requests,
        COUNT(pr.id)::INTEGER as actual_count,
        (r.pull_request_count - COUNT(pr.id)::INTEGER) as difference,
        CASE 
            WHEN r.pull_request_count = COUNT(pr.id) AND r.total_pull_requests = COUNT(pr.id) THEN 'CONSISTENT'
            WHEN r.pull_request_count != COUNT(pr.id) THEN 'PR_COUNT_MISMATCH'
            WHEN r.total_pull_requests != COUNT(pr.id) THEN 'TOTAL_PR_MISMATCH'
            ELSE 'INCONSISTENT'
        END as status
    FROM repositories r
    LEFT JOIN pull_requests pr ON r.id = pr.repository_id
    GROUP BY r.id, r.full_name, r.pull_request_count, r.total_pull_requests
    HAVING r.pull_request_count != COUNT(pr.id) 
        OR r.total_pull_requests != COUNT(pr.id)
        OR r.total_pull_requests != r.pull_request_count
    ORDER BY ABS(r.pull_request_count - COUNT(pr.id)::INTEGER) DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- 5. Function to automatically fix inconsistencies
CREATE OR REPLACE FUNCTION fix_repository_pr_count_inconsistencies()
RETURNS TABLE (
    repository_name TEXT,
    old_pull_request_count INTEGER,
    old_total_pull_requests INTEGER,
    new_count INTEGER,
    fixed BOOLEAN
) AS $$
DECLARE
    repo_record RECORD;
    actual_count INTEGER;
BEGIN
    FOR repo_record IN 
        SELECT r.id, r.full_name, r.pull_request_count, r.total_pull_requests, COUNT(pr.id)::INTEGER as actual_pr_count
        FROM repositories r
        LEFT JOIN pull_requests pr ON r.id = pr.repository_id
        GROUP BY r.id, r.full_name, r.pull_request_count, r.total_pull_requests
        HAVING r.pull_request_count != COUNT(pr.id) 
            OR r.total_pull_requests != COUNT(pr.id)
            OR r.total_pull_requests != r.pull_request_count
    LOOP
        actual_count := repo_record.actual_pr_count;
        
        -- Update both columns to the correct count
        UPDATE repositories 
        SET pull_request_count = actual_count,
            total_pull_requests = actual_count
        WHERE id = repo_record.id;
        
        -- Log the fix
        INSERT INTO sync_logs (sync_type, repository_id, status, records_processed, metadata)
        VALUES ('repository_sync', repo_record.id, 'completed', 1, 
                jsonb_build_object(
                    'operation', 'consistency_fix',
                    'old_pull_request_count', repo_record.pull_request_count,
                    'old_total_pull_requests', repo_record.total_pull_requests,
                    'new_count', actual_count
                ));
        
        -- Return the fix details
        repository_name := repo_record.full_name;
        old_pull_request_count := repo_record.pull_request_count;
        old_total_pull_requests := repo_record.total_pull_requests;
        new_count := actual_count;
        fixed := true;
        
        RETURN NEXT;
    END LOOP;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PHASE 4: MONITORING AND ALERTING
-- =====================================================

-- 6. Add monitoring table for data consistency checks
CREATE TABLE IF NOT EXISTS data_consistency_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    check_type TEXT NOT NULL,
    repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('consistent', 'inconsistent', 'fixed', 'failed')),
    details JSONB,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fixed_at TIMESTAMPTZ
);

-- Index for efficient monitoring queries
CREATE INDEX IF NOT EXISTS idx_consistency_checks_status 
ON data_consistency_checks(check_type, status, checked_at DESC);

-- 7. Function to run comprehensive consistency checks
CREATE OR REPLACE FUNCTION run_data_consistency_checks()
RETURNS INTEGER AS $$
DECLARE
    inconsistency_count INTEGER := 0;
    repo_record RECORD;
BEGIN
    -- Clear old checks (keep last 30 days)
    DELETE FROM data_consistency_checks 
    WHERE checked_at < NOW() - INTERVAL '30 days';
    
    -- Check all repositories for PR count consistency
    FOR repo_record IN 
        SELECT * FROM check_repository_pr_count_consistency()
    LOOP
        inconsistency_count := inconsistency_count + 1;
        
        INSERT INTO data_consistency_checks (check_type, repository_id, status, details)
        SELECT 'pr_count_consistency', r.id, 'inconsistent',
               jsonb_build_object(
                   'repository_name', repo_record.repository_name,
                   'stored_pull_request_count', repo_record.stored_pull_request_count,
                   'stored_total_pull_requests', repo_record.stored_total_pull_requests,
                   'actual_pr_count', repo_record.actual_pr_count,
                   'count_difference', repo_record.count_difference,
                   'consistency_status', repo_record.consistency_status
               )
        FROM repositories r
        WHERE r.full_name = repo_record.repository_name;
    END LOOP;
    
    RETURN inconsistency_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PHASE 5: SCHEDULED MAINTENANCE
-- =====================================================

-- 8. Set up pg_cron job for regular consistency checks (if pg_cron is available)
-- This will run daily at 2 AM to check for inconsistencies
DO $$
BEGIN
    -- Only create the cron job if pg_cron extension is available
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Schedule daily consistency check
        PERFORM cron.schedule('repository-consistency-check', '0 2 * * *', 'SELECT run_data_consistency_checks();');
        
        -- Schedule weekly auto-fix (Sundays at 3 AM)
        PERFORM cron.schedule('repository-consistency-fix', '0 3 * * 0', 'SELECT fix_repository_pr_count_inconsistencies();');
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- If pg_cron is not available, just log it (don't fail the migration)
        INSERT INTO sync_logs (sync_type, status, error_message, metadata)
        VALUES ('repository_sync', 'completed', 'pg_cron not available for scheduled checks',
                jsonb_build_object('note', 'Manual consistency checks recommended'));
END $$;

-- =====================================================
-- PHASE 6: RLS POLICIES AND PERMISSIONS
-- =====================================================

-- 9. Enable RLS and set up policies for the new monitoring table
ALTER TABLE data_consistency_checks ENABLE ROW LEVEL SECURITY;

-- Allow public read access to consistency check status (like other monitoring tables)
CREATE POLICY "Allow authenticated read access to consistency checks" 
ON data_consistency_checks FOR SELECT 
USING (auth.role() IN ('authenticated', 'service_role'));

-- Only service role can insert/update consistency checks
CREATE POLICY "Service role can manage consistency checks" 
ON data_consistency_checks FOR ALL 
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Grant appropriate permissions
GRANT SELECT ON data_consistency_checks TO authenticated;
GRANT ALL ON data_consistency_checks TO service_role;

-- Grant execute permissions on new functions
GRANT EXECUTE ON FUNCTION check_repository_pr_count_consistency() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION run_data_consistency_checks() TO service_role;
GRANT EXECUTE ON FUNCTION fix_repository_pr_count_inconsistencies() TO service_role;

-- =====================================================
-- PHASE 7: IMMEDIATE CONSISTENCY VERIFICATION
-- =====================================================

-- 10. Run initial consistency check and fix any issues found
SELECT fix_repository_pr_count_inconsistencies();

-- 11. Verify no inconsistencies remain
DO $$
DECLARE
    inconsistency_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO inconsistency_count
    FROM check_repository_pr_count_consistency();
    
    IF inconsistency_count > 0 THEN
        RAISE WARNING 'Found % repositories with data inconsistencies after fix attempt. Manual intervention may be required.', inconsistency_count;
        
        -- Log the remaining issues
        INSERT INTO sync_logs (sync_type, status, records_failed, error_message, metadata)
        SELECT 'repository_sync', 'completed', inconsistency_count, 'Inconsistencies remain after auto-fix',
               jsonb_build_object('remaining_inconsistencies', 
                   (SELECT jsonb_agg(row_to_json(t)) FROM check_repository_pr_count_consistency() t));
    ELSE
        INSERT INTO sync_logs (sync_type, status, records_processed, metadata)
        VALUES ('repository_sync', 'completed', 0, 
                jsonb_build_object('message', 'All repository PR counts are now consistent'));
    END IF;
END $$;

-- =====================================================
-- DOCUMENTATION AND COMMENTS
-- =====================================================

COMMENT ON FUNCTION check_repository_pr_count_consistency() IS 'Detects repositories where stored PR counts do not match actual PR data';
COMMENT ON FUNCTION fix_repository_pr_count_inconsistencies() IS 'Automatically fixes PR count mismatches by recalculating from actual data';
COMMENT ON FUNCTION run_data_consistency_checks() IS 'Comprehensive consistency check that logs results to monitoring table';
COMMENT ON TABLE data_consistency_checks IS 'Logs data consistency check results for monitoring and alerting';
COMMENT ON FUNCTION update_repository_pr_count_trigger() IS 'Enhanced trigger function with error handling and logging for PR count maintenance';

-- Migration completed successfully
-- This migration addresses the systemic issues that caused GitHub issue #694
-- It ensures both current and future data consistency for PR count fields
-- Migration: Add RLS Performance Monitoring Views
-- Purpose: Track RLS policy performance and detect potential issues
-- Date: 2025-01-27

-- Create schema for monitoring if it doesn't exist
CREATE SCHEMA IF NOT EXISTS monitoring;

-- Grant usage to authenticated and service role
GRANT USAGE ON SCHEMA monitoring TO authenticated, service_role;

-- Drop existing views if they exist
DROP VIEW IF EXISTS monitoring.rls_performance_metrics CASCADE;
DROP VIEW IF EXISTS monitoring.rls_policy_summary CASCADE;
DROP VIEW IF EXISTS monitoring.slow_rls_queries CASCADE;

-- View 1: RLS Policy Summary by Table
-- Shows policy count and types per table for quick overview
CREATE OR REPLACE VIEW monitoring.rls_policy_summary AS
SELECT
    schemaname,
    tablename,
    COUNT(*) AS total_policies,
    COUNT(*) FILTER (WHERE policyname LIKE '%service_role%') AS service_role_policies,
    COUNT(*) FILTER (WHERE policyname LIKE '%select%' OR cmd = 'SELECT') AS select_policies,
    COUNT(*) FILTER (WHERE policyname LIKE '%insert%' OR cmd = 'INSERT') AS insert_policies,
    COUNT(*) FILTER (WHERE policyname LIKE '%update%' OR cmd = 'UPDATE') AS update_policies,
    COUNT(*) FILTER (WHERE policyname LIKE '%delete%' OR cmd = 'DELETE') AS delete_policies,
    COUNT(*) FILTER (WHERE permissive = 'PERMISSIVE') AS permissive_policies,
    COUNT(*) FILTER (WHERE permissive = 'RESTRICTIVE') AS restrictive_policies,
    -- Check for potential optimization issues
    CASE
        WHEN COUNT(*) FILTER (WHERE permissive = 'PERMISSIVE' AND cmd = 'SELECT') > 1 THEN 'Multiple SELECT policies'
        WHEN COUNT(*) FILTER (WHERE permissive = 'PERMISSIVE' AND cmd = 'INSERT') > 1 THEN 'Multiple INSERT policies'
        WHEN COUNT(*) FILTER (WHERE permissive = 'PERMISSIVE' AND cmd = 'UPDATE') > 1 THEN 'Multiple UPDATE policies'
        WHEN COUNT(*) FILTER (WHERE permissive = 'PERMISSIVE' AND cmd = 'DELETE') > 1 THEN 'Multiple DELETE policies'
        ELSE 'OK'
    END AS optimization_status
FROM pg_policies
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
GROUP BY schemaname, tablename
ORDER BY total_policies DESC, schemaname, tablename;

-- View 2: RLS Performance Metrics
-- Combines policy info with table statistics for performance insights
CREATE OR REPLACE VIEW monitoring.rls_performance_metrics AS
SELECT
    ps.schemaname,
    ps.relname AS tablename,
    ps.n_tup_ins AS rows_inserted,
    ps.n_tup_upd AS rows_updated,
    ps.n_tup_del AS rows_deleted,
    ps.n_live_tup AS live_rows,
    ps.n_dead_tup AS dead_rows,
    ROUND((ps.n_dead_tup::numeric / NULLIF(ps.n_live_tup, 0)) * 100, 2) AS dead_row_percent,
    ps.last_vacuum,
    ps.last_autovacuum,
    ps.last_analyze,
    ps.last_autoanalyze,
    COALESCE(rls.total_policies, 0) AS rls_policy_count,
    COALESCE(rls.optimization_status, 'No policies') AS rls_status,
    -- Performance indicators
    CASE
        WHEN COALESCE(rls.total_policies, 0) > 10 THEN 'High'
        WHEN COALESCE(rls.total_policies, 0) > 5 THEN 'Medium'
        ELSE 'Low'
    END AS policy_complexity,
    CASE
        WHEN ps.n_live_tup > 1000000 AND COALESCE(rls.total_policies, 0) > 5 THEN 'Critical'
        WHEN ps.n_live_tup > 100000 AND COALESCE(rls.total_policies, 0) > 5 THEN 'High'
        WHEN ps.n_live_tup > 10000 AND COALESCE(rls.total_policies, 0) > 5 THEN 'Medium'
        ELSE 'Low'
    END AS performance_risk
FROM pg_stat_user_tables ps
LEFT JOIN monitoring.rls_policy_summary rls ON ps.schemaname = rls.schemaname AND ps.relname = rls.tablename
WHERE ps.schemaname NOT IN ('pg_catalog', 'information_schema', 'monitoring')
ORDER BY performance_risk DESC, ps.n_live_tup DESC;

-- View 3: Slow Query Detection (requires pg_stat_statements)
-- Note: This view will only work if pg_stat_statements extension is enabled
CREATE OR REPLACE VIEW monitoring.slow_rls_queries AS
SELECT
    'Requires pg_stat_statements extension' AS note,
    'Enable with: CREATE EXTENSION IF NOT EXISTS pg_stat_statements;' AS action
WHERE NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
);

-- Function to check for unoptimized auth patterns
CREATE OR REPLACE FUNCTION monitoring.check_unoptimized_policies()
RETURNS TABLE(
    tablename text,
    policyname text,
    issue text,
    qual text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.tablename::text,
        p.policyname::text,
        CASE
            WHEN p.qual LIKE '%auth.uid()%' AND p.qual NOT LIKE '%(SELECT auth.uid())%' THEN 'Unoptimized auth.uid()'
            WHEN p.qual LIKE '%auth.role()%' AND p.qual NOT LIKE '%(SELECT auth.role())%' THEN 'Unoptimized auth.role()'
            WHEN p.qual LIKE '%auth.jwt()%' AND p.qual NOT LIKE '%(SELECT auth.jwt())%' THEN 'Unoptimized auth.jwt()'
            WHEN p.qual LIKE '%current_setting(%' AND p.qual NOT LIKE '%(SELECT current_setting(%' THEN 'Unoptimized current_setting()'
            ELSE 'Unknown issue'
        END::text AS issue,
        p.qual::text
    FROM pg_policies p
    WHERE
        p.schemaname = 'public'
        AND (
            (p.qual LIKE '%auth.uid()%' AND p.qual NOT LIKE '%(SELECT auth.uid())%')
            OR (p.qual LIKE '%auth.role()%' AND p.qual NOT LIKE '%(SELECT auth.role())%')
            OR (p.qual LIKE '%auth.jwt()%' AND p.qual NOT LIKE '%(SELECT auth.jwt())%')
            OR (p.qual LIKE '%current_setting(%' AND p.qual NOT LIKE '%(SELECT current_setting(%')
        )
    ORDER BY p.tablename, p.policyname;
END;
$$;

-- Function to generate monitoring report
CREATE OR REPLACE FUNCTION monitoring.generate_rls_report()
RETURNS TABLE(
    metric_name text,
    metric_value text,
    status text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_policies integer;
    v_unoptimized_count integer;
    v_high_risk_tables integer;
    v_multiple_policies integer;
BEGIN
    -- Count total policies
    SELECT COUNT(*) INTO v_total_policies
    FROM pg_policies
    WHERE schemaname = 'public';

    -- Count unoptimized policies
    SELECT COUNT(*) INTO v_unoptimized_count
    FROM monitoring.check_unoptimized_policies();

    -- Count high risk tables
    SELECT COUNT(*) INTO v_high_risk_tables
    FROM monitoring.rls_performance_metrics
    WHERE performance_risk IN ('High', 'Critical');

    -- Count tables with multiple permissive policies
    SELECT COUNT(*) INTO v_multiple_policies
    FROM monitoring.rls_policy_summary
    WHERE optimization_status != 'OK';

    -- Return report
    RETURN QUERY
    SELECT 'Total RLS Policies'::text, v_total_policies::text,
           CASE WHEN v_total_policies > 0 THEN '✅'::text ELSE '⚠️'::text END;

    RETURN QUERY
    SELECT 'Unoptimized Auth Patterns'::text, v_unoptimized_count::text,
           CASE WHEN v_unoptimized_count = 0 THEN '✅'::text ELSE '❌'::text END;

    RETURN QUERY
    SELECT 'High Risk Tables'::text, v_high_risk_tables::text,
           CASE WHEN v_high_risk_tables = 0 THEN '✅'::text
                WHEN v_high_risk_tables <= 3 THEN '⚠️'::text
                ELSE '❌'::text END;

    RETURN QUERY
    SELECT 'Tables with Multiple Policies'::text, v_multiple_policies::text,
           CASE WHEN v_multiple_policies = 0 THEN '✅'::text
                WHEN v_multiple_policies <= 5 THEN '⚠️'::text
                ELSE '❌'::text END;

    RETURN QUERY
    SELECT 'Report Generated'::text, NOW()::text, '📊'::text;
END;
$$;

-- Grant permissions
GRANT SELECT ON monitoring.rls_policy_summary TO authenticated, service_role;
GRANT SELECT ON monitoring.rls_performance_metrics TO authenticated, service_role;
GRANT SELECT ON monitoring.slow_rls_queries TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION monitoring.check_unoptimized_policies() TO service_role;
GRANT EXECUTE ON FUNCTION monitoring.generate_rls_report() TO service_role;

-- Add helpful comments
COMMENT ON VIEW monitoring.rls_policy_summary IS 'Summary of RLS policies by table with optimization status';
COMMENT ON VIEW monitoring.rls_performance_metrics IS 'Performance metrics for tables with RLS policies';
COMMENT ON VIEW monitoring.slow_rls_queries IS 'Placeholder for slow query detection (requires pg_stat_statements)';
COMMENT ON FUNCTION monitoring.check_unoptimized_policies() IS 'Detect unoptimized auth function calls in RLS policies';
COMMENT ON FUNCTION monitoring.generate_rls_report() IS 'Generate a summary report of RLS health metrics';

-- Example usage:
-- SELECT * FROM monitoring.rls_policy_summary WHERE optimization_status != 'OK';
-- SELECT * FROM monitoring.rls_performance_metrics WHERE performance_risk IN ('High', 'Critical');
-- SELECT * FROM monitoring.check_unoptimized_policies();
-- SELECT * FROM monitoring.generate_rls_report();
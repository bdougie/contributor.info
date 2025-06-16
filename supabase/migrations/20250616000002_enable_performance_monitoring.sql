-- Performance Monitoring Setup Migration
-- This migration enables comprehensive database performance monitoring
-- Run this using Supabase CLI or Dashboard SQL Editor

-- =====================================================
-- ENABLE PERFORMANCE MONITORING EXTENSIONS
-- =====================================================

-- Enable pg_stat_statements for query performance monitoring
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Enable pg_stat_statements tracking
-- Note: This may require superuser privileges, configure via Supabase dashboard if needed
-- ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
-- ALTER SYSTEM SET pg_stat_statements.track = all;
-- ALTER SYSTEM SET pg_stat_statements.max = 10000;

-- =====================================================
-- PERFORMANCE MONITORING VIEWS
-- =====================================================

-- View: Slow Query Detection
-- Identifies queries that take longer than 500ms on average
CREATE OR REPLACE VIEW slow_queries AS
SELECT 
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    stddev_exec_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent,
    query AS query_text
FROM pg_stat_statements 
WHERE mean_exec_time > 500  -- Queries taking longer than 500ms on average
ORDER BY mean_exec_time DESC;

-- View: Query Performance Summary
-- Provides overall query performance metrics
CREATE OR REPLACE VIEW query_performance_summary AS
SELECT 
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    min_exec_time,
    max_exec_time,
    stddev_exec_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS cache_hit_ratio,
    round((total_exec_time / sum(total_exec_time) OVER ()) * 100, 2) AS percent_total_time
FROM pg_stat_statements
ORDER BY total_exec_time DESC;

-- View: Index Usage Analysis
-- Shows which indexes are being used and their effectiveness
CREATE OR REPLACE VIEW index_usage_stats AS
SELECT
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan,
    CASE 
        WHEN idx_scan = 0 THEN 0
        ELSE round((idx_tup_fetch::numeric / idx_scan), 2)
    END AS avg_tuples_per_scan,
    CASE 
        WHEN idx_tup_read = 0 THEN 0
        ELSE round((idx_tup_fetch::numeric / idx_tup_read * 100), 2)
    END AS fetch_ratio_percent
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- View: Table Activity Statistics
-- Shows table-level activity for monitoring database load
CREATE OR REPLACE VIEW table_activity_stats AS
SELECT
    schemaname,
    tablename,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch,
    n_tup_ins,
    n_tup_upd,
    n_tup_del,
    n_tup_hot_upd,
    n_live_tup,
    n_dead_tup,
    vacuum_count,
    autovacuum_count,
    analyze_count,
    autoanalyze_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY (seq_tup_read + idx_tup_fetch) DESC;

-- View: Connection Activity
-- Monitors database connections and their states
CREATE OR REPLACE VIEW connection_stats AS
SELECT
    state,
    count(*) as connection_count,
    max(now() - state_change) as max_duration,
    avg(now() - state_change) as avg_duration
FROM pg_stat_activity
WHERE pid != pg_backend_pid()  -- Exclude current connection
GROUP BY state
ORDER BY connection_count DESC;

-- =====================================================
-- PERFORMANCE MONITORING FUNCTIONS
-- =====================================================

-- Function: Reset Query Statistics
-- Allows clearing pg_stat_statements for fresh monitoring periods
CREATE OR REPLACE FUNCTION reset_query_stats()
RETURNS VOID AS $$
BEGIN
    -- Only reset if user has appropriate permissions
    IF has_function_privilege('pg_stat_statements_reset()', 'EXECUTE') THEN
        PERFORM pg_stat_statements_reset();
        INSERT INTO sync_logs (operation, status, details, created_at)
        VALUES ('reset_query_stats', 'success', 'Query statistics reset', NOW());
    ELSE
        INSERT INTO sync_logs (operation, status, details, created_at)
        VALUES ('reset_query_stats', 'error', 'Insufficient permissions', NOW());
    END IF;
EXCEPTION WHEN OTHERS THEN
    INSERT INTO sync_logs (operation, status, details, created_at)
    VALUES ('reset_query_stats', 'error', SQLERRM, NOW());
END;
$$ LANGUAGE plpgsql;

-- Function: Get Database Size Stats
-- Provides database size information for capacity monitoring
CREATE OR REPLACE FUNCTION get_database_size_stats()
RETURNS TABLE (
    database_name TEXT,
    size_bytes BIGINT,
    size_pretty TEXT,
    table_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        current_database()::TEXT,
        pg_database_size(current_database())::BIGINT,
        pg_size_pretty(pg_database_size(current_database()))::TEXT,
        (SELECT count(*)::INTEGER FROM information_schema.tables WHERE table_schema = 'public');
END;
$$ LANGUAGE plpgsql;

-- Function: Get Connection Pool Status
-- Monitors connection pool health and capacity
CREATE OR REPLACE FUNCTION get_connection_pool_status()
RETURNS TABLE (
    total_connections INTEGER,
    active_connections INTEGER,
    idle_connections INTEGER,
    max_connections INTEGER,
    connection_utilization_percent NUMERIC
) AS $$
DECLARE
    max_conn INTEGER;
BEGIN
    -- Get max connections setting
    SELECT setting::INTEGER INTO max_conn FROM pg_settings WHERE name = 'max_connections';
    
    RETURN QUERY
    SELECT 
        (SELECT count(*)::INTEGER FROM pg_stat_activity WHERE pid != pg_backend_pid()),
        (SELECT count(*)::INTEGER FROM pg_stat_activity WHERE state = 'active' AND pid != pg_backend_pid()),
        (SELECT count(*)::INTEGER FROM pg_stat_activity WHERE state = 'idle' AND pid != pg_backend_pid()),
        max_conn,
        round((SELECT count(*) FROM pg_stat_activity WHERE pid != pg_backend_pid())::NUMERIC * 100.0 / max_conn, 2);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- MONITORING TABLES
-- =====================================================

-- Table: Performance Snapshots
-- Stores periodic performance snapshots for historical analysis
CREATE TABLE IF NOT EXISTS performance_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    snapshot_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_queries BIGINT,
    slow_queries_count INTEGER,
    avg_query_time NUMERIC,
    max_query_time NUMERIC,
    cache_hit_ratio NUMERIC,
    active_connections INTEGER,
    database_size_bytes BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for time-based queries on performance snapshots
CREATE INDEX IF NOT EXISTS idx_performance_snapshots_time ON performance_snapshots (snapshot_time);

-- Table: Query Performance Alerts
-- Logs performance alerts for tracking and analysis
CREATE TABLE IF NOT EXISTS query_performance_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_type TEXT NOT NULL, -- 'slow_query', 'high_connection_count', 'low_cache_hit_ratio'
    severity TEXT NOT NULL, -- 'warning', 'critical'
    query_text TEXT,
    metric_value NUMERIC,
    threshold_value NUMERIC,
    details JSONB,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for alert queries
CREATE INDEX IF NOT EXISTS idx_query_alerts_type_time ON query_performance_alerts (alert_type, created_at);
CREATE INDEX IF NOT EXISTS idx_query_alerts_unresolved ON query_performance_alerts (created_at) WHERE resolved_at IS NULL;

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on monitoring tables
ALTER TABLE performance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE query_performance_alerts ENABLE ROW LEVEL SECURITY;

-- Allow public read access to monitoring data (following existing pattern)
CREATE POLICY "Public read access for performance_snapshots" ON performance_snapshots FOR SELECT USING (true);
CREATE POLICY "Public read access for query_performance_alerts" ON query_performance_alerts FOR SELECT USING (true);

-- Allow service role to manage monitoring data
CREATE POLICY "Service role full access to performance_snapshots" ON performance_snapshots FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access to query_performance_alerts" ON query_performance_alerts FOR ALL USING (auth.role() = 'service_role');

-- =====================================================
-- INITIAL DATA AND COMMENTS
-- =====================================================

-- Add comments for documentation
COMMENT ON VIEW slow_queries IS 'Identifies database queries with mean execution time > 500ms';
COMMENT ON VIEW query_performance_summary IS 'Comprehensive query performance metrics with cache hit ratios';
COMMENT ON VIEW index_usage_stats IS 'Index usage statistics for optimization analysis';
COMMENT ON VIEW table_activity_stats IS 'Table-level activity statistics for monitoring database load';
COMMENT ON VIEW connection_stats IS 'Real-time connection state monitoring';

COMMENT ON TABLE performance_snapshots IS 'Historical performance snapshots for trend analysis';
COMMENT ON TABLE query_performance_alerts IS 'Performance alert logs for monitoring and analysis';

COMMENT ON FUNCTION reset_query_stats() IS 'Resets pg_stat_statements for fresh monitoring periods';
COMMENT ON FUNCTION get_database_size_stats() IS 'Returns database size information for capacity monitoring';
COMMENT ON FUNCTION get_connection_pool_status() IS 'Monitors connection pool health and utilization';

-- Log migration completion
INSERT INTO sync_logs (operation, status, details, created_at)
VALUES ('enable_performance_monitoring', 'success', 'Performance monitoring migration completed', NOW());
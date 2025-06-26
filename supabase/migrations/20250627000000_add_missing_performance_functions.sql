-- Add missing performance monitoring functions
-- This migration adds the create_performance_snapshot function that was missing

-- =====================================================
-- CREATE PERFORMANCE SNAPSHOT FUNCTION
-- =====================================================

-- Function: Create Performance Snapshot
-- Creates a snapshot of current database performance metrics
CREATE OR REPLACE FUNCTION create_performance_snapshot()
RETURNS UUID AS $$
DECLARE
    snapshot_id UUID;
    total_queries_count BIGINT;
    slow_queries_count INTEGER;
    avg_query_time_val NUMERIC;
    max_query_time_val NUMERIC;
    cache_hit_ratio_val NUMERIC;
    active_connections_count INTEGER;
    database_size_bytes_val BIGINT;
BEGIN
    -- Generate new snapshot ID
    snapshot_id := uuid_generate_v4();
    
    -- Get total queries from pg_stat_statements
    SELECT 
        COALESCE(SUM(calls), 0),
        COALESCE(AVG(mean_exec_time), 0),
        COALESCE(MAX(max_exec_time), 0)
    INTO 
        total_queries_count,
        avg_query_time_val,
        max_query_time_val
    FROM pg_stat_statements;
    
    -- Get slow queries count
    SELECT COUNT(*) INTO slow_queries_count FROM slow_queries;
    
    -- Calculate cache hit ratio
    SELECT 
        COALESCE(
            AVG(100.0 * shared_blks_hit / NULLIF(shared_blks_hit + shared_blks_read, 0)), 
            0
        )
    INTO cache_hit_ratio_val
    FROM pg_stat_statements
    WHERE shared_blks_hit + shared_blks_read > 0;
    
    -- Get active connections
    SELECT COUNT(*) INTO active_connections_count 
    FROM pg_stat_activity 
    WHERE state = 'active' AND pid != pg_backend_pid();
    
    -- Get database size
    SELECT pg_database_size(current_database()) INTO database_size_bytes_val;
    
    -- Insert snapshot
    INSERT INTO performance_snapshots (
        id,
        snapshot_time,
        total_queries,
        slow_queries_count,
        avg_query_time,
        max_query_time,
        cache_hit_ratio,
        active_connections,
        database_size_bytes,
        created_at
    ) VALUES (
        snapshot_id,
        NOW(),
        total_queries_count,
        slow_queries_count,
        avg_query_time_val,
        max_query_time_val,
        cache_hit_ratio_val,
        active_connections_count,
        database_size_bytes_val,
        NOW()
    );
    
    -- Log the operation using the correct sync_logs table structure
    INSERT INTO sync_logs (sync_type, status, started_at, completed_at, metadata)
    VALUES (
        'full_sync', 
        'completed', 
        NOW(),
        NOW(),
        jsonb_build_object(
            'operation', 'create_performance_snapshot',
            'snapshot_id', snapshot_id,
            'total_queries', total_queries_count,
            'slow_queries', slow_queries_count,
            'avg_query_time', avg_query_time_val
        )
    );
    
    RETURN snapshot_id;
    
EXCEPTION WHEN OTHERS THEN
    -- Log error using the correct sync_logs table structure
    INSERT INTO sync_logs (sync_type, status, started_at, error_message, metadata)
    VALUES (
        'full_sync', 
        'failed', 
        NOW(),
        SQLERRM,
        jsonb_build_object('operation', 'create_performance_snapshot')
    );
    
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON FUNCTION create_performance_snapshot() IS 'Creates a snapshot of current database performance metrics for historical tracking';

-- Log migration completion
INSERT INTO sync_logs (sync_type, status, started_at, completed_at, metadata)
VALUES (
    'full_sync', 
    'completed', 
    NOW(), 
    NOW(),
    jsonb_build_object(
        'operation', 'add_missing_performance_functions',
        'details', 'Added create_performance_snapshot function'
    )
);
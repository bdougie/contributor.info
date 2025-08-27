-- Local-safe version of 20250710000000_add_progressive_capture_jobs.sql
-- Generated: 2025-08-27T02:47:08.050Z
-- This migration has been modified to work without auth, roles, and extensions
-- Original migration may have different behavior in production

-- Transaction wrapper for safety
BEGIN;


-- Ensure authenticated exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated;
    RAISE NOTICE 'Created missing role: authenticated';
  END IF;
END $$;

-- Ensure service_role exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role;
    RAISE NOTICE 'Created missing role: service_role';
  END IF;
END $$;

-- Add progressive capture jobs table for hybrid queue management
-- This enables tracking jobs across both Inngest and GitHub Actions processors

-- Create progressive capture jobs table
CREATE TABLE IF NOT EXISTS progressive_capture_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_type VARCHAR(50) NOT NULL,
  repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE,
  processor_type VARCHAR(20) NOT NULL DEFAULT 'github_actions', -- 'inngest' or 'github_actions'
  status VARCHAR(20) DEFAULT 'pending',
  time_range_days INTEGER,
  workflow_run_id BIGINT, -- For GitHub Actions jobs
  metadata JSONB DEFAULT '{}',
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_capture_jobs_processor 
ON progressive_capture_jobs(processor_type, status, created_at);

CREATE INDEX IF NOT EXISTS idx_capture_jobs_repository 
ON progressive_capture_jobs(repository_id, created_at);

CREATE INDEX IF NOT EXISTS idx_capture_jobs_status
ON progressive_capture_jobs(status, created_at);

CREATE INDEX IF NOT EXISTS idx_capture_jobs_workflow_run
ON progressive_capture_jobs(workflow_run_id) 
WHERE workflow_run_id IS NOT NULL;

-- Create progress tracking table
CREATE TABLE IF NOT EXISTS progressive_capture_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES progressive_capture_jobs(id) ON DELETE CASCADE,
  total_items INTEGER,
  processed_items INTEGER DEFAULT 0,
  failed_items INTEGER DEFAULT 0,
  current_item TEXT,
  errors JSONB DEFAULT '[]',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for progress tracking
CREATE INDEX IF NOT EXISTS idx_capture_progress_job_id
ON progressive_capture_progress(job_id);

-- Add RLS policies
ALTER TABLE progressive_capture_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE progressive_capture_progress ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all jobs (for monitoring)
CREATE POLICY "progressive_capture_jobs_select" ON progressive_capture_jobs
FOR SELECT TO authenticated 
USING (true);

-- Allow service role to manage all jobs
CREATE POLICY "progressive_capture_jobs_service" ON progressive_capture_jobs
FOR ALL TO service_role 
USING (true);

-- Allow authenticated users to read progress
CREATE POLICY "progressive_capture_progress_select" ON progressive_capture_progress
FOR SELECT TO authenticated 
USING (true);

-- Allow service role to manage progress
CREATE POLICY "progressive_capture_progress_service" ON progressive_capture_progress
FOR ALL TO service_role 
USING (true);

-- Add helpful views for monitoring
CREATE OR REPLACE VIEW progressive_capture_stats AS
SELECT 
  processor_type,
  status,
  COUNT(*) as count,
  MIN(created_at) as oldest_job,
  MAX(created_at) as newest_job,
  AVG(EXTRACT(EPOCH FROM (completed_at - started_at))/60) as avg_duration_minutes
FROM progressive_capture_jobs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY processor_type, status;

-- DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    Grant select on the view
GRANT SELECT ON progressive_capture_stats TO authenticated, service_role;
  ELSE
    RAISE NOTICE 'Role authenticated not found, skipping grant';
  END IF;
END $;

-- Add function to get job metrics
CREATE OR REPLACE FUNCTION get_progressive_capture_metrics(days_back INTEGER DEFAULT 7)
RETURNS TABLE (
  total_jobs BIGINT,
  pending_jobs BIGINT,
  processing_jobs BIGINT,
  completed_jobs BIGINT,
  failed_jobs BIGINT,
  inngest_jobs BIGINT,
  github_actions_jobs BIGINT,
  avg_completion_time_minutes NUMERIC
) 
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT 
    COUNT(*) as total_jobs,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_jobs,
    COUNT(*) FILTER (WHERE status = 'processing') as processing_jobs,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_jobs,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_jobs,
    COUNT(*) FILTER (WHERE processor_type = 'inngest') as inngest_jobs,
    COUNT(*) FILTER (WHERE processor_type = 'github_actions') as github_actions_jobs,
    AVG(EXTRACT(EPOCH FROM (completed_at - started_at))/60) as avg_completion_time_minutes
  FROM progressive_capture_jobs
  WHERE created_at > NOW() - INTERVAL '1 day' * days_back;
$$;

-- DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    Grant execute permission
GRANT EXECUTE ON FUNCTION get_progressive_capture_metrics TO authenticated, service_role;
  ELSE
    RAISE NOTICE 'Role authenticated not found, skipping grant';
  END IF;
END $;

-- Add comment for documentation
COMMENT ON TABLE progressive_capture_jobs IS 'Tracks jobs across hybrid progressive capture system (Inngest + GitHub Actions)';
COMMENT ON TABLE progressive_capture_progress IS 'Tracks progress of individual progressive capture jobs';

COMMIT;
-- Create background_jobs table for tracking long-running Inngest jobs
CREATE TABLE IF NOT EXISTS public.background_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  payload JSONB,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  result JSONB,
  error TEXT,
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  duration_ms INT GENERATED ALWAYS AS (
    CASE
      WHEN completed_at IS NOT NULL AND started_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000
      WHEN failed_at IS NOT NULL AND started_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (failed_at - started_at)) * 1000
      ELSE NULL
    END
  ) STORED,

  -- Metadata for tracking
  inngest_event_id TEXT,
  inngest_run_id TEXT,
  repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE,

  CONSTRAINT valid_dates CHECK (
    (completed_at IS NULL OR started_at IS NOT NULL) AND
    (failed_at IS NULL OR started_at IS NOT NULL)
  )
);

-- Indexes for efficient querying
CREATE INDEX idx_jobs_status ON background_jobs(status) WHERE status != 'completed';
CREATE INDEX idx_jobs_created ON background_jobs(created_at DESC);
CREATE INDEX idx_jobs_type ON background_jobs(type);
CREATE INDEX idx_jobs_repository ON background_jobs(repository_id) WHERE repository_id IS NOT NULL;
CREATE INDEX idx_jobs_inngest_event ON background_jobs(inngest_event_id) WHERE inngest_event_id IS NOT NULL;

-- RLS policies
ALTER TABLE background_jobs ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role can manage all jobs" ON background_jobs
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Allow authenticated users to view all jobs (read-only)
CREATE POLICY "Authenticated users can view jobs" ON background_jobs
  FOR SELECT USING (auth.role() = 'authenticated');

-- Create view for job statistics
CREATE OR REPLACE VIEW job_statistics AS
SELECT
  type,
  status,
  COUNT(*) as count,
  AVG(duration_ms) as avg_duration_ms,
  MIN(duration_ms) as min_duration_ms,
  MAX(duration_ms) as max_duration_ms,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms) as median_duration_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_duration_ms,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'completed')::numeric /
    NULLIF(COUNT(*), 0) * 100, 2
  ) as success_rate
FROM background_jobs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY type, status;

-- Function to get next job to process
CREATE OR REPLACE FUNCTION get_next_job()
RETURNS TABLE (
  id UUID,
  type TEXT,
  payload JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  UPDATE background_jobs
  SET
    status = 'processing',
    started_at = NOW()
  WHERE id = (
    SELECT id
    FROM background_jobs
    WHERE status = 'queued'
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING background_jobs.id, background_jobs.type, background_jobs.payload;
END;
$$;

-- Function to retry failed jobs
CREATE OR REPLACE FUNCTION retry_failed_job(job_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  job_record background_jobs%ROWTYPE;
BEGIN
  SELECT * INTO job_record
  FROM background_jobs
  WHERE id = job_id AND status = 'failed'
  FOR UPDATE;

  IF job_record.id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF job_record.retry_count >= job_record.max_retries THEN
    RETURN FALSE;
  END IF;

  UPDATE background_jobs
  SET
    status = 'queued',
    retry_count = retry_count + 1,
    error = NULL,
    failed_at = NULL,
    started_at = NULL,
    completed_at = NULL
  WHERE id = job_id;

  RETURN TRUE;
END;
$$;

COMMENT ON TABLE background_jobs IS 'Tracks long-running background jobs delegated from Inngest to Supabase Edge Functions';
COMMENT ON COLUMN background_jobs.type IS 'Job type matching Inngest event name (e.g., capture/repository.sync.graphql)';
COMMENT ON COLUMN background_jobs.payload IS 'Job data/parameters from Inngest event';
COMMENT ON COLUMN background_jobs.duration_ms IS 'Computed duration in milliseconds';
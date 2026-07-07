-- Add webhook metrics tracking to background_jobs table

-- Add webhook-specific columns to background_jobs
ALTER TABLE background_jobs
ADD COLUMN IF NOT EXISTS webhook_source TEXT,
ADD COLUMN IF NOT EXISTS webhook_event_type TEXT,
ADD COLUMN IF NOT EXISTS affected_workspaces INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS processing_mode TEXT CHECK (processing_mode IN ('inline', 'background')),
ADD COLUMN IF NOT EXISTS response_time_ms INT;

-- Create index for webhook queries
CREATE INDEX IF NOT EXISTS idx_jobs_webhook_source
ON background_jobs(webhook_source)
WHERE webhook_source IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_webhook_event_type
ON background_jobs(webhook_event_type)
WHERE webhook_event_type IS NOT NULL;

-- Create view for webhook metrics
CREATE OR REPLACE VIEW webhook_metrics AS
SELECT
  webhook_source,
  webhook_event_type,
  processing_mode,
  COUNT(*) as total_events,
  COUNT(*) FILTER (WHERE status = 'completed') as successful,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  AVG(duration_ms) FILTER (WHERE status = 'completed') as avg_duration_ms,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms) FILTER (WHERE status = 'completed') as median_duration_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) FILTER (WHERE status = 'completed') as p95_duration_ms,
  AVG(affected_workspaces) as avg_affected_workspaces,
  MAX(affected_workspaces) as max_affected_workspaces,
  AVG(response_time_ms) as avg_response_time_ms
FROM background_jobs
WHERE webhook_source IS NOT NULL
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY webhook_source, webhook_event_type, processing_mode;

-- Dead Letter Queue table for permanently failed jobs
CREATE TABLE IF NOT EXISTS public.dead_letter_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  original_job_id UUID REFERENCES background_jobs(id),
  type TEXT NOT NULL,
  payload JSONB,
  error_history JSONB[], -- Array of all error attempts
  failure_count INT DEFAULT 0,
  first_failed_at TIMESTAMPTZ,
  last_failed_at TIMESTAMPTZ,
  moved_to_dlq_at TIMESTAMPTZ DEFAULT NOW(),

  -- Metadata for investigation
  error_category TEXT, -- timeout, validation, external_api, etc.
  requires_manual_intervention BOOLEAN DEFAULT false,
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),

  -- Original job metadata
  inngest_event_id TEXT,
  repository_id UUID,
  webhook_source TEXT,
  webhook_event_type TEXT,

  CONSTRAINT valid_dlq_dates CHECK (
    first_failed_at <= last_failed_at AND
    last_failed_at <= moved_to_dlq_at
  )
);

-- Indexes for DLQ
CREATE INDEX idx_dlq_unresolved ON dead_letter_queue(resolved_at)
WHERE resolved_at IS NULL;

CREATE INDEX idx_dlq_error_category ON dead_letter_queue(error_category);

CREATE INDEX idx_dlq_moved_at ON dead_letter_queue(moved_to_dlq_at DESC);

-- Function to move failed jobs to DLQ
CREATE OR REPLACE FUNCTION move_to_dead_letter_queue(job_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  job_record background_jobs%ROWTYPE;
  error_history JSONB[];
BEGIN
  -- Get the failed job
  SELECT * INTO job_record
  FROM background_jobs
  WHERE id = job_id
    AND status = 'failed'
    AND retry_count >= max_retries;

  IF job_record.id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Build error history
  error_history := ARRAY[
    jsonb_build_object(
      'attempt', job_record.retry_count,
      'error', job_record.error,
      'failed_at', job_record.failed_at
    )
  ];

  -- Insert into DLQ
  INSERT INTO dead_letter_queue (
    original_job_id,
    type,
    payload,
    error_history,
    failure_count,
    first_failed_at,
    last_failed_at,
    inngest_event_id,
    repository_id,
    webhook_source,
    webhook_event_type,
    error_category
  ) VALUES (
    job_record.id,
    job_record.type,
    job_record.payload,
    error_history,
    job_record.retry_count,
    job_record.failed_at,
    job_record.failed_at,
    job_record.inngest_event_id,
    job_record.repository_id,
    job_record.webhook_source,
    job_record.webhook_event_type,
    CASE
      WHEN job_record.error ILIKE '%timeout%' THEN 'timeout'
      WHEN job_record.error ILIKE '%validation%' THEN 'validation'
      WHEN job_record.error ILIKE '%api%' THEN 'external_api'
      WHEN job_record.error ILIKE '%rate limit%' THEN 'rate_limit'
      ELSE 'unknown'
    END
  );

  -- Update original job status
  UPDATE background_jobs
  SET status = 'dead_letter'
  WHERE id = job_id;

  RETURN TRUE;
END;
$$;

-- Function to get webhook processing stats
CREATE OR REPLACE FUNCTION get_webhook_stats(
  time_range INTERVAL DEFAULT INTERVAL '24 hours'
)
RETURNS TABLE (
  metric TEXT,
  value TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT
      COUNT(*) as total_webhooks,
      COUNT(*) FILTER (WHERE processing_mode = 'inline') as inline_processed,
      COUNT(*) FILTER (WHERE processing_mode = 'background') as background_processed,
      COUNT(*) FILTER (WHERE status = 'completed') as successful,
      COUNT(*) FILTER (WHERE status = 'failed') as failed,
      AVG(response_time_ms) as avg_response_time,
      MAX(affected_workspaces) as max_workspaces,
      COUNT(DISTINCT webhook_source || ':' || webhook_event_type) as unique_event_types
    FROM background_jobs
    WHERE webhook_source IS NOT NULL
      AND created_at > NOW() - time_range
  )
  SELECT 'Total Webhooks', total_webhooks::TEXT FROM stats
  UNION ALL
  SELECT 'Inline Processed', inline_processed::TEXT FROM stats
  UNION ALL
  SELECT 'Background Processed', background_processed::TEXT FROM stats
  UNION ALL
  SELECT 'Success Rate',
    ROUND(100.0 * successful / NULLIF(total_webhooks, 0), 2) || '%' FROM stats
  UNION ALL
  SELECT 'Failed Webhooks', failed::TEXT FROM stats
  UNION ALL
  SELECT 'Avg Response Time',
    CASE
      WHEN avg_response_time < 1000 THEN ROUND(avg_response_time) || 'ms'
      ELSE ROUND(avg_response_time / 1000.0, 1) || 's'
    END FROM stats
  UNION ALL
  SELECT 'Max Workspaces Affected', max_workspaces::TEXT FROM stats
  UNION ALL
  SELECT 'Unique Event Types', unique_event_types::TEXT FROM stats;
END;
$$;

-- Alert view for critical failures
CREATE OR REPLACE VIEW critical_failures AS
SELECT
  id,
  type,
  error,
  retry_count,
  failed_at,
  webhook_source,
  webhook_event_type,
  CASE
    WHEN type LIKE 'webhook/%' THEN 'Webhook Processing'
    WHEN type LIKE 'capture/%' THEN 'Data Capture'
    WHEN type LIKE 'classify/%' THEN 'Classification'
    ELSE 'Other'
  END as category,
  CASE
    WHEN failed_at > NOW() - INTERVAL '1 hour' THEN 'Recent'
    WHEN failed_at > NOW() - INTERVAL '24 hours' THEN 'Today'
    ELSE 'Older'
  END as recency
FROM background_jobs
WHERE status = 'failed'
  AND retry_count >= max_retries
  AND failed_at > NOW() - INTERVAL '7 days'
ORDER BY failed_at DESC;

-- Add status for dead letter
ALTER TABLE background_jobs
DROP CONSTRAINT IF EXISTS background_jobs_status_check;

ALTER TABLE background_jobs
ADD CONSTRAINT background_jobs_status_check
CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled', 'dead_letter'));

-- Grant permissions
GRANT SELECT ON webhook_metrics TO authenticated;
GRANT SELECT ON critical_failures TO authenticated;
GRANT SELECT, INSERT ON dead_letter_queue TO service_role;
GRANT EXECUTE ON FUNCTION move_to_dead_letter_queue TO service_role;
GRANT EXECUTE ON FUNCTION get_webhook_stats TO authenticated;

-- Add comments
COMMENT ON TABLE dead_letter_queue IS 'Storage for jobs that failed permanently after max retries';
COMMENT ON VIEW webhook_metrics IS 'Aggregated metrics for webhook processing performance';
COMMENT ON VIEW critical_failures IS 'Jobs that failed after max retries and need investigation';
COMMENT ON FUNCTION move_to_dead_letter_queue IS 'Move permanently failed jobs to dead letter queue for investigation';
COMMENT ON FUNCTION get_webhook_stats IS 'Get summary statistics for webhook processing';
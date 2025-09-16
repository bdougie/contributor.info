-- Create edge_function_metrics table for monitoring concurrency and performance
-- This table stores metrics about Edge Function execution patterns and limits

CREATE TABLE IF NOT EXISTS public.edge_function_metrics (
  -- Primary key
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Concurrency metrics
  current_concurrent INTEGER NOT NULL,
  peak_concurrent INTEGER NOT NULL,
  total_requests INTEGER NOT NULL,
  throttled_requests INTEGER NOT NULL,

  -- Performance metrics
  average_execution_time DOUBLE PRECISION NOT NULL,

  -- Timestamp
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

  -- Additional context
  tier TEXT DEFAULT 'pro' CHECK (tier IN ('free', 'pro', 'enterprise')),
  endpoint TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for efficient querying
CREATE INDEX idx_edge_function_metrics_recorded_at
ON public.edge_function_metrics(recorded_at DESC);

CREATE INDEX idx_edge_function_metrics_tier
ON public.edge_function_metrics(tier);

CREATE INDEX idx_edge_function_metrics_endpoint
ON public.edge_function_metrics(endpoint);

-- Create composite index for time-series queries
CREATE INDEX idx_edge_function_metrics_time_series
ON public.edge_function_metrics(recorded_at DESC, current_concurrent, peak_concurrent);

-- Add Row Level Security
ALTER TABLE public.edge_function_metrics ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything
CREATE POLICY "Service role has full access to edge_function_metrics"
ON public.edge_function_metrics
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy: Authenticated users can read metrics
CREATE POLICY "Authenticated users can read edge_function_metrics"
ON public.edge_function_metrics
FOR SELECT
TO authenticated
USING (true);

-- Create webhook_queue table for request queuing
CREATE TABLE IF NOT EXISTS public.webhook_queue (
  -- Primary key
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Queue management
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead_letter')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),

  -- Request data
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  headers JSONB DEFAULT '{}'::jsonb,

  -- Processing metadata
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  last_error TEXT,
  processing_started_at TIMESTAMP WITH TIME ZONE,
  processing_completed_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

  -- Optional tracking
  idempotency_key TEXT,
  correlation_id TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create indexes for queue processing
CREATE INDEX idx_webhook_queue_status
ON public.webhook_queue(status);

CREATE INDEX idx_webhook_queue_priority_scheduled
ON public.webhook_queue(priority, scheduled_for)
WHERE status = 'pending';

CREATE INDEX idx_webhook_queue_processing
ON public.webhook_queue(processing_started_at)
WHERE status = 'processing';

CREATE INDEX idx_webhook_queue_failed
ON public.webhook_queue(retry_count, status)
WHERE status = 'failed';

CREATE INDEX idx_webhook_queue_idempotency
ON public.webhook_queue(idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- Add Row Level Security
ALTER TABLE public.webhook_queue ENABLE ROW LEVEL SECURITY;

-- Policy: Service role has full access
CREATE POLICY "Service role has full access to webhook_queue"
ON public.webhook_queue
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Function to process webhook queue with advisory lock
CREATE OR REPLACE FUNCTION process_webhook_queue()
RETURNS SETOF public.webhook_queue AS $$
DECLARE
  queue_record public.webhook_queue;
  lock_key bigint;
BEGIN
  -- Select next item to process with priority ordering and advisory lock
  SELECT * INTO queue_record
  FROM public.webhook_queue
  WHERE status = 'pending'
    AND scheduled_for <= NOW()
  ORDER BY
    CASE priority
      WHEN 'high' THEN 0
      WHEN 'medium' THEN 1
      WHEN 'low' THEN 2
    END,
    scheduled_for,
    created_at
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  -- If we found a record, mark it as processing
  IF FOUND THEN
    UPDATE public.webhook_queue
    SET
      status = 'processing',
      processing_started_at = NOW(),
      updated_at = NOW()
    WHERE id = queue_record.id;

    RETURN NEXT queue_record;
  END IF;

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark queue item as completed
CREATE OR REPLACE FUNCTION complete_queue_item(
  queue_id UUID,
  success BOOLEAN,
  error_message TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  IF success THEN
    UPDATE public.webhook_queue
    SET
      status = 'completed',
      processing_completed_at = NOW(),
      updated_at = NOW()
    WHERE id = queue_id;
  ELSE
    UPDATE public.webhook_queue
    SET
      status = CASE
        WHEN retry_count >= max_retries THEN 'dead_letter'
        ELSE 'failed'
      END,
      retry_count = retry_count + 1,
      last_error = error_message,
      processing_completed_at = NOW(),
      updated_at = NOW(),
      -- Exponential backoff for retries
      scheduled_for = CASE
        WHEN retry_count < max_retries THEN
          NOW() + INTERVAL '1 minute' * POWER(2, retry_count)
        ELSE scheduled_for
      END
    WHERE id = queue_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get queue depth by priority
CREATE OR REPLACE FUNCTION get_queue_depth()
RETURNS TABLE(
  priority TEXT,
  pending_count BIGINT,
  processing_count BIGINT,
  failed_count BIGINT,
  total_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.priority,
    COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
    COUNT(*) FILTER (WHERE status = 'processing') AS processing_count,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed_count,
    COUNT(*) AS total_count
  FROM (VALUES ('high'), ('medium'), ('low')) AS p(priority)
  LEFT JOIN public.webhook_queue wq ON wq.priority = p.priority
  GROUP BY p.priority
  ORDER BY
    CASE p.priority
      WHEN 'high' THEN 0
      WHEN 'medium' THEN 1
      WHEN 'low' THEN 2
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old metrics
CREATE OR REPLACE FUNCTION cleanup_old_metrics()
RETURNS void AS $$
BEGIN
  -- Delete metrics older than 30 days
  DELETE FROM public.edge_function_metrics
  WHERE recorded_at < NOW() - INTERVAL '30 days';

  -- Delete completed queue items older than 7 days
  DELETE FROM public.webhook_queue
  WHERE status IN ('completed', 'dead_letter')
    AND updated_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add helpful comments
COMMENT ON TABLE public.edge_function_metrics IS 'Stores metrics for Edge Function concurrency monitoring and capacity planning';
COMMENT ON TABLE public.webhook_queue IS 'Queue for processing webhook events with priority and retry support';
COMMENT ON FUNCTION process_webhook_queue() IS 'Fetches next webhook to process with proper locking';
COMMENT ON FUNCTION complete_queue_item(UUID, BOOLEAN, TEXT) IS 'Marks a queue item as completed or failed with retry logic';
COMMENT ON FUNCTION get_queue_depth() IS 'Returns current queue depth by priority level';
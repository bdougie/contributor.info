-- Create idempotency_keys table for request deduplication
-- This table stores idempotency keys to prevent duplicate request processing

-- Create the table
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  -- Primary key
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- The idempotency key provided by the client
  key TEXT NOT NULL UNIQUE,

  -- SHA-256 hash of the request payload for comparison
  request_hash TEXT NOT NULL,

  -- The cached response to return for duplicate requests
  response JSONB,

  -- Status of the request processing
  status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

  -- The endpoint this key is for (for future multi-endpoint support)
  endpoint TEXT NOT NULL,

  -- Optional user association
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Additional metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Indexes for performance
  CONSTRAINT idempotency_keys_key_unique UNIQUE(key)
);

-- Create indexes for efficient lookups
CREATE INDEX idx_idempotency_keys_key ON public.idempotency_keys(key);
CREATE INDEX idx_idempotency_keys_expires_at ON public.idempotency_keys(expires_at);
CREATE INDEX idx_idempotency_keys_user_id ON public.idempotency_keys(user_id);
CREATE INDEX idx_idempotency_keys_status ON public.idempotency_keys(status);
CREATE INDEX idx_idempotency_keys_created_at ON public.idempotency_keys(created_at);

-- Create composite index for common lookup pattern
CREATE INDEX idx_idempotency_keys_lookup
ON public.idempotency_keys(key, status, expires_at);

-- Add Row Level Security (RLS)
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything
CREATE POLICY "Service role has full access to idempotency_keys"
ON public.idempotency_keys
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy: Users can only see their own idempotency keys
CREATE POLICY "Users can view their own idempotency keys"
ON public.idempotency_keys
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Function to clean up expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS void AS $$
BEGIN
  DELETE FROM public.idempotency_keys
  WHERE expires_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a scheduled job to clean up expired keys (requires pg_cron extension)
-- Note: This is commented out as pg_cron might not be available in all environments
-- Uncomment if pg_cron is available in your Supabase instance
/*
SELECT cron.schedule(
  'cleanup-expired-idempotency-keys',
  '0 3 * * *', -- Run daily at 3 AM
  'SELECT cleanup_expired_idempotency_keys();'
);
*/

-- Add helpful comments
COMMENT ON TABLE public.idempotency_keys IS 'Stores idempotency keys for request deduplication to prevent duplicate processing';
COMMENT ON COLUMN public.idempotency_keys.key IS 'Unique idempotency key provided by the client';
COMMENT ON COLUMN public.idempotency_keys.request_hash IS 'SHA-256 hash of the request payload for comparison';
COMMENT ON COLUMN public.idempotency_keys.response IS 'Cached response to return for duplicate requests';
COMMENT ON COLUMN public.idempotency_keys.status IS 'Current processing status: processing, completed, or failed';
COMMENT ON COLUMN public.idempotency_keys.expires_at IS 'When this idempotency key expires and can be cleaned up';
COMMENT ON COLUMN public.idempotency_keys.endpoint IS 'The API endpoint this key is associated with';
COMMENT ON COLUMN public.idempotency_keys.user_id IS 'Optional reference to the user who made the request';
COMMENT ON COLUMN public.idempotency_keys.metadata IS 'Additional metadata about the request';
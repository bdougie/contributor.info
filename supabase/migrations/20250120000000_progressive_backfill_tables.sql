-- Create tables for tracking progressive backfill state and progress

-- Table to track overall backfill state for each repository
CREATE TABLE IF NOT EXISTS progressive_backfill_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  total_prs INTEGER NOT NULL,
  processed_prs INTEGER DEFAULT 0,
  last_processed_cursor TEXT, -- GitHub cursor for pagination
  last_processed_pr_number INTEGER, -- Last PR number processed
  last_processed_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'failed')),
  chunk_size INTEGER DEFAULT 25,
  error_count INTEGER DEFAULT 0,
  consecutive_errors INTEGER DEFAULT 0,
  last_error TEXT,
  last_error_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one backfill per repository
  CONSTRAINT unique_active_backfill UNIQUE (repository_id)
);

-- Table to track individual chunk processing
CREATE TABLE IF NOT EXISTS backfill_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  backfill_state_id UUID NOT NULL REFERENCES progressive_backfill_state(id) ON DELETE CASCADE,
  chunk_number INTEGER NOT NULL,
  pr_numbers INTEGER[],
  pr_count INTEGER GENERATED ALWAYS AS (array_length(pr_numbers, 1)) STORED,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  processor_type VARCHAR(20) DEFAULT 'github_actions',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  processing_time_ms INTEGER GENERATED ALWAYS AS (
    CASE 
      WHEN completed_at IS NOT NULL AND started_at IS NOT NULL 
      THEN EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000
      ELSE NULL
    END
  ) STORED,
  error TEXT,
  retry_count INTEGER DEFAULT 0,
  api_calls_made INTEGER,
  rate_limit_remaining INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique chunk numbers per backfill
  CONSTRAINT unique_chunk_per_backfill UNIQUE (backfill_state_id, chunk_number)
);

-- Index for efficient queries
CREATE INDEX idx_backfill_state_repository ON progressive_backfill_state(repository_id, status);
CREATE INDEX idx_backfill_state_active ON progressive_backfill_state(status) WHERE status = 'active';
CREATE INDEX idx_backfill_chunks_status ON backfill_chunks(backfill_state_id, status);
CREATE INDEX idx_backfill_chunks_pending ON backfill_chunks(status, created_at) WHERE status = 'pending';

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_progressive_backfill_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER progressive_backfill_state_updated_at
  BEFORE UPDATE ON progressive_backfill_state
  FOR EACH ROW
  EXECUTE FUNCTION update_progressive_backfill_updated_at();

-- Add RLS policies
ALTER TABLE progressive_backfill_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE backfill_chunks ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read backfill state
CREATE POLICY "Authenticated users can read backfill state"
  ON progressive_backfill_state
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow service role to manage backfill state
CREATE POLICY "Service role can manage backfill state"
  ON progressive_backfill_state
  FOR ALL
  TO service_role
  USING (true);

-- Allow authenticated users to read backfill chunks
CREATE POLICY "Authenticated users can read backfill chunks"
  ON backfill_chunks
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow service role to manage backfill chunks
CREATE POLICY "Service role can manage backfill chunks"
  ON backfill_chunks
  FOR ALL
  TO service_role
  USING (true);

-- View for monitoring backfill progress
CREATE OR REPLACE VIEW backfill_progress_summary AS
SELECT 
  r.owner,
  r.name,
  pbs.id as backfill_id,
  pbs.status,
  pbs.total_prs,
  pbs.processed_prs,
  CASE 
    WHEN pbs.total_prs > 0 
    THEN ROUND((pbs.processed_prs::NUMERIC / pbs.total_prs) * 100, 2)
    ELSE 0
  END as progress_percentage,
  pbs.chunk_size,
  pbs.error_count,
  pbs.last_processed_at,
  pbs.created_at,
  pbs.updated_at,
  COALESCE(
    (SELECT COUNT(*) FROM backfill_chunks WHERE backfill_state_id = pbs.id AND status = 'completed'),
    0
  ) as completed_chunks,
  COALESCE(
    (SELECT COUNT(*) FROM backfill_chunks WHERE backfill_state_id = pbs.id AND status = 'failed'),
    0
  ) as failed_chunks,
  COALESCE(
    (SELECT AVG(processing_time_ms) FROM backfill_chunks WHERE backfill_state_id = pbs.id AND status = 'completed'),
    0
  )::INTEGER as avg_chunk_processing_time_ms
FROM progressive_backfill_state pbs
JOIN repositories r ON pbs.repository_id = r.id
ORDER BY pbs.created_at DESC;
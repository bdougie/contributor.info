-- Repository Confidence History Table
-- Stores historical confidence scores for trend analysis and comparison

CREATE TABLE IF NOT EXISTS repository_confidence_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Repository identification
  repository_owner text NOT NULL,
  repository_name text NOT NULL,

  -- Historical confidence data
  confidence_score integer NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
  time_range_days integer NOT NULL CHECK (time_range_days > 0),

  -- Breakdown for detailed analysis (stores the full confidence breakdown as JSON)
  breakdown jsonb,

  -- Temporal tracking - allows querying by specific time periods
  calculated_at timestamptz NOT NULL DEFAULT now(),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,

  -- Metadata
  data_version integer DEFAULT 1,
  calculation_time_ms integer,

  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_confidence_history_repo
  ON repository_confidence_history(repository_owner, repository_name);

CREATE INDEX IF NOT EXISTS idx_confidence_history_time
  ON repository_confidence_history(calculated_at DESC);

CREATE INDEX IF NOT EXISTS idx_confidence_history_period
  ON repository_confidence_history(period_start, period_end);

-- Composite index for trend queries (most common use case)
CREATE INDEX IF NOT EXISTS idx_confidence_history_repo_time
  ON repository_confidence_history(repository_owner, repository_name, calculated_at DESC);

-- Index for time range filtering
CREATE INDEX IF NOT EXISTS idx_confidence_history_time_range
  ON repository_confidence_history(repository_owner, repository_name, time_range_days);

-- RLS Policies (allow public read access similar to other tables)
ALTER TABLE repository_confidence_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to confidence history"
  ON repository_confidence_history
  FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated insert to confidence history"
  ON repository_confidence_history
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Allow service role all access to confidence history"
  ON repository_confidence_history
  FOR ALL
  USING (auth.role() = 'service_role');

-- Function to clean up old history entries (keep last 365 days)
CREATE OR REPLACE FUNCTION cleanup_old_confidence_history()
RETURNS void AS $$
BEGIN
  DELETE FROM repository_confidence_history
  WHERE calculated_at < now() - interval '365 days';
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE repository_confidence_history IS 'Stores historical confidence scores for trend analysis and comparison over time';
COMMENT ON COLUMN repository_confidence_history.confidence_score IS 'Historical confidence score (0-100)';
COMMENT ON COLUMN repository_confidence_history.time_range_days IS 'Time range used for calculation (30, 90, 365 days)';
COMMENT ON COLUMN repository_confidence_history.breakdown IS 'JSON object containing detailed confidence breakdown (starFork, engagement, retention, quality)';
COMMENT ON COLUMN repository_confidence_history.period_start IS 'Start of the period this score represents';
COMMENT ON COLUMN repository_confidence_history.period_end IS 'End of the period this score represents';
COMMENT ON COLUMN repository_confidence_history.data_version IS 'Version of the calculation algorithm used';
COMMENT ON COLUMN repository_confidence_history.calculation_time_ms IS 'Time taken to calculate this score in milliseconds';

-- Add automatic data purging for privacy compliance
-- This migration sets up pg_cron to automatically purge old file data after 30 days

-- Enable pg_cron extension if not already enabled
-- Note: This requires superuser privileges and may need to be run separately
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Add purge tracking to file_contributors and file_embeddings
ALTER TABLE file_contributors ADD COLUMN IF NOT EXISTS purge_after TIMESTAMP WITH TIME ZONE 
  GENERATED ALWAYS AS (last_commit_at + INTERVAL '30 days') STORED;

ALTER TABLE file_embeddings ADD COLUMN IF NOT EXISTS purge_after TIMESTAMP WITH TIME ZONE 
  GENERATED ALWAYS AS (last_indexed_at + INTERVAL '30 days') STORED;

-- Create indexes for efficient purging
CREATE INDEX IF NOT EXISTS idx_file_contributors_purge_after ON file_contributors(purge_after);
CREATE INDEX IF NOT EXISTS idx_file_embeddings_purge_after ON file_embeddings(purge_after);

-- Add indexes on the actual filter columns for better performance
CREATE INDEX IF NOT EXISTS idx_file_contributors_last_commit ON file_contributors(last_commit_at);
CREATE INDEX IF NOT EXISTS idx_file_embeddings_last_indexed ON file_embeddings(last_indexed_at);
CREATE INDEX IF NOT EXISTS idx_pr_insights_generated_at ON pr_insights(generated_at);

-- Create a function to purge old data (alternative to Edge Function)
CREATE OR REPLACE FUNCTION purge_old_file_data()
RETURNS TABLE (
  purged_contributors INTEGER,
  purged_embeddings INTEGER,
  purged_insights INTEGER
) AS $$
DECLARE
  cutoff_date TIMESTAMP WITH TIME ZONE;
  contributors_count INTEGER;
  embeddings_count INTEGER;
  insights_count INTEGER;
BEGIN
  -- Calculate cutoff date (30 days ago)
  cutoff_date := NOW() - INTERVAL '30 days';
  
  -- Purge old file contributors
  WITH deleted AS (
    DELETE FROM file_contributors
    WHERE last_commit_at < cutoff_date
    RETURNING 1
  )
  SELECT COUNT(*)::INTEGER INTO contributors_count FROM deleted;
  
  -- Purge old file embeddings
  WITH deleted AS (
    DELETE FROM file_embeddings
    WHERE last_indexed_at < cutoff_date
    RETURNING 1
  )
  SELECT COUNT(*)::INTEGER INTO embeddings_count FROM deleted;
  
  -- Purge old PR insights
  WITH deleted AS (
    DELETE FROM pr_insights
    WHERE generated_at < cutoff_date
    RETURNING 1
  )
  SELECT COUNT(*)::INTEGER INTO insights_count FROM deleted;
  
  -- Log the purge activity
  INSERT INTO data_purge_log (
    purge_date,
    file_contributors_purged,
    file_embeddings_purged,
    pr_insights_purged
  ) VALUES (
    NOW(),
    contributors_count,
    embeddings_count,
    insights_count
  );
  
  RETURN QUERY SELECT contributors_count, embeddings_count, insights_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Create a table to log purge activities
CREATE TABLE IF NOT EXISTS data_purge_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purge_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  file_contributors_purged INTEGER DEFAULT 0,
  file_embeddings_purged INTEGER DEFAULT 0,
  pr_insights_purged INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for purge log
CREATE INDEX idx_data_purge_log_date ON data_purge_log(purge_date DESC);

-- Add RLS for purge log (read-only for authenticated users)
ALTER TABLE data_purge_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read purge logs"
  ON data_purge_log FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage purge logs"
  ON data_purge_log FOR ALL
  USING (auth.role() = 'service_role');

-- Add comment about the purge policy
COMMENT ON FUNCTION purge_old_file_data IS 'Automatically purges file data older than 30 days for privacy compliance';
COMMENT ON TABLE data_purge_log IS 'Tracks data purge activities for compliance auditing';

-- Note: To schedule this function with pg_cron, run the following after enabling the extension:
/*
SELECT cron.schedule(
  'purge-old-file-data',
  '0 2 * * *', -- Daily at 2 AM UTC
  $$SELECT purge_old_file_data();$$
);
*/

-- Create a view to show upcoming data to be purged
CREATE OR REPLACE VIEW upcoming_data_purge AS
SELECT 
  'file_contributors' as table_name,
  COUNT(*) as records_to_purge,
  MIN(purge_after) as earliest_purge_date
FROM file_contributors
WHERE purge_after <= NOW() + INTERVAL '7 days'
UNION ALL
SELECT 
  'file_embeddings' as table_name,
  COUNT(*) as records_to_purge,
  MIN(purge_after) as earliest_purge_date
FROM file_embeddings
WHERE purge_after <= NOW() + INTERVAL '7 days'
UNION ALL
SELECT 
  'pr_insights' as table_name,
  COUNT(*) as records_to_purge,
  MIN(generated_at + INTERVAL '30 days') as earliest_purge_date
FROM pr_insights
WHERE generated_at <= NOW() - INTERVAL '23 days';

-- Grant access to the purge view
GRANT SELECT ON upcoming_data_purge TO authenticated;

COMMENT ON VIEW upcoming_data_purge IS 'Shows data that will be purged in the next 7 days';
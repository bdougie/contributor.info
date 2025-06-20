-- Migration: Setup pg_cron for automated tasks
-- Description: Configures scheduled jobs for GitHub event synchronization and maintenance

-- Enable pg_cron extension (requires superuser privileges)
-- Note: This may need to be enabled via Supabase dashboard if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage on cron schema to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;

-- Create function to invoke Edge Function
CREATE OR REPLACE FUNCTION invoke_edge_function(function_name TEXT, payload JSONB DEFAULT '{}'::jsonb)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  service_role_key TEXT;
  project_url TEXT;
BEGIN
  -- Get the service role key from vault (you'll need to store this)
  -- In production, store these in Supabase Vault
  service_role_key := current_setting('app.service_role_key', true);
  project_url := current_setting('app.supabase_url', true);
  
  -- Use pg_net to call the Edge Function
  SELECT net.http_post(
    url := project_url || '/functions/v1/' || function_name,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || service_role_key,
      'Content-Type', 'application/json'
    ),
    body := payload
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule hourly GitHub sync
SELECT cron.schedule(
  'sync-github-events-hourly',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT invoke_edge_function('github-sync', '{"trigger": "scheduled"}'::jsonb);
  $$
);

-- Schedule daily cleanup of old events (at 2 AM UTC)
SELECT cron.schedule(
  'cleanup-old-events-daily',
  '0 2 * * *', -- Daily at 2:00 AM
  $$
  DELETE FROM github_events_cache 
  WHERE created_at < NOW() - INTERVAL '90 days'
  AND processed = true;
  $$
);

-- Schedule monthly partition creation (on the 25th to prepare for next month)
SELECT cron.schedule(
  'create-monthly-partition',
  '0 0 25 * *', -- Monthly on the 25th at midnight
  $$
  SELECT create_monthly_partition();
  $$
);

-- Schedule daily role confidence decay (to handle inactive maintainers)
SELECT cron.schedule(
  'decay-role-confidence-daily',
  '0 3 * * *', -- Daily at 3:00 AM
  $$
  UPDATE contributor_roles
  SET confidence_score = GREATEST(0.5, confidence_score - 0.01),
      updated_at = NOW()
  WHERE last_verified < NOW() - INTERVAL '30 days'
  AND confidence_score > 0.5;
  $$
);

-- Schedule weekly statistics aggregation
SELECT cron.schedule(
  'aggregate-statistics-weekly',
  '0 0 * * 0', -- Weekly on Sunday at midnight
  $$
  INSERT INTO contributor_role_history (
    contributor_role_id,
    user_id,
    repository_owner,
    repository_name,
    previous_role,
    new_role,
    previous_confidence,
    new_confidence,
    change_reason
  )
  SELECT 
    id,
    user_id,
    repository_owner,
    repository_name,
    role,
    role,
    confidence_score,
    confidence_score,
    'Weekly snapshot'
  FROM contributor_roles
  WHERE updated_at > NOW() - INTERVAL '7 days';
  $$
);

-- Create function to check and create next month's partition
CREATE OR REPLACE FUNCTION ensure_future_partitions()
RETURNS void AS $$
DECLARE
  next_month DATE;
  partition_name TEXT;
BEGIN
  -- Get next month
  next_month := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month');
  partition_name := 'github_events_cache_' || TO_CHAR(next_month, 'YYYY_MM');
  
  -- Check if partition exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = partition_name
  ) THEN
    -- Create partition
    PERFORM create_monthly_partition();
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Schedule partition check daily (as backup to monthly creation)
SELECT cron.schedule(
  'ensure-partitions-daily',
  '0 1 * * *', -- Daily at 1:00 AM
  $$
  SELECT ensure_future_partitions();
  $$
);

-- Create view to monitor cron job status
CREATE OR REPLACE VIEW cron_job_status AS
SELECT 
  jobname,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active
FROM cron.job
ORDER BY jobname;

-- Grant select on the view
GRANT SELECT ON cron_job_status TO authenticated;

-- Comment on scheduled jobs
COMMENT ON FUNCTION invoke_edge_function IS 'Helper function to invoke Supabase Edge Functions from cron jobs';
COMMENT ON VIEW cron_job_status IS 'Monitor status of all scheduled cron jobs';
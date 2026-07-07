-- Migration: GitHub Events Classification System
-- Description: Adds tables for tracking contributor roles and GitHub events with confidence scoring

-- Create contributor_roles table for tracking detected maintainer status
CREATE TABLE IF NOT EXISTS public.contributor_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  repository_owner TEXT NOT NULL,
  repository_name TEXT NOT NULL,
  role TEXT CHECK (role IN ('owner', 'maintainer', 'contributor')) NOT NULL,
  confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  detected_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_verified TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  detection_methods JSONB DEFAULT '[]'::jsonb, -- Array of detection signals used
  permission_events_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, repository_owner, repository_name)
);

-- Create github_events_cache table with partitioning support
CREATE TABLE IF NOT EXISTS public.github_events_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL, -- Format: {event_type}_{github_event_id}
  event_type TEXT NOT NULL,
  actor_login TEXT NOT NULL,
  repository_owner TEXT NOT NULL,
  repository_name TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  is_privileged BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  processing_notes TEXT
) PARTITION BY RANGE (created_at);

-- Create initial monthly partitions
CREATE TABLE IF NOT EXISTS public.github_events_cache_2025_01 
  PARTITION OF public.github_events_cache
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE IF NOT EXISTS public.github_events_cache_2025_02 
  PARTITION OF public.github_events_cache
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

CREATE TABLE IF NOT EXISTS public.github_events_cache_2025_03 
  PARTITION OF public.github_events_cache
  FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_contributor_roles_repo 
  ON public.contributor_roles(repository_owner, repository_name);

CREATE INDEX IF NOT EXISTS idx_contributor_roles_user 
  ON public.contributor_roles(user_id);

CREATE INDEX IF NOT EXISTS idx_contributor_roles_confidence 
  ON public.contributor_roles(confidence_score DESC);

-- Indexes on partitioned table (will apply to all partitions)
CREATE INDEX IF NOT EXISTS idx_events_actor_repo 
  ON public.github_events_cache(actor_login, repository_owner, repository_name);

CREATE INDEX IF NOT EXISTS idx_events_privileged 
  ON public.github_events_cache(is_privileged) 
  WHERE is_privileged = TRUE;

CREATE INDEX IF NOT EXISTS idx_events_processed 
  ON public.github_events_cache(processed) 
  WHERE processed = FALSE;

CREATE INDEX IF NOT EXISTS idx_events_type 
  ON public.github_events_cache(event_type);

-- Create historical tracking table for role changes
CREATE TABLE IF NOT EXISTS public.contributor_role_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contributor_role_id UUID NOT NULL REFERENCES public.contributor_roles(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  repository_owner TEXT NOT NULL,
  repository_name TEXT NOT NULL,
  previous_role TEXT,
  new_role TEXT NOT NULL,
  previous_confidence DECIMAL(3,2),
  new_confidence DECIMAL(3,2) NOT NULL,
  change_reason TEXT,
  detection_methods JSONB DEFAULT '[]'::jsonb,
  changed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_role_history_contributor 
  ON public.contributor_role_history(contributor_role_id);

CREATE INDEX IF NOT EXISTS idx_role_history_time 
  ON public.contributor_role_history(changed_at DESC);

-- Create table for tracking sync status
CREATE TABLE IF NOT EXISTS public.github_sync_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_owner TEXT NOT NULL,
  repository_name TEXT NOT NULL,
  last_sync_at TIMESTAMPTZ,
  last_event_at TIMESTAMPTZ,
  events_processed INT DEFAULT 0,
  sync_status TEXT CHECK (sync_status IN ('pending', 'in_progress', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(repository_owner, repository_name)
);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_contributor_roles_updated_at 
  BEFORE UPDATE ON public.contributor_roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_github_sync_status_updated_at 
  BEFORE UPDATE ON public.github_sync_status
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.contributor_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_events_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contributor_role_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_sync_status ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for public read access
CREATE POLICY "Allow public read access to contributor roles" 
  ON public.contributor_roles FOR SELECT 
  USING (true);

CREATE POLICY "Allow public read access to events cache" 
  ON public.github_events_cache FOR SELECT 
  USING (true);

CREATE POLICY "Allow public read access to role history" 
  ON public.contributor_role_history FOR SELECT 
  USING (true);

CREATE POLICY "Allow public read access to sync status" 
  ON public.github_sync_status FOR SELECT 
  USING (true);

-- Create function to automatically create monthly partitions
CREATE OR REPLACE FUNCTION create_monthly_partition()
RETURNS void AS $$
DECLARE
  partition_date DATE;
  partition_name TEXT;
  start_date DATE;
  end_date DATE;
BEGIN
  -- Calculate next month
  partition_date := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month');
  start_date := partition_date;
  end_date := partition_date + INTERVAL '1 month';
  
  -- Generate partition name
  partition_name := 'github_events_cache_' || TO_CHAR(partition_date, 'YYYY_MM');
  
  -- Check if partition already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = partition_name
  ) THEN
    -- Create the partition
    EXECUTE format(
      'CREATE TABLE public.%I PARTITION OF public.github_events_cache FOR VALUES FROM (%L) TO (%L)',
      partition_name,
      start_date,
      end_date
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Comment on tables and important columns
COMMENT ON TABLE public.contributor_roles IS 'Tracks detected roles and permissions for GitHub contributors with confidence scoring';
COMMENT ON COLUMN public.contributor_roles.confidence_score IS 'Confidence level of role detection (0.0 to 1.0)';
COMMENT ON COLUMN public.contributor_roles.detection_methods IS 'JSON array of detection signals used (e.g., ["merge_event", "push_to_protected", "admin_action"])';

COMMENT ON TABLE public.github_events_cache IS 'Caches GitHub events for processing, partitioned by month for performance';
COMMENT ON COLUMN public.github_events_cache.is_privileged IS 'Whether this event indicates elevated permissions';

COMMENT ON TABLE public.contributor_role_history IS 'Audit trail of all role and confidence changes';
COMMENT ON TABLE public.github_sync_status IS 'Tracks synchronization status for each repository';
-- Local-safe version of 20241225000000_add_share_analytics.sql
-- Generated: 2025-08-27T02:47:08.035Z
-- This migration has been modified to work without auth, roles, and extensions
-- Original migration may have different behavior in production

-- Transaction wrapper for safety
BEGIN;


-- Ensure anon exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon;
    RAISE NOTICE 'Created missing role: anon';
  END IF;
END $$;

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

-- Migration: Add share analytics tracking tables
-- Purpose: Track short URL creation and sharing analytics for charts/metrics

-- Table to track short URL creation events
CREATE TABLE IF NOT EXISTS share_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- User and session info
  user_id TEXT, -- GitHub user ID when available
  session_id TEXT, -- Browser session ID for anonymous tracking
  
  -- URL and sharing info
  original_url TEXT NOT NULL,
  short_url TEXT, -- The generated short URL (dub.co or oss.fyi)
  dub_link_id TEXT, -- ID from dub.co API for analytics
  
  -- Content context
  chart_type TEXT NOT NULL, -- 'treemap', 'donut', 'bar', etc.
  repository TEXT, -- owner/repo format
  page_path TEXT, -- URL path for grouping
  
  -- Event details
  action TEXT NOT NULL, -- 'create', 'share', 'copy', 'download'
  share_type TEXT, -- 'url', 'image', 'native'
  platform TEXT, -- 'web', 'twitter', 'linkedin', etc.
  
  -- Technical details
  domain TEXT, -- 'dub.co' or 'oss.fyi'
  user_agent TEXT,
  referrer TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}', -- Additional context data
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table to track click analytics (when available from dub.co)
CREATE TABLE IF NOT EXISTS share_click_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Link relationship
  share_event_id UUID REFERENCES share_events(id) ON DELETE CASCADE,
  dub_link_id TEXT NOT NULL,
  
  -- Click metrics from dub.co API
  total_clicks INTEGER DEFAULT 0,
  unique_clicks INTEGER DEFAULT 0,
  click_data JSONB DEFAULT '{}', -- Raw analytics from dub.co
  
  -- Aggregation period
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_share_events_user_id ON share_events(user_id);
CREATE INDEX IF NOT EXISTS idx_share_events_chart_type ON share_events(chart_type);
CREATE INDEX IF NOT EXISTS idx_share_events_repository ON share_events(repository);
CREATE INDEX IF NOT EXISTS idx_share_events_action ON share_events(action);
CREATE INDEX IF NOT EXISTS idx_share_events_created_at ON share_events(created_at);
CREATE INDEX IF NOT EXISTS idx_share_events_dub_link_id ON share_events(dub_link_id);

CREATE INDEX IF NOT EXISTS idx_share_click_analytics_dub_link_id ON share_click_analytics(dub_link_id);
CREATE INDEX IF NOT EXISTS idx_share_click_analytics_period ON share_click_analytics(period_start, period_end);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic updated_at
CREATE TRIGGER update_share_events_updated_at 
  BEFORE UPDATE ON share_events 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_share_click_analytics_updated_at 
  BEFORE UPDATE ON share_click_analytics 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View for comprehensive share analytics
CREATE OR REPLACE VIEW share_analytics_summary AS
SELECT 
  se.id,
  se.chart_type,
  se.repository,
  se.action,
  se.share_type,
  se.domain,
  se.short_url,
  se.created_at,
  sca.total_clicks,
  sca.unique_clicks,
  CASE 
    WHEN se.short_url IS NOT NULL THEN TRUE 
    ELSE FALSE 
  END as is_shortened
FROM share_events se
LEFT JOIN share_click_analytics sca ON se.dub_link_id = sca.dub_link_id
ORDER BY se.created_at DESC;

-- RLS Policies
ALTER TABLE share_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_click_analytics ENABLE ROW LEVEL SECURITY;

-- Allow public read access for analytics (aggregated data only)
CREATE POLICY "Allow public read access to share analytics" ON share_events
  FOR SELECT TO PUBLIC
  USING (true);

CREATE POLICY "Allow public read access to click analytics" ON share_click_analytics
  FOR SELECT TO PUBLIC
  USING (true);

-- Allow authenticated users to insert their own share events
CREATE POLICY "Allow authenticated users to insert share events" ON share_events
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Allow service role full access for analytics updates
CREATE POLICY "Allow service role full access to share events" ON share_events
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service role full access to click analytics" ON share_click_analytics
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON share_events TO PUBLIC;
GRANT SELECT ON share_click_analytics TO PUBLIC;
GRANT SELECT ON share_analytics_summary TO PUBLIC;

DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT INSERT ON share_events TO authenticated;
  ELSE
    RAISE NOTICE 'Role authenticated not found, skipping grant';
  END IF;
END $;
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON share_events TO service_role;
  ELSE
    RAISE NOTICE 'Role service_role not found, skipping grant';
  END IF;
END $;
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON share_click_analytics TO service_role;
  ELSE
    RAISE NOTICE 'Role service_role not found, skipping grant';
  END IF;
END $;

-- Add helpful comments
COMMENT ON TABLE share_events IS 'Tracks sharing events for charts and metrics with short URL generation';
COMMENT ON TABLE share_click_analytics IS 'Aggregated click analytics from dub.co API';
COMMENT ON VIEW share_analytics_summary IS 'Comprehensive view of sharing analytics with click data';

COMMENT ON COLUMN share_events.chart_type IS 'Type of chart: treemap, donut, bar, etc.';
COMMENT ON COLUMN share_events.action IS 'User action: create, share, copy, download';
COMMENT ON COLUMN share_events.share_type IS 'Share method: url, image, native';
COMMENT ON COLUMN share_events.domain IS 'Short URL domain: dub.co (dev) or oss.fyi (prod)';

COMMIT;

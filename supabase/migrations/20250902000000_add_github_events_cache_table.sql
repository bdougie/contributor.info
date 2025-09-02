-- GitHub Events Cache Table Migration
-- This migration creates the github_events_cache table for storing GitHub Events API data
-- Used for capturing stars (WatchEvent) and forks (ForkEvent) from repositories

-- Create github_events_cache table
CREATE TABLE github_events_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id TEXT UNIQUE NOT NULL, -- GitHub event ID for deduplication
    event_type TEXT NOT NULL CHECK (event_type IN ('WatchEvent', 'ForkEvent')),
    actor_login TEXT NOT NULL, -- GitHub username of the actor
    repository_owner TEXT NOT NULL,
    repository_name TEXT NOT NULL,
    payload JSONB, -- Full event data from GitHub API
    created_at TIMESTAMPTZ NOT NULL, -- When the event occurred on GitHub
    processed BOOLEAN DEFAULT FALSE, -- Whether this event has been processed
    inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW() -- When we inserted this record
);

-- Indexes for performance
CREATE INDEX idx_github_events_cache_event_id ON github_events_cache(event_id);
CREATE INDEX idx_github_events_cache_event_type ON github_events_cache(event_type);
CREATE INDEX idx_github_events_cache_repository ON github_events_cache(repository_owner, repository_name);
CREATE INDEX idx_github_events_cache_actor ON github_events_cache(actor_login);
CREATE INDEX idx_github_events_cache_created_at ON github_events_cache(created_at DESC);
CREATE INDEX idx_github_events_cache_processed ON github_events_cache(processed) WHERE processed = FALSE;

-- Comments for documentation
COMMENT ON TABLE github_events_cache IS 'Stores GitHub Events API data for stars (WatchEvent) and forks (ForkEvent)';
COMMENT ON COLUMN github_events_cache.event_id IS 'GitHub event ID from Events API - used for deduplication';
COMMENT ON COLUMN github_events_cache.event_type IS 'Type of GitHub event - currently WatchEvent or ForkEvent';
COMMENT ON COLUMN github_events_cache.actor_login IS 'GitHub username of the user who performed the action';
COMMENT ON COLUMN github_events_cache.payload IS 'Full JSON payload from GitHub Events API';
COMMENT ON COLUMN github_events_cache.processed IS 'Flag to track if event has been processed for analytics';
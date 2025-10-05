-- Add webhook priority system to repositories table
-- This enables prioritizing webhook-sourced data over progressive capture

-- Add columns to track webhook status
ALTER TABLE repositories
ADD COLUMN IF NOT EXISTS webhook_priority BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS webhook_enabled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_webhook_event_at TIMESTAMPTZ;

-- Update existing app-enabled repositories to have webhook priority
UPDATE repositories r
SET
  webhook_priority = TRUE,
  webhook_enabled_at = aer.enabled_at
FROM app_enabled_repositories aer
WHERE r.id = aer.repository_id
  AND r.webhook_priority IS FALSE;

-- Add index for efficient queries on webhook-enabled repos
CREATE INDEX IF NOT EXISTS idx_repositories_webhook_priority
ON repositories(webhook_priority)
WHERE webhook_priority = TRUE;

-- Add index for querying by last webhook event time
CREATE INDEX IF NOT EXISTS idx_repositories_last_webhook_event
ON repositories(last_webhook_event_at DESC)
WHERE webhook_priority = TRUE;

-- Add comment explaining the columns
COMMENT ON COLUMN repositories.webhook_priority IS 'TRUE if repository has GitHub App installed and receives webhook updates';
COMMENT ON COLUMN repositories.webhook_enabled_at IS 'Timestamp when webhook priority was enabled (app installation)';
COMMENT ON COLUMN repositories.last_webhook_event_at IS 'Timestamp of most recent webhook event received for this repository';

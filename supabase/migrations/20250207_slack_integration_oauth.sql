-- Migrate Slack integration from webhook-based to OAuth-based
-- This migration updates the schema to support Slack OAuth app installation

-- Step 1: Add new columns for OAuth
ALTER TABLE public.slack_integrations
ADD COLUMN IF NOT EXISTS slack_team_id TEXT,
ADD COLUMN IF NOT EXISTS slack_team_name TEXT,
ADD COLUMN IF NOT EXISTS bot_token_encrypted TEXT,
ADD COLUMN IF NOT EXISTS bot_user_id TEXT,
ADD COLUMN IF NOT EXISTS channel_id TEXT;

-- Step 2: Make webhook_url_encrypted nullable (transitioning away from webhooks)
ALTER TABLE public.slack_integrations
ALTER COLUMN webhook_url_encrypted DROP NOT NULL;

-- Step 3: Update the unique constraint to allow multiple channels per workspace
ALTER TABLE public.slack_integrations
DROP CONSTRAINT IF EXISTS unique_workspace_channel;

-- New constraint: one integration per workspace per Slack team per channel
ALTER TABLE public.slack_integrations
ADD CONSTRAINT unique_workspace_team_channel UNIQUE (workspace_id, slack_team_id, channel_id);

-- Step 4: Add index on slack_team_id for lookups
CREATE INDEX IF NOT EXISTS idx_slack_integrations_team_id ON public.slack_integrations(slack_team_id);

-- Step 5: Add index on channel_id
CREATE INDEX IF NOT EXISTS idx_slack_integrations_channel_id ON public.slack_integrations(channel_id);

-- Step 6: Update comments to reflect OAuth-based approach
COMMENT ON COLUMN public.slack_integrations.bot_token_encrypted IS 'Encrypted Slack bot token (xoxb-*) - decrypt before use';
COMMENT ON COLUMN public.slack_integrations.slack_team_id IS 'Slack workspace/team ID where the app is installed';
COMMENT ON COLUMN public.slack_integrations.slack_team_name IS 'Slack workspace/team name for display';
COMMENT ON COLUMN public.slack_integrations.channel_id IS 'Slack channel ID where reports are posted';
COMMENT ON COLUMN public.slack_integrations.channel_name IS 'Slack channel name for display (e.g., #engineering)';
COMMENT ON COLUMN public.slack_integrations.webhook_url_encrypted IS 'DEPRECATED: Legacy webhook URL - use bot_token_encrypted instead';

-- Step 7: Create a helper function to check if an integration is OAuth-based
CREATE OR REPLACE FUNCTION public.is_oauth_integration(integration public.slack_integrations)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN integration.bot_token_encrypted IS NOT NULL
        AND integration.slack_team_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 8: Add validation to ensure either webhook OR OAuth is configured (not both)
ALTER TABLE public.slack_integrations
ADD CONSTRAINT check_integration_type CHECK (
    (webhook_url_encrypted IS NOT NULL AND bot_token_encrypted IS NULL) OR
    (webhook_url_encrypted IS NULL AND bot_token_encrypted IS NOT NULL)
);

COMMENT ON TABLE public.slack_integrations IS 'Stores Slack integration configurations for workspaces. Supports both legacy webhook-based and modern OAuth-based integrations.';

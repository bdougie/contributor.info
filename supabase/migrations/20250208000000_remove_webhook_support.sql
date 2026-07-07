-- Remove webhook support from Slack integrations
-- This migration removes webhook-related columns since we're fully transitioning to OAuth

-- Step 1: Drop the constraint that enforces either webhook OR OAuth
ALTER TABLE public.slack_integrations
DROP CONSTRAINT IF EXISTS check_integration_type;

-- Step 2: Drop the webhook_url_encrypted column
ALTER TABLE public.slack_integrations
DROP COLUMN IF EXISTS webhook_url_encrypted;

-- Step 3: Make bot_token_encrypted required (NOT NULL)
-- First, delete any integrations that don't have bot_token_encrypted (legacy webhook-only integrations)
DELETE FROM public.slack_integrations
WHERE bot_token_encrypted IS NULL;

ALTER TABLE public.slack_integrations
ALTER COLUMN bot_token_encrypted SET NOT NULL;

-- Step 4: Make slack_team_id required (NOT NULL)
ALTER TABLE public.slack_integrations
ALTER COLUMN slack_team_id SET NOT NULL;

-- Step 5: Update the helper function to always return true (all integrations are OAuth now)
CREATE OR REPLACE FUNCTION public.is_oauth_integration(integration public.slack_integrations)
RETURNS BOOLEAN AS $$
BEGIN
    -- All integrations are OAuth-based now
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 6: Update table comment to reflect OAuth-only approach
COMMENT ON TABLE public.slack_integrations IS 'Stores OAuth-based Slack integration configurations for workspaces. Webhook support has been removed.';

-- Step 7: Remove webhook-related column comments
COMMENT ON COLUMN public.slack_integrations.bot_token_encrypted IS 'Encrypted Slack bot token (xoxb-*) - required for OAuth integrations';
COMMENT ON COLUMN public.slack_integrations.slack_team_id IS 'Slack workspace/team ID where the app is installed - required';
COMMENT ON COLUMN public.slack_integrations.channel_id IS 'Slack channel ID where reports are posted - required after channel selection';
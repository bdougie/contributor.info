-- Migration: Create user_slack_integrations table
-- Purpose: Allow individual users to connect repositories to Slack for monthly leaderboard notifications

-- Create the user_slack_integrations table
CREATE TABLE IF NOT EXISTS public.user_slack_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  repository_id UUID NOT NULL REFERENCES public.repositories(id) ON DELETE CASCADE,
  channel_name TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  slack_team_id TEXT NOT NULL,
  slack_team_name TEXT,
  bot_token_encrypted TEXT NOT NULL,
  bot_user_id TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_repo_channel UNIQUE (user_id, repository_id, channel_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_slack_integrations_user_id
  ON public.user_slack_integrations(user_id);

CREATE INDEX IF NOT EXISTS idx_user_slack_integrations_repository_id
  ON public.user_slack_integrations(repository_id);

CREATE INDEX IF NOT EXISTS idx_user_slack_integrations_enabled
  ON public.user_slack_integrations(enabled)
  WHERE enabled = true;

-- Enable RLS
ALTER TABLE public.user_slack_integrations ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only manage their own integrations

-- SELECT: Users can view their own integrations
CREATE POLICY "Users can view own slack integrations"
  ON public.user_slack_integrations
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: Users can create their own integrations (max 5 per user enforced via trigger)
CREATE POLICY "Users can create own slack integrations"
  ON public.user_slack_integrations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: Users can update their own integrations
CREATE POLICY "Users can update own slack integrations"
  ON public.user_slack_integrations
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: Users can delete their own integrations
CREATE POLICY "Users can delete own slack integrations"
  ON public.user_slack_integrations
  FOR DELETE
  USING (auth.uid() = user_id);

-- Service role policy for cron jobs to read all enabled integrations
CREATE POLICY "Service role can read all integrations"
  ON public.user_slack_integrations
  FOR SELECT
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Function to enforce max 5 integrations per user
CREATE OR REPLACE FUNCTION check_user_slack_integration_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.user_slack_integrations WHERE user_id = NEW.user_id) >= 5 THEN
    RAISE EXCEPTION 'Maximum of 5 Slack integrations per user allowed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to enforce limit on insert
CREATE TRIGGER enforce_user_slack_integration_limit
  BEFORE INSERT ON public.user_slack_integrations
  FOR EACH ROW
  EXECUTE FUNCTION check_user_slack_integration_limit();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_slack_integration_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamp
CREATE TRIGGER update_user_slack_integration_updated_at
  BEFORE UPDATE ON public.user_slack_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_user_slack_integration_timestamp();

-- Create logs table for tracking notification history
CREATE TABLE IF NOT EXISTS public.user_slack_integration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES public.user_slack_integrations(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('success', 'failure', 'pending')),
  message_sent JSONB,
  error_message TEXT,
  metadata JSONB,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying logs by integration
CREATE INDEX IF NOT EXISTS idx_user_slack_integration_logs_integration_id
  ON public.user_slack_integration_logs(integration_id);

CREATE INDEX IF NOT EXISTS idx_user_slack_integration_logs_sent_at
  ON public.user_slack_integration_logs(sent_at DESC);

-- Enable RLS on logs
ALTER TABLE public.user_slack_integration_logs ENABLE ROW LEVEL SECURITY;

-- Users can view logs for their own integrations
CREATE POLICY "Users can view own integration logs"
  ON public.user_slack_integration_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_slack_integrations
      WHERE id = integration_id AND user_id = auth.uid()
    )
  );

-- Service role can insert logs (for cron jobs)
CREATE POLICY "Service role can insert logs"
  ON public.user_slack_integration_logs
  FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_slack_integrations TO authenticated;
GRANT SELECT ON public.user_slack_integration_logs TO authenticated;
GRANT ALL ON public.user_slack_integrations TO service_role;
GRANT ALL ON public.user_slack_integration_logs TO service_role;

-- Add comment for documentation
COMMENT ON TABLE public.user_slack_integrations IS 'Stores user-level Slack integrations for monthly leaderboard notifications per repository';
COMMENT ON TABLE public.user_slack_integration_logs IS 'Audit log of Slack notification sends for user integrations';

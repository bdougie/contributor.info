-- Create slack_integrations table for storing workspace Slack configurations
CREATE TABLE IF NOT EXISTS public.slack_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    channel_name TEXT NOT NULL,
    webhook_url_encrypted TEXT NOT NULL,
    schedule TEXT NOT NULL CHECK (schedule IN ('daily', 'weekly')),
    enabled BOOLEAN NOT NULL DEFAULT true,
    config JSONB NOT NULL DEFAULT '{
        "excludeBots": true,
        "maxAssignees": 10,
        "repositoryIds": []
    }'::jsonb,
    last_sent_at TIMESTAMPTZ,
    next_scheduled_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_workspace_channel UNIQUE (workspace_id, channel_name)
);

-- Create integration_logs table for audit trail
CREATE TABLE IF NOT EXISTS public.integration_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID NOT NULL REFERENCES public.slack_integrations(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('success', 'failure', 'pending')),
    message_sent TEXT,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_slack_integrations_workspace_id ON public.slack_integrations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_slack_integrations_enabled ON public.slack_integrations(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_slack_integrations_next_scheduled ON public.slack_integrations(next_scheduled_at) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_integration_logs_integration_id ON public.integration_logs(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_logs_workspace_id ON public.integration_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_integration_logs_sent_at ON public.integration_logs(sent_at DESC);

-- Enable RLS on both tables
ALTER TABLE public.slack_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for slack_integrations

-- Workspace owners and admins can view integrations
CREATE POLICY "Workspace members can view slack integrations"
    ON public.slack_integrations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = slack_integrations.workspace_id
            AND wm.user_id = auth.uid()
        )
    );

-- Only workspace owners and admins can create integrations
CREATE POLICY "Workspace owners and admins can create slack integrations"
    ON public.slack_integrations
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = slack_integrations.workspace_id
            AND wm.user_id = auth.uid()
            AND wm.role IN ('owner', 'admin')
        )
    );

-- Only workspace owners and admins can update integrations
CREATE POLICY "Workspace owners and admins can update slack integrations"
    ON public.slack_integrations
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = slack_integrations.workspace_id
            AND wm.user_id = auth.uid()
            AND wm.role IN ('owner', 'admin')
        )
    );

-- Only workspace owners and admins can delete integrations
CREATE POLICY "Workspace owners and admins can delete slack integrations"
    ON public.slack_integrations
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = slack_integrations.workspace_id
            AND wm.user_id = auth.uid()
            AND wm.role IN ('owner', 'admin')
        )
    );

-- RLS Policies for integration_logs

-- Workspace members can view logs for their workspace
CREATE POLICY "Workspace members can view integration logs"
    ON public.integration_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = integration_logs.workspace_id
            AND wm.user_id = auth.uid()
        )
    );

-- System can insert logs (no user authentication required for background jobs)
CREATE POLICY "System can insert integration logs"
    ON public.integration_logs
    FOR INSERT
    WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_slack_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_slack_integrations_updated_at
    BEFORE UPDATE ON public.slack_integrations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_slack_integrations_updated_at();

-- Function to calculate next scheduled time based on schedule type
CREATE OR REPLACE FUNCTION public.calculate_next_slack_scheduled_at(
    p_schedule TEXT,
    p_from_time TIMESTAMPTZ DEFAULT now()
)
RETURNS TIMESTAMPTZ AS $$
BEGIN
    CASE p_schedule
        WHEN 'daily' THEN
            RETURN (p_from_time + INTERVAL '1 day')::date + TIME '09:00:00';
        WHEN 'weekly' THEN
            -- Schedule for next Monday at 9 AM
            RETURN (p_from_time + INTERVAL '1 week' - INTERVAL '1 day' * EXTRACT(DOW FROM p_from_time)::int + INTERVAL '1 day')::date + TIME '09:00:00';
        ELSE
            RETURN p_from_time + INTERVAL '1 day';
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to set next_scheduled_at on insert or when schedule changes
CREATE OR REPLACE FUNCTION public.set_next_scheduled_at()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (OLD.schedule IS DISTINCT FROM NEW.schedule OR OLD.enabled IS DISTINCT FROM NEW.enabled)) THEN
        IF NEW.enabled THEN
            NEW.next_scheduled_at = public.calculate_next_slack_scheduled_at(NEW.schedule);
        ELSE
            NEW.next_scheduled_at = NULL;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_next_scheduled_at_trigger
    BEFORE INSERT OR UPDATE ON public.slack_integrations
    FOR EACH ROW
    EXECUTE FUNCTION public.set_next_scheduled_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.slack_integrations TO authenticated;
GRANT SELECT, INSERT ON public.integration_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.slack_integrations TO service_role;
GRANT SELECT, INSERT ON public.integration_logs TO service_role;

-- Add comment for documentation
COMMENT ON TABLE public.slack_integrations IS 'Stores Slack integration configurations for workspaces';
COMMENT ON TABLE public.integration_logs IS 'Audit trail for Slack message sends and integration activities';
COMMENT ON COLUMN public.slack_integrations.webhook_url_encrypted IS 'Encrypted Slack webhook URL - decrypt before use';
COMMENT ON COLUMN public.slack_integrations.config IS 'JSON configuration: excludeBots, maxAssignees, repositoryIds';

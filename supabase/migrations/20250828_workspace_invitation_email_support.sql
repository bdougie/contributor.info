-- =====================================================
-- WORKSPACE INVITATION EMAIL SUPPORT
-- =====================================================
-- This migration adds support for workspace invitation emails,
-- including activity logging and GDPR compliance tracking.

-- Update email_logs table to include workspace_invitation email type
ALTER TABLE email_logs 
DROP CONSTRAINT IF EXISTS email_logs_email_type_check;

ALTER TABLE email_logs 
ADD CONSTRAINT email_logs_email_type_check 
CHECK (email_type IN ('welcome', 'notification', 'marketing', 'transactional', 'workspace_invitation'));

-- Add legal_basis and gdpr_log_id columns if they don't exist
ALTER TABLE email_logs 
ADD COLUMN IF NOT EXISTS legal_basis text CHECK (legal_basis IN ('consent', 'contract', 'legitimate_interest', 'legal_obligation'));

ALTER TABLE email_logs 
ADD COLUMN IF NOT EXISTS gdpr_log_id uuid;

-- Create workspace activity log table for audit trail
CREATE TABLE IF NOT EXISTS workspace_activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID, -- Can be NULL for anonymous actions like declining invitations
    action TEXT NOT NULL CHECK (action IN (
        'workspace_created',
        'workspace_updated',
        'workspace_deleted',
        'member_invited',
        'member_joined',
        'member_removed',
        'member_role_changed',
        'invitation_sent',
        'invitation_accepted',
        'invitation_declined',
        'invitation_cancelled',
        'repository_added',
        'repository_removed',
        'settings_updated'
    )),
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_workspace_activity_workspace ON workspace_activity_log(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_activity_user ON workspace_activity_log(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workspace_activity_action ON workspace_activity_log(action);
CREATE INDEX IF NOT EXISTS idx_workspace_activity_created ON workspace_activity_log(created_at DESC);

-- Create GDPR processing log table for compliance tracking
CREATE TABLE IF NOT EXISTS gdpr_processing_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID, -- Can be NULL for system-level processing
    purpose TEXT NOT NULL,
    legal_basis TEXT NOT NULL CHECK (legal_basis IN ('consent', 'contract', 'legitimate_interest', 'legal_obligation', 'vital_interests', 'public_task')),
    data_categories TEXT[] NOT NULL,
    processing_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processing_completed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for GDPR log
CREATE INDEX IF NOT EXISTS idx_gdpr_log_user ON gdpr_processing_log(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gdpr_log_purpose ON gdpr_processing_log(purpose);
CREATE INDEX IF NOT EXISTS idx_gdpr_log_created ON gdpr_processing_log(created_at DESC);

-- Create function to log GDPR processing activity
CREATE OR REPLACE FUNCTION log_gdpr_processing(
    p_user_id UUID,
    p_purpose TEXT,
    p_legal_basis TEXT,
    p_data_categories TEXT[],
    p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO gdpr_processing_log (
        user_id,
        purpose,
        legal_basis,
        data_categories,
        notes
    ) VALUES (
        p_user_id,
        p_purpose,
        p_legal_basis,
        p_data_categories,
        p_notes
    ) RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update workspace_invitations table to add metadata column if it doesn't exist
ALTER TABLE workspace_invitations 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add status column to workspace_invitations if it doesn't exist
ALTER TABLE workspace_invitations 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending' 
CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled'));

-- Add index for status
CREATE INDEX IF NOT EXISTS idx_invitations_status ON workspace_invitations(status);

-- Function to automatically expire old invitations
CREATE OR REPLACE FUNCTION expire_old_invitations() RETURNS void AS $$
BEGIN
    UPDATE workspace_invitations
    SET 
        status = 'expired',
        metadata = metadata || jsonb_build_object('expired_at', NOW())
    WHERE 
        status = 'pending' 
        AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a scheduled job to expire invitations (requires pg_cron extension)
-- This should be run daily
-- Note: pg_cron setup is done separately in production
-- SELECT cron.schedule('expire-invitations', '0 0 * * *', 'SELECT expire_old_invitations();');

-- Grant necessary permissions
GRANT SELECT, INSERT ON workspace_activity_log TO authenticated;
GRANT SELECT, INSERT, UPDATE ON gdpr_processing_log TO authenticated;

-- RLS Policies for new tables
ALTER TABLE workspace_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE gdpr_processing_log ENABLE ROW LEVEL SECURITY;

-- Workspace activity log policies
CREATE POLICY "Users can view activity for their workspaces"
    ON workspace_activity_log FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM workspace_members
            WHERE workspace_members.workspace_id = workspace_activity_log.workspace_id
            AND workspace_members.user_id = auth.uid()
            AND workspace_members.accepted_at IS NOT NULL
        ) OR
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = workspace_activity_log.workspace_id
            AND workspaces.owner_id = auth.uid()
        )
    );

-- Service role can insert activity logs
CREATE POLICY "Service role can insert activity logs"
    ON workspace_activity_log FOR INSERT
    WITH CHECK (true);

-- GDPR log policies (restricted to service role and the user themselves)
CREATE POLICY "Users can view their own GDPR logs"
    ON gdpr_processing_log FOR SELECT
    USING (user_id = auth.uid());

-- Service role can manage GDPR logs
CREATE POLICY "Service role can manage GDPR logs"
    ON gdpr_processing_log FOR ALL
    USING (true)
    WITH CHECK (true);

-- Add comments for documentation
COMMENT ON TABLE workspace_activity_log IS 'Audit log for all workspace-related activities';
COMMENT ON TABLE gdpr_processing_log IS 'GDPR compliance tracking for data processing activities';
COMMENT ON COLUMN workspace_invitations.metadata IS 'Flexible JSON storage for invitation-related metadata like email send status';
COMMENT ON COLUMN workspace_invitations.status IS 'Current status of the invitation: pending, accepted, declined, expired, or cancelled';
COMMENT ON FUNCTION log_gdpr_processing IS 'Helper function to log GDPR processing activities for compliance';
COMMENT ON FUNCTION expire_old_invitations IS 'Automatically expire invitations that have passed their expiry date';
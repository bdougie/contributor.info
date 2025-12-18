-- Migration: Fix Invitation RPC Issues
-- Description: Fixes critical issues in the workspace invitation RPC functions:
-- 1. Creates workspace_activity_log table if it doesn't exist (allows NULL user_id)
-- 2. Grants execute permissions to anon role for unauthenticated users
-- 3. Improves error handling with distinct error codes

-- 1. Create workspace_activity_log table if it doesn't exist
-- user_id is nullable to support system-generated actions like anonymous invitation declines
CREATE TABLE IF NOT EXISTS workspace_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID, -- NULL for system-generated actions
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_activity_log_workspace ON workspace_activity_log(workspace_id, created_at DESC);

-- Enable RLS on activity log
ALTER TABLE workspace_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for workspace_activity_log
DO $$
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "workspace_activity_log_select_policy" ON workspace_activity_log;
  DROP POLICY IF EXISTS "workspace_activity_log_insert_policy" ON workspace_activity_log;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

CREATE POLICY "workspace_activity_log_select_policy" ON workspace_activity_log
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_activity_log_insert_policy" ON workspace_activity_log
  FOR INSERT WITH CHECK (true);  -- Allow inserts from RPCs using SECURITY DEFINER

-- Add comment explaining the NULL case
COMMENT ON COLUMN workspace_activity_log.user_id IS
  'The user who performed the action. NULL for system-generated actions like anonymous invitation declines.';

-- 2. Grant execute permissions to anon role for unauthenticated users
-- Users may need to view/decline invitations before signing in
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT EXECUTE ON FUNCTION get_workspace_invitation_by_token(UUID) TO anon;
    GRANT EXECUTE ON FUNCTION decline_workspace_invitation(UUID) TO anon;
    RAISE NOTICE 'Granted execute permissions to anon role';
  END IF;
END $$;

-- 3. Update decline_workspace_invitation to include expired status handling
CREATE OR REPLACE FUNCTION decline_workspace_invitation(
  p_invitation_token UUID
)
RETURNS TABLE (
  success BOOLEAN,
  error_message TEXT,
  error_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation_id UUID;
  v_workspace_id UUID;
  v_status TEXT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Lock the invitation row
  SELECT id, workspace_id, status, expires_at
  INTO v_invitation_id, v_workspace_id, v_status, v_expires_at
  FROM workspace_invitations
  WHERE invitation_token = p_invitation_token
  FOR UPDATE;

  IF v_invitation_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Invitation not found'::TEXT, 'NOT_FOUND'::TEXT;
    RETURN;
  END IF;

  -- Check if already expired by date
  IF v_expires_at < NOW() AND v_status = 'pending' THEN
    -- Update status to expired
    UPDATE workspace_invitations
    SET status = 'expired'
    WHERE id = v_invitation_id;

    RETURN QUERY SELECT FALSE, 'Invitation has expired'::TEXT, 'EXPIRED'::TEXT;
    RETURN;
  END IF;

  IF v_status = 'expired' THEN
    RETURN QUERY SELECT FALSE, 'Invitation has expired'::TEXT, 'EXPIRED'::TEXT;
    RETURN;
  END IF;

  IF v_status != 'pending' THEN
    RETURN QUERY SELECT FALSE, ('Invitation has already been ' || v_status)::TEXT, 'ALREADY_PROCESSED'::TEXT;
    RETURN;
  END IF;

  UPDATE workspace_invitations
  SET
    status = 'declined',
    rejected_at = NOW()
  WHERE id = v_invitation_id;

  -- Log activity (user_id can be NULL for anonymous declines)
  INSERT INTO workspace_activity_log (
    workspace_id,
    user_id,
    action,
    details
  ) VALUES (
    v_workspace_id,
    NULL, -- Anonymous/System action
    'invitation_declined',
    jsonb_build_object('invitation_id', v_invitation_id)
  );

  RETURN QUERY SELECT TRUE, NULL::TEXT, NULL::TEXT;
END;
$$;

-- Update comment
COMMENT ON FUNCTION decline_workspace_invitation IS
  'Securely declines an invitation by token, bypassing RLS. Returns success status, error message, and error code.';

-- Migration: Validate Invitation RPC
-- Description: Creates secure RPC functions to validate and decline invitation tokens bypassing RLS
-- This fixes the issue where users cannot see/act on the invitation if their
-- email doesn't match or if RLS is too restrictive.

-- Check for auth schema
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    RAISE NOTICE 'Auth schema not found. Skipping auth-dependent sections.';
  END IF;
END $$;

-- Create the get_workspace_invitation_by_token function
CREATE OR REPLACE FUNCTION get_workspace_invitation_by_token(
  p_invitation_token UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation JSONB;
BEGIN
  SELECT to_jsonb(t) INTO v_invitation
  FROM (
    SELECT
      i.id,
      i.workspace_id,
      i.email,
      i.role,
      i.invited_by,
      i.invited_at,
      i.expires_at,
      i.status,
      jsonb_build_object(
        'id', w.id,
        'name', w.name,
        'slug', w.slug,
        'description', w.description,
        'created_at', w.created_at,
        'status', w.status,
        'member_count', w.member_count,
        'repository_count', w.repository_count,
        'owner_id', w.owner_id
      ) as workspace
    FROM workspace_invitations i
    JOIN workspaces w ON w.id = i.workspace_id
    WHERE i.invitation_token = p_invitation_token
  ) t;

  RETURN v_invitation;
END;
$$;

-- Create decline_workspace_invitation function
CREATE OR REPLACE FUNCTION decline_workspace_invitation(
  p_invitation_token UUID
)
RETURNS TABLE (
  success BOOLEAN,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation_id UUID;
  v_workspace_id UUID;
  v_status TEXT;
BEGIN
  -- Lock the invitation row
  SELECT id, workspace_id, status INTO v_invitation_id, v_workspace_id, v_status
  FROM workspace_invitations
  WHERE invitation_token = p_invitation_token
  FOR UPDATE;

  IF v_invitation_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Invitation not found'::TEXT;
    RETURN;
  END IF;

  IF v_status != 'pending' THEN
    RETURN QUERY SELECT FALSE, ('Invitation has already been ' || v_status)::TEXT;
    RETURN;
  END IF;

  UPDATE workspace_invitations
  SET
    status = 'declined',
    rejected_at = NOW()
  WHERE id = v_invitation_id;

  -- Log activity
  INSERT INTO workspace_activity_log (
    workspace_id,
    user_id,
    action,
    details
  ) VALUES (
    v_workspace_id,
    NULL, -- Anonymous/System
    'invitation_declined',
    jsonb_build_object('invitation_id', v_invitation_id)
  );

  RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$;

-- Grant execute permission to authenticated users
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION get_workspace_invitation_by_token(UUID) TO authenticated;
    GRANT EXECUTE ON FUNCTION decline_workspace_invitation(UUID) TO authenticated;
  END IF;
END $$;

-- Add comments
COMMENT ON FUNCTION get_workspace_invitation_by_token IS
  'Securely retrieves invitation details by token, bypassing RLS to allow users to validate invitations sent to different emails.';

COMMENT ON FUNCTION decline_workspace_invitation IS
  'Securely declines an invitation by token, bypassing RLS.';

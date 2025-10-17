-- Migration: Atomic Accept Invitation
-- Description: Creates an atomic RPC function to handle invitation acceptance without race conditions
-- Author: Claude Code
-- Date: 2025-10-16

-- Create the atomic accept_workspace_invitation function
CREATE OR REPLACE FUNCTION accept_workspace_invitation(
  p_invitation_token UUID,
  p_user_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  error_code TEXT,
  error_message TEXT,
  workspace_id UUID,
  member_role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation_id UUID;
  v_workspace_id UUID;
  v_invitation_email TEXT;
  v_invitation_role TEXT;
  v_invitation_status TEXT;
  v_invitation_expires_at TIMESTAMPTZ;
  v_existing_member_id UUID;
BEGIN
  -- Start transaction (implicit in function)
  -- Lock the invitation row to prevent concurrent processing
  SELECT
    id,
    workspace_id,
    email,
    role,
    status,
    expires_at
  INTO
    v_invitation_id,
    v_workspace_id,
    v_invitation_email,
    v_invitation_role,
    v_invitation_status,
    v_invitation_expires_at
  FROM workspace_invitations
  WHERE invitation_token = p_invitation_token
  FOR UPDATE; -- Critical: locks the row for the duration of the transaction

  -- Check if invitation exists
  IF v_invitation_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'NOT_FOUND', 'Invalid invitation', NULL::UUID, NULL::TEXT;
    RETURN;
  END IF;

  -- Check if invitation has expired
  IF NOW() > v_invitation_expires_at THEN
    -- Update status to expired
    UPDATE workspace_invitations
    SET status = 'expired'
    WHERE id = v_invitation_id;

    RETURN QUERY SELECT FALSE, 'EXPIRED', 'Invitation has expired', NULL::UUID, NULL::TEXT;
    RETURN;
  END IF;

  -- Check if invitation is pending
  IF v_invitation_status != 'pending' THEN
    RETURN QUERY SELECT FALSE, 'ALREADY_PROCESSED',
      'Invitation has already been ' || v_invitation_status,
      NULL::UUID, NULL::TEXT;
    RETURN;
  END IF;

  -- Check if user is already a member (with lock to prevent race condition)
  SELECT id INTO v_existing_member_id
  FROM workspace_members
  WHERE workspace_id = v_workspace_id
    AND user_id = p_user_id
  FOR UPDATE; -- Lock to prevent concurrent inserts

  IF v_existing_member_id IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, 'ALREADY_MEMBER',
      'You are already a member of this workspace',
      NULL::UUID, NULL::TEXT;
    RETURN;
  END IF;

  -- All checks passed - perform atomic operations

  -- 1. Insert member (will fail with unique constraint if concurrent insert somehow occurs)
  BEGIN
    INSERT INTO workspace_members (
      workspace_id,
      user_id,
      role,
      joined_at,
      accepted_at
    ) VALUES (
      v_workspace_id,
      p_user_id,
      v_invitation_role,
      NOW(),
      NOW()
    );
  EXCEPTION
    WHEN unique_violation THEN
      RETURN QUERY SELECT FALSE, 'ALREADY_MEMBER',
        'You are already a member of this workspace',
        NULL::UUID, NULL::TEXT;
      RETURN;
  END;

  -- 2. Update invitation status
  UPDATE workspace_invitations
  SET
    status = 'accepted',
    accepted_at = NOW()
  WHERE id = v_invitation_id;

  -- 3. Log activity
  INSERT INTO workspace_activity_log (
    workspace_id,
    user_id,
    action,
    details
  ) VALUES (
    v_workspace_id,
    p_user_id,
    'invitation_accepted',
    jsonb_build_object('invitation_id', v_invitation_id)
  );

  -- Return success
  RETURN QUERY SELECT TRUE, NULL::TEXT, NULL::TEXT, v_workspace_id, v_invitation_role;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION accept_workspace_invitation(UUID, UUID) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION accept_workspace_invitation IS
  'Atomically accepts a workspace invitation. Handles all validation, checks, and member insertion in a single transaction to prevent race conditions.';

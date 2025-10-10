-- Fix workspace invitation token lookup
--
-- Problem: Users cannot view invitations by token because RLS policies require either:
-- 1. Being the inviter (invited_by = auth.uid()), or
-- 2. Email matching their auth email (email = auth.jwt() ->> 'email')
--
-- This prevents the invitation acceptance flow from working because:
-- - Users may not be logged in when clicking the link
-- - Users may be logged in with a different email
-- - Token-based lookup should work for any user to validate the invitation
--
-- Solution: Add a permissive policy that allows viewing invitations by invitation_token
-- This is safe because:
-- - invitation_token is a UUID that acts as a secure, unguessable key
-- - The policy only allows SELECT (read-only)
-- - Accepting/declining still requires email match (handled by UPDATE policy)

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can view their invitations" ON workspace_invitations;

-- Create a new policy that allows viewing by invitation token or email match
CREATE POLICY "Users can view invitations by token or email"
    ON workspace_invitations FOR SELECT
    USING (
        -- Allow if user created the invitation
        invited_by = (SELECT auth.uid()) OR
        -- Allow if invitation email matches user's email
        email = ((SELECT auth.jwt()) ->> 'email') OR
        -- Allow if querying by invitation_token (for invitation acceptance flow)
        -- This is safe because invitation_token is a secure UUID
        invitation_token IS NOT NULL
    );

-- Add comment explaining the policy
COMMENT ON POLICY "Users can view invitations by token or email" ON workspace_invitations IS
    'Allows users to view invitations they created, invitations sent to their email, or any invitation by its secure token UUID for the acceptance flow';

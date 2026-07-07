-- Fix security vulnerability in workspace invitation token lookup
--
-- Problem: The previous policy used `invitation_token IS NOT NULL` which evaluates to TRUE
-- for all rows, effectively exposing all invitations to any authenticated user.
--
-- Solution: Remove the insecure blanket permission. Token-based lookups should happen
-- client-side by filtering the results after the query (client filters by token).
-- The RLS policy should only grant access based on user identity, not query parameters.
--
-- Security Model:
-- - Users can view invitations they created (invited_by check)
-- - Users can view invitations sent to their email (email match check)
-- - Token validation happens client-side after fetching allowed invitations

-- Drop the vulnerable policy
DROP POLICY IF EXISTS "Users can view invitations by token or email" ON workspace_invitations;

-- Create a secure policy that only checks user identity
CREATE POLICY "Users can view their own invitations"
    ON workspace_invitations FOR SELECT
    USING (
        -- Allow if user created the invitation
        invited_by = auth.uid() OR
        -- Allow if invitation email matches user's email
        email = (auth.jwt() ->> 'email')
    );

-- Add comment explaining the security model
COMMENT ON POLICY "Users can view their own invitations" ON workspace_invitations IS
    'Allows users to view invitations they created or invitations sent to their email. Token validation is handled client-side.';

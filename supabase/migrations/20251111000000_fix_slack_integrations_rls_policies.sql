-- Fix RLS policies to properly join through app_users table
-- The issue: RLS policies check auth.uid() = workspace_members.user_id
-- But workspace_members.user_id references app_users.id, not auth.users.id
-- We need to join through app_users to match auth.uid() with app_users.auth_user_id

-- Drop all existing RLS policies
DROP POLICY IF EXISTS "Workspace members can view slack integrations" ON slack_integrations;
DROP POLICY IF EXISTS "Workspace owners and admins can create slack integrations" ON slack_integrations;
DROP POLICY IF EXISTS "Workspace owners and admins can update slack integrations" ON slack_integrations;
DROP POLICY IF EXISTS "Workspace owners and admins can delete slack integrations" ON slack_integrations;

-- Recreate policies with correct joins through app_users
CREATE POLICY "Workspace members can view slack integrations"
ON slack_integrations FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM workspace_members wm
    JOIN app_users au ON au.id = wm.user_id
    WHERE wm.workspace_id = slack_integrations.workspace_id
      AND au.auth_user_id = auth.uid()
  )
);

CREATE POLICY "Workspace owners and admins can create slack integrations"
ON slack_integrations FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM workspace_members wm
    JOIN app_users au ON au.id = wm.user_id
    WHERE wm.workspace_id = slack_integrations.workspace_id
      AND au.auth_user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Workspace owners and admins can update slack integrations"
ON slack_integrations FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1
    FROM workspace_members wm
    JOIN app_users au ON au.id = wm.user_id
    WHERE wm.workspace_id = slack_integrations.workspace_id
      AND au.auth_user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Workspace owners and admins can delete slack integrations"
ON slack_integrations FOR DELETE
TO public
USING (
  EXISTS (
    SELECT 1
    FROM workspace_members wm
    JOIN app_users au ON au.id = wm.user_id
    WHERE wm.workspace_id = slack_integrations.workspace_id
      AND au.auth_user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
  )
);

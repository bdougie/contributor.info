-- Local-safe version of 20250124_workspace_contributors.sql
-- Generated: 2025-08-27T02:47:08.045Z
-- This migration has been modified to work without auth, roles, and extensions
-- Original migration may have different behavior in production

-- Transaction wrapper for safety
BEGIN;


-- Ensure anon exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon;
    RAISE NOTICE 'Created missing role: anon';
  END IF;
END $$;

-- Ensure authenticated exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated;
    RAISE NOTICE 'Created missing role: authenticated';
  END IF;
END $$;

-- This migration requires auth schema
DO $$
BEGIN
  -- Check if auth schema and functions exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    RAISE NOTICE 'Auth schema not found. Skipping 20250124_workspace_contributors.sql';
    RETURN;
  END IF;
  
  -- Check for auth.uid() function
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'auth' AND p.proname = 'uid'
  ) THEN
    RAISE NOTICE 'Auth functions not available. Skipping 20250124_workspace_contributors.sql';
    RETURN;
  END IF;
END $$;

-- Original migration content (only runs if auth is available)
-- Create workspace_contributors table to track which contributors are added to each workspace
CREATE TABLE IF NOT EXISTS workspace_contributors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  contributor_id UUID NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure a contributor can only be added once per workspace
  UNIQUE(workspace_id, contributor_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_workspace_contributors_workspace_id ON workspace_contributors(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_contributors_contributor_id ON workspace_contributors(contributor_id);
CREATE INDEX IF NOT EXISTS idx_workspace_contributors_added_by ON workspace_contributors(added_by);

-- RLS policies
ALTER TABLE workspace_contributors ENABLE ROW LEVEL SECURITY;

-- Allow users to view contributors in workspaces they can access
CREATE POLICY "Users can view workspace contributors"
  ON workspace_contributors
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspaces 
      WHERE workspaces.id = workspace_contributors.workspace_id
      AND (
        workspaces.visibility = 'public' 
        OR workspaces.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM workspace_members 
          WHERE workspace_members.workspace_id = workspaces.id 
          AND workspace_members.user_id = auth.uid()
        )
      )
    )
  );

-- Allow workspace owners and admins to add contributors
CREATE POLICY "Workspace owners and admins can add contributors"
  ON workspace_contributors
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspaces 
      WHERE workspaces.id = workspace_contributors.workspace_id
      AND (
        workspaces.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM workspace_members 
          WHERE workspace_members.workspace_id = workspaces.id 
          AND workspace_members.user_id = auth.uid()
          AND workspace_members.role IN ('admin', 'owner')
        )
      )
    )
  );

-- Allow workspace owners and admins to remove contributors
CREATE POLICY "Workspace owners and admins can remove contributors"
  ON workspace_contributors
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workspaces 
      WHERE workspaces.id = workspace_contributors.workspace_id
      AND (
        workspaces.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM workspace_members 
          WHERE workspace_members.workspace_id = workspaces.id 
          AND workspace_members.user_id = auth.uid()
          AND workspace_members.role IN ('admin', 'owner')
        )
      )
    )
  );

-- DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    Grant permissions
GRANT ALL ON workspace_contributors TO authenticated;
  ELSE
    RAISE NOTICE 'Role authenticated not found, skipping grant';
  END IF;
END $;
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT ON workspace_contributors TO anon;
  ELSE
    RAISE NOTICE 'Role anon not found, skipping grant';
  END IF;
END $;

COMMIT;

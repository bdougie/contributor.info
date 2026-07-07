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
CREATE INDEX idx_workspace_contributors_workspace_id ON workspace_contributors(workspace_id);
CREATE INDEX idx_workspace_contributors_contributor_id ON workspace_contributors(contributor_id);
CREATE INDEX idx_workspace_contributors_added_by ON workspace_contributors(added_by);

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

-- Grant permissions
GRANT ALL ON workspace_contributors TO authenticated;
GRANT SELECT ON workspace_contributors TO anon;
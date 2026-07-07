-- Migration: Contributor CRM System Tables
-- Description: Add tables for contributor groups, group members, and notes
-- Date: 2025-09-26

-- Create contributor_groups table
CREATE TABLE IF NOT EXISTS public.contributor_groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(20) DEFAULT 'gray',
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Ensure unique group names within a workspace
    UNIQUE(workspace_id, name)
);

-- Create index for workspace queries
CREATE INDEX IF NOT EXISTS idx_contributor_groups_workspace ON contributor_groups(workspace_id);
CREATE INDEX IF NOT EXISTS idx_contributor_groups_system ON contributor_groups(is_system);

-- Create contributor_group_members table
CREATE TABLE IF NOT EXISTS public.contributor_group_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID NOT NULL REFERENCES contributor_groups(id) ON DELETE CASCADE,
    contributor_username VARCHAR(255) NOT NULL,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Ensure a contributor can only be in a group once
    UNIQUE(group_id, contributor_username)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_group_members_group ON contributor_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_contributor ON contributor_group_members(contributor_username);
CREATE INDEX IF NOT EXISTS idx_group_members_workspace ON contributor_group_members(workspace_id);

-- Create contributor_notes table
CREATE TABLE IF NOT EXISTS public.contributor_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    contributor_username VARCHAR(255) NOT NULL,
    note_content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Ensure one note per contributor per workspace
    UNIQUE(workspace_id, contributor_username)
);

-- Create indexes for contributor notes
CREATE INDEX IF NOT EXISTS idx_contributor_notes_workspace ON contributor_notes(workspace_id);
CREATE INDEX IF NOT EXISTS idx_contributor_notes_contributor ON contributor_notes(contributor_username);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at columns
DROP TRIGGER IF EXISTS update_contributor_groups_updated_at ON contributor_groups;
CREATE TRIGGER update_contributor_groups_updated_at
    BEFORE UPDATE ON contributor_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_contributor_notes_updated_at ON contributor_notes;
CREATE TRIGGER update_contributor_notes_updated_at
    BEFORE UPDATE ON contributor_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to create default groups for a workspace
CREATE OR REPLACE FUNCTION create_default_contributor_groups()
RETURNS TRIGGER AS $$
BEGIN
    -- Create default system groups for the new workspace
    INSERT INTO contributor_groups (workspace_id, name, description, color, is_system, created_by)
    VALUES
        (NEW.id, 'VIP Contributors', 'High-value contributors with significant impact', 'gold', TRUE, NEW.owner_id),
        (NEW.id, 'Internal', 'Internal team members and maintainers', 'blue', TRUE, NEW.owner_id),
        (NEW.id, 'New Contributors', 'First-time or recent contributors', 'green', TRUE, NEW.owner_id)
    ON CONFLICT (workspace_id, name) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to create default groups when a workspace is created
DROP TRIGGER IF EXISTS create_workspace_default_groups ON workspaces;
CREATE TRIGGER create_workspace_default_groups
    AFTER INSERT ON workspaces
    FOR EACH ROW
    EXECUTE FUNCTION create_default_contributor_groups();

-- Add RLS policies for contributor_groups
ALTER TABLE contributor_groups ENABLE ROW LEVEL SECURITY;

-- Allow users to view groups in their workspaces
CREATE POLICY "Users can view groups in their workspaces" ON contributor_groups
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- Allow users to create groups in their workspaces
CREATE POLICY "Users can create groups in their workspaces" ON contributor_groups
    FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- Allow users to update non-system groups in their workspaces
CREATE POLICY "Users can update non-system groups in their workspaces" ON contributor_groups
    FOR UPDATE
    USING (
        is_system = FALSE AND
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- Allow users to delete non-system groups in their workspaces
CREATE POLICY "Users can delete non-system groups in their workspaces" ON contributor_groups
    FOR DELETE
    USING (
        is_system = FALSE AND
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- Add RLS policies for contributor_group_members
ALTER TABLE contributor_group_members ENABLE ROW LEVEL SECURITY;

-- Allow users to view group members in their workspaces
CREATE POLICY "Users can view group members in their workspaces" ON contributor_group_members
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- Allow users to add group members in their workspaces
CREATE POLICY "Users can add group members in their workspaces" ON contributor_group_members
    FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- Allow users to remove group members in their workspaces
CREATE POLICY "Users can remove group members in their workspaces" ON contributor_group_members
    FOR DELETE
    USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- Add RLS policies for contributor_notes
ALTER TABLE contributor_notes ENABLE ROW LEVEL SECURITY;

-- Allow users to view notes in their workspaces
CREATE POLICY "Users can view notes in their workspaces" ON contributor_notes
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- Allow users to create notes in their workspaces
CREATE POLICY "Users can create notes in their workspaces" ON contributor_notes
    FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- Allow users to update notes in their workspaces
CREATE POLICY "Users can update notes in their workspaces" ON contributor_notes
    FOR UPDATE
    USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- Allow users to delete notes in their workspaces
CREATE POLICY "Users can delete notes in their workspaces" ON contributor_notes
    FOR DELETE
    USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_contributor_groups_workspace_name ON contributor_groups(workspace_id, name);
CREATE INDEX IF NOT EXISTS idx_contributor_group_members_group_contributor ON contributor_group_members(group_id, contributor_username);
CREATE INDEX IF NOT EXISTS idx_contributor_notes_workspace_contributor ON contributor_notes(workspace_id, contributor_username);
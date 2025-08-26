-- Fix for issue #538: Workspace owners cannot add repositories
-- This migration ensures workspace owners are automatically added as members
-- and fixes the RLS policy for workspace_repositories

-- ROLLBACK COMMANDS (if needed):
-- DROP TRIGGER IF EXISTS add_workspace_owner_as_member ON workspaces;
-- DROP FUNCTION IF EXISTS add_owner_as_workspace_member() CASCADE;
-- DROP FUNCTION IF EXISTS has_workspace_edit_permission(UUID) CASCADE;
-- DELETE FROM workspace_members WHERE role = 'owner' AND user_id IN (SELECT owner_id FROM workspaces WHERE id = workspace_members.workspace_id);
-- Recreate original policies if they exist

-- Ensure proper index exists for ON CONFLICT clause performance
-- This index should already exist from the initial schema, but verify:
-- CREATE UNIQUE INDEX IF NOT EXISTS workspace_members_workspace_user_idx ON workspace_members(workspace_id, user_id);

-- Create a function to automatically add owner as a member when workspace is created
CREATE OR REPLACE FUNCTION add_owner_as_workspace_member()
RETURNS TRIGGER AS $$
BEGIN
    -- Use exception handling to prevent workspace creation failure
    BEGIN
        -- Insert the owner as a member with 'owner' role
        INSERT INTO workspace_members (
            workspace_id,
            user_id,
            role,
            invited_by,
            invited_at,
            accepted_at,
            notifications_enabled
        ) VALUES (
            NEW.id,
            NEW.owner_id,
            'owner',
            NEW.owner_id,
            NOW(),
            NOW(),
            TRUE
        ) ON CONFLICT (workspace_id, user_id) DO NOTHING;
        
        -- Log when conflict occurs (member already exists)
        IF NOT FOUND THEN
            RAISE NOTICE 'Owner member already exists for workspace %', NEW.id;
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            -- Log error but don't fail workspace creation
            RAISE WARNING 'Failed to add owner as member for workspace %: %', NEW.id, SQLERRM;
            -- Still return NEW to allow workspace creation to succeed
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to add owner as member on workspace creation
DROP TRIGGER IF EXISTS add_workspace_owner_as_member ON workspaces;
CREATE TRIGGER add_workspace_owner_as_member
    AFTER INSERT ON workspaces
    FOR EACH ROW
    EXECUTE FUNCTION add_owner_as_workspace_member();

-- Add any existing workspace owners who are not already members
-- This fixes existing workspaces that were created before this migration
INSERT INTO workspace_members (
    workspace_id,
    user_id,
    role,
    invited_by,
    invited_at,
    accepted_at,
    notifications_enabled
)
SELECT 
    w.id,
    w.owner_id,
    'owner',
    w.owner_id,
    w.created_at,
    w.created_at,
    TRUE
FROM workspaces w
LEFT JOIN workspace_members wm ON w.id = wm.workspace_id AND w.owner_id = wm.user_id
WHERE wm.id IS NULL;

-- Update the RLS policies for workspace_repositories to simplify the checks
-- The policies now only check workspace_members table since owners are always members

-- Create a helper function to check workspace membership without recursion
-- Using has_workspace_edit_permission for clearer boolean intent
CREATE OR REPLACE FUNCTION has_workspace_edit_permission(workspace_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_uuid UUID;
BEGIN
    -- Get current user ID
    user_uuid := auth.uid();
    
    -- Check if user is a member with edit permissions
    RETURN EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = workspace_uuid
        AND wm.user_id = user_uuid
        AND wm.role IN ('editor', 'admin', 'owner')
        AND wm.accepted_at IS NOT NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix INSERT policy
DROP POLICY IF EXISTS "Editors can add repositories to workspaces" ON workspace_repositories;
CREATE POLICY "Editors can add repositories to workspaces"
    ON workspace_repositories FOR INSERT
    WITH CHECK (
        added_by = auth.uid() AND
        has_workspace_edit_permission(workspace_id)
    );

-- Fix UPDATE policy
DROP POLICY IF EXISTS "Editors can update repository settings" ON workspace_repositories;
CREATE POLICY "Editors can update repository settings"
    ON workspace_repositories FOR UPDATE
    USING (check_workspace_edit_permission(workspace_id));

-- Fix DELETE policy
DROP POLICY IF EXISTS "Editors can remove repositories from workspaces" ON workspace_repositories;
CREATE POLICY "Editors can remove repositories from workspaces"
    ON workspace_repositories FOR DELETE
    USING (check_workspace_edit_permission(workspace_id));
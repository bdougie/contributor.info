-- Fix workspace security issues and add improvements
-- This migration addresses:
-- 1. Prevents self-demotion from owner role
-- 2. Adds activity logging triggers
-- 3. Adds performance indexes
-- 4. Documents role consolidation

-- Drop existing update policy to replace with improved version
DROP POLICY IF EXISTS "Owners and maintainers can update members" ON workspace_members;

-- Create improved update policy that prevents self-demotion
CREATE POLICY "Owners and maintainers can update members"
    ON workspace_members FOR UPDATE
    USING (
        -- User updating their own notification settings (but not role)
        (user_id = auth.uid() AND OLD.role = NEW.role) OR
        -- Owners can update anyone except themselves
        (user_id != auth.uid() AND EXISTS (
            SELECT 1 FROM workspace_members wm
            WHERE wm.workspace_id = workspace_members.workspace_id
            AND wm.user_id = auth.uid()
            AND wm.role = 'owner'
            AND wm.accepted_at IS NOT NULL
        )) OR
        (user_id != auth.uid() AND EXISTS (
            SELECT 1 FROM workspaces w
            WHERE w.id = workspace_members.workspace_id
            AND w.owner_id = auth.uid()
        )) OR
        -- Maintainers can update contributors only (not themselves)
        (
            user_id != auth.uid() AND
            workspace_members.role = 'contributor' AND
            EXISTS (
                SELECT 1 FROM workspace_members wm
                WHERE wm.workspace_id = workspace_members.workspace_id
                AND wm.user_id = auth.uid()
                AND wm.role = 'maintainer'
                AND wm.accepted_at IS NOT NULL
            )
        )
    )
    WITH CHECK (
        -- Prevent role changes that would violate permissions
        CASE
            -- Prevent self-demotion from owner
            WHEN user_id = auth.uid() AND OLD.role = 'owner' THEN
                NEW.role = 'owner'
            -- Owners can set maintainer or contributor (but not owner)
            WHEN EXISTS (
                SELECT 1 FROM workspace_members wm
                WHERE wm.workspace_id = workspace_members.workspace_id
                AND wm.user_id = auth.uid()
                AND wm.role = 'owner'
                AND wm.accepted_at IS NOT NULL
            ) OR EXISTS (
                SELECT 1 FROM workspaces w
                WHERE w.id = workspace_members.workspace_id
                AND w.owner_id = auth.uid()
            ) THEN NEW.role IN ('maintainer', 'contributor')
            -- Maintainers can only set contributor role
            WHEN EXISTS (
                SELECT 1 FROM workspace_members wm
                WHERE wm.workspace_id = workspace_members.workspace_id
                AND wm.user_id = auth.uid()
                AND wm.role = 'maintainer'
                AND wm.accepted_at IS NOT NULL
            ) THEN NEW.role = 'contributor'
            -- Users can't change their own role
            WHEN user_id = auth.uid() THEN NEW.role = OLD.role
            ELSE false
        END
    );

-- Add performance indexes for workspace members
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_role
    ON workspace_members(workspace_id, role)
    WHERE accepted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workspace_members_user_workspace
    ON workspace_members(user_id, workspace_id)
    WHERE accepted_at IS NOT NULL;

-- Create activity log table if it doesn't exist
CREATE TABLE IF NOT EXISTS workspace_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_action CHECK (action IN (
        'member_invited', 'member_removed', 'member_role_changed',
        'repository_added', 'repository_removed',
        'workspace_created', 'workspace_updated', 'workspace_deleted',
        'settings_updated', 'subscription_changed'
    ))
);

-- Add index for activity logs
CREATE INDEX IF NOT EXISTS idx_workspace_activity_logs_workspace
    ON workspace_activity_logs(workspace_id, created_at DESC);

-- Create trigger function for logging member changes
CREATE OR REPLACE FUNCTION log_workspace_member_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO workspace_activity_logs (
            workspace_id, user_id, action, entity_type, entity_id, new_values
        ) VALUES (
            NEW.workspace_id,
            COALESCE(auth.uid(), NEW.invited_by),
            'member_invited',
            'workspace_member',
            NEW.id,
            jsonb_build_object(
                'user_id', NEW.user_id,
                'role', NEW.role,
                'invited_by', NEW.invited_by
            )
        );
    ELSIF TG_OP = 'UPDATE' THEN
        -- Log role changes
        IF OLD.role IS DISTINCT FROM NEW.role THEN
            INSERT INTO workspace_activity_logs (
                workspace_id, user_id, action, entity_type, entity_id, old_values, new_values
            ) VALUES (
                NEW.workspace_id,
                auth.uid(),
                'member_role_changed',
                'workspace_member',
                NEW.id,
                jsonb_build_object('role', OLD.role),
                jsonb_build_object('role', NEW.role)
            );
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO workspace_activity_logs (
            workspace_id, user_id, action, entity_type, entity_id, old_values
        ) VALUES (
            OLD.workspace_id,
            auth.uid(),
            'member_removed',
            'workspace_member',
            OLD.id,
            jsonb_build_object(
                'user_id', OLD.user_id,
                'role', OLD.role
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for workspace member changes
DROP TRIGGER IF EXISTS trigger_log_workspace_member_changes ON workspace_members;
CREATE TRIGGER trigger_log_workspace_member_changes
    AFTER INSERT OR UPDATE OR DELETE ON workspace_members
    FOR EACH ROW
    EXECUTE FUNCTION log_workspace_member_changes();

-- Create trigger function for logging repository changes
CREATE OR REPLACE FUNCTION log_workspace_repository_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO workspace_activity_logs (
            workspace_id, user_id, action, entity_type, entity_id, new_values
        ) VALUES (
            NEW.workspace_id,
            auth.uid(),
            'repository_added',
            'workspace_repository',
            NEW.id,
            jsonb_build_object(
                'repository_id', NEW.repository_id,
                'added_by', NEW.added_by
            )
        );
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO workspace_activity_logs (
            workspace_id, user_id, action, entity_type, entity_id, old_values
        ) VALUES (
            OLD.workspace_id,
            auth.uid(),
            'repository_removed',
            'workspace_repository',
            OLD.id,
            jsonb_build_object(
                'repository_id', OLD.repository_id
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for workspace repository changes
DROP TRIGGER IF EXISTS trigger_log_workspace_repository_changes ON workspace_repositories;
CREATE TRIGGER trigger_log_workspace_repository_changes
    AFTER INSERT OR DELETE ON workspace_repositories
    FOR EACH ROW
    EXECUTE FUNCTION log_workspace_repository_changes();

-- Add RLS policies for activity logs (read-only for workspace members)
ALTER TABLE workspace_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view activity logs"
    ON workspace_activity_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM workspace_members wm
            WHERE wm.workspace_id = workspace_activity_logs.workspace_id
            AND wm.user_id = auth.uid()
            AND wm.accepted_at IS NOT NULL
        ) OR
        EXISTS (
            SELECT 1 FROM workspaces w
            WHERE w.id = workspace_activity_logs.workspace_id
            AND w.owner_id = auth.uid()
        )
    );

-- Add comment explaining role consolidation
COMMENT ON COLUMN workspace_members.role IS
'User role in the workspace.
Roles were consolidated from viewer/editor/admin to contributor/maintainer/owner for clarity:
- contributor: Can view workspace data and contribute (formerly viewer/editor)
- maintainer: Can manage repositories and invite contributors (formerly editor with elevated permissions)
- owner: Full control including billing and member management (formerly admin)
This simplification aligns with common repository permission models.';

-- Add constraint to ensure at least one owner per workspace
CREATE OR REPLACE FUNCTION ensure_workspace_has_owner()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if this would remove the last owner
    IF OLD.role = 'owner' AND (NEW.role != 'owner' OR TG_OP = 'DELETE') THEN
        IF NOT EXISTS (
            SELECT 1 FROM workspace_members
            WHERE workspace_id = OLD.workspace_id
            AND role = 'owner'
            AND id != OLD.id
            AND accepted_at IS NOT NULL
        ) AND NOT EXISTS (
            SELECT 1 FROM workspaces
            WHERE id = OLD.workspace_id
            AND owner_id IS NOT NULL
            AND owner_id != OLD.user_id
        ) THEN
            RAISE EXCEPTION 'Cannot remove the last owner from workspace';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ensure_workspace_has_owner ON workspace_members;
CREATE TRIGGER trigger_ensure_workspace_has_owner
    BEFORE UPDATE OR DELETE ON workspace_members
    FOR EACH ROW
    EXECUTE FUNCTION ensure_workspace_has_owner();
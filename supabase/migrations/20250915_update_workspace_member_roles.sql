-- =====================================================
-- Update Workspace Member Roles Migration
-- Migrates from (owner, admin, editor, viewer) to (owner, maintainer, contributor)
-- =====================================================

BEGIN;

-- 1. First, update existing data to new role structure
UPDATE workspace_members
SET role = CASE
  WHEN role = 'admin' THEN 'maintainer'
  WHEN role = 'editor' THEN 'contributor'
  WHEN role = 'viewer' THEN 'contributor'
  ELSE role
END
WHERE role IN ('admin', 'editor', 'viewer');

-- 2. Update workspace_invitations table roles
UPDATE workspace_invitations
SET role = CASE
  WHEN role = 'admin' THEN 'maintainer'
  WHEN role = 'editor' THEN 'contributor'
  WHEN role = 'viewer' THEN 'contributor'
  ELSE role
END
WHERE role IN ('admin', 'editor', 'viewer');

-- 3. Drop existing constraints
ALTER TABLE workspace_members
DROP CONSTRAINT IF EXISTS workspace_members_role_check;

ALTER TABLE workspace_invitations
DROP CONSTRAINT IF EXISTS workspace_invitations_role_check;

-- 4. Add new constraints with updated roles
ALTER TABLE workspace_members
ADD CONSTRAINT workspace_members_role_check
CHECK (role IN ('owner', 'maintainer', 'contributor'));

ALTER TABLE workspace_invitations
ADD CONSTRAINT workspace_invitations_role_check
CHECK (role IN ('maintainer', 'contributor'));

-- 5. Drop existing RLS policies that reference old roles
DROP POLICY IF EXISTS "Admins can add members" ON workspace_members;
DROP POLICY IF EXISTS "Admins can update members" ON workspace_members;
DROP POLICY IF EXISTS "Admins can remove members" ON workspace_members;

-- 6. Create new RLS policies for workspace_members with updated roles

-- Owners and maintainers can add members (but maintainers can only add contributors)
CREATE POLICY "Owners and maintainers can add members"
    ON workspace_members FOR INSERT
    WITH CHECK (
        invited_by = auth.uid() AND (
            -- Owners can add anyone
            EXISTS (
                SELECT 1 FROM workspace_members wm
                WHERE wm.workspace_id = workspace_members.workspace_id
                AND wm.user_id = auth.uid()
                AND wm.role = 'owner'
                AND wm.accepted_at IS NOT NULL
            ) OR
            EXISTS (
                SELECT 1 FROM workspaces w
                WHERE w.id = workspace_members.workspace_id
                AND w.owner_id = auth.uid()
            ) OR
            -- Maintainers can only add contributors
            (
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
    );

-- Owners and maintainers can update member roles
CREATE POLICY "Owners and maintainers can update members"
    ON workspace_members FOR UPDATE
    USING (
        -- User updating their own notification settings
        user_id = auth.uid() OR
        -- Owners can update anyone
        EXISTS (
            SELECT 1 FROM workspace_members wm
            WHERE wm.workspace_id = workspace_members.workspace_id
            AND wm.user_id = auth.uid()
            AND wm.role = 'owner'
            AND wm.accepted_at IS NOT NULL
        ) OR
        EXISTS (
            SELECT 1 FROM workspaces w
            WHERE w.id = workspace_members.workspace_id
            AND w.owner_id = auth.uid()
        ) OR
        -- Maintainers can update contributors only
        (
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
        -- Prevent role escalation
        CASE
            -- Owners can set any role except owner (transfer ownership is separate)
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
            ) THEN workspace_members.role IN ('maintainer', 'contributor')
            -- Maintainers can only set contributor role
            WHEN EXISTS (
                SELECT 1 FROM workspace_members wm
                WHERE wm.workspace_id = workspace_members.workspace_id
                AND wm.user_id = auth.uid()
                AND wm.role = 'maintainer'
                AND wm.accepted_at IS NOT NULL
            ) THEN workspace_members.role = 'contributor'
            -- Users updating their own settings can't change role
            WHEN user_id = auth.uid() THEN
                workspace_members.role = (SELECT role FROM workspace_members WHERE id = workspace_members.id)
            ELSE FALSE
        END
    );

-- Owners and maintainers can remove members
CREATE POLICY "Owners and maintainers can remove members"
    ON workspace_members FOR DELETE
    USING (
        -- Owners can remove anyone except themselves
        (
            user_id != auth.uid() AND (
                EXISTS (
                    SELECT 1 FROM workspace_members wm
                    WHERE wm.workspace_id = workspace_members.workspace_id
                    AND wm.user_id = auth.uid()
                    AND wm.role = 'owner'
                    AND wm.accepted_at IS NOT NULL
                ) OR
                EXISTS (
                    SELECT 1 FROM workspaces w
                    WHERE w.id = workspace_members.workspace_id
                    AND w.owner_id = auth.uid()
                )
            )
        ) OR
        -- Maintainers can remove contributors only
        (
            workspace_members.role = 'contributor' AND
            EXISTS (
                SELECT 1 FROM workspace_members wm
                WHERE wm.workspace_id = workspace_members.workspace_id
                AND wm.user_id = auth.uid()
                AND wm.role = 'maintainer'
                AND wm.accepted_at IS NOT NULL
            )
        ) OR
        -- Members can remove themselves (leave workspace)
        user_id = auth.uid()
    );

-- 7. Update workspace_repositories policies for new roles

DROP POLICY IF EXISTS "Members can add repositories to workspace" ON workspace_repositories;
DROP POLICY IF EXISTS "Editors and admins can update repository settings" ON workspace_repositories;
DROP POLICY IF EXISTS "Editors and admins can remove repositories" ON workspace_repositories;

-- Only owners and maintainers can add repositories (contributors cannot)
CREATE POLICY "Owners and maintainers can add repositories"
    ON workspace_repositories FOR INSERT
    WITH CHECK (
        added_by = auth.uid() AND (
            EXISTS (
                SELECT 1 FROM workspace_members
                WHERE workspace_members.workspace_id = workspace_repositories.workspace_id
                AND workspace_members.user_id = auth.uid()
                AND workspace_members.role IN ('owner', 'maintainer')
                AND workspace_members.accepted_at IS NOT NULL
            ) OR
            EXISTS (
                SELECT 1 FROM workspaces
                WHERE workspaces.id = workspace_repositories.workspace_id
                AND workspaces.owner_id = auth.uid()
            )
        )
    );

-- Only owners and maintainers can update repository settings
CREATE POLICY "Owners and maintainers can update repositories"
    ON workspace_repositories FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM workspace_members
            WHERE workspace_members.workspace_id = workspace_repositories.workspace_id
            AND workspace_members.user_id = auth.uid()
            AND workspace_members.role IN ('owner', 'maintainer')
            AND workspace_members.accepted_at IS NOT NULL
        ) OR
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = workspace_repositories.workspace_id
            AND workspaces.owner_id = auth.uid()
        )
    );

-- Only owners and maintainers can remove repositories
CREATE POLICY "Owners and maintainers can remove repositories"
    ON workspace_repositories FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM workspace_members
            WHERE workspace_members.workspace_id = workspace_repositories.workspace_id
            AND workspace_members.user_id = auth.uid()
            AND workspace_members.role IN ('owner', 'maintainer')
            AND workspace_members.accepted_at IS NOT NULL
        ) OR
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = workspace_repositories.workspace_id
            AND workspaces.owner_id = auth.uid()
        )
    );

-- 8. Update workspace settings update policy
DROP POLICY IF EXISTS "Owners and admins can update workspace" ON workspaces;

CREATE POLICY "Owners and maintainers can update workspace"
    ON workspaces FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM workspace_members
            WHERE workspace_members.workspace_id = workspaces.id
            AND workspace_members.user_id = auth.uid()
            AND workspace_members.role IN ('owner', 'maintainer')
            AND workspace_members.accepted_at IS NOT NULL
        ) OR
        owner_id = auth.uid()
    )
    WITH CHECK (
        -- Prevent non-owners from changing owner_id
        owner_id = (SELECT owner_id FROM workspaces WHERE id = workspaces.id)
        AND (
            EXISTS (
                SELECT 1 FROM workspace_members
                WHERE workspace_members.workspace_id = workspaces.id
                AND workspace_members.user_id = auth.uid()
                AND workspace_members.role IN ('owner', 'maintainer')
                AND workspace_members.accepted_at IS NOT NULL
            ) OR
            owner_id = auth.uid()
        )
    );

-- 9. Add helper function to check user permissions
CREATE OR REPLACE FUNCTION check_workspace_permission(
    workspace_id_param UUID,
    user_id_param UUID,
    required_permission TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
    is_owner BOOLEAN;
BEGIN
    -- Check if user is workspace owner
    SELECT EXISTS(
        SELECT 1 FROM workspaces
        WHERE id = workspace_id_param
        AND owner_id = user_id_param
    ) INTO is_owner;

    IF is_owner THEN
        RETURN TRUE;
    END IF;

    -- Get user's role in workspace
    SELECT role INTO user_role
    FROM workspace_members
    WHERE workspace_id = workspace_id_param
    AND user_id = user_id_param
    AND accepted_at IS NOT NULL
    LIMIT 1;

    IF user_role IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Check permissions based on role
    CASE required_permission
        WHEN 'view' THEN
            -- All members can view
            RETURN TRUE;
        WHEN 'add_repository' THEN
            -- Only owners and maintainers
            RETURN user_role IN ('owner', 'maintainer');
        WHEN 'edit_settings' THEN
            -- Only owners and maintainers
            RETURN user_role IN ('owner', 'maintainer');
        WHEN 'invite_member' THEN
            -- Owners can invite anyone, maintainers can invite contributors
            RETURN user_role IN ('owner', 'maintainer');
        WHEN 'remove_member' THEN
            -- Owners can remove anyone, maintainers can remove contributors
            RETURN user_role IN ('owner', 'maintainer');
        WHEN 'delete_workspace' THEN
            -- Only owners
            RETURN user_role = 'owner';
        ELSE
            RETURN FALSE;
    END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Add activity logging for role changes
CREATE TABLE IF NOT EXISTS workspace_activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_workspace ON workspace_activity_log(workspace_id, created_at DESC);

-- Enable RLS on activity log
ALTER TABLE workspace_activity_log ENABLE ROW LEVEL SECURITY;

-- Members can view activity for their workspaces
CREATE POLICY "Members can view workspace activity"
    ON workspace_activity_log FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM workspace_members
            WHERE workspace_members.workspace_id = workspace_activity_log.workspace_id
            AND workspace_members.user_id = auth.uid()
            AND workspace_members.accepted_at IS NOT NULL
        ) OR
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = workspace_activity_log.workspace_id
            AND workspaces.owner_id = auth.uid()
        )
    );

-- System can insert activity logs
CREATE POLICY "System can log activity"
    ON workspace_activity_log FOR INSERT
    WITH CHECK (TRUE);

COMMIT;

-- Add comment for documentation
COMMENT ON COLUMN workspace_members.role IS 'User role in workspace: owner (full control), maintainer (can manage repos and invite contributors), contributor (view-only access)';
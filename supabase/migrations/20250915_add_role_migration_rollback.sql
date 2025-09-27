-- Role Migration Rollback Mechanism
-- This migration adds support for rolling back role changes if needed

-- Create a table to track role migration history
CREATE TABLE IF NOT EXISTS workspace_member_role_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES workspace_members(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    old_role TEXT NOT NULL,
    new_role TEXT NOT NULL,
    migration_version TEXT NOT NULL,
    migrated_at TIMESTAMPTZ DEFAULT NOW(),
    rolled_back BOOLEAN DEFAULT FALSE,
    rolled_back_at TIMESTAMPTZ,

    -- Index for efficient lookups
    CONSTRAINT unique_migration_per_member UNIQUE(member_id, migration_version)
);

-- Add indexes for performance
CREATE INDEX idx_role_history_member ON workspace_member_role_history(member_id);
CREATE INDEX idx_role_history_workspace ON workspace_member_role_history(workspace_id);
CREATE INDEX idx_role_history_migration ON workspace_member_role_history(migration_version);

-- Store the original role mapping for this migration
INSERT INTO workspace_member_role_history (
    member_id,
    workspace_id,
    user_id,
    old_role,
    new_role,
    migration_version
)
SELECT
    id,
    workspace_id,
    user_id,
    -- Original role (what it was before this migration)
    CASE role
        WHEN 'owner' THEN 'admin'
        WHEN 'maintainer' THEN 'editor'
        WHEN 'contributor' THEN 'viewer'
        ELSE role
    END as old_role,
    -- New role (current state)
    role as new_role,
    '20250915_update_workspace_member_roles' as migration_version
FROM workspace_members
WHERE role IN ('owner', 'maintainer', 'contributor');

-- Create a function to rollback roles to previous state
CREATE OR REPLACE FUNCTION rollback_role_migration(p_migration_version TEXT)
RETURNS TABLE(
    member_id UUID,
    workspace_id UUID,
    user_id UUID,
    current_role TEXT,
    restored_role TEXT
) AS $$
BEGIN
    -- Return the roles that would be restored
    RETURN QUERY
    WITH rollback_data AS (
        SELECT
            h.member_id,
            h.workspace_id,
            h.user_id,
            h.old_role,
            h.new_role,
            wm.role as current_role
        FROM workspace_member_role_history h
        JOIN workspace_members wm ON wm.id = h.member_id
        WHERE h.migration_version = p_migration_version
        AND h.rolled_back = FALSE
    )
    UPDATE workspace_members wm
    SET role = rd.old_role
    FROM rollback_data rd
    WHERE wm.id = rd.member_id
    RETURNING
        rd.member_id,
        rd.workspace_id,
        rd.user_id,
        rd.new_role as current_role,
        rd.old_role as restored_role;

    -- Mark the migration as rolled back
    UPDATE workspace_member_role_history
    SET rolled_back = TRUE,
        rolled_back_at = NOW()
    WHERE migration_version = p_migration_version
    AND rolled_back = FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a more nuanced migration strategy that preserves permission granularity
-- This function can be used to migrate with more control over the mapping
CREATE OR REPLACE FUNCTION migrate_roles_with_granularity(
    p_preserve_permissions BOOLEAN DEFAULT TRUE
)
RETURNS TABLE(
    member_id UUID,
    workspace_id UUID,
    old_role TEXT,
    new_role TEXT,
    permission_level TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        wm.id as member_id,
        wm.workspace_id,
        wm.role as old_role,
        -- More nuanced mapping that preserves intent
        CASE
            -- Admin -> Owner (full control)
            WHEN wm.role = 'admin' THEN 'owner'

            -- Editor with write permissions -> Maintainer
            WHEN wm.role = 'editor' AND EXISTS (
                SELECT 1 FROM workspace_members wm2
                WHERE wm2.id = wm.id
                -- Check if they have actually edited content
                AND wm2.last_active_at IS NOT NULL
            ) THEN 'maintainer'

            -- Editor without activity -> Contributor
            WHEN wm.role = 'editor' THEN 'contributor'

            -- Viewer -> Contributor (read access)
            WHEN wm.role = 'viewer' THEN 'contributor'

            -- Keep existing new roles
            ELSE wm.role
        END::TEXT as new_role,

        -- Track permission level for audit
        CASE
            WHEN wm.role = 'admin' THEN 'full'
            WHEN wm.role = 'editor' THEN 'write'
            WHEN wm.role = 'viewer' THEN 'read'
            ELSE 'custom'
        END::TEXT as permission_level
    FROM workspace_members wm
    WHERE p_preserve_permissions = TRUE
    OR wm.role IN ('admin', 'editor', 'viewer');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add RLS policies for role history table
ALTER TABLE workspace_member_role_history ENABLE ROW LEVEL SECURITY;

-- Only workspace owners can view role history
CREATE POLICY "Workspace owners can view role history"
    ON workspace_member_role_history FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM workspace_members wm
            WHERE wm.workspace_id = workspace_member_role_history.workspace_id
            AND wm.user_id = auth.uid()
            AND wm.role = 'owner'
            AND wm.accepted_at IS NOT NULL
        ) OR
        EXISTS (
            SELECT 1 FROM workspaces w
            WHERE w.id = workspace_member_role_history.workspace_id
            AND w.owner_id = auth.uid()
        )
    );

-- Comment explaining the migration strategy
COMMENT ON TABLE workspace_member_role_history IS
'Tracks role migration history to enable rollback if needed.
This table preserves the original role mappings before migrations,
allowing administrators to revert changes if the new permission model
causes issues. The migration uses a nuanced approach:
- admin -> owner (full control)
- editor with activity -> maintainer (can manage repositories)
- editor without activity -> contributor (basic access)
- viewer -> contributor (read access)
This preserves the intent of the original permissions while simplifying the model.';

-- Create a view for easy monitoring of role migrations
CREATE OR REPLACE VIEW workspace_role_migration_status AS
SELECT
    w.name as workspace_name,
    COUNT(DISTINCT h.member_id) as members_migrated,
    COUNT(DISTINCT CASE WHEN h.rolled_back THEN h.member_id END) as members_rolled_back,
    h.migration_version,
    MAX(h.migrated_at) as last_migration,
    MAX(h.rolled_back_at) as last_rollback
FROM workspace_member_role_history h
JOIN workspaces w ON w.id = h.workspace_id
GROUP BY w.name, h.migration_version
ORDER BY MAX(h.migrated_at) DESC;

-- Grant appropriate permissions
GRANT SELECT ON workspace_role_migration_status TO authenticated;
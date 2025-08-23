-- Row Level Security (RLS) Policies for Workspaces
-- These policies ensure users can only access workspaces they own or are members of

-- =====================================================
-- ENABLE RLS ON ALL WORKSPACE TABLES
-- =====================================================

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_metrics_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- WORKSPACES TABLE POLICIES
-- =====================================================

-- Public workspaces are viewable by everyone
CREATE POLICY "Public workspaces are viewable by everyone"
    ON workspaces FOR SELECT
    USING (visibility = 'public' AND is_active = TRUE);

-- Users can view private workspaces they own or are members of
CREATE POLICY "Users can view their private workspaces"
    ON workspaces FOR SELECT
    USING (
        is_active = TRUE AND
        visibility = 'private' AND (
            owner_id = auth.uid() OR
            EXISTS (
                SELECT 1 FROM workspace_members
                WHERE workspace_members.workspace_id = workspaces.id
                AND workspace_members.user_id = auth.uid()
                AND workspace_members.accepted_at IS NOT NULL
            )
        )
    );

-- Users can create workspaces (they become the owner)
CREATE POLICY "Users can create workspaces"
    ON workspaces FOR INSERT
    WITH CHECK (owner_id = auth.uid());

-- Owners can update their workspaces
CREATE POLICY "Owners can update their workspaces"
    ON workspaces FOR UPDATE
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid()); -- Prevent ownership transfer via UPDATE

-- Admins can also update workspaces (but cannot change ownership)
CREATE POLICY "Admins can update workspaces"
    ON workspaces FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM workspace_members
            WHERE workspace_members.workspace_id = workspaces.id
            AND workspace_members.user_id = auth.uid()
            AND workspace_members.role IN ('admin', 'owner')
            AND workspace_members.accepted_at IS NOT NULL
        )
    )
    WITH CHECK (
        -- Prevent admins from changing owner_id
        owner_id = (SELECT owner_id FROM workspaces WHERE id = workspaces.id)
        AND EXISTS (
            SELECT 1 FROM workspace_members
            WHERE workspace_members.workspace_id = workspaces.id
            AND workspace_members.user_id = auth.uid()
            AND workspace_members.role IN ('admin', 'owner')
            AND workspace_members.accepted_at IS NOT NULL
        )
    );

-- Only owners can delete (soft delete by setting is_active = FALSE)
CREATE POLICY "Owners can delete their workspaces"
    ON workspaces FOR DELETE
    USING (owner_id = auth.uid());

-- =====================================================
-- WORKSPACE_REPOSITORIES TABLE POLICIES
-- =====================================================

-- View repositories in public workspaces (requires login)
CREATE POLICY "Logged in users can view repositories in public workspaces"
    ON workspace_repositories FOR SELECT
    USING (
        auth.uid() IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = workspace_repositories.workspace_id
            AND workspaces.visibility = 'public'
            AND workspaces.is_active = TRUE
        )
    );

-- Members can view repositories in their workspaces
CREATE POLICY "Members can view repositories in their workspaces"
    ON workspace_repositories FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM workspace_members
            WHERE workspace_members.workspace_id = workspace_repositories.workspace_id
            AND workspace_members.user_id = auth.uid()
            AND workspace_members.accepted_at IS NOT NULL
        ) OR
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = workspace_repositories.workspace_id
            AND workspaces.owner_id = auth.uid()
        )
    );

-- Editors, admins, and owners can add repositories
CREATE POLICY "Editors can add repositories to workspaces"
    ON workspace_repositories FOR INSERT
    WITH CHECK (
        added_by = auth.uid() AND (
            EXISTS (
                SELECT 1 FROM workspace_members
                WHERE workspace_members.workspace_id = workspace_repositories.workspace_id
                AND workspace_members.user_id = auth.uid()
                AND workspace_members.role IN ('editor', 'admin', 'owner')
                AND workspace_members.accepted_at IS NOT NULL
            ) OR
            EXISTS (
                SELECT 1 FROM workspaces
                WHERE workspaces.id = workspace_repositories.workspace_id
                AND workspaces.owner_id = auth.uid()
            )
        )
    );

-- Editors, admins, and owners can update repository settings
CREATE POLICY "Editors can update repository settings"
    ON workspace_repositories FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM workspace_members
            WHERE workspace_members.workspace_id = workspace_repositories.workspace_id
            AND workspace_members.user_id = auth.uid()
            AND workspace_members.role IN ('editor', 'admin', 'owner')
            AND workspace_members.accepted_at IS NOT NULL
        ) OR
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = workspace_repositories.workspace_id
            AND workspaces.owner_id = auth.uid()
        )
    );

-- Editors, admins, and owners can remove repositories
CREATE POLICY "Editors can remove repositories from workspaces"
    ON workspace_repositories FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM workspace_members
            WHERE workspace_members.workspace_id = workspace_repositories.workspace_id
            AND workspace_members.user_id = auth.uid()
            AND workspace_members.role IN ('editor', 'admin', 'owner')
            AND workspace_members.accepted_at IS NOT NULL
        ) OR
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = workspace_repositories.workspace_id
            AND workspaces.owner_id = auth.uid()
        )
    );

-- =====================================================
-- WORKSPACE_MEMBERS TABLE POLICIES
-- =====================================================

-- Members of public workspaces are visible to everyone
CREATE POLICY "Public workspace members are visible"
    ON workspace_members FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = workspace_members.workspace_id
            AND workspaces.visibility = 'public'
            AND workspaces.is_active = TRUE
        )
    );

-- Members can view other members in their private workspaces
CREATE POLICY "Members can view their workspace members"
    ON workspace_members FOR SELECT
    USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM workspace_members wm
            WHERE wm.workspace_id = workspace_members.workspace_id
            AND wm.user_id = auth.uid()
            AND wm.accepted_at IS NOT NULL
        ) OR
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = workspace_members.workspace_id
            AND workspaces.owner_id = auth.uid()
        )
    );

-- Admins and owners can add members
CREATE POLICY "Admins can add members"
    ON workspace_members FOR INSERT
    WITH CHECK (
        invited_by = auth.uid() AND (
            EXISTS (
                SELECT 1 FROM workspace_members wm
                WHERE wm.workspace_id = workspace_members.workspace_id
                AND wm.user_id = auth.uid()
                AND wm.role IN ('admin', 'owner')
                AND wm.accepted_at IS NOT NULL
            ) OR
            EXISTS (
                SELECT 1 FROM workspaces w
                WHERE w.id = workspace_members.workspace_id
                AND w.owner_id = auth.uid()
            )
        )
    );

-- Members can update their own settings
CREATE POLICY "Members can update their own settings"
    ON workspace_members FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Admins can update member roles (but not owner roles)
CREATE POLICY "Admins can update member roles"
    ON workspace_members FOR UPDATE
    USING (
        -- Can only update if you're an admin/owner
        (EXISTS (
            SELECT 1 FROM workspace_members wm
            WHERE wm.workspace_id = workspace_members.workspace_id
            AND wm.user_id = auth.uid()
            AND wm.role IN ('admin', 'owner')
            AND wm.accepted_at IS NOT NULL
        ) OR
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = workspace_members.workspace_id
            AND workspaces.owner_id = auth.uid()
        ))
        -- AND the target member is not an owner (prevent demoting owners)
        AND workspace_members.role != 'owner'
    )
    WITH CHECK (
        -- Prevent assigning owner role unless you're the workspace owner
        (role != 'owner' OR EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = workspace_members.workspace_id
            AND workspaces.owner_id = auth.uid()
        ))
    );

-- Members can remove themselves
CREATE POLICY "Members can remove themselves"
    ON workspace_members FOR DELETE
    USING (user_id = auth.uid());

-- Admins and owners can remove members
CREATE POLICY "Admins can remove members"
    ON workspace_members FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM workspace_members wm
            WHERE wm.workspace_id = workspace_members.workspace_id
            AND wm.user_id = auth.uid()
            AND wm.role IN ('admin', 'owner')
            AND wm.accepted_at IS NOT NULL
        ) OR
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = workspace_members.workspace_id
            AND workspaces.owner_id = auth.uid()
        )
    );

-- =====================================================
-- WORKSPACE_METRICS_CACHE TABLE POLICIES
-- =====================================================

-- Anyone can view metrics for public workspaces
CREATE POLICY "Public workspace metrics are viewable"
    ON workspace_metrics_cache FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = workspace_metrics_cache.workspace_id
            AND workspaces.visibility = 'public'
            AND workspaces.is_active = TRUE
        )
    );

-- Members can view metrics for their workspaces
CREATE POLICY "Members can view workspace metrics"
    ON workspace_metrics_cache FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM workspace_members
            WHERE workspace_members.workspace_id = workspace_metrics_cache.workspace_id
            AND workspace_members.user_id = auth.uid()
            AND workspace_members.accepted_at IS NOT NULL
        ) OR
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = workspace_metrics_cache.workspace_id
            AND workspaces.owner_id = auth.uid()
        )
    );

-- System/service role can insert and update metrics (for background jobs)
-- Note: This would typically be done by a service role or function
CREATE POLICY "Service role can manage metrics cache"
    ON workspace_metrics_cache FOR ALL
    USING (auth.role() = 'service_role');

-- =====================================================
-- WORKSPACE_INVITATIONS TABLE POLICIES
-- =====================================================

-- Users can view invitations sent to their email
CREATE POLICY "Users can view their invitations"
    ON workspace_invitations FOR SELECT
    USING (
        invited_by = auth.uid() OR
        email = auth.jwt() ->> 'email'
    );

-- Admins and owners can create invitations
CREATE POLICY "Admins can create invitations"
    ON workspace_invitations FOR INSERT
    WITH CHECK (
        invited_by = auth.uid() AND (
            EXISTS (
                SELECT 1 FROM workspace_members
                WHERE workspace_members.workspace_id = workspace_invitations.workspace_id
                AND workspace_members.user_id = auth.uid()
                AND workspace_members.role IN ('admin', 'owner')
                AND workspace_members.accepted_at IS NOT NULL
            ) OR
            EXISTS (
                SELECT 1 FROM workspaces
                WHERE workspaces.id = workspace_invitations.workspace_id
                AND workspaces.owner_id = auth.uid()
            )
        )
    );

-- Users can update invitations sent to them (accept/reject)
CREATE POLICY "Users can respond to their invitations"
    ON workspace_invitations FOR UPDATE
    USING (email = auth.jwt() ->> 'email')
    WITH CHECK (email = auth.jwt() ->> 'email');

-- Admins can delete/cancel invitations
CREATE POLICY "Admins can cancel invitations"
    ON workspace_invitations FOR DELETE
    USING (
        invited_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM workspace_members
            WHERE workspace_members.workspace_id = workspace_invitations.workspace_id
            AND workspace_members.user_id = auth.uid()
            AND workspace_members.role IN ('admin', 'owner')
            AND workspace_members.accepted_at IS NOT NULL
        ) OR
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = workspace_invitations.workspace_id
            AND workspaces.owner_id = auth.uid()
        )
    );

-- =====================================================
-- HELPER FUNCTIONS FOR RLS
-- =====================================================

-- Function to check if a user is a workspace member
CREATE OR REPLACE FUNCTION is_workspace_member(workspace_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM workspace_members
        WHERE workspace_id = workspace_uuid
        AND user_id = user_uuid
        AND accepted_at IS NOT NULL
    ) OR EXISTS (
        SELECT 1 FROM workspaces
        WHERE id = workspace_uuid
        AND owner_id = user_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check user's role in a workspace
CREATE OR REPLACE FUNCTION get_workspace_role(workspace_uuid UUID, user_uuid UUID)
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    -- Check if user is owner
    IF EXISTS (SELECT 1 FROM workspaces WHERE id = workspace_uuid AND owner_id = user_uuid) THEN
        RETURN 'owner';
    END IF;
    
    -- Check member role
    SELECT role INTO user_role
    FROM workspace_members
    WHERE workspace_id = workspace_uuid
    AND user_id = user_uuid
    AND accepted_at IS NOT NULL;
    
    RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON POLICY "Public workspaces are viewable by everyone" ON workspaces 
    IS 'Allows anyone to view public workspaces for discovery and sharing';

COMMENT ON POLICY "Users can view their private workspaces" ON workspaces 
    IS 'Restricts private workspace access to owners and accepted members only';

COMMENT ON POLICY "Editors can add repositories to workspaces" ON workspace_repositories 
    IS 'Allows editors, admins, and owners to manage workspace repositories';
-- Workspace Feature Database Schema
-- This migration creates tables for the workspace feature, allowing users to create
-- and manage collections of repositories with team collaboration capabilities

-- =====================================================
-- WORKSPACE CORE TABLES
-- =====================================================

-- 1. Workspaces table - stores workspace configurations
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE, -- URL-friendly identifier
    description TEXT,
    owner_id UUID NOT NULL, -- References auth.users(id) from Supabase Auth
    visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
    
    -- Settings stored as JSONB for flexibility
    settings JSONB DEFAULT '{
        "theme": "default",
        "dashboard_layout": "grid",
        "default_time_range": "30d",
        "notifications": {
            "email": true,
            "in_app": true
        }
    }'::jsonb,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE, -- Soft delete support
    
    -- Constraints
    CONSTRAINT workspace_slug_format CHECK (slug ~ '^[a-z0-9-]+$'),
    CONSTRAINT workspace_name_length CHECK (char_length(name) BETWEEN 3 AND 100),
    CONSTRAINT workspace_slug_length CHECK (char_length(slug) BETWEEN 3 AND 50)
);

-- 2. Workspace repositories junction table - many-to-many relationship
CREATE TABLE workspace_repositories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    
    -- Track who added the repository and when
    added_by UUID NOT NULL, -- References auth.users(id)
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Optional metadata for this specific workspace-repo relationship
    notes TEXT,
    tags TEXT[], -- Custom tags for organization within workspace
    is_pinned BOOLEAN DEFAULT FALSE, -- Pin important repos to top
    
    -- Ensure unique repository per workspace
    CONSTRAINT unique_workspace_repository UNIQUE (workspace_id, repository_id)
);

-- 3. Workspace members table - team collaboration with roles
CREATE TABLE workspace_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- References auth.users(id)
    
    -- Role-based access control
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
    
    -- Invitation tracking
    invited_by UUID, -- References auth.users(id)
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ, -- NULL if invitation pending
    
    -- Member settings
    notifications_enabled BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ,
    
    -- Ensure unique membership
    CONSTRAINT unique_workspace_member UNIQUE (workspace_id, user_id)
);

-- 4. Workspace metrics cache table - for performance optimization
CREATE TABLE workspace_metrics_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Time range for these metrics
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    time_range TEXT NOT NULL, -- '7d', '30d', '90d', etc.
    
    -- Aggregated metrics stored as JSONB
    metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    /* Example metrics structure:
    {
        "total_prs": 150,
        "merged_prs": 120,
        "open_prs": 30,
        "total_issues": 75,
        "closed_issues": 60,
        "total_contributors": 25,
        "active_contributors": 15,
        "total_commits": 500,
        "total_stars": 1250,
        "total_forks": 85,
        "avg_pr_merge_time_hours": 48,
        "pr_velocity": 4.0,
        "issue_closure_rate": 0.8,
        "languages": {
            "TypeScript": 65,
            "JavaScript": 20,
            "CSS": 10,
            "Other": 5
        },
        "top_contributors": [
            {"username": "user1", "prs": 25, "avatar_url": "..."},
            {"username": "user2", "prs": 20, "avatar_url": "..."}
        ],
        "activity_timeline": [...]
    }
    */
    
    -- Cache management
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),
    is_stale BOOLEAN DEFAULT FALSE,
    
    -- Ensure unique cache entry per workspace and time range
    CONSTRAINT unique_workspace_metrics_period UNIQUE (workspace_id, time_range, period_end)
);

-- 5. Workspace invitations table - for pending invitations
CREATE TABLE workspace_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Invitation details
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
    invitation_token UUID NOT NULL DEFAULT uuid_generate_v4() UNIQUE,
    
    -- Tracking
    invited_by UUID NOT NULL, -- References auth.users(id)
    invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    accepted_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
    
    -- Ensure unique pending invitation per email and workspace
    CONSTRAINT unique_pending_invitation UNIQUE (workspace_id, email)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Workspace indexes
CREATE INDEX idx_workspaces_owner ON workspaces(owner_id) WHERE is_active = TRUE;
CREATE INDEX idx_workspaces_slug ON workspaces(slug) WHERE is_active = TRUE;
CREATE INDEX idx_workspaces_visibility ON workspaces(visibility) WHERE is_active = TRUE;
CREATE INDEX idx_workspaces_updated ON workspaces(updated_at DESC) WHERE is_active = TRUE;

-- Workspace repositories indexes
CREATE INDEX idx_workspace_repos_workspace ON workspace_repositories(workspace_id);
CREATE INDEX idx_workspace_repos_repository ON workspace_repositories(repository_id);
CREATE INDEX idx_workspace_repos_pinned ON workspace_repositories(workspace_id, is_pinned) WHERE is_pinned = TRUE;

-- Workspace members indexes
CREATE INDEX idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX idx_workspace_members_role ON workspace_members(workspace_id, role);
CREATE INDEX idx_workspace_members_accepted ON workspace_members(workspace_id, accepted_at) WHERE accepted_at IS NOT NULL;

-- Metrics cache indexes
CREATE INDEX idx_metrics_cache_workspace ON workspace_metrics_cache(workspace_id);
CREATE INDEX idx_metrics_cache_lookup ON workspace_metrics_cache(workspace_id, time_range, period_end);
CREATE INDEX idx_metrics_cache_expires ON workspace_metrics_cache(expires_at) WHERE is_stale = FALSE;

-- Invitations indexes
CREATE INDEX idx_invitations_workspace ON workspace_invitations(workspace_id);
CREATE INDEX idx_invitations_email ON workspace_invitations(email) WHERE status = 'pending';
CREATE INDEX idx_invitations_token ON workspace_invitations(invitation_token) WHERE status = 'pending';
CREATE INDEX idx_invitations_expires ON workspace_invitations(expires_at) WHERE status = 'pending';

-- =====================================================
-- FUNCTIONS FOR WORKSPACE MANAGEMENT
-- =====================================================

-- Function to generate URL-friendly slug from workspace name
CREATE OR REPLACE FUNCTION generate_workspace_slug(workspace_name TEXT)
RETURNS TEXT AS $$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 0;
BEGIN
    -- Convert to lowercase and replace spaces/special chars with hyphens
    base_slug := lower(workspace_name);
    base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');
    base_slug := regexp_replace(base_slug, '^-+|-+$', '', 'g');
    
    -- Ensure slug is within length limits
    IF char_length(base_slug) > 47 THEN
        base_slug := substring(base_slug, 1, 47);
    END IF;
    
    final_slug := base_slug;
    
    -- Check for uniqueness and append number if needed
    WHILE EXISTS (SELECT 1 FROM workspaces WHERE slug = final_slug) LOOP
        counter := counter + 1;
        final_slug := base_slug || '-' || counter;
    END LOOP;
    
    RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Function to update workspace activity timestamp
CREATE OR REPLACE FUNCTION update_workspace_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE workspaces 
    SET last_activity_at = NOW()
    WHERE id = NEW.workspace_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to maintain workspace activity
CREATE TRIGGER update_workspace_activity_on_repo_change
    AFTER INSERT OR UPDATE OR DELETE ON workspace_repositories
    FOR EACH ROW EXECUTE FUNCTION update_workspace_activity();

CREATE TRIGGER update_workspace_activity_on_member_change
    AFTER INSERT OR UPDATE OR DELETE ON workspace_members
    FOR EACH ROW EXECUTE FUNCTION update_workspace_activity();

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON workspaces
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workspace_members_updated_at BEFORE UPDATE ON workspace_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE workspaces IS 'Stores workspace configurations for organizing repositories and team collaboration';
COMMENT ON TABLE workspace_repositories IS 'Junction table linking workspaces to repositories they track';
COMMENT ON TABLE workspace_members IS 'Manages team members and their roles within workspaces';
COMMENT ON TABLE workspace_metrics_cache IS 'Caches aggregated metrics for workspace performance optimization';
COMMENT ON TABLE workspace_invitations IS 'Tracks pending invitations to join workspaces';

COMMENT ON COLUMN workspaces.slug IS 'URL-friendly unique identifier for the workspace';
COMMENT ON COLUMN workspaces.settings IS 'Flexible JSON storage for workspace preferences and configuration';
COMMENT ON COLUMN workspace_members.role IS 'Access level: owner (full control), admin (manage members), editor (add/remove repos), viewer (read-only)';
COMMENT ON COLUMN workspace_metrics_cache.metrics IS 'Pre-calculated metrics to avoid expensive real-time aggregations';
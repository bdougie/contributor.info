-- Admin System Database Schema Migration
-- Creates user management and role-based access control system
-- This enables database-driven admin permissions for user "bdougie"

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ADMIN SYSTEM TABLES
-- =====================================================

-- 1. App Users table - tracks application users linked to Supabase Auth
CREATE TABLE app_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID UNIQUE, -- References auth.users(id) but not enforced due to auth schema
    github_username TEXT UNIQUE NOT NULL,
    github_user_id BIGINT UNIQUE, -- GitHub user ID for reliable identification
    email TEXT,
    avatar_url TEXT,
    display_name TEXT,
    is_admin BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    first_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. User Roles table - flexible role management system
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'moderator', 'user')),
    granted_by UUID REFERENCES app_users(id), -- who granted this role
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES app_users(id),
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Unique constraint to prevent duplicate active roles
    CONSTRAINT unique_active_user_role UNIQUE (user_id, role, is_active)
);

-- 3. Admin Action Logs table - audit trail for admin actions
CREATE TABLE admin_action_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_user_id UUID NOT NULL REFERENCES app_users(id),
    action_type TEXT NOT NULL CHECK (action_type IN (
        'grant_role', 'revoke_role', 'create_user', 'update_user', 
        'deactivate_user', 'activate_user', 'system_config'
    )),
    target_user_id UUID REFERENCES app_users(id), -- user affected by action
    action_details JSONB, -- additional context about the action
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- App users indexes
CREATE INDEX idx_app_users_auth_user_id ON app_users(auth_user_id);
CREATE INDEX idx_app_users_github_username ON app_users(github_username);
CREATE INDEX idx_app_users_github_user_id ON app_users(github_user_id);
CREATE INDEX idx_app_users_is_admin ON app_users(is_admin) WHERE is_admin = TRUE;
CREATE INDEX idx_app_users_active ON app_users(is_active) WHERE is_active = TRUE;

-- User roles indexes
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role);
CREATE INDEX idx_user_roles_active ON user_roles(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_user_roles_user_role_active ON user_roles(user_id, role, is_active);

-- Admin action logs indexes
CREATE INDEX idx_admin_logs_admin_user ON admin_action_logs(admin_user_id);
CREATE INDEX idx_admin_logs_target_user ON admin_action_logs(target_user_id);
CREATE INDEX idx_admin_logs_action_type ON admin_action_logs(action_type);
CREATE INDEX idx_admin_logs_created_at ON admin_action_logs(created_at DESC);

-- =====================================================
-- FUNCTIONS FOR ADMIN OPERATIONS
-- =====================================================

-- Function to check if a user is an admin
CREATE OR REPLACE FUNCTION is_user_admin(user_github_username TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    admin_status BOOLEAN := FALSE;
BEGIN
    SELECT is_admin INTO admin_status
    FROM app_users
    WHERE github_username = user_github_username
      AND is_active = TRUE;
    
    RETURN COALESCE(admin_status, FALSE);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check if a user has a specific role
CREATE OR REPLACE FUNCTION user_has_role(user_github_username TEXT, role_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    has_role BOOLEAN := FALSE;
BEGIN
    SELECT EXISTS(
        SELECT 1
        FROM app_users au
        JOIN user_roles ur ON au.id = ur.user_id
        WHERE au.github_username = user_github_username
          AND au.is_active = TRUE
          AND ur.role = role_name
          AND ur.is_active = TRUE
    ) INTO has_role;
    
    RETURN has_role;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to create or update app user from GitHub OAuth data
CREATE OR REPLACE FUNCTION upsert_app_user(
    p_auth_user_id UUID,
    p_github_username TEXT,
    p_github_user_id BIGINT,
    p_email TEXT DEFAULT NULL,
    p_avatar_url TEXT DEFAULT NULL,
    p_display_name TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    user_id UUID;
    is_new_user BOOLEAN := FALSE;
BEGIN
    -- Try to find existing user by GitHub username or auth_user_id
    SELECT id INTO user_id
    FROM app_users
    WHERE github_username = p_github_username
       OR auth_user_id = p_auth_user_id;
    
    IF user_id IS NULL THEN
        -- Create new user
        INSERT INTO app_users (
            auth_user_id, github_username, github_user_id,
            email, avatar_url, display_name
        )
        VALUES (
            p_auth_user_id, p_github_username, p_github_user_id,
            p_email, p_avatar_url, p_display_name
        )
        RETURNING id INTO user_id;
        
        is_new_user := TRUE;
    ELSE
        -- Update existing user
        UPDATE app_users
        SET 
            auth_user_id = p_auth_user_id,
            github_user_id = p_github_user_id,
            email = COALESCE(p_email, email),
            avatar_url = COALESCE(p_avatar_url, avatar_url),
            display_name = COALESCE(p_display_name, display_name),
            last_login_at = NOW(),
            updated_at = NOW()
        WHERE id = user_id;
    END IF;
    
    -- Assign default 'user' role if new user
    IF is_new_user THEN
        INSERT INTO user_roles (user_id, role)
        VALUES (user_id, 'user');
    END IF;
    
    RETURN user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to grant a role to a user
CREATE OR REPLACE FUNCTION grant_user_role(
    target_username TEXT,
    role_name TEXT,
    granted_by_username TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    target_user_id UUID;
    granter_user_id UUID;
    granter_is_admin BOOLEAN;
BEGIN
    -- Get target user ID
    SELECT id INTO target_user_id
    FROM app_users
    WHERE github_username = target_username AND is_active = TRUE;
    
    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'Target user not found: %', target_username;
    END IF;
    
    -- Get granter user ID and check admin status
    SELECT id, is_admin INTO granter_user_id, granter_is_admin
    FROM app_users
    WHERE github_username = granted_by_username AND is_active = TRUE;
    
    IF granter_user_id IS NULL THEN
        RAISE EXCEPTION 'Granter user not found: %', granted_by_username;
    END IF;
    
    IF NOT granter_is_admin THEN
        RAISE EXCEPTION 'User % is not authorized to grant roles', granted_by_username;
    END IF;
    
    -- Deactivate any existing role of the same type
    UPDATE user_roles
    SET is_active = FALSE,
        revoked_at = NOW(),
        revoked_by = granter_user_id
    WHERE user_id = target_user_id
      AND role = role_name
      AND is_active = TRUE;
    
    -- Grant the new role
    INSERT INTO user_roles (user_id, role, granted_by)
    VALUES (target_user_id, role_name, granter_user_id);
    
    -- Update admin status if granting admin role
    IF role_name = 'admin' THEN
        UPDATE app_users
        SET is_admin = TRUE, updated_at = NOW()
        WHERE id = target_user_id;
    END IF;
    
    -- Log the action
    INSERT INTO admin_action_logs (
        admin_user_id, action_type, target_user_id,
        action_details
    )
    VALUES (
        granter_user_id, 'grant_role', target_user_id,
        jsonb_build_object('role', role_name, 'target_username', target_username)
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- BOOTSTRAP ADMIN USER
-- =====================================================

-- Bootstrap "bdougie" as the initial admin user
-- This will be updated when the user first logs in via OAuth
INSERT INTO app_users (
    github_username,
    github_user_id,
    email,
    display_name,
    is_admin
)
VALUES (
    'bdougie',
    5713670, -- bdougie's GitHub user ID
    'hello@bdougie.live',
    'Brian Douglas',
    TRUE
)
ON CONFLICT (github_username) DO UPDATE SET
    is_admin = TRUE,
    updated_at = NOW();

-- Grant admin role to bdougie
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin'
FROM app_users
WHERE github_username = 'bdougie'
ON CONFLICT (user_id, role, is_active) DO NOTHING;

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on admin tables
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_action_logs ENABLE ROW LEVEL SECURITY;

-- App users policies
-- Public can read basic user info (for contributor profiles)
CREATE POLICY "public_read_app_users_basic"
ON app_users FOR SELECT
USING (is_active = TRUE);

-- Only admins can insert/update app users
CREATE POLICY "admin_manage_app_users"
ON app_users FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM app_users au
        WHERE au.auth_user_id = auth.uid()
          AND au.is_admin = TRUE
          AND au.is_active = TRUE
    )
);

-- Users can update their own record
CREATE POLICY "users_update_own_record"
ON app_users FOR UPDATE
USING (auth_user_id = auth.uid());

-- User roles policies
-- Only admins can manage roles
CREATE POLICY "admin_manage_user_roles"
ON user_roles FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM app_users au
        WHERE au.auth_user_id = auth.uid()
          AND au.is_admin = TRUE
          AND au.is_active = TRUE
    )
);

-- Users can read their own roles
CREATE POLICY "users_read_own_roles"
ON user_roles FOR SELECT
USING (
    user_id IN (
        SELECT id FROM app_users
        WHERE auth_user_id = auth.uid()
    )
);

-- Admin action logs policies
-- Only admins can read admin logs
CREATE POLICY "admin_read_action_logs"
ON admin_action_logs FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM app_users au
        WHERE au.auth_user_id = auth.uid()
          AND au.is_admin = TRUE
          AND au.is_active = TRUE
    )
);

-- Only system can insert admin logs (via functions)
CREATE POLICY "system_insert_admin_logs"
ON admin_action_logs FOR INSERT
WITH CHECK (TRUE); -- Functions handle the actual permission checking

-- =====================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =====================================================

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to app_users table
CREATE TRIGGER update_app_users_updated_at
    BEFORE UPDATE ON app_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- COMMENTS AND DOCUMENTATION
-- =====================================================

COMMENT ON TABLE app_users IS 'Application users linked to Supabase Auth with GitHub OAuth data';
COMMENT ON TABLE user_roles IS 'Role-based access control system for application users';
COMMENT ON TABLE admin_action_logs IS 'Audit trail for administrative actions';

COMMENT ON FUNCTION is_user_admin IS 'Checks if a user has admin privileges';
COMMENT ON FUNCTION user_has_role IS 'Checks if a user has a specific role';
COMMENT ON FUNCTION upsert_app_user IS 'Creates or updates app user from GitHub OAuth data';
COMMENT ON FUNCTION grant_user_role IS 'Grants a role to a user (admin only)';

-- Migration completed successfully
-- Next steps:
-- 1. Update authentication hooks to use app_users table
-- 2. Create admin-specific routes and components
-- 3. Implement user management interface
-- 4. Move admin tools from /dev to /admin routes
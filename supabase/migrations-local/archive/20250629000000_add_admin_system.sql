-- Local-safe version of 20250629000000_add_admin_system.sql
-- Generated: 2025-08-27T02:47:08.050Z
-- This migration has been modified to work without auth, roles, and extensions
-- Original migration may have different behavior in production

-- Transaction wrapper for safety
BEGIN;

-- This migration requires auth schema
DO $$
BEGIN
  -- Check if auth schema and functions exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    RAISE NOTICE 'Auth schema not found. Skipping 20250629000000_add_admin_system.sql';
    RETURN;
  END IF;
  
  -- Check for auth.uid() function
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'auth' AND p.proname = 'uid'
  ) THEN
    RAISE NOTICE 'Auth functions not available. Skipping 20250629000000_add_admin_system.sql';
    RETURN;
  END IF;
END $$;

-- Original migration content (only runs if auth is available)
-- Admin System Migration
-- Creates user role management and admin functionality

-- Create app_users table to link Supabase Auth users with GitHub profiles
CREATE TABLE IF NOT EXISTS app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    github_id BIGINT UNIQUE NOT NULL,
    github_username VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    avatar_url TEXT,
    email VARCHAR(255),
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    UNIQUE(auth_user_id),
    UNIQUE(github_username)
);

-- Create user_roles table for flexible role management
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
    role_name VARCHAR(50) NOT NULL CHECK (role_name IN ('admin', 'moderator', 'user')),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    granted_by UUID REFERENCES app_users(id),
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_by UUID REFERENCES app_users(id),
    is_active BOOLEAN GENERATED ALWAYS AS (revoked_at IS NULL) STORED,
    UNIQUE(user_id, role_name, is_active) WHERE is_active = TRUE
);

-- Create admin_action_logs for audit trail
CREATE TABLE IF NOT EXISTS admin_action_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    action_type VARCHAR(100) NOT NULL,
    target_type VARCHAR(100), -- 'user', 'pull_request', 'repository', etc.
    target_id VARCHAR(255),
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_app_users_github_id ON app_users(github_id);
CREATE INDEX IF NOT EXISTS idx_app_users_github_username ON app_users(github_username);
CREATE INDEX IF NOT EXISTS idx_app_users_auth_user_id ON app_users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_active ON user_roles(user_id, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_admin_action_logs_admin_user_id ON admin_action_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_action_logs_created_at ON admin_action_logs(created_at);

-- Function to check if a user is admin
CREATE OR REPLACE FUNCTION is_user_admin(user_github_id BIGINT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM app_users 
        WHERE github_id = user_github_id 
        AND is_admin = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if a user has a specific role
CREATE OR REPLACE FUNCTION user_has_role(user_github_id BIGINT, role_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM app_users au
        JOIN user_roles ur ON au.id = ur.user_id
        WHERE au.github_id = user_github_id 
        AND ur.role_name = user_has_role.role_name
        AND ur.is_active = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to upsert app_user from auth user and GitHub data
CREATE OR REPLACE FUNCTION upsert_app_user(
    p_auth_user_id UUID,
    p_github_id BIGINT,
    p_github_username VARCHAR(255),
    p_display_name VARCHAR(255) DEFAULT NULL,
    p_avatar_url TEXT DEFAULT NULL,
    p_email VARCHAR(255) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    user_id UUID;
BEGIN
    INSERT INTO app_users (
        auth_user_id, github_id, github_username, 
        display_name, avatar_url, email, last_login
    )
    VALUES (
        p_auth_user_id, p_github_id, p_github_username,
        p_display_name, p_avatar_url, p_email, NOW()
    )
    ON CONFLICT (github_id) 
    DO UPDATE SET
        auth_user_id = EXCLUDED.auth_user_id,
        github_username = EXCLUDED.github_username,
        display_name = COALESCE(EXCLUDED.display_name, app_users.display_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, app_users.avatar_url),
        email = COALESCE(EXCLUDED.email, app_users.email),
        updated_at = NOW(),
        last_login = NOW()
    RETURNING id INTO user_id;
    
    RETURN user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log admin actions
CREATE OR REPLACE FUNCTION log_admin_action(
    p_admin_github_id BIGINT,
    p_action_type VARCHAR(100),
    p_target_type VARCHAR(100) DEFAULT NULL,
    p_target_id VARCHAR(255) DEFAULT NULL,
    p_details JSONB DEFAULT '{}',
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    admin_user_id UUID;
    log_id UUID;
BEGIN
    -- Get admin user ID
    SELECT id INTO admin_user_id 
    FROM app_users 
    WHERE github_id = p_admin_github_id;
    
    -- Create log entry
    INSERT INTO admin_action_logs (
        admin_user_id, action_type, target_type, target_id,
        details, ip_address, user_agent
    )
    VALUES (
        admin_user_id, p_action_type, p_target_type, p_target_id,
        p_details, p_ip_address, p_user_agent
    )
    RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable Row Level Security
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_action_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for app_users
-- Allow public read access (for progressive onboarding)
CREATE POLICY "Allow public read access to app_users" ON app_users
    FOR SELECT USING (true);

-- Allow users to update their own records
CREATE POLICY "Users can update own record" ON app_users
    FOR UPDATE USING (auth.uid() = auth_user_id);

-- Allow admins full access
CREATE POLICY "Admins have full access to app_users" ON app_users
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM app_users 
            WHERE auth_user_id = auth.uid() 
            AND is_admin = TRUE
        )
    );

-- RLS Policies for user_roles
-- Allow public read access to active roles
CREATE POLICY "Allow public read access to active user_roles" ON user_roles
    FOR SELECT USING (is_active = TRUE);

-- Allow admins full access
CREATE POLICY "Admins have full access to user_roles" ON user_roles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM app_users 
            WHERE auth_user_id = auth.uid() 
            AND is_admin = TRUE
        )
    );

-- RLS Policies for admin_action_logs
-- Only admins can read logs
CREATE POLICY "Only admins can read admin_action_logs" ON admin_action_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM app_users 
            WHERE auth_user_id = auth.uid() 
            AND is_admin = TRUE
        )
    );

-- Only admins can insert logs (via function)
CREATE POLICY "Only admins can insert admin_action_logs" ON admin_action_logs
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM app_users 
            WHERE auth_user_id = auth.uid() 
            AND is_admin = TRUE
        )
    );

-- Bootstrap admin user: bdougie (GitHub ID: 5713670)
-- Note: This will be updated when they first log in with actual auth_user_id
INSERT INTO app_users (
    github_id, 
    github_username, 
    display_name,
    is_admin
) VALUES (
    5713670,
    'bdougie', 
    'Brian Douglas',
    TRUE
) ON CONFLICT (github_id) DO UPDATE SET
    is_admin = TRUE,
    updated_at = NOW();

-- Grant admin role to bdougie
INSERT INTO user_roles (user_id, role_name)
SELECT id, 'admin'
FROM app_users 
WHERE github_username = 'bdougie'
ON CONFLICT (user_id, role_name, is_active) WHERE is_active = TRUE 
DO NOTHING;

-- Add helpful comments
COMMENT ON TABLE app_users IS 'Application users linked to Supabase Auth and GitHub profiles';
COMMENT ON TABLE user_roles IS 'Flexible role management system for users';
COMMENT ON TABLE admin_action_logs IS 'Audit trail for administrative actions';
COMMENT ON FUNCTION is_user_admin(BIGINT) IS 'Check if a GitHub user ID has admin privileges';
COMMENT ON FUNCTION user_has_role(BIGINT, TEXT) IS 'Check if a GitHub user ID has a specific role';
COMMENT ON FUNCTION upsert_app_user IS 'Create or update app_user from auth and GitHub data';
COMMENT ON FUNCTION log_admin_action IS 'Log administrative actions for audit trail';

COMMIT;

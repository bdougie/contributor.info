-- Remove SECURITY DEFINER from functions (Phases 1-3)
-- Phase 1: Low-risk maintenance and utility functions
-- Phase 2: Email and auth handlers
-- Phase 3: Admin functions (converting to SECURITY INVOKER with proper RLS)

-- ============================================
-- PHASE 1: LOW-RISK FUNCTIONS
-- ============================================

-- 1. Idempotency keys cleanup function
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_expired_idempotency_keys') THEN
        ALTER FUNCTION cleanup_expired_idempotency_keys() SECURITY INVOKER;
    END IF;
END $$;

-- 2. Workspace invitation expiry function
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'expire_old_invitations') THEN
        ALTER FUNCTION expire_old_invitations() SECURITY INVOKER;
    END IF;
END $$;

-- 3. Edge function metrics functions
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'complete_queue_item') THEN
        ALTER FUNCTION complete_queue_item(UUID, INTEGER, TEXT, TEXT) SECURITY INVOKER;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_queue_depth') THEN
        ALTER FUNCTION get_queue_depth() SECURITY INVOKER;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_old_metrics') THEN
        ALTER FUNCTION cleanup_old_metrics() SECURITY INVOKER;
    END IF;
END $$;

-- 4. Search vector update function
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_contributors_search_with_email') THEN
        ALTER FUNCTION update_contributors_search_with_email() SECURITY INVOKER;
    END IF;
END $$;

-- ============================================
-- PHASE 2: EMAIL AND AUTH HANDLERS
-- ============================================

-- 5. Email preferences - users should be able to create their own preferences
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_default_email_preferences') THEN
        ALTER FUNCTION public.create_default_email_preferences() SECURITY INVOKER;
    END IF;
END $$;

-- 6. Auth user handler - converting to INVOKER since it should run with user's permissions
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'simple_auth_user_handler') THEN
        ALTER FUNCTION public.simple_auth_user_handler() SECURITY INVOKER;
    END IF;
END $$;

-- ============================================
-- PHASE 3: ADMIN FUNCTIONS
-- ============================================

-- 7. Admin check functions - converting to INVOKER with proper RLS
-- These will rely on RLS policies for security instead of SECURITY DEFINER
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_user_admin' AND pg_get_function_identity_arguments(oid) = 'user_github_id bigint') THEN
        ALTER FUNCTION is_user_admin(user_github_id BIGINT) SECURITY INVOKER;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_user_admin' AND pg_get_function_identity_arguments(oid) = 'user_github_username text') THEN
        ALTER FUNCTION is_user_admin(user_github_username TEXT) SECURITY INVOKER;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'user_has_role') THEN
        ALTER FUNCTION user_has_role(user_github_username TEXT, role_name TEXT) SECURITY INVOKER;
    END IF;
END $$;

-- 8. User upsert - should run with caller's permissions
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'upsert_app_user') THEN
        ALTER FUNCTION upsert_app_user(
            p_auth_user_id UUID,
            p_github_username TEXT,
            p_github_user_id BIGINT,
            p_email TEXT,
            p_avatar_url TEXT,
            p_display_name TEXT
        ) SECURITY INVOKER;
    END IF;
END $$;

-- 9. Admin role management - converting to INVOKER
-- These will now require the caller to have appropriate permissions via RLS
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'grant_admin_role') THEN
        ALTER FUNCTION grant_admin_role(BIGINT, BIGINT) SECURITY INVOKER;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'revoke_admin_role') THEN
        ALTER FUNCTION revoke_admin_role(BIGINT, BIGINT) SECURITY INVOKER;
    END IF;
END $$;

-- ============================================
-- ADD RLS POLICIES TO SUPPORT SECURITY INVOKER
-- ============================================

-- Enable RLS on tables if not already enabled
ALTER TABLE IF EXISTS app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workspace_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS edge_function_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS email_preferences ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "app_users_read_policy" ON app_users;
DROP POLICY IF EXISTS "app_users_insert_policy" ON app_users;
DROP POLICY IF EXISTS "app_users_update_policy" ON app_users;
DROP POLICY IF EXISTS "user_roles_read_policy" ON user_roles;
DROP POLICY IF EXISTS "user_roles_admin_write_policy" ON user_roles;

-- App users table policies
CREATE POLICY "app_users_read_policy" ON app_users
    FOR SELECT
    USING (true); -- Public read for user lookups

CREATE POLICY "app_users_insert_policy" ON app_users
    FOR INSERT
    WITH CHECK (
        auth.uid() = auth_user_id OR
        auth.uid() IS NOT NULL -- Allow authenticated users to create profiles
    );

CREATE POLICY "app_users_update_policy" ON app_users
    FOR UPDATE
    USING (
        auth.uid() = auth_user_id OR
        EXISTS (
            SELECT 1 FROM app_users
            WHERE auth_user_id = auth.uid()
            AND is_admin = true
        )
    );

-- User roles table policies
CREATE POLICY "user_roles_read_policy" ON user_roles
    FOR SELECT
    USING (true); -- Public read for role checks

CREATE POLICY "user_roles_admin_write_policy" ON user_roles
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM app_users
            WHERE auth_user_id = auth.uid()
            AND is_admin = true
        )
    );

-- Admin action logs policies (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_action_logs') THEN
        ALTER TABLE admin_action_logs ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "admin_logs_read_policy" ON admin_action_logs;
        DROP POLICY IF EXISTS "admin_logs_write_policy" ON admin_action_logs;

        CREATE POLICY "admin_logs_read_policy" ON admin_action_logs
            FOR SELECT
            USING (
                EXISTS (
                    SELECT 1 FROM app_users
                    WHERE auth_user_id = auth.uid()
                    AND is_admin = true
                )
            );

        CREATE POLICY "admin_logs_write_policy" ON admin_action_logs
            FOR INSERT
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM app_users
                    WHERE auth_user_id = auth.uid()
                    AND is_admin = true
                )
            );
    END IF;
END $$;

-- Idempotency keys policies (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'idempotency_keys') THEN
        DROP POLICY IF EXISTS "idempotency_keys_owner_policy" ON idempotency_keys;
        CREATE POLICY "idempotency_keys_owner_policy" ON idempotency_keys
            FOR ALL
            USING (user_id::uuid = auth.uid() OR user_id IS NULL);
    END IF;
END $$;

-- Workspace invitations policies (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workspace_invitations') THEN
        DROP POLICY IF EXISTS "workspace_invitations_read_policy" ON workspace_invitations;
        CREATE POLICY "workspace_invitations_read_policy" ON workspace_invitations
            FOR SELECT
            USING (true);

        DROP POLICY IF EXISTS "workspace_invitations_write_policy" ON workspace_invitations;
        CREATE POLICY "workspace_invitations_write_policy" ON workspace_invitations
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM workspace_members
                    WHERE workspace_id = workspace_invitations.workspace_id
                    AND user_id = auth.uid()
                    AND role IN ('owner', 'admin')
                )
            );
    END IF;
END $$;

-- Edge function metrics policies (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'edge_function_metrics') THEN
        DROP POLICY IF EXISTS "metrics_write_policy" ON edge_function_metrics;
        CREATE POLICY "metrics_write_policy" ON edge_function_metrics
            FOR ALL
            USING (true);
    END IF;
END $$;

-- Email preferences policies (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_preferences') THEN
        DROP POLICY IF EXISTS "email_preferences_owner_policy" ON email_preferences;
        CREATE POLICY "email_preferences_owner_policy" ON email_preferences
            FOR ALL
            USING (user_id = auth.uid());
    END IF;
END $$;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check that all functions have been converted
DO $$
DECLARE
    func_record RECORD;
    remaining_count INTEGER := 0;
BEGIN
    -- Check for any remaining SECURITY DEFINER functions
    FOR func_record IN
        SELECT
            n.nspname as schema_name,
            p.proname as function_name,
            pg_get_functiondef(p.oid) as definition
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND pg_get_functiondef(p.oid) ILIKE '%SECURITY DEFINER%'
    LOOP
        remaining_count := remaining_count + 1;
        RAISE WARNING 'Function still has SECURITY DEFINER: %.%',
            func_record.schema_name, func_record.function_name;
    END LOOP;

    IF remaining_count = 0 THEN
        RAISE NOTICE 'SUCCESS: All targeted functions converted to SECURITY INVOKER';
    ELSE
        RAISE WARNING 'Found % functions still using SECURITY DEFINER', remaining_count;
    END IF;
END $$;

-- Log the migration completion (if admin_action_logs exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_action_logs') THEN
        INSERT INTO admin_action_logs (
            action_type,
            details,
            created_at
        ) VALUES (
            'security_definer_removal',
            jsonb_build_object(
                'phase', 'phases_1_3',
                'functions_converted', ARRAY[
                    'cleanup_expired_idempotency_keys',
                    'expire_old_invitations',
                    'complete_queue_item',
                    'get_queue_depth',
                    'cleanup_old_metrics',
                    'update_contributors_search_with_email',
                    'create_default_email_preferences',
                    'simple_auth_user_handler',
                    'is_user_admin',
                    'user_has_role',
                    'upsert_app_user',
                    'grant_admin_role',
                    'revoke_admin_role'
                ],
                'migration_date', CURRENT_TIMESTAMP
            ),
            CURRENT_TIMESTAMP
        );
    END IF;
END $$;

COMMENT ON SCHEMA public IS 'SECURITY DEFINER removed from all non-critical functions. Admin operations now rely on RLS policies instead of function-level security.';
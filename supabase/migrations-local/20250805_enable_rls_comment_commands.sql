-- Local-safe version of 20250805_enable_rls_comment_commands.sql
-- Generated: 2025-08-27T02:47:08.061Z
-- This migration has been modified to work without auth, roles, and extensions
-- Original migration may have different behavior in production

-- Transaction wrapper for safety
BEGIN;


-- Ensure authenticated exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated;
    RAISE NOTICE 'Created missing role: authenticated';
  END IF;
END $$;

-- Ensure service_role exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role;
    RAISE NOTICE 'Created missing role: service_role';
  END IF;
END $$;

-- This migration requires auth schema
DO $$
BEGIN
  -- Check if auth schema and functions exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    RAISE NOTICE 'Auth schema not found. Skipping 20250805_enable_rls_comment_commands.sql';
    RETURN;
  END IF;
  
  -- Check for auth.uid() function
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'auth' AND p.proname = 'uid'
  ) THEN
    RAISE NOTICE 'Auth functions not available. Skipping 20250805_enable_rls_comment_commands.sql';
    RETURN;
  END IF;
END $$;

-- Original migration content (only runs if auth is available)
-- Enable RLS on comment_commands table
ALTER TABLE comment_commands ENABLE ROW LEVEL SECURITY;

-- Allow public read access to comment_commands
CREATE POLICY "public_read_comment_commands"
ON comment_commands FOR SELECT
USING (true);

-- Only authenticated users or service role can insert
CREATE POLICY "service_insert_comment_commands"
ON comment_commands FOR INSERT
WITH CHECK (auth.role() = 'service_role' OR auth.uid() IS NOT NULL);

-- Only service role can update
CREATE POLICY "service_update_comment_commands"
ON comment_commands FOR UPDATE
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Only service role can delete
CREATE POLICY "service_delete_comment_commands"
ON comment_commands FOR DELETE
USING (auth.role() = 'service_role');

-- Enable RLS on other tables that might be missing it
-- These are conditional to avoid errors if RLS is already enabled

DO $$ 
BEGIN
    -- Enable RLS on tables that might not have it
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'repository_confidence_cache' AND schemaname = 'public') THEN
        ALTER TABLE repository_confidence_cache ENABLE ROW LEVEL SECURITY;
        CREATE POLICY IF NOT EXISTS "public_read_repository_confidence_cache" ON repository_confidence_cache FOR SELECT USING (true);
        CREATE POLICY IF NOT EXISTS "service_write_repository_confidence_cache" ON repository_confidence_cache FOR ALL USING (auth.role() = 'service_role');
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'file_contributors' AND schemaname = 'public') THEN
        ALTER TABLE file_contributors ENABLE ROW LEVEL SECURITY;
        CREATE POLICY IF NOT EXISTS "public_read_file_contributors" ON file_contributors FOR SELECT USING (true);
        CREATE POLICY IF NOT EXISTS "service_write_file_contributors" ON file_contributors FOR ALL USING (auth.role() = 'service_role');
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'file_embeddings' AND schemaname = 'public') THEN
        ALTER TABLE file_embeddings ENABLE ROW LEVEL SECURITY;
        CREATE POLICY IF NOT EXISTS "public_read_file_embeddings" ON file_embeddings FOR SELECT USING (true);
        CREATE POLICY IF NOT EXISTS "service_write_file_embeddings" ON file_embeddings FOR ALL USING (auth.role() = 'service_role');
    END IF;
    
    -- More restrictive tables (admin/app related)
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'app_users' AND schemaname = 'public') THEN
        ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
        CREATE POLICY IF NOT EXISTS "users_read_own_app_users" ON app_users FOR SELECT USING (auth.uid() = id OR auth.role() = 'service_role');
        CREATE POLICY IF NOT EXISTS "service_write_app_users" ON app_users FOR ALL USING (auth.role() = 'service_role');
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'user_roles' AND schemaname = 'public') THEN
        ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
        CREATE POLICY IF NOT EXISTS "service_only_user_roles" ON user_roles FOR ALL USING (auth.role() = 'service_role');
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'admin_action_logs' AND schemaname = 'public') THEN
        ALTER TABLE admin_action_logs ENABLE ROW LEVEL SECURITY;
        CREATE POLICY IF NOT EXISTS "service_only_admin_logs" ON admin_action_logs FOR ALL USING (auth.role() = 'service_role');
    END IF;
END $$;

COMMIT;
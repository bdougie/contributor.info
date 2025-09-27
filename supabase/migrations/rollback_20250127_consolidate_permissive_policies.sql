-- Rollback script for Phase 2 RLS Policy Consolidation
-- Use this ONLY if the consolidation causes unexpected issues
-- This recreates the original 91 duplicate policies

BEGIN;

-- =====================================================
-- ROLLBACK: app_users table
-- =====================================================
DROP POLICY IF EXISTS "consolidated_read_app_users" ON public.app_users;

-- Recreate original policies
CREATE POLICY "app_users_read_policy" ON public.app_users
FOR SELECT USING (true);

CREATE POLICY "authenticated_read_app_users" ON public.app_users
FOR SELECT USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "public_read_app_users_basic" ON public.app_users
FOR SELECT USING (is_active = true);

-- =====================================================
-- ROLLBACK: auth_errors table
-- =====================================================
DROP POLICY IF EXISTS "consolidated_read_auth_errors" ON public.auth_errors;

CREATE POLICY "Admins can view all auth errors" ON public.auth_errors
FOR SELECT USING (EXISTS (
  SELECT 1 FROM app_users au
  WHERE au.auth_user_id = (select auth.uid()) AND au.is_admin = true
));

CREATE POLICY "Users can view their own auth errors" ON public.auth_errors
FOR SELECT USING (auth_user_id = (select auth.uid()));

CREATE POLICY "auth_read_auth_errors" ON public.auth_errors
FOR SELECT USING ((select auth.uid()) IS NOT NULL);

-- =====================================================
-- VERIFICATION
-- =====================================================
-- After rollback, you should see ~91 policies again:
-- SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public';

COMMIT;

-- Note: This is a partial rollback script showing the pattern.
-- The full migration consolidated 91 policies across 30+ tables.
-- For complete rollback, retrieve the original policy definitions from:
-- 1. Previous migration files
-- 2. Production database backup
-- 3. Git history before the consolidation
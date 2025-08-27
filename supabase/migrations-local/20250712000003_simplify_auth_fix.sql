-- Local-safe version of 20250712000003_simplify_auth_fix.sql
-- Generated: 2025-08-27T02:47:08.053Z
-- This migration has been modified to work without auth, roles, and extensions
-- Original migration may have different behavior in production

-- Transaction wrapper for safety
BEGIN;

-- Simplify auth fix - remove the problematic trigger and use a simpler approach

-- First, drop the existing triggers that are causing the error
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_auth_user();
DROP FUNCTION IF EXISTS public.handle_auth_user_login();

-- Create a simplified trigger that just ensures the user can log in
-- We'll handle the app_users creation in the frontend
CREATE OR REPLACE FUNCTION public.simple_auth_user_handler()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Just return NEW without any processing
    -- This prevents the "Database error saving new user" issue
    RETURN NEW;
END;
$$;

-- Only log warnings if we need to debug
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION public.simple_auth_user_handler();

COMMIT;
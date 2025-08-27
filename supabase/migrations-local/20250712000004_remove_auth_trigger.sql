-- Local-safe version of 20250712000004_remove_auth_trigger.sql
-- Generated: 2025-08-27T02:47:08.053Z
-- This migration has been modified to work without auth, roles, and extensions
-- Original migration may have different behavior in production

-- Transaction wrapper for safety
BEGIN;

-- Remove all auth triggers to fix the "Database error saving new user" issue
-- The frontend fallback logic will handle creating app_users records

-- Drop all triggers on auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users;

-- Drop the trigger functions
DROP FUNCTION IF EXISTS public.handle_new_auth_user();
DROP FUNCTION IF EXISTS public.handle_auth_user_login();
DROP FUNCTION IF EXISTS public.simple_auth_user_handler();
DROP FUNCTION IF EXISTS public.create_missing_app_users_records();

COMMIT;
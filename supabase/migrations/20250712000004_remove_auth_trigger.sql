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
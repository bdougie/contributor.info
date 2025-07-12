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
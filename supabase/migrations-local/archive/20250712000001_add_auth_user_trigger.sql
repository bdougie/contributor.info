-- Local-safe version of 20250712000001_add_auth_user_trigger.sql
-- Generated: 2025-08-27T02:47:08.052Z
-- This migration has been modified to work without auth, roles, and extensions
-- Original migration may have different behavior in production

-- Transaction wrapper for safety
BEGIN;


-- Ensure anon exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon;
    RAISE NOTICE 'Created missing role: anon';
  END IF;
END $$;

-- Ensure authenticated exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated;
    RAISE NOTICE 'Created missing role: authenticated';
  END IF;
END $$;

-- Migration to automatically create app_users entry when a new user logs in via GitHub OAuth
-- This fixes the "Database error saving new user" issue

-- CREATE OR REPLACE FUNCTION to handle new auth user creation
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger AS $$
BEGIN
    -- Only process if the user has GitHub metadata
    IF NEW.raw_user_meta_data->>'provider_id' IS NOT NULL AND 
       NEW.raw_user_meta_data->>'user_name' IS NOT NULL THEN
        
        -- Insert or update the app_users table
        INSERT INTO public.app_users (
            auth_user_id,
            github_id,
            github_username,
            display_name,
            avatar_url,
            email,
            last_login
        )
        VALUES (
            NEW.id,
            (NEW.raw_user_meta_data->>'provider_id')::BIGINT,
            NEW.raw_user_meta_data->>'user_name',
            COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
            NEW.raw_user_meta_data->>'avatar_url',
            COALESCE(NEW.raw_user_meta_data->>'email', NEW.email),
            NOW()
        )
        ON CONFLICT (github_id) 
        DO UPDATE SET
            auth_user_id = EXCLUDED.auth_user_id,
            github_username = EXCLUDED.github_username,
            display_name = COALESCE(EXCLUDED.display_name, app_users.display_name),
            avatar_url = COALESCE(EXCLUDED.avatar_url, app_users.avatar_url),
            email = COALESCE(EXCLUDED.email, app_users.email),
            updated_at = NOW(),
            last_login = NOW();
            
        -- Also ensure the user exists in the contributors table
        INSERT INTO public.contributors (
            github_id,
            username,
            display_name,
            avatar_url,
            email,
            profile_url
        )
        VALUES (
            (NEW.raw_user_meta_data->>'provider_id')::BIGINT,
            NEW.raw_user_meta_data->>'user_name',
            COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
            NEW.raw_user_meta_data->>'avatar_url',
            COALESCE(NEW.raw_user_meta_data->>'email', NEW.email),
            COALESCE(NEW.raw_user_meta_data->>'html_url', 
                     'https://github.com/' || (NEW.raw_user_meta_data->>'user_name'))
        )
        ON CONFLICT (github_id) 
        DO UPDATE SET
            username = EXCLUDED.username,
            display_name = COALESCE(EXCLUDED.display_name, contributors.display_name),
            avatar_url = COALESCE(EXCLUDED.avatar_url, contributors.avatar_url),
            email = COALESCE(EXCLUDED.email, contributors.email),
            last_updated_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_new_auth_user();

-- CREATE OR REPLACE FUNCTION to handle auth user updates (for login events)
CREATE OR REPLACE FUNCTION public.handle_auth_user_login()
RETURNS trigger AS $$
BEGIN
    -- Only process if last_sign_in_at has changed and user has GitHub metadata
    IF NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at AND
       NEW.raw_user_meta_data->>'provider_id' IS NOT NULL AND 
       NEW.raw_user_meta_data->>'user_name' IS NOT NULL THEN
        
        -- Update last login time
        UPDATE public.app_users 
        SET last_login = NOW(),
            updated_at = NOW()
        WHERE auth_user_id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for user login updates
DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users;
CREATE TRIGGER on_auth_user_login
    AFTER UPDATE ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_auth_user_login();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO postgres, authenticated, anon;
GRANT SELECT ON auth.users TO postgres, authenticated;

-- Add helpful comments
COMMENT ON FUNCTION public.handle_new_auth_user() IS 'Automatically creates app_users and contributors entries when a new user signs up via GitHub OAuth';
COMMENT ON FUNCTION public.handle_auth_user_login() IS 'Updates last login time when a user logs in';

COMMIT;

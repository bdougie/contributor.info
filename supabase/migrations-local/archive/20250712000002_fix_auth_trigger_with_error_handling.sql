-- Local-safe version of 20250712000002_fix_auth_trigger_with_error_handling.sql
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

-- Fix auth trigger with proper error handling and variable declaration
-- This matches the implementation from the post-mortem

-- Drop existing function and trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_auth_user();

-- Create improved function with error handling
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger AS $$
DECLARE
    github_user_id BIGINT;
    github_username TEXT;
    user_display_name TEXT;
    user_avatar_url TEXT;
    user_email TEXT;
BEGIN
    -- Extract GitHub metadata from the auth user
    github_user_id := COALESCE(
        (NEW.raw_user_meta_data->>'provider_id')::BIGINT,
        (NEW.raw_user_meta_data->>'sub')::BIGINT
    );
    
    github_username := NEW.raw_user_meta_data->>'user_name';
    user_display_name := NEW.raw_user_meta_data->>'full_name';
    user_avatar_url := NEW.raw_user_meta_data->>'avatar_url';
    user_email := COALESCE(NEW.email, NEW.raw_user_meta_data->>'email');

    -- Only proceed if we have GitHub data
    IF github_user_id IS NOT NULL AND github_username IS NOT NULL THEN
        -- Use the existing upsert_app_user function to create the record
        PERFORM upsert_app_user(
            NEW.id,                    -- auth_user_id
            github_user_id,            -- github_id
            github_username,           -- github_username
            user_display_name,         -- display_name
            user_avatar_url,          -- avatar_url
            user_email                -- email
        );
    END IF;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the auth user creation
        RAISE WARNING 'Failed to create app_users record for auth user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create app_users record
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_auth_user();

-- Also create a function to handle existing users who don't have app_users records
CREATE OR REPLACE FUNCTION public.create_missing_app_users_records()
RETURNS void AS $$
DECLARE
    auth_user RECORD;
    github_user_id BIGINT;
    github_username TEXT;
    user_display_name TEXT;
    user_avatar_url TEXT;
    user_email TEXT;
BEGIN
    -- Loop through all auth.users that don't have corresponding app_users records
    FOR auth_user IN 
        SELECT u.* 
        FROM auth.users u
        LEFT JOIN public.app_users au ON u.id = au.auth_user_id
        WHERE au.id IS NULL
        AND u.raw_user_meta_data->>'provider_id' IS NOT NULL
    LOOP
        -- Extract GitHub metadata
        github_user_id := COALESCE(
            (auth_user.raw_user_meta_data->>'provider_id')::BIGINT,
            (auth_user.raw_user_meta_data->>'sub')::BIGINT
        );
        
        github_username := auth_user.raw_user_meta_data->>'user_name';
        user_display_name := auth_user.raw_user_meta_data->>'full_name';
        user_avatar_url := auth_user.raw_user_meta_data->>'avatar_url';
        user_email := COALESCE(auth_user.email, auth_user.raw_user_meta_data->>'email');

        -- Create the missing app_users record
        IF github_user_id IS NOT NULL AND github_username IS NOT NULL THEN
            BEGIN
                PERFORM upsert_app_user(
                    auth_user.id,
                    github_user_id,
                    github_username,
                    user_display_name,
                    user_avatar_url,
                    user_email
                );
                RAISE NOTICE 'Created app_users record for %', github_username;
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE WARNING 'Failed to create app_users record for %: %', github_username, SQLERRM;
            END;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run the function to create any missing records
SELECT public.create_missing_app_users_records();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO postgres, authenticated, anon;
GRANT SELECT ON auth.users TO postgres, authenticated;

COMMIT;

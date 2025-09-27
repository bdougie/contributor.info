-- Local-safe version of 20250712000005_fix_email_preferences_trigger.sql
-- Generated: 2025-08-27T02:47:08.053Z
-- This migration has been modified to work without auth, roles, and extensions
-- Original migration may have different behavior in production

-- Transaction wrapper for safety
BEGIN;

-- Fix the email preferences trigger that's causing auth errors

-- Drop and recreate the trigger function with better error handling
CREATE OR REPLACE FUNCTION public.create_default_email_preferences()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Try to insert email preferences, but don't fail if it errors
    BEGIN
        INSERT INTO user_email_preferences (
            user_id,
            welcome_emails,
            marketing_emails,
            notification_emails,
            transactional_emails,
            consent_given_at,
            privacy_policy_version,
            terms_accepted_at,
            consent_method
        ) VALUES (
            NEW.id,
            true,  -- Welcome emails enabled by default
            false, -- Marketing requires explicit consent
            true,  -- Notifications enabled by default
            true,  -- Transactional always enabled
            NEW.created_at,
            '1.0',
            NEW.created_at,
            'signup'
        )
        ON CONFLICT (user_id) DO NOTHING; -- Don't fail if record already exists
    EXCEPTION
        WHEN OTHERS THEN
            -- Log the error but don't fail the auth process
            RAISE WARNING 'Failed to create email preferences for user %: %', NEW.id, SQLERRM;
    END;
    
    RETURN NEW;
END;
$$;

-- Make sure the trigger exists with the correct settings
DROP TRIGGER IF EXISTS create_user_email_preferences_trigger ON auth.users;
CREATE TRIGGER create_user_email_preferences_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.create_default_email_preferences();

COMMIT;

-- Local-safe version of 20250712000006_disable_email_trigger.sql
-- Generated: 2025-08-27T02:47:08.053Z
-- This migration has been modified to work without auth, roles, and extensions
-- Original migration may have different behavior in production

-- Transaction wrapper for safety
BEGIN;

-- Temporarily disable the email preferences trigger to fix auth issues
-- We'll handle email preferences in the app instead

DROP TRIGGER IF EXISTS create_user_email_preferences_trigger ON auth.users;

-- Keep the function but don't use it as a trigger
-- This way we can call it manually if needed

COMMIT;

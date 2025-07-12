-- Temporarily disable the email preferences trigger to fix auth issues
-- We'll handle email preferences in the app instead

DROP TRIGGER IF EXISTS create_user_email_preferences_trigger ON auth.users;

-- Keep the function but don't use it as a trigger
-- This way we can call it manually if needed
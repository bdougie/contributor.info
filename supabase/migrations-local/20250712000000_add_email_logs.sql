-- Local-safe version of 20250712000000_add_email_logs.sql
-- Generated: 2025-08-27T02:47:08.051Z
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

-- Ensure service_role exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role;
    RAISE NOTICE 'Created missing role: service_role';
  END IF;
END $$;

-- This migration requires auth schema
DO $$
BEGIN
  -- Check if auth schema and functions exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    RAISE NOTICE 'Auth schema not found. Skipping 20250712000000_add_email_logs.sql';
    RETURN;
  END IF;
  
  -- Check for auth.uid() function
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'auth' AND p.proname = 'uid'
  ) THEN
    RAISE NOTICE 'Auth functions not available. Skipping 20250712000000_add_email_logs.sql';
    RETURN;
  END IF;
END $$;

-- Original migration content (only runs if auth is available)
-- Add email logs table for tracking sent emails
CREATE TABLE IF NOT EXISTS email_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    email_type text NOT NULL CHECK (email_type IN ('welcome', 'notification', 'marketing', 'transactional')),
    recipient_email text NOT NULL,
    resend_email_id text, -- Resend API email ID for tracking
    sent_at timestamptz DEFAULT now(),
    failed_at timestamptz,
    error_message text,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_email_type ON email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient_email ON email_logs(recipient_email);

-- Add RLS policy to allow users to see their own email logs
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own email logs
CREATE POLICY "Users can view their own email logs" ON email_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Service role can manage all email logs
CREATE POLICY "Service role can manage email logs" ON email_logs
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Add a trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_email_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_email_logs_updated_at
    BEFORE UPDATE ON email_logs
    FOR EACH ROW
    EXECUTE PROCEDURE update_email_logs_updated_at();

-- Add a function to check email sending rate limits (optional)
CREATE OR REPLACE FUNCTION check_email_rate_limit(
    p_user_id uuid,
    p_email_type text,
    p_time_window interval DEFAULT '1 hour',
    p_max_emails integer DEFAULT 5
)
RETURNS boolean AS $$
DECLARE
    email_count integer;
BEGIN
    SELECT COUNT(*)
    INTO email_count
    FROM email_logs
    WHERE user_id = p_user_id
      AND email_type = p_email_type
      AND sent_at > (now() - p_time_window)
      AND failed_at IS NULL;
    
    RETURN email_count < p_max_emails;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
  ELSE
    RAISE NOTICE 'Role anon not found, skipping grant';
  END IF;
END $;
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT ON email_logs TO anon, authenticated;
  ELSE
    RAISE NOTICE 'Role anon not found, skipping grant';
  END IF;
END $;
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON email_logs TO service_role;
  ELSE
    RAISE NOTICE 'Role service_role not found, skipping grant';
  END IF;
END $;

COMMIT;
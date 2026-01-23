-- Migration: Add API Keys Table for Unkey Integration
-- This table stores metadata about user API keys managed by Unkey

-- Create the api_keys table
CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    unkey_key_id VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    prefix VARCHAR(50),
    last_four VARCHAR(4),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
);

-- Create index for faster lookups by user_id
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON public.api_keys(user_id);

-- Create index for faster lookups by unkey_key_id
CREATE INDEX IF NOT EXISTS idx_api_keys_unkey_key_id ON public.api_keys(unkey_key_id);

-- Enable Row Level Security
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own API keys
CREATE POLICY "Users can view own api_keys"
    ON public.api_keys
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own API keys
CREATE POLICY "Users can insert own api_keys"
    ON public.api_keys
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own API keys (for revocation)
CREATE POLICY "Users can update own api_keys"
    ON public.api_keys
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Grant permissions to authenticated users
-- NOTE: DELETE intentionally omitted - keys are soft-deleted via revoked_at column
-- This prevents accidental data loss and maintains audit trail of key usage
GRANT SELECT, INSERT, UPDATE ON public.api_keys TO authenticated;

-- Grant permissions to service role for admin operations
GRANT ALL ON public.api_keys TO service_role;

-- Add comment for documentation
COMMENT ON TABLE public.api_keys IS 'Stores metadata for API keys managed by Unkey';
COMMENT ON COLUMN public.api_keys.unkey_key_id IS 'Unique identifier from Unkey';
COMMENT ON COLUMN public.api_keys.prefix IS 'Key prefix for display (e.g., ck_live)';
COMMENT ON COLUMN public.api_keys.last_four IS 'Last 4 characters for identification';
COMMENT ON COLUMN public.api_keys.revoked_at IS 'Timestamp when key was revoked, NULL if active';

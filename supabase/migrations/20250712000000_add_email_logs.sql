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

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON email_logs TO anon, authenticated;
GRANT ALL ON email_logs TO service_role;
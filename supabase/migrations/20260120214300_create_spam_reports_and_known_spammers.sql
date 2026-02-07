-- Migration: Create spam_reports and known_spammers tables
-- Issue: #1622 - Known Spammer Community Database

-- Create spam_reports table for community-submitted spam reports
CREATE TABLE IF NOT EXISTS public.spam_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_url TEXT NOT NULL,
  pr_owner TEXT NOT NULL,
  pr_repo TEXT NOT NULL,
  pr_number INTEGER NOT NULL,
  contributor_github_login TEXT,
  spam_category TEXT NOT NULL CHECK (spam_category IN (
    'hacktoberfest', 'bot_automated', 'fake_contribution',
    'self_promotion', 'low_quality', 'other'
  )),
  description TEXT,
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reporter_ip_hash TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected', 'duplicate')),
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  report_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pr_owner, pr_repo, pr_number)
);

-- Create known_spammers table for tracking verified spammers
CREATE TABLE IF NOT EXISTS public.known_spammers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_login TEXT UNIQUE NOT NULL,
  github_id BIGINT UNIQUE,
  spam_pr_count INTEGER DEFAULT 0,
  first_reported_at TIMESTAMPTZ DEFAULT NOW(),
  last_reported_at TIMESTAMPTZ DEFAULT NOW(),
  verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'verified', 'appealed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for spam_reports
CREATE INDEX IF NOT EXISTS idx_spam_reports_status ON public.spam_reports(status);
CREATE INDEX IF NOT EXISTS idx_spam_reports_contributor ON public.spam_reports(contributor_github_login);
CREATE INDEX IF NOT EXISTS idx_spam_reports_reporter ON public.spam_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_spam_reports_category ON public.spam_reports(spam_category);
CREATE INDEX IF NOT EXISTS idx_spam_reports_created_at ON public.spam_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_spam_reports_pr_lookup ON public.spam_reports(pr_owner, pr_repo, pr_number);

-- Create indexes for known_spammers
CREATE INDEX IF NOT EXISTS idx_known_spammers_status ON public.known_spammers(verification_status);
CREATE INDEX IF NOT EXISTS idx_known_spammers_login ON public.known_spammers(github_login);
CREATE INDEX IF NOT EXISTS idx_known_spammers_spam_count ON public.known_spammers(spam_pr_count DESC);

-- Enable RLS on both tables
ALTER TABLE public.spam_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.known_spammers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for spam_reports
-- Anyone can read verified reports
CREATE POLICY "Anyone can read verified spam reports"
  ON public.spam_reports
  FOR SELECT
  USING (status = 'verified');

-- Authenticated users can read their own reports
CREATE POLICY "Users can read their own reports"
  ON public.spam_reports
  FOR SELECT
  TO authenticated
  USING (reporter_id = auth.uid());

-- Authenticated users can submit reports
CREATE POLICY "Authenticated users can submit spam reports"
  ON public.spam_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = auth.uid());

-- Anonymous users can submit reports (with IP hash for rate limiting)
CREATE POLICY "Anonymous users can submit spam reports"
  ON public.spam_reports
  FOR INSERT
  TO anon
  WITH CHECK (reporter_id IS NULL AND reporter_ip_hash IS NOT NULL);

-- Admins can manage all reports (using service role or admin check)
CREATE POLICY "Service role can manage all spam reports"
  ON public.spam_reports
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for known_spammers
-- Anyone can read verified spammers
CREATE POLICY "Anyone can read verified spammers"
  ON public.known_spammers
  FOR SELECT
  USING (verification_status = 'verified');

-- Service role can manage all spammers
CREATE POLICY "Service role can manage all spammers"
  ON public.known_spammers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_spam_reports_updated_at ON public.spam_reports;
CREATE TRIGGER update_spam_reports_updated_at
  BEFORE UPDATE ON public.spam_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_known_spammers_updated_at ON public.known_spammers;
CREATE TRIGGER update_known_spammers_updated_at
  BEFORE UPDATE ON public.known_spammers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE public.spam_reports IS 'Community-submitted spam PR reports for the Known Spammer Database';
COMMENT ON TABLE public.known_spammers IS 'Aggregated list of known spam contributors';
COMMENT ON COLUMN public.spam_reports.reporter_ip_hash IS 'Hashed IP for rate limiting anonymous reports';
COMMENT ON COLUMN public.spam_reports.report_count IS 'Increments when duplicate reports are submitted';
COMMENT ON COLUMN public.known_spammers.verification_status IS 'unverified=pending review, verified=confirmed spammer, appealed=under appeal';

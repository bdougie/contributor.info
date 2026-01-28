-- Migration: Add spam_reporters table for tracking reporter reputation
-- Protects against DDoS and false submissions
-- Issue: #1622 - Known Spammer Community Database

-- Create spam_reporters table for tracking reporter activity and reputation
CREATE TABLE IF NOT EXISTS public.spam_reporters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_hash TEXT,
  github_login TEXT,
  total_reports INTEGER DEFAULT 0,
  verified_reports INTEGER DEFAULT 0,
  rejected_reports INTEGER DEFAULT 0,
  accuracy_score DECIMAL(5,2) DEFAULT 0.00,
  is_trusted BOOLEAN DEFAULT false,
  is_banned BOOLEAN DEFAULT false,
  ban_reason TEXT,
  banned_at TIMESTAMPTZ,
  banned_by UUID REFERENCES auth.users(id),
  last_report_at TIMESTAMPTZ,
  reports_today INTEGER DEFAULT 0,
  reports_this_hour INTEGER DEFAULT 0,
  hour_window_start TIMESTAMPTZ DEFAULT NOW(),
  day_window_start TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id),
  UNIQUE(ip_hash)
);

-- Create indexes for spam_reporters
CREATE INDEX IF NOT EXISTS idx_spam_reporters_user ON public.spam_reporters(user_id);
CREATE INDEX IF NOT EXISTS idx_spam_reporters_ip ON public.spam_reporters(ip_hash);
CREATE INDEX IF NOT EXISTS idx_spam_reporters_banned ON public.spam_reporters(is_banned);
CREATE INDEX IF NOT EXISTS idx_spam_reporters_trusted ON public.spam_reporters(is_trusted);
CREATE INDEX IF NOT EXISTS idx_spam_reporters_accuracy ON public.spam_reporters(accuracy_score DESC);

-- Enable RLS
ALTER TABLE public.spam_reporters ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can read their own reporter stats
CREATE POLICY "Users can read their own reporter stats"
  ON public.spam_reporters
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Service role can manage all reporters
CREATE POLICY "Service role can manage all reporters"
  ON public.spam_reporters
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_spam_reporters_updated_at ON public.spam_reporters;
CREATE TRIGGER update_spam_reporters_updated_at
  BEFORE UPDATE ON public.spam_reporters
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add reporter_id reference to spam_reports for linking
ALTER TABLE public.spam_reports
ADD COLUMN IF NOT EXISTS spam_reporter_id UUID REFERENCES public.spam_reporters(id);

CREATE INDEX IF NOT EXISTS idx_spam_reports_reporter_ref ON public.spam_reports(spam_reporter_id);

-- Function to check rate limits before allowing submission
CREATE OR REPLACE FUNCTION public.check_spam_report_rate_limit(
  p_user_id UUID DEFAULT NULL,
  p_ip_hash TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_reporter spam_reporters%ROWTYPE;
  v_hourly_limit INTEGER := 10;
  v_daily_limit INTEGER := 50;
  v_trusted_hourly_limit INTEGER := 50;
  v_trusted_daily_limit INTEGER := 200;
BEGIN
  -- Find or create reporter record
  IF p_user_id IS NOT NULL THEN
    SELECT * INTO v_reporter FROM spam_reporters WHERE user_id = p_user_id;
  ELSIF p_ip_hash IS NOT NULL THEN
    SELECT * INTO v_reporter FROM spam_reporters WHERE ip_hash = p_ip_hash;
  END IF;

  -- Check if banned
  IF v_reporter.is_banned THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'banned',
      'message', 'Your reporting privileges have been suspended'
    );
  END IF;

  -- Set limits based on trust status
  IF v_reporter.is_trusted THEN
    v_hourly_limit := v_trusted_hourly_limit;
    v_daily_limit := v_trusted_daily_limit;
  END IF;

  -- Reset hourly counter if needed
  IF v_reporter.hour_window_start < NOW() - INTERVAL '1 hour' THEN
    v_reporter.reports_this_hour := 0;
    v_reporter.hour_window_start := NOW();
  END IF;

  -- Reset daily counter if needed
  IF v_reporter.day_window_start < NOW() - INTERVAL '1 day' THEN
    v_reporter.reports_today := 0;
    v_reporter.day_window_start := NOW();
  END IF;

  -- Check hourly limit
  IF v_reporter.reports_this_hour >= v_hourly_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'hourly_limit',
      'message', format('Hourly limit reached (%s reports). Please try again later.', v_hourly_limit)
    );
  END IF;

  -- Check daily limit
  IF v_reporter.reports_today >= v_daily_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'daily_limit',
      'message', format('Daily limit reached (%s reports). Please try again tomorrow.', v_daily_limit)
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining_hourly', v_hourly_limit - COALESCE(v_reporter.reports_this_hour, 0),
    'remaining_daily', v_daily_limit - COALESCE(v_reporter.reports_today, 0)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update reporter stats after a report is verified/rejected
CREATE OR REPLACE FUNCTION public.update_reporter_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process when status changes to verified or rejected
  IF NEW.status IN ('verified', 'rejected') AND OLD.status = 'pending' THEN
    UPDATE spam_reporters
    SET
      verified_reports = CASE WHEN NEW.status = 'verified' THEN verified_reports + 1 ELSE verified_reports END,
      rejected_reports = CASE WHEN NEW.status = 'rejected' THEN rejected_reports + 1 ELSE rejected_reports END,
      accuracy_score = CASE
        WHEN (verified_reports + rejected_reports + 1) > 0
        THEN ROUND(((verified_reports + CASE WHEN NEW.status = 'verified' THEN 1 ELSE 0 END)::DECIMAL /
              (verified_reports + rejected_reports + 1)) * 100, 2)
        ELSE 0
      END,
      -- Auto-trust reporters with 10+ reports and 80%+ accuracy
      is_trusted = CASE
        WHEN total_reports >= 10 AND
             ((verified_reports + CASE WHEN NEW.status = 'verified' THEN 1 ELSE 0 END)::DECIMAL /
              (verified_reports + rejected_reports + 1)) >= 0.8
        THEN true
        ELSE is_trusted
      END,
      -- Auto-ban reporters with 5+ rejected reports and <30% accuracy
      is_banned = CASE
        WHEN (rejected_reports + CASE WHEN NEW.status = 'rejected' THEN 1 ELSE 0 END) >= 5 AND
             ((verified_reports + CASE WHEN NEW.status = 'verified' THEN 1 ELSE 0 END)::DECIMAL /
              (verified_reports + rejected_reports + 1)) < 0.3
        THEN true
        ELSE is_banned
      END
    WHERE id = NEW.spam_reporter_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for auto-updating reporter stats
DROP TRIGGER IF EXISTS update_reporter_stats_on_verification ON public.spam_reports;
CREATE TRIGGER update_reporter_stats_on_verification
  AFTER UPDATE ON public.spam_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_reporter_stats();

-- Function to increment reporter counts atomically
CREATE OR REPLACE FUNCTION public.increment_reporter_counts(p_reporter_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE spam_reporters
  SET
    total_reports = total_reports + 1,
    reports_today = CASE
      WHEN day_window_start < NOW() - INTERVAL '1 day' THEN 1
      ELSE reports_today + 1
    END,
    reports_this_hour = CASE
      WHEN hour_window_start < NOW() - INTERVAL '1 hour' THEN 1
      ELSE reports_this_hour + 1
    END,
    hour_window_start = CASE
      WHEN hour_window_start < NOW() - INTERVAL '1 hour' THEN NOW()
      ELSE hour_window_start
    END,
    day_window_start = CASE
      WHEN day_window_start < NOW() - INTERVAL '1 day' THEN NOW()
      ELSE day_window_start
    END,
    last_report_at = NOW()
  WHERE id = p_reporter_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON TABLE public.spam_reporters IS 'Tracks reporter reputation, rate limits, and trust status for abuse prevention';
COMMENT ON COLUMN public.spam_reporters.accuracy_score IS 'Percentage of verified reports (0-100)';
COMMENT ON COLUMN public.spam_reporters.is_trusted IS 'Trusted reporters get higher rate limits';
COMMENT ON COLUMN public.spam_reporters.is_banned IS 'Banned reporters cannot submit new reports';

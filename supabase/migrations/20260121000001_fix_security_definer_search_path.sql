-- Migration: Fix SECURITY DEFINER functions to include safe search_path
-- Prevents privilege escalation attacks by setting search_path to empty
-- Issue: #1622 - PR review feedback

-- Recreate check_spam_report_rate_limit with safe search_path
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
  -- Find reporter record
  IF p_user_id IS NOT NULL THEN
    SELECT * INTO v_reporter FROM public.spam_reporters WHERE user_id = p_user_id;
  ELSIF p_ip_hash IS NOT NULL THEN
    SELECT * INTO v_reporter FROM public.spam_reporters WHERE ip_hash = p_ip_hash;
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Recreate update_reporter_stats with safe search_path and NULL guard
CREATE OR REPLACE FUNCTION public.update_reporter_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip if spam_reporter_id is NULL
  IF NEW.spam_reporter_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only process when status changes to verified or rejected
  IF NEW.status IN ('verified', 'rejected') AND OLD.status = 'pending' THEN
    UPDATE public.spam_reporters
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Recreate increment_reporter_counts with safe search_path
CREATE OR REPLACE FUNCTION public.increment_reporter_counts(p_reporter_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.spam_reporters
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Function for atomic report count increment
CREATE OR REPLACE FUNCTION public.increment_spam_report_count(p_report_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.spam_reports
  SET
    report_count = report_count + 1,
    updated_at = NOW()
  WHERE id = p_report_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.increment_spam_report_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_spam_report_count(UUID) TO service_role;

-- Migration: Phase 2 - Verification workflow functions
-- Issue: #1622 - Known Spammer Community Database
-- Features:
--   1. Auto-verify reports with 3+ independent submissions
--   2. Update known_spammers when reports verified
--   3. Admin bulk verification support
--   4. Link to existing spam_detections

-- ============================================
-- 1. Function to verify a spam report
-- ============================================
CREATE OR REPLACE FUNCTION public.verify_spam_report(
  p_report_id UUID,
  p_admin_id UUID,
  p_status TEXT DEFAULT 'verified'
)
RETURNS JSONB AS $$
DECLARE
  v_report public.spam_reports%ROWTYPE;
  v_spammer_id UUID;
BEGIN
  -- Validate status
  IF p_status NOT IN ('verified', 'rejected') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid status. Must be verified or rejected.'
    );
  END IF;

  -- Get the report
  SELECT * INTO v_report FROM public.spam_reports WHERE id = p_report_id;

  IF v_report.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Report not found'
    );
  END IF;

  -- Update report status
  UPDATE public.spam_reports
  SET
    status = p_status,
    verified_by = p_admin_id,
    verified_at = NOW(),
    updated_at = NOW()
  WHERE id = p_report_id;

  -- If verified, update or create known_spammers entry
  IF p_status = 'verified' AND v_report.contributor_github_login IS NOT NULL THEN
    INSERT INTO public.known_spammers (
      github_login,
      spam_pr_count,
      first_reported_at,
      last_reported_at,
      verification_status
    )
    VALUES (
      v_report.contributor_github_login,
      1,
      v_report.created_at,
      NOW(),
      'verified'
    )
    ON CONFLICT (github_login) DO UPDATE SET
      spam_pr_count = public.known_spammers.spam_pr_count + 1,
      last_reported_at = NOW(),
      verification_status = 'verified',
      updated_at = NOW()
    RETURNING id INTO v_spammer_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'report_id', p_report_id,
    'status', p_status,
    'spammer_id', v_spammer_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ============================================
-- 2. Function to auto-verify based on report count
-- ============================================
CREATE OR REPLACE FUNCTION public.auto_verify_spam_reports(
  p_threshold INTEGER DEFAULT 3
)
RETURNS JSONB AS $$
DECLARE
  v_verified_count INTEGER := 0;
  v_report RECORD;
BEGIN
  -- Find pending reports with report_count >= threshold
  FOR v_report IN
    SELECT id, contributor_github_login, created_at
    FROM public.spam_reports
    WHERE status = 'pending'
      AND report_count >= p_threshold
  LOOP
    -- Update report to verified (system auto-verify)
    UPDATE public.spam_reports
    SET
      status = 'verified',
      verified_at = NOW(),
      updated_at = NOW()
    WHERE id = v_report.id;

    -- Update or create known_spammers entry
    IF v_report.contributor_github_login IS NOT NULL THEN
      INSERT INTO public.known_spammers (
        github_login,
        spam_pr_count,
        first_reported_at,
        last_reported_at,
        verification_status
      )
      VALUES (
        v_report.contributor_github_login,
        1,
        v_report.created_at,
        NOW(),
        'verified'
      )
      ON CONFLICT (github_login) DO UPDATE SET
        spam_pr_count = public.known_spammers.spam_pr_count + 1,
        last_reported_at = NOW(),
        verification_status = 'verified',
        updated_at = NOW();
    END IF;

    v_verified_count := v_verified_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'verified_count', v_verified_count,
    'threshold', p_threshold
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ============================================
-- 3. Function to bulk verify reports
-- ============================================
CREATE OR REPLACE FUNCTION public.bulk_verify_spam_reports(
  p_report_ids UUID[],
  p_admin_id UUID,
  p_status TEXT DEFAULT 'verified'
)
RETURNS JSONB AS $$
DECLARE
  v_processed INTEGER := 0;
  v_report_id UUID;
  v_result JSONB;
BEGIN
  FOREACH v_report_id IN ARRAY p_report_ids
  LOOP
    SELECT public.verify_spam_report(v_report_id, p_admin_id, p_status) INTO v_result;
    IF (v_result->>'success')::boolean THEN
      v_processed := v_processed + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'processed', v_processed,
    'total', array_length(p_report_ids, 1)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ============================================
-- 4. Function to ban/unban a reporter
-- ============================================
CREATE OR REPLACE FUNCTION public.manage_spam_reporter(
  p_reporter_id UUID,
  p_admin_id UUID,
  p_action TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
BEGIN
  IF p_action = 'ban' THEN
    UPDATE public.spam_reporters
    SET
      is_banned = true,
      ban_reason = p_reason,
      banned_at = NOW(),
      banned_by = p_admin_id,
      updated_at = NOW()
    WHERE id = p_reporter_id;
  ELSIF p_action = 'unban' THEN
    UPDATE public.spam_reporters
    SET
      is_banned = false,
      ban_reason = NULL,
      banned_at = NULL,
      banned_by = NULL,
      updated_at = NOW()
    WHERE id = p_reporter_id;
  ELSIF p_action = 'trust' THEN
    UPDATE public.spam_reporters
    SET
      is_trusted = true,
      updated_at = NOW()
    WHERE id = p_reporter_id;
  ELSIF p_action = 'untrust' THEN
    UPDATE public.spam_reporters
    SET
      is_trusted = false,
      updated_at = NOW()
    WHERE id = p_reporter_id;
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid action. Must be ban, unban, trust, or untrust.'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'reporter_id', p_reporter_id,
    'action', p_action
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ============================================
-- 5. RLS policy for admins to read all reports
-- ============================================
-- Drop existing policy if exists and recreate
DROP POLICY IF EXISTS "Admins can read all spam reports" ON public.spam_reports;
CREATE POLICY "Admins can read all spam reports"
  ON public.spam_reports
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE github_id = (
        SELECT (raw_user_meta_data->>'user_name')::text
        FROM auth.users
        WHERE id = (SELECT auth.uid())
      )
      OR user_id = (SELECT auth.uid())
    )
  );

-- Drop existing policy if exists and recreate for reporters
DROP POLICY IF EXISTS "Admins can read all spam reporters" ON public.spam_reporters;
CREATE POLICY "Admins can read all spam reporters"
  ON public.spam_reporters
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE github_id = (
        SELECT (raw_user_meta_data->>'user_name')::text
        FROM auth.users
        WHERE id = (SELECT auth.uid())
      )
      OR user_id = (SELECT auth.uid())
    )
  );

-- ============================================
-- 6. Grant execute permissions
-- ============================================
GRANT EXECUTE ON FUNCTION public.verify_spam_report(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_spam_report(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.auto_verify_spam_reports(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.bulk_verify_spam_reports(UUID[], UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_verify_spam_reports(UUID[], UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.manage_spam_reporter(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manage_spam_reporter(UUID, UUID, TEXT, TEXT) TO service_role;

-- ============================================
-- Documentation
-- ============================================
COMMENT ON FUNCTION public.verify_spam_report IS 'Verify or reject a spam report, updating known_spammers if verified';
COMMENT ON FUNCTION public.auto_verify_spam_reports IS 'Auto-verify reports with N+ independent submissions';
COMMENT ON FUNCTION public.bulk_verify_spam_reports IS 'Bulk verify/reject multiple reports';
COMMENT ON FUNCTION public.manage_spam_reporter IS 'Ban, unban, trust, or untrust a reporter';

-- Migration: Fix missing admin authorization checks in SECURITY DEFINER functions
-- Issue: #1622 - Critical security fix
-- Problem: Functions granted to 'authenticated' but missing admin verification
-- Impact: Any authenticated user could verify reports, add spammers, ban reporters

-- ============================================
-- Helper function to check admin status
-- ============================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE github_id = (
      SELECT (raw_user_meta_data->>'user_name')::text
      FROM auth.users
      WHERE id = auth.uid()
    )
    OR user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = '';

-- ============================================
-- 1. Fix verify_spam_report - add admin check
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
  -- SECURITY: Verify caller is admin
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: Admin access required'
    );
  END IF;

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

  -- Update report status (use auth.uid() instead of untrusted parameter)
  UPDATE public.spam_reports
  SET
    status = p_status,
    verified_by = auth.uid(),
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
-- 2. Fix bulk_verify_spam_reports - add admin check
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
  -- SECURITY: Verify caller is admin
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: Admin access required'
    );
  END IF;

  FOREACH v_report_id IN ARRAY p_report_ids
  LOOP
    -- Note: verify_spam_report also checks admin, but we check here too
    -- to fail fast before any operations
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
-- 3. Fix manage_spam_reporter - add admin check
-- ============================================
CREATE OR REPLACE FUNCTION public.manage_spam_reporter(
  p_reporter_id UUID,
  p_admin_id UUID,
  p_action TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
BEGIN
  -- SECURITY: Verify caller is admin
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: Admin access required'
    );
  END IF;

  IF p_action = 'ban' THEN
    UPDATE public.spam_reporters
    SET
      is_banned = true,
      ban_reason = p_reason,
      banned_at = NOW(),
      banned_by = auth.uid(),  -- Use auth.uid() instead of untrusted parameter
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
-- 4. Fix auto_verify_spam_reports - add admin check
-- (Even though only service_role can call, defense in depth)
-- ============================================
CREATE OR REPLACE FUNCTION public.auto_verify_spam_reports(
  p_threshold INTEGER DEFAULT 3
)
RETURNS JSONB AS $$
DECLARE
  v_verified_count INTEGER := 0;
  v_report RECORD;
BEGIN
  -- SECURITY: This should only be called by service_role or admin
  -- Service role bypasses RLS, so we check for admin when called by authenticated
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: Admin or service role required'
    );
  END IF;

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
-- Grant execute on helper function
-- ============================================
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;

-- ============================================
-- Documentation
-- ============================================
COMMENT ON FUNCTION public.is_admin IS 'Check if current user is an admin (used for authorization in SECURITY DEFINER functions)';

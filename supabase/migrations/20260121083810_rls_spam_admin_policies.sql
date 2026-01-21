-- RLS Fixes for PR #1629: Spam Leaderboard and Admin Spammer Management
-- Tables: spam_detections, known_spammers
--
-- Issue: Admin users cannot manage spam detections or spammer records
-- because there are no RLS policies allowing authenticated admins to 
-- UPDATE/DELETE records. The frontend code relies on admin users being
-- able to modify these tables via the SpamManagement component.
--
-- This migration adds admin-scoped policies for the spam management feature.

-- ============================================================================
-- spam_detections: Add admin management policies
-- ============================================================================

-- Allow admins to read all spam detections (for admin management UI)
CREATE POLICY "spam_detections_admin_select"
ON public.spam_detections
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.app_users au
        WHERE au.auth_user_id = auth.uid()
        AND au.is_admin = true
    )
);
-- Purpose: Allow admin users to view all spam detections in the admin panel

-- Allow admins to update spam detection status (confirm/mark as false positive)
CREATE POLICY "spam_detections_admin_update"
ON public.spam_detections
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.app_users au
        WHERE au.auth_user_id = auth.uid()
        AND au.is_admin = true
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.app_users au
        WHERE au.auth_user_id = auth.uid()
        AND au.is_admin = true
    )
);
-- Purpose: Allow admins to update spam status (confirmed/false_positive)

-- ============================================================================
-- known_spammers: Add admin management policies  
-- ============================================================================

-- Allow admins to read ALL spammers (not just verified) for management
CREATE POLICY "known_spammers_admin_select"
ON public.known_spammers
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.app_users au
        WHERE au.auth_user_id = auth.uid()
        AND au.is_admin = true
    )
);
-- Purpose: Admin panel needs to see all spammers, including unverified

-- Allow admins to update spammer verification status
CREATE POLICY "known_spammers_admin_update"
ON public.known_spammers
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.app_users au
        WHERE au.auth_user_id = auth.uid()
        AND au.is_admin = true
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.app_users au
        WHERE au.auth_user_id = auth.uid()
        AND au.is_admin = true
    )
);
-- Purpose: Allow admins to verify/unverify spammers

-- Allow admins to remove spammers from the database
CREATE POLICY "known_spammers_admin_delete"
ON public.known_spammers
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.app_users au
        WHERE au.auth_user_id = auth.uid()
        AND au.is_admin = true
    )
);
-- Purpose: Allow admins to remove incorrectly flagged users from spammer list

-- ============================================================================
-- Rollback Instructions
-- ============================================================================
-- DROP POLICY "spam_detections_admin_select" ON public.spam_detections;
-- DROP POLICY "spam_detections_admin_update" ON public.spam_detections;
-- DROP POLICY "known_spammers_admin_select" ON public.known_spammers;
-- DROP POLICY "known_spammers_admin_update" ON public.known_spammers;
-- DROP POLICY "known_spammers_admin_delete" ON public.known_spammers;

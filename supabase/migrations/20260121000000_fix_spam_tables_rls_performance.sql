-- Migration: Fix RLS performance issues in spam tables
-- Issue: auth_rls_initplan - Using auth.uid() without SELECT wrapper
-- Fix: Wrap auth.uid() in (SELECT ...) to ensure single evaluation per query
-- Reference: https://supabase.com/docs/guides/database/postgres/row-level-security#auth-functions

-- Drop and recreate affected policies on spam_reports table

-- Fix: "Users can read their own reports" policy
DROP POLICY IF EXISTS "Users can read their own reports" ON public.spam_reports;
CREATE POLICY "Users can read their own reports"
  ON public.spam_reports
  FOR SELECT
  TO authenticated
  USING (reporter_id = (SELECT auth.uid()));

-- Fix: "Authenticated users can submit spam reports" policy
DROP POLICY IF EXISTS "Authenticated users can submit spam reports" ON public.spam_reports;
CREATE POLICY "Authenticated users can submit spam reports"
  ON public.spam_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = (SELECT auth.uid()));

-- Drop and recreate affected policy on spam_reporters table

-- Fix: "Users can read their own reporter stats" policy
DROP POLICY IF EXISTS "Users can read their own reporter stats" ON public.spam_reporters;
CREATE POLICY "Users can read their own reporter stats"
  ON public.spam_reporters
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Add comment documenting the optimization
COMMENT ON POLICY "Users can read their own reports" ON public.spam_reports IS 
  'Optimized: Uses (SELECT auth.uid()) to prevent per-row evaluation';
COMMENT ON POLICY "Authenticated users can submit spam reports" ON public.spam_reports IS 
  'Optimized: Uses (SELECT auth.uid()) to prevent per-row evaluation';
COMMENT ON POLICY "Users can read their own reporter stats" ON public.spam_reporters IS 
  'Optimized: Uses (SELECT auth.uid()) to prevent per-row evaluation';

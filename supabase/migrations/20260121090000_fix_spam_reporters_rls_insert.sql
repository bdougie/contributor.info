-- Migration: Fix missing RLS policies for spam_reporters INSERT/UPDATE
-- Issue: #1622 - Users couldn't create their reporter record due to missing INSERT policy

-- Add INSERT policy for authenticated users to create their own reporter record
CREATE POLICY "Users can create their own reporter record"
  ON public.spam_reporters
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Add UPDATE policy for authenticated users to update their own record
-- This is needed for the increment_reporter_counts RPC to work
CREATE POLICY "Users can update their own reporter stats"
  ON public.spam_reporters
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Documentation
COMMENT ON POLICY "Users can create their own reporter record" ON public.spam_reporters IS
  'Allows authenticated users to create their own reporter record for spam submission tracking';
COMMENT ON POLICY "Users can update their own reporter stats" ON public.spam_reporters IS
  'Allows authenticated users to update their own reporter stats (report counts, etc)';

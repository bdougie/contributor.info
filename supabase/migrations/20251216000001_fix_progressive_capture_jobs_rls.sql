-- Fix conflicting RLS policies on progressive_capture_jobs table
-- Issue: Overly permissive public policies (USING (true)) alongside service_role-only policy
-- The permissive policies override the restrictive intent of service_only_all
-- Solution: Remove the permissive policies, keep only service_role access

-- Drop overly permissive policies
DROP POLICY IF EXISTS progressive_capture_jobs_select_all ON progressive_capture_jobs;
DROP POLICY IF EXISTS progressive_capture_jobs_insert_all ON progressive_capture_jobs;
DROP POLICY IF EXISTS progressive_capture_jobs_update_all ON progressive_capture_jobs;
DROP POLICY IF EXISTS progressive_capture_jobs_delete_all ON progressive_capture_jobs;

-- Verify service_only_all policy exists (it should already be there)
-- This policy allows only service_role to access the table
-- service_role is used by background jobs (gh-datapipe, Inngest functions)

COMMENT ON TABLE progressive_capture_jobs IS 'Background job queue for progressive data capture - service_role only access';

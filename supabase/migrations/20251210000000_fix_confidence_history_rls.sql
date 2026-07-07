-- Fix RLS policy for repository_confidence_history table
-- Issue #1296: Tests fail because INSERT requires authenticated role
-- Solution: Use permissive INSERT policy (matches repository_metrics_history pattern)

-- Drop the restrictive INSERT policy
DROP POLICY IF EXISTS "Allow authenticated insert to confidence history"
  ON repository_confidence_history;

-- Create permissive INSERT policy (system-generated data)
CREATE POLICY "Allow inserts to confidence history"
  ON repository_confidence_history
  FOR INSERT
  WITH CHECK (true);

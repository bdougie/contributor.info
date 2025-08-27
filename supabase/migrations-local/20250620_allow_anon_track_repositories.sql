-- Local-safe version of 20250620_allow_anon_track_repositories.sql
-- Generated: 2025-08-27T02:47:08.048Z
-- This migration has been modified to work without auth, roles, and extensions
-- Original migration may have different behavior in production

-- Transaction wrapper for safety
BEGIN;


-- Ensure anon exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon;
    RAISE NOTICE 'Created missing role: anon';
  END IF;
END $$;

-- Ensure authenticated exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated;
    RAISE NOTICE 'Created missing role: authenticated';
  END IF;
END $$;

-- Allow anonymous users to track repositories
-- This enables the auto-tracking feature to work without authentication

-- Create policy for anonymous users to insert tracked repositories
CREATE POLICY "anon_insert_tracked_repositories"
ON tracked_repositories FOR INSERT
TO anon
WITH CHECK (true);

-- Also allow anonymous users to check if a repository is already tracked
-- (The SELECT policy already exists as "public_read_tracked_repositories")

-- Optional: Add a policy for authenticated users as well
CREATE POLICY "auth_insert_tracked_repositories"
ON tracked_repositories FOR INSERT
TO authenticated
WITH CHECK (true);

COMMIT;
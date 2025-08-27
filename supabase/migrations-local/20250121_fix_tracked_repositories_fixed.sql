-- Local-safe version of 20250121_fix_tracked_repositories_fixed.sql
-- Generated: 2025-08-27T02:47:08.042Z
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

-- Ensure service_role exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role;
    RAISE NOTICE 'Created missing role: service_role';
  END IF;
END $$;

-- Fix tracked_repositories table to allow direct insertion without repository_id
-- This resolves the circular dependency where repositories table is only populated by sync

-- First, add the missing last_updated_at column if it doesn't exist
ALTER TABLE tracked_repositories 
ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add organization_name and repository_name columns
ALTER TABLE tracked_repositories 
ADD COLUMN IF NOT EXISTS organization_name TEXT,
ADD COLUMN IF NOT EXISTS repository_name TEXT;

-- Make repository_id nullable temporarily
ALTER TABLE tracked_repositories 
ALTER COLUMN repository_id DROP NOT NULL;

-- Drop existing constraint if it exists to avoid error
ALTER TABLE tracked_repositories
DROP CONSTRAINT IF EXISTS tracked_repositories_org_repo_unique;

-- Add unique constraint on org/repo name combination
ALTER TABLE tracked_repositories
ADD CONSTRAINT tracked_repositories_org_repo_unique 
UNIQUE (organization_name, repository_name);

-- Update existing rows to populate org/repo names from repositories table
UPDATE tracked_repositories tr
SET 
    organization_name = r.owner,
    repository_name = r.name
FROM repositories r
WHERE tr.repository_id = r.id
  AND tr.organization_name IS NULL;

-- Drop existing function and trigger if they exist
DROP TRIGGER IF EXISTS trigger_update_tracked_repository_id ON tracked_repositories;
DROP FUNCTION IF EXISTS update_tracked_repository_id();

-- Create function to auto-populate repository_id when org/repo exists
CREATE OR REPLACE FUNCTION update_tracked_repository_id()
RETURNS TRIGGER AS $$
BEGIN
    -- If repository_id is not set but org/repo names are provided
    IF NEW.repository_id IS NULL AND NEW.organization_name IS NOT NULL AND NEW.repository_name IS NOT NULL THEN
        -- Try to find the repository
        SELECT id INTO NEW.repository_id
        FROM repositories
        WHERE owner = NEW.organization_name
          AND name = NEW.repository_name;
    END IF;
    
    -- If repository_id is set but org/repo names are not
    IF NEW.repository_id IS NOT NULL AND (NEW.organization_name IS NULL OR NEW.repository_name IS NULL) THEN
        -- Get org/repo names from repository
        SELECT owner, name INTO NEW.organization_name, NEW.repository_name
        FROM repositories
        WHERE id = NEW.repository_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-populate fields
CREATE TRIGGER trigger_update_tracked_repository_id
BEFORE INSERT OR UPDATE ON tracked_repositories
FOR EACH ROW
EXECUTE FUNCTION update_tracked_repository_id();

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tracked_repositories_org_repo 
ON tracked_repositories(organization_name, repository_name);

-- Add RLS policy to allow anonymous users to insert tracked repositories
-- (They can track repos even if not yet synced)
ALTER TABLE tracked_repositories ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "tracked_repositories_read_all" ON tracked_repositories;
DROP POLICY IF EXISTS "tracked_repositories_insert_authenticated" ON tracked_repositories;
DROP POLICY IF EXISTS "tracked_repositories_service_role" ON tracked_repositories;

-- Allow anyone to read tracked repositories
CREATE POLICY "tracked_repositories_read_all" ON tracked_repositories
FOR SELECT
TO anon, authenticated
USING (true);

-- Allow authenticated users to insert tracked repositories
CREATE POLICY "tracked_repositories_insert_authenticated" ON tracked_repositories
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow service role full access
CREATE POLICY "tracked_repositories_service_role" ON tracked_repositories
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

COMMIT;
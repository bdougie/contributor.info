-- Fix tracked_repositories table to allow direct insertion without repository_id
-- This resolves the circular dependency where repositories table is only populated by sync

-- Add organization_name and repository_name columns
ALTER TABLE tracked_repositories 
ADD COLUMN IF NOT EXISTS organization_name TEXT,
ADD COLUMN IF NOT EXISTS repository_name TEXT;

-- Make repository_id nullable temporarily
ALTER TABLE tracked_repositories 
ALTER COLUMN repository_id DROP NOT NULL;

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
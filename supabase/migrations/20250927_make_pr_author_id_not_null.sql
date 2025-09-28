-- Migration: Make pull_requests.author_id NOT NULL
-- References: #736
-- Description: Enforce data integrity by ensuring all pull requests have a valid author

-- Step 1: First, identify any pull requests with NULL author_id
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count
  FROM public.pull_requests
  WHERE author_id IS NULL;

  IF null_count > 0 THEN
    RAISE NOTICE 'Found % pull requests with NULL author_id. These will be deleted.', null_count;
  END IF;
END $$;

-- Step 2: Delete any pull requests with NULL author_id
-- These are orphaned records that shouldn't exist
DELETE FROM public.pull_requests
WHERE author_id IS NULL;

-- Step 3: Add a CHECK constraint first (NOT VALID to avoid locking the table)
ALTER TABLE public.pull_requests
ADD CONSTRAINT pull_requests_author_id_not_null
CHECK (author_id IS NOT NULL) NOT VALID;

-- Step 4: Validate the constraint (can be done concurrently)
-- This scans existing rows to ensure they meet the constraint
ALTER TABLE public.pull_requests
VALIDATE CONSTRAINT pull_requests_author_id_not_null;

-- Step 5: Now make the column properly NOT NULL
-- This is safe since we've already validated all existing data
ALTER TABLE public.pull_requests
ALTER COLUMN author_id SET NOT NULL;

-- Step 6: Drop the now-redundant CHECK constraint
ALTER TABLE public.pull_requests
DROP CONSTRAINT pull_requests_author_id_not_null;

-- Step 7: Ensure the foreign key constraint still exists
-- (it should already be there from initial schema)
DO $$
BEGIN
  -- Check if foreign key exists
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'pull_requests'
    AND constraint_type = 'FOREIGN KEY'
    AND constraint_name LIKE '%author_id%'
  ) THEN
    -- Add it if missing
    ALTER TABLE public.pull_requests
    ADD CONSTRAINT pull_requests_author_id_fkey
    FOREIGN KEY (author_id)
    REFERENCES public.contributors(id)
    ON DELETE CASCADE;
  END IF;
END $$;

-- Add a comment documenting this constraint
COMMENT ON COLUMN public.pull_requests.author_id IS 'Required reference to the contributor who authored this pull request. Cannot be NULL.';
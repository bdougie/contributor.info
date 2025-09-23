-- Add repository_full_name column to pull_requests table
-- This column is needed for gh-datapipe sync compatibility
-- Issue: https://github.com/bdougie/contributor.info/issues/765

-- Add the new column
ALTER TABLE public.pull_requests
ADD COLUMN IF NOT EXISTS repository_full_name text;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_pull_requests_repository_full_name
ON public.pull_requests(repository_full_name);

-- Populate existing data from repositories table
UPDATE public.pull_requests pr
SET repository_full_name = r.full_name
FROM public.repositories r
WHERE pr.repository_id = r.id
AND pr.repository_full_name IS NULL;

-- Add comment to document the column
COMMENT ON COLUMN public.pull_requests.repository_full_name IS
'Denormalized repository full name (owner/repo) for improved query performance and gh-datapipe compatibility';
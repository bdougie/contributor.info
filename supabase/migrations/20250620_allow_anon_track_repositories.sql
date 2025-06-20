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
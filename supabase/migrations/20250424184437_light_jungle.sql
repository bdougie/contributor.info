/*
  # GitHub Activity Cache Schema

  1. New Tables
    - `github_activities`
      - `id` (uuid, primary key)
      - `repo` (text) - Repository name in owner/repo format
      - `activity_data` (jsonb) - Cached activity data
      - `created_at` (timestamptz) - When the cache entry was created
      - `updated_at` (timestamptz) - When the cache was last updated

  2. Security
    - Enable RLS on `github_activities` table
    - Add policy for authenticated users to read data
    - Add policy for service role to manage data

  3. Functions
    - Add function to clean up old cache entries (older than 30 days)
*/

-- Create the activities table
CREATE TABLE IF NOT EXISTS github_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repo text NOT NULL,
  activity_data jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_github_activities_repo ON github_activities(repo);
CREATE INDEX IF NOT EXISTS idx_github_activities_updated_at ON github_activities(updated_at);

-- Enable RLS
ALTER TABLE github_activities ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public read access"
  ON github_activities
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow service role full access"
  ON github_activities
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to clean up old cache entries
CREATE OR REPLACE FUNCTION cleanup_old_github_activities()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM github_activities
  WHERE updated_at < now() - INTERVAL '30 days';
END;
$$;
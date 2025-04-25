/*
  # Create GitHub Activities Table

  1. New Tables
    - `github_activities`
      - `id` (uuid, primary key)
      - `repo` (text, not null)
      - `activity_data` (jsonb, not null)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on `github_activities` table
    - Add policy for public read access
    - Add policy for service role full access
  
  3. Indexes
    - Index on repo for faster lookups
    - Index on updated_at for cache invalidation queries
*/

CREATE TABLE IF NOT EXISTS github_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repo text NOT NULL,
  activity_data jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_github_activities_repo ON github_activities(repo);
CREATE INDEX IF NOT EXISTS idx_github_activities_updated_at ON github_activities(updated_at);

-- Enable RLS
ALTER TABLE github_activities ENABLE ROW LEVEL SECURITY;

-- Add policies if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'github_activities' 
    AND policyname = 'Allow public read access'
  ) THEN
    CREATE POLICY "Allow public read access"
      ON github_activities
      FOR SELECT
      TO public
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'github_activities' 
    AND policyname = 'Allow service role full access'
  ) THEN
    CREATE POLICY "Allow service role full access"
      ON github_activities
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
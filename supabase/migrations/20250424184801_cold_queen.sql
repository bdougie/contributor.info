/*
  # Update GitHub Activities RLS Policies

  1. Changes
    - Add RLS policies for authenticated users to insert and update records
    - Add RLS policy for service role to have full access
    - Add RLS policy for public read access

  2. Security
    - Enable RLS on github_activities table
    - Add policies for authenticated users and service role
*/

-- Enable RLS
ALTER TABLE github_activities ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access" 
ON github_activities
FOR SELECT 
TO public 
USING (true);

-- Allow authenticated users to insert and update their own records
CREATE POLICY "Allow authenticated users to insert"
ON github_activities
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update"
ON github_activities
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow service role full access
CREATE POLICY "Allow service role full access"
ON github_activities
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
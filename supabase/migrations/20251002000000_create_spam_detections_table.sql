-- Create spam_detections table for admin reviews
-- This addresses the missing table issue mentioned in #859

-- Create the spam_detections table
CREATE TABLE IF NOT EXISTS spam_detections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pr_id UUID NOT NULL REFERENCES pull_requests(id) ON DELETE CASCADE,
  contributor_id UUID NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
  spam_score INTEGER NOT NULL CHECK (spam_score >= 0 AND spam_score <= 100),
  status TEXT NOT NULL CHECK (status IN ('confirmed', 'false_positive', 'pending_review')),
  admin_reviewed_by UUID REFERENCES contributors(id),
  admin_reviewed_at TIMESTAMPTZ,
  detection_reasons TEXT[],
  admin_notes TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_spam_detections_pr ON spam_detections(pr_id);
CREATE INDEX IF NOT EXISTS idx_spam_detections_contributor ON spam_detections(contributor_id);
CREATE INDEX IF NOT EXISTS idx_spam_detections_status ON spam_detections(status);
CREATE INDEX IF NOT EXISTS idx_spam_detections_admin ON spam_detections(admin_reviewed_by);
CREATE INDEX IF NOT EXISTS idx_spam_detections_detected_at ON spam_detections(detected_at);

-- Add missing columns to tracked_repositories table if they don't exist
-- This addresses the schema mismatch issue mentioned in #859
ALTER TABLE tracked_repositories 
ADD COLUMN IF NOT EXISTS organization_name TEXT,
ADD COLUMN IF NOT EXISTS repository_name TEXT;

-- Create a function to update organization_name and repository_name from repositories table
CREATE OR REPLACE FUNCTION update_tracked_repositories_names()
RETURNS void AS $$
BEGIN
  -- Update existing records to populate these columns
  UPDATE tracked_repositories 
  SET 
    organization_name = (
      SELECT split_part(repositories.full_name, '/', 1) 
      FROM repositories 
      WHERE repositories.id = tracked_repositories.repository_id
    ),
    repository_name = (
      SELECT split_part(repositories.full_name, '/', 2) 
      FROM repositories 
      WHERE repositories.id = tracked_repositories.repository_id
    )
  WHERE organization_name IS NULL OR repository_name IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Execute the function to populate existing data
SELECT update_tracked_repositories_names();

-- Add indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_tracked_repositories_org_repo ON tracked_repositories(organization_name, repository_name);

-- Add RLS policies for spam_detections table
ALTER TABLE spam_detections ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read spam detections
CREATE POLICY "Allow authenticated users to read spam detections" ON spam_detections
  FOR SELECT TO authenticated
  USING (true);

-- Allow service role to manage spam detections (for edge functions)
CREATE POLICY "Allow service role to manage spam detections" ON spam_detections
  FOR ALL TO service_role
  USING (true);

-- Allow admins to insert/update spam detections
-- Use the app_users table which has the is_admin column
CREATE POLICY "Allow admins to manage spam detections" ON spam_detections
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_users 
      WHERE app_users.auth_user_id = auth.uid() 
      AND app_users.is_admin = TRUE
    )
  );

-- Add comments for documentation
COMMENT ON TABLE spam_detections IS 'Admin reviews and classifications of spam pull requests';
COMMENT ON COLUMN spam_detections.pr_id IS 'Reference to the pull request being reviewed';
COMMENT ON COLUMN spam_detections.contributor_id IS 'Reference to the contributor who created the PR';
COMMENT ON COLUMN spam_detections.spam_score IS 'Spam detection score from 0-100';
COMMENT ON COLUMN spam_detections.status IS 'Admin classification: confirmed, false_positive, or pending_review';
COMMENT ON COLUMN spam_detections.admin_reviewed_by IS 'Contributor ID of the admin who reviewed this';
COMMENT ON COLUMN spam_detections.detection_reasons IS 'Array of reasons why this was flagged as spam';
COMMENT ON COLUMN spam_detections.admin_notes IS 'Optional notes from the reviewing admin';
COMMENT ON COLUMN tracked_repositories.organization_name IS 'Organization/owner name (e.g., facebook)';
COMMENT ON COLUMN tracked_repositories.repository_name IS 'Repository name (e.g., react)';
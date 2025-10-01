-- Local-safe version of 20240115000000_add_spam_detection_fields.sql
-- Generated: 2025-08-27T02:47:08.021Z
-- This migration has been modified to work without auth, roles, and extensions
-- Original migration may have different behavior in production

-- Transaction wrapper for safety
BEGIN;

-- Add spam detection fields to pull_requests table
ALTER TABLE pull_requests 
ADD COLUMN IF NOT EXISTS spam_score INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS spam_flags JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_spam BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reviewed_by_admin BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS spam_detected_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_pull_requests_spam_score ON pull_requests(spam_score);
CREATE INDEX IF NOT EXISTS idx_pull_requests_is_spam ON pull_requests(is_spam);
CREATE INDEX IF NOT EXISTS idx_pull_requests_repository_spam ON pull_requests(repository_id, is_spam);

-- Add comment to explain spam score range
COMMENT ON COLUMN pull_requests.spam_score IS 'Spam detection score from 0-100. 0=legitimate, 100=definite spam';
COMMENT ON COLUMN pull_requests.spam_flags IS 'Detailed spam detection flags as JSONB';
COMMENT ON COLUMN pull_requests.is_spam IS 'Whether PR is classified as spam (score >= 75)';
COMMENT ON COLUMN pull_requests.reviewed_by_admin IS 'Whether an admin has manually reviewed this spam classification';
COMMENT ON COLUMN pull_requests.spam_detected_at IS 'Timestamp when spam detection was performed';

COMMIT;

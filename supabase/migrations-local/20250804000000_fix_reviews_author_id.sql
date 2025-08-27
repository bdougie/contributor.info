-- Local-safe version of 20250804000000_fix_reviews_author_id.sql
-- Generated: 2025-08-27T02:47:08.060Z
-- This migration has been modified to work without auth, roles, and extensions
-- Original migration may have different behavior in production

-- Transaction wrapper for safety
BEGIN;

-- Migration to fix reviews table schema
-- The code expects 'author_id' but the table has 'reviewer_id'

-- Add author_id column as an alias for reviewer_id
ALTER TABLE reviews ADD COLUMN author_id UUID;

-- Copy existing reviewer_id data to author_id
UPDATE reviews SET author_id = reviewer_id WHERE author_id IS NULL;

-- Add NOT NULL constraint and foreign key
ALTER TABLE reviews 
  ALTER COLUMN author_id SET NOT NULL,
  ADD CONSTRAINT reviews_author_id_fkey 
    FOREIGN KEY (author_id) 
    REFERENCES contributors(id) 
    ON DELETE CASCADE;

-- CREATE INDEX IF NOT EXISTS for performance
CREATE INDEX IF NOT EXISTS idx_reviews_author_id ON reviews(author_id);

-- Optional: Drop reviewer_id column if no longer needed
-- Note: Only uncomment this if you're sure no other code depends on reviewer_id
-- ALTER TABLE reviews DROP COLUMN reviewer_id;

COMMIT;
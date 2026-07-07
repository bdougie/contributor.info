-- Migration: Fix contributor notes to allow multiple notes per contributor
-- Description: Remove UNIQUE constraint on (workspace_id, contributor_username)
--              to allow multiple notes per contributor
-- Date: 2025-02-06

-- Drop the unique constraint that limits one note per contributor
ALTER TABLE public.contributor_notes
DROP CONSTRAINT IF EXISTS contributor_notes_workspace_id_contributor_username_key;

-- Drop the old index if it exists
DROP INDEX IF EXISTS idx_contributor_notes_workspace_contributor;

-- Create a new non-unique index for efficient querying
-- This allows multiple notes per contributor while maintaining query performance
CREATE INDEX IF NOT EXISTS idx_contributor_notes_workspace_contributor
ON contributor_notes(workspace_id, contributor_username);

-- Fix foreign key constraint to allow NULL created_by for OAuth callbacks
-- OAuth callbacks don't have authenticated user context, so created_by should be nullable

-- Drop the existing foreign key constraint
ALTER TABLE slack_integrations
  DROP CONSTRAINT IF EXISTS slack_integrations_created_by_fkey;

-- Make created_by nullable
ALTER TABLE slack_integrations
  ALTER COLUMN created_by DROP NOT NULL;

-- Re-add the foreign key with ON DELETE SET NULL
ALTER TABLE slack_integrations
  ADD CONSTRAINT slack_integrations_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

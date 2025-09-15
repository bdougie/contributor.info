-- Migration to add 'team' tier to workspaces
-- This aligns the database with the TypeScript codebase which expects 'free', 'pro', 'team'

-- First, drop the existing constraint on workspaces table
ALTER TABLE workspaces
DROP CONSTRAINT IF EXISTS workspaces_tier_check;

-- Update any existing 'private' or 'enterprise' tiers to 'team'
UPDATE workspaces
SET tier = 'team'
WHERE tier IN ('private', 'enterprise');

-- Add the new constraint with 'team' tier
ALTER TABLE workspaces
ADD CONSTRAINT workspaces_tier_check
CHECK (tier IN ('free', 'pro', 'team'));

-- Update workspace limits for team tier
UPDATE workspaces
SET
    max_repositories = 10,
    data_retention_days = 30
WHERE tier = 'team';

-- Add helpful comments
COMMENT ON COLUMN workspaces.tier IS 'Subscription tier: free (no workspaces), pro ($19/mo, 1 public workspace), team ($99/mo, 3 workspaces with private option)';
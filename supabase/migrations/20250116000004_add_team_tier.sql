-- Migration to add 'team' tier to workspaces and standardize tier naming
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

-- Drop and recreate constraint on subscription_features if it exists
ALTER TABLE subscription_features
DROP CONSTRAINT IF EXISTS subscription_features_tier_check;

-- Update any existing 'enterprise' entries to 'team'
UPDATE subscription_features
SET tier = 'team'
WHERE tier = 'enterprise';

-- Add the new constraint
ALTER TABLE subscription_features
ADD CONSTRAINT subscription_features_tier_check
CHECK (tier IN ('free', 'pro', 'team'));

-- Insert or update subscription features for team tier
INSERT INTO subscription_features (
    tier,
    max_workspaces,
    max_repositories_per_workspace,
    max_members_per_workspace,
    data_retention_days,
    private_workspaces_allowed,
    advanced_analytics,
    priority_support,
    custom_integrations,
    sso_enabled,
    audit_logs,
    created_at,
    updated_at
) VALUES (
    'team',
    3,  -- 3 workspaces included
    10, -- 10 repos per workspace
    5,  -- 5 team members included
    30, -- 30 days data retention
    true, -- Private workspaces allowed
    true, -- Advanced analytics
    true, -- Priority support
    true, -- Custom integrations
    true, -- SSO enabled
    true, -- Audit logs
    NOW(),
    NOW()
)
ON CONFLICT (tier)
DO UPDATE SET
    max_workspaces = EXCLUDED.max_workspaces,
    max_repositories_per_workspace = EXCLUDED.max_repositories_per_workspace,
    max_members_per_workspace = EXCLUDED.max_members_per_workspace,
    data_retention_days = EXCLUDED.data_retention_days,
    private_workspaces_allowed = EXCLUDED.private_workspaces_allowed,
    advanced_analytics = EXCLUDED.advanced_analytics,
    priority_support = EXCLUDED.priority_support,
    custom_integrations = EXCLUDED.custom_integrations,
    sso_enabled = EXCLUDED.sso_enabled,
    audit_logs = EXCLUDED.audit_logs,
    updated_at = NOW();

-- Update Pro tier to ensure it's configured correctly
UPDATE subscription_features
SET
    max_workspaces = 1,
    max_repositories_per_workspace = 3,
    max_members_per_workspace = 1,
    data_retention_days = 30,
    private_workspaces_allowed = false, -- Pro doesn't get private workspaces
    advanced_analytics = true,
    priority_support = false,
    custom_integrations = false,
    sso_enabled = false,
    audit_logs = false,
    updated_at = NOW()
WHERE tier = 'pro';

-- Update Free tier configuration
UPDATE subscription_features
SET
    max_workspaces = 0, -- No workspaces for free tier
    max_repositories_per_workspace = 0,
    max_members_per_workspace = 0,
    data_retention_days = 7,
    private_workspaces_allowed = false,
    advanced_analytics = false,
    priority_support = false,
    custom_integrations = false,
    sso_enabled = false,
    audit_logs = false,
    updated_at = NOW()
WHERE tier = 'free';

-- Add helpful comments
COMMENT ON COLUMN workspaces.tier IS 'Subscription tier: free (no workspaces), pro ($19/mo, 1 public workspace), team ($99/mo, 3 workspaces with private option)';
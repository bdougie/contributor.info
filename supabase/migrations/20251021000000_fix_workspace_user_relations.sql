-- Fix Workspace User Relations
-- Issue: https://github.com/bdougie/contributor.info/issues/1147
--
-- Problem: The workspace service code references a 'users' table/view that doesn't exist.
-- The system uses 'app_users' table but workspace queries use PostgREST syntax expecting 'users'.
-- This migration creates a 'users' view and adds the missing foreign key constraints.

-- =====================================================
-- 1. CREATE USERS VIEW
-- =====================================================
-- Create a view that maps 'users' to 'app_users' for workspace compatibility
-- This allows PostgREST joins like 'users!workspaces_owner_id_fkey' to work correctly

CREATE OR REPLACE VIEW users AS
SELECT
    id,
    auth_user_id,
    email,
    display_name,
    avatar_url,
    created_at,
    updated_at
FROM app_users;

-- Add comment explaining the view
COMMENT ON VIEW users IS 'View mapping app_users to users for workspace service compatibility';

-- Grant permissions on the view
GRANT SELECT ON users TO authenticated, anon;

-- =====================================================
-- 2. MIGRATE ORPHANED DATA
-- =====================================================
-- Before adding constraints, fix workspaces that reference auth_user_id instead of app_users.id
-- This can happen when workspace.owner_id was set to auth.users.id instead of app_users.id

-- Update workspaces to use the correct app_users.id instead of auth_user_id
UPDATE workspaces w
SET owner_id = au.id
FROM app_users au
WHERE w.owner_id = au.auth_user_id
  AND w.owner_id != au.id;

-- Update workspace_members to use the correct app_users.id instead of auth_user_id
UPDATE workspace_members wm
SET user_id = au.id
FROM app_users au
WHERE wm.user_id = au.auth_user_id
  AND wm.user_id != au.id;

-- Update workspace_members.invited_by to use the correct app_users.id instead of auth_user_id
UPDATE workspace_members wm
SET invited_by = au.id
FROM app_users au
WHERE wm.invited_by = au.auth_user_id
  AND wm.invited_by != au.id
  AND wm.invited_by IS NOT NULL;

-- Update workspace_repositories.added_by to use the correct app_users.id instead of auth_user_id
UPDATE workspace_repositories wr
SET added_by = au.id
FROM app_users au
WHERE wr.added_by = au.auth_user_id
  AND wr.added_by != au.id;

-- Handle null UUIDs and orphaned references in workspace_repositories.added_by
-- First, make the column nullable temporarily
ALTER TABLE workspace_repositories ALTER COLUMN added_by DROP NOT NULL;

-- Set orphaned references to NULL
UPDATE workspace_repositories
SET added_by = NULL
WHERE added_by = '00000000-0000-0000-0000-000000000000'
   OR added_by NOT IN (SELECT id FROM app_users);

-- Update workspace_invitations.invited_by to use the correct app_users.id instead of auth_user_id
UPDATE workspace_invitations wi
SET invited_by = au.id
FROM app_users au
WHERE wi.invited_by = au.auth_user_id
  AND wi.invited_by != au.id;

-- Delete orphaned invitations (invited_by column is NOT NULL, so we delete instead of setting NULL)
DELETE FROM workspace_invitations
WHERE invited_by = '00000000-0000-0000-0000-000000000000'
   OR invited_by NOT IN (SELECT id FROM app_users);

-- Handle null UUIDs in workspace_members.invited_by
UPDATE workspace_members
SET invited_by = NULL
WHERE invited_by = '00000000-0000-0000-0000-000000000000'
   OR invited_by NOT IN (SELECT id FROM app_users);

-- =====================================================
-- 3. ADD MISSING FOREIGN KEY CONSTRAINTS
-- =====================================================

-- Add foreign key for workspaces.owner_id -> app_users.id
-- This ensures workspace owners must exist in app_users table
ALTER TABLE workspaces
ADD CONSTRAINT workspaces_owner_id_fkey
FOREIGN KEY (owner_id)
REFERENCES app_users(id)
ON DELETE CASCADE;

-- Add foreign key for workspace_members.user_id -> app_users.id
-- This ensures workspace members must exist in app_users table
ALTER TABLE workspace_members
ADD CONSTRAINT workspace_members_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES app_users(id)
ON DELETE CASCADE;

-- Add foreign key for workspace_repositories.added_by -> app_users.id
-- This ensures the user who added a repo must exist in app_users table
ALTER TABLE workspace_repositories
ADD CONSTRAINT workspace_repositories_added_by_fkey
FOREIGN KEY (added_by)
REFERENCES app_users(id)
ON DELETE SET NULL;

-- Add foreign key for workspace_invitations.invited_by -> app_users.id
-- This ensures the user who sent an invitation must exist in app_users table
-- ON DELETE CASCADE: When inviter is deleted, delete their pending invitations
ALTER TABLE workspace_invitations
ADD CONSTRAINT workspace_invitations_invited_by_fkey
FOREIGN KEY (invited_by)
REFERENCES app_users(id)
ON DELETE CASCADE;

-- Add foreign key for workspace_members.invited_by -> app_users.id (nullable)
-- This ensures the user who sent an invitation must exist in app_users table
ALTER TABLE workspace_members
ADD CONSTRAINT workspace_members_invited_by_fkey
FOREIGN KEY (invited_by)
REFERENCES app_users(id)
ON DELETE SET NULL;

-- =====================================================
-- 4. CREATE INDEXES FOR FOREIGN KEY PERFORMANCE
-- =====================================================

-- Index for workspaces.owner_id foreign key lookups
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id_fkey
ON workspaces(owner_id);

-- Index for workspace_members.user_id foreign key lookups
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id_fkey
ON workspace_members(user_id);

-- Index for workspace_repositories.added_by foreign key lookups
CREATE INDEX IF NOT EXISTS idx_workspace_repositories_added_by_fkey
ON workspace_repositories(added_by);

-- Index for workspace_invitations.invited_by foreign key lookups
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_invited_by_fkey
ON workspace_invitations(invited_by);

-- Index for workspace_members.invited_by foreign key lookups
CREATE INDEX IF NOT EXISTS idx_workspace_members_invited_by_fkey
ON workspace_members(invited_by);

-- =====================================================
-- 5. ADD HELPFUL COMMENTS
-- =====================================================

COMMENT ON CONSTRAINT workspaces_owner_id_fkey ON workspaces IS
'Ensures workspace owner exists in app_users table';

COMMENT ON CONSTRAINT workspace_members_user_id_fkey ON workspace_members IS
'Ensures workspace member exists in app_users table';

COMMENT ON CONSTRAINT workspace_repositories_added_by_fkey ON workspace_repositories IS
'Ensures user who added repository exists in app_users table';

COMMENT ON CONSTRAINT workspace_invitations_invited_by_fkey ON workspace_invitations IS
'Ensures user who sent invitation exists in app_users table';

COMMENT ON CONSTRAINT workspace_members_invited_by_fkey ON workspace_members IS
'Ensures user who invited member exists in app_users table';

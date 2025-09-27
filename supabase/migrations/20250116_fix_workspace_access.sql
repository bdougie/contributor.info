-- Fix workspace access for test workspace
-- This migration ensures the workspace owner has proper access

-- First, check if the test workspace exists and get its details
DO $$
DECLARE
    v_workspace_id UUID;
    v_current_user_id UUID;
BEGIN
    -- Get the current user ID (you'll need to replace this with your actual user ID)
    -- You can find your user ID by checking the auth.users table
    SELECT id INTO v_current_user_id
    FROM auth.users
    LIMIT 1; -- Replace this with WHERE email = 'your-email@example.com'

    -- Get the test workspace ID
    SELECT id INTO v_workspace_id
    FROM workspaces
    WHERE slug = 'test'
    LIMIT 1;

    IF v_workspace_id IS NOT NULL AND v_current_user_id IS NOT NULL THEN
        -- Ensure the workspace is active
        UPDATE workspaces
        SET is_active = true,
            visibility = 'public' -- Make it public for easier access during testing
        WHERE id = v_workspace_id;

        -- Check if owner exists in workspace_members
        IF NOT EXISTS (
            SELECT 1 FROM workspace_members
            WHERE workspace_id = v_workspace_id
            AND user_id = v_current_user_id
        ) THEN
            -- Add owner as a member with owner role
            INSERT INTO workspace_members (
                workspace_id,
                user_id,
                role,
                accepted_at,
                created_at,
                updated_at
            ) VALUES (
                v_workspace_id,
                v_current_user_id,
                'owner',
                NOW(),
                NOW(),
                NOW()
            );

            RAISE NOTICE 'Added owner to workspace_members for test workspace';
        ELSE
            -- Update existing member to owner role
            UPDATE workspace_members
            SET role = 'owner',
                accepted_at = COALESCE(accepted_at, NOW())
            WHERE workspace_id = v_workspace_id
            AND user_id = v_current_user_id;

            RAISE NOTICE 'Updated member role to owner for test workspace';
        END IF;

        -- Also update the workspace owner_id to ensure consistency
        UPDATE workspaces
        SET owner_id = v_current_user_id
        WHERE id = v_workspace_id;

        RAISE NOTICE 'Workspace access fixed for test workspace';
    ELSE
        RAISE NOTICE 'Workspace or user not found';
    END IF;
END $$;

-- Alternative: If you know your user ID, uncomment and use this simpler version:
/*
-- Replace 'YOUR_USER_ID_HERE' with your actual user ID from auth.users table
UPDATE workspaces
SET owner_id = 'YOUR_USER_ID_HERE',
    is_active = true,
    visibility = 'public'
WHERE slug = 'test';

-- Ensure you're in workspace_members as owner
INSERT INTO workspace_members (workspace_id, user_id, role, accepted_at, created_at, updated_at)
SELECT id, 'YOUR_USER_ID_HERE', 'owner', NOW(), NOW(), NOW()
FROM workspaces
WHERE slug = 'test'
ON CONFLICT (workspace_id, user_id)
DO UPDATE SET
    role = 'owner',
    accepted_at = COALESCE(workspace_members.accepted_at, NOW());
*/
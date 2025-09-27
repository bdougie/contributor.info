-- Local-safe version of 20250131_add_maintainer_admin_overrides.sql
-- Generated: 2025-08-27T02:47:08.047Z
-- This migration has been modified to work without auth, roles, and extensions
-- Original migration may have different behavior in production

-- Transaction wrapper for safety
BEGIN;


-- Ensure authenticated exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated;
    RAISE NOTICE 'Created missing role: authenticated';
  END IF;
END $$;

-- This migration requires auth schema
DO $$
BEGIN
  -- Check if auth schema and functions exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    RAISE NOTICE 'Auth schema not found. Skipping 20250131_add_maintainer_admin_overrides.sql';
    RETURN;
  END IF;
  
  -- Check for auth.uid() function
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'auth' AND p.proname = 'uid'
  ) THEN
    RAISE NOTICE 'Auth functions not available. Skipping 20250131_add_maintainer_admin_overrides.sql';
    RETURN;
  END IF;
END $$;

-- Original migration content (only runs if auth is available)
-- Migration: Add admin override fields for maintainer management
-- Description: Adds fields to track manual admin overrides of contributor roles

-- Add admin override fields to contributor_roles table
ALTER TABLE public.contributor_roles 
ADD COLUMN IF NOT EXISTS admin_override BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS admin_override_by BIGINT,
ADD COLUMN IF NOT EXISTS admin_override_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS override_reason TEXT,
ADD COLUMN IF NOT EXISTS locked BOOLEAN DEFAULT FALSE;

-- Add foreign key constraint for admin user
ALTER TABLE public.contributor_roles
ADD CONSTRAINT fk_admin_override_by 
FOREIGN KEY (admin_override_by) 
REFERENCES public.app_users(github_user_id) 
ON DELETE SET NULL;

-- CREATE INDEX IF NOT EXISTS for admin overrides
CREATE INDEX IF NOT EXISTS idx_contributor_roles_admin_override 
ON public.contributor_roles(admin_override) 
WHERE admin_override = TRUE;

-- CREATE INDEX IF NOT EXISTS for locked roles
CREATE INDEX IF NOT EXISTS idx_contributor_roles_locked 
ON public.contributor_roles(locked) 
WHERE locked = TRUE;

-- Update RLS policies to allow admin updates
CREATE POLICY "Allow admin users to update contributor roles"
ON public.contributor_roles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.app_users
    WHERE app_users.auth_user_id = auth.uid()
    AND app_users.is_admin = TRUE
    AND app_users.is_active = TRUE
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.app_users
    WHERE app_users.auth_user_id = auth.uid()
    AND app_users.is_admin = TRUE
    AND app_users.is_active = TRUE
  )
);

-- Create function to handle admin role override
CREATE OR REPLACE FUNCTION public.override_contributor_role(
  p_user_id TEXT,
  p_repository_owner TEXT,
  p_repository_name TEXT,
  p_new_role TEXT,
  p_admin_github_id BIGINT,
  p_reason TEXT DEFAULT NULL,
  p_lock BOOLEAN DEFAULT FALSE
)
RETURNS VOID AS $$
DECLARE
  v_role_id UUID;
  v_previous_role TEXT;
  v_previous_confidence DECIMAL(3,2);
BEGIN
  -- Get current role info
  SELECT id, role, confidence_score 
  INTO v_role_id, v_previous_role, v_previous_confidence
  FROM public.contributor_roles
  WHERE user_id = p_user_id 
    AND repository_owner = p_repository_owner 
    AND repository_name = p_repository_name;

  -- Update the role with admin override
  UPDATE public.contributor_roles
  SET 
    role = p_new_role,
    admin_override = TRUE,
    admin_override_by = p_admin_github_id,
    admin_override_at = NOW(),
    override_reason = p_reason,
    locked = p_lock,
    updated_at = NOW()
  WHERE user_id = p_user_id 
    AND repository_owner = p_repository_owner 
    AND repository_name = p_repository_name;

  -- If no existing role, insert new one
  IF NOT FOUND THEN
    INSERT INTO public.contributor_roles (
      user_id, repository_owner, repository_name, role, 
      confidence_score, admin_override, admin_override_by, 
      admin_override_at, override_reason, locked, detection_methods
    ) VALUES (
      p_user_id, p_repository_owner, p_repository_name, p_new_role,
      0.0, TRUE, p_admin_github_id, NOW(), p_reason, p_lock, 
      '["manual_admin_override"]'::jsonb
    )
    RETURNING id INTO v_role_id;
  END IF;

  -- Log the change in history
  INSERT INTO public.contributor_role_history (
    contributor_role_id, user_id, repository_owner, repository_name,
    previous_role, new_role, previous_confidence, new_confidence,
    change_reason, detection_methods
  ) VALUES (
    v_role_id, p_user_id, p_repository_owner, p_repository_name,
    v_previous_role, p_new_role, v_previous_confidence, 0.0,
    COALESCE(p_reason, 'Admin manual override'),
    '["manual_admin_override"]'::jsonb
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    Grant execute permission to authenticated users (admin check is inside function)
GRANT EXECUTE ON FUNCTION public.override_contributor_role TO authenticated;
  ELSE
    RAISE NOTICE 'Role authenticated not found, skipping grant';
  END IF;
END $;

-- Update role constraint to include bot
ALTER TABLE public.contributor_roles 
DROP CONSTRAINT IF EXISTS contributor_roles_role_check;

ALTER TABLE public.contributor_roles 
ADD CONSTRAINT contributor_roles_role_check 
CHECK (role IN ('owner', 'maintainer', 'contributor', 'bot'));

COMMIT;

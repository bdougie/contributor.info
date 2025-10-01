-- Local-safe version of 20250805_fix_function_search_paths.sql
-- Generated: 2025-08-27T02:47:08.062Z
-- This migration has been modified to work without auth, roles, and extensions
-- Original migration may have different behavior in production

-- Transaction wrapper for safety
BEGIN;


-- Ensure anon exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon;
    RAISE NOTICE 'Created missing role: anon';
  END IF;
END $$;

-- Ensure authenticated exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated;
    RAISE NOTICE 'Created missing role: authenticated';
  END IF;
END $$;

-- Ensure service_role exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role;
    RAISE NOTICE 'Created missing role: service_role';
  END IF;
END $$;

-- Fix function search paths for security
-- This prevents potential security issues with schema resolution

-- Update all functions to have an immutable search path
-- This is a security best practice recommended by Supabase

DO $$ 
DECLARE
    func RECORD;
BEGIN
    -- Loop through all functions in the public schema
    FOR func IN 
        SELECT proname, pg_get_function_identity_arguments(oid) as args
        FROM pg_proc
        WHERE pronamespace = 'public'::regnamespace
        AND prokind = 'f' -- Only functions, not procedures
    LOOP
        BEGIN
            -- Set search_path for each function
            EXECUTE format('
                ALTER FUNCTION public.%I(%s) 
                SET search_path = public, pg_catalog, pg_temp
            ', func.proname, func.args);
        EXCEPTION
            WHEN OTHERS THEN
                -- Log but don't fail if a function can't be altered
                RAISE NOTICE 'Could not alter function %.%: %', func.proname, func.args, SQLERRM;
        END;
    END LOOP;
END $$;

-- Move extensions out of public schema for security
-- This prevents potential security issues with extension functions

-- Create a dedicated schema for extensions if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Grant usage on extensions schema to necessary roles
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    

-- Note: Moving extensions requires careful handling of dependencies
-- The following commands are commented out and should be run manually after verifying dependencies:
-- ALTER EXTENSION vector SET SCHEMA extensions;
  ELSE
    RAISE NOTICE 'Extension vector not available, skipping dependent code';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error with vector extension: %', SQLERRM;
END $$;
-- ALTER EXTENSION http SET SCHEMA extensions;

-- Add RLS policy for materialized view (convert to regular view if needed)
-- Note: Materialized views can't have RLS, so we need to control access differently
COMMENT ON MATERIALIZED VIEW public.repository_contribution_stats IS 
'This materialized view is publicly accessible. Consider converting to a regular view with RLS-enabled base tables if sensitive data is involved.';

COMMIT;

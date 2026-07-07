-- Migration: Drop unused monitoring schema
-- Purpose: Remove RLS diagnostic tooling from 2025-01-27 that duplicates
--          Supabase advisor lints (auth_rls_initplan, multiple_permissive_policies).
--          No app code, cron jobs, or other database objects reference it.
--          Resolves 2 function_search_path_mutable advisor warnings and removes
--          2 SECURITY DEFINER functions from the attack surface.
-- Objects removed: views rls_policy_summary, rls_performance_metrics,
--          slow_rls_queries; functions check_unoptimized_policies(),
--          generate_rls_report()

DROP SCHEMA IF EXISTS monitoring CASCADE;

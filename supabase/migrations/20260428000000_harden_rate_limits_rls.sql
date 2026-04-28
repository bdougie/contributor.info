-- Fix: rate_limits has four always-true RLS policies (advisor: rls_policy_always_true)
--
-- Current policies on public.rate_limits:
--   service_only_all       — ALL,    service_role only           (correct)
--   rate_limits_select     — SELECT, anon|authenticated|service  (USING true)       — bypass
--   rate_limits_insert     — INSERT, anon|authenticated|service  (WITH CHECK true)  — bypass
--   rate_limits_update     — UPDATE, anon|authenticated|service  (USING+WITH CHECK true) — bypass
--   rate_limits_delete     — DELETE, anon|authenticated|service  (USING true)       — bypass
--
-- Because RLS policies are OR'd together, the four loose policies override the
-- correct service_only_all policy. The DELETE one is the worst: any anon
-- caller with the publishable key can DELETE rows, defeating rate limiting
-- entirely.
--
-- All current writers (netlify/functions/lib/rate-limiter.mts and
-- supabase/functions/codeowners/index.ts) authenticate with the
-- service_role key, so the service_only_all policy is sufficient.
--
-- Note: netlify/functions/api-*.mts fall back to SUPABASE_ANON_KEY when
-- SUPABASE_SERVICE_ROLE_KEY is not set. After this migration, any deploy
-- missing the service-role key will fail to write rate limits (silent under
-- supabase-js — the request returns OK with zero affected rows). Production
-- has 2536 successful updates on this table, so service-role is currently
-- configured correctly; this is a deploy-config concern to track separately.

BEGIN;

DROP POLICY IF EXISTS rate_limits_select ON public.rate_limits;
DROP POLICY IF EXISTS rate_limits_insert ON public.rate_limits;
DROP POLICY IF EXISTS rate_limits_update ON public.rate_limits;
DROP POLICY IF EXISTS rate_limits_delete ON public.rate_limits;

COMMIT;

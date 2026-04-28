-- Fix: 5 SECURITY DEFINER views (advisor: security_definer_view)
--
-- Postgres views default to SECURITY DEFINER behavior — they execute with
-- the view-owner's permissions and bypass RLS on underlying tables. The
-- advisor flags any view without `security_invoker = true` set explicitly.
--
-- Switching to SECURITY INVOKER means the view executes with the *querying*
-- user's permissions and respects RLS on underlying tables. This is the
-- safer default in modern Postgres (15+).
--
-- Verification per view:
--   - users → app_users (public SELECT policy, qual=true) — safe
--   - codeowners_with_repository → codeowners + repositories (both public read) — safe
--   - items_needing_embeddings → issues + pull_requests + discussions +
--       workspace_repositories — all public-readable. Caller is Inngest
--       (service_role, bypasses RLS regardless).
--   - items_needing_embeddings_priority → same. Caller is Inngest.
--   - stuck_jobs_monitor → progressive_capture_jobs (service_role-only).
--       No app callers found; used for manual ops monitoring.
--       Tightening visibility to service_role-only is intended.

BEGIN;

ALTER VIEW public.users SET (security_invoker = true);
ALTER VIEW public.codeowners_with_repository SET (security_invoker = true);
ALTER VIEW public.items_needing_embeddings SET (security_invoker = true);
ALTER VIEW public.items_needing_embeddings_priority SET (security_invoker = true);
ALTER VIEW public.stuck_jobs_monitor SET (security_invoker = true);

COMMIT;

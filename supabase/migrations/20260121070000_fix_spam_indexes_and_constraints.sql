-- Migration: Fix redundant indexes and add missing constraints
-- Issue: #1622 - PR 1624 review feedback
-- Fixes:
--   1. Drop redundant indexes on unique columns (CodeRabbit nitpick)
--   2. Add missing index on reporter_ip_hash for rate limiting (Cubic P2)
--   3. Add CHECK constraint ensuring reporter identity (CodeRabbit nitpick)

-- ============================================
-- 1. Drop redundant indexes on unique columns
-- ============================================
-- UNIQUE constraints automatically create implicit indexes, making these redundant

-- Drop redundant index on known_spammers.github_login (UNIQUE already creates index)
DROP INDEX IF EXISTS public.idx_known_spammers_login;

-- Drop redundant indexes on spam_reporters (UNIQUE constraints already create indexes)
DROP INDEX IF EXISTS public.idx_spam_reporters_user;
DROP INDEX IF EXISTS public.idx_spam_reporters_ip;

-- ============================================
-- 2. Add missing index for rate limiting
-- ============================================
-- Required for efficient anonymous rate limit checks (10/hr per IP)

CREATE INDEX IF NOT EXISTS idx_spam_reports_ip_hash
  ON public.spam_reports(reporter_ip_hash)
  WHERE reporter_ip_hash IS NOT NULL;

-- ============================================
-- 3. Add CHECK constraint for reporter identity
-- ============================================
-- Ensures at least one identifier (user_id or ip_hash) is present
-- Prevents unidentifiable reporter records

ALTER TABLE public.spam_reporters
DROP CONSTRAINT IF EXISTS reporter_identity_required;

ALTER TABLE public.spam_reporters
ADD CONSTRAINT reporter_identity_required
  CHECK (user_id IS NOT NULL OR ip_hash IS NOT NULL);

-- ============================================
-- Documentation
-- ============================================
COMMENT ON INDEX public.idx_spam_reports_ip_hash IS
  'Partial index for anonymous rate limit lookups - only indexes non-null IP hashes';
COMMENT ON CONSTRAINT reporter_identity_required ON public.spam_reporters IS
  'Ensures every reporter has at least one identifier (user_id or ip_hash)';

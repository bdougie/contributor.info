-- Fix: 2 public storage buckets allow listing (advisor: public_bucket_allows_listing)
--
-- Public buckets serve files via direct URL — no SELECT policy on
-- storage.objects is required for URL-based access. The broad SELECT
-- policies on these buckets currently allow any client with the
-- publishable key to enumerate every file in the bucket via .list(),
-- exposing more data than intended.
--
-- Buckets: chart-screenshots, social-cards (both public).
--
-- Caller impact:
--   - chart-screenshots: no callers found.
--   - social-cards: one .list() call in
--     src/components/performance-monitoring-dashboard.tsx (loadCDNMetrics).
--     This is an admin diagnostic that counts files for CDN metrics
--     (which the same file describes as "mock CDN performance data").
--     The dashboard handles errors gracefully — it will report 0 files
--     until the metric is moved to a server-side Netlify endpoint that
--     uses SUPABASE_SERVICE_ROLE_KEY.
--
-- URL-based image access (the actual product feature) is unaffected.

BEGIN;

DROP POLICY IF EXISTS "Public read access for chart screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for social cards"      ON storage.objects;

COMMIT;

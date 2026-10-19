-- Schedule cleanup of expired idempotency_keys rows.
--
-- The table gained a steady writer in Oct 2026: the GitHub App webhook
-- background function inserts one row per delivery (cost-reduction plan,
-- Phase 1a). expires_at is metadata, not a TTL, and the cron in
-- 20250116000000_idempotency_keys.sql was left commented out, so without this
-- the table grows without bound.
--
-- The original cleanup_expired_idempotency_keys() waited a further 7 days past
-- expires_at. Rows are already written with the intended retention in
-- expires_at (7 days for webhook deliveries), so this deletes at expiry. Rows
-- still marked `processing` are kept for one extra day so a long-running or
-- stuck claim is never deleted out from under a live invocation.

CREATE OR REPLACE FUNCTION public.cleanup_expired_idempotency_keys()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted integer;
BEGIN
  DELETE FROM public.idempotency_keys
  WHERE expires_at < NOW()
    AND (status <> 'processing' OR expires_at < NOW() - INTERVAL '1 day');
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

COMMENT ON FUNCTION public.cleanup_expired_idempotency_keys() IS
  'Deletes idempotency_keys rows past expires_at (processing rows get one extra day). Scheduled daily by pg_cron.';

-- Idempotent schedule: unschedule any previous job of the same name first.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('cleanup-expired-idempotency-keys')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-idempotency-keys');

    PERFORM cron.schedule(
      'cleanup-expired-idempotency-keys',
      '23 3 * * *',
      'SELECT public.cleanup_expired_idempotency_keys();'
    );
  ELSE
    RAISE NOTICE 'pg_cron not installed; cleanup_expired_idempotency_keys() must be scheduled manually';
  END IF;
END
$$;

// Note: HTTP headers are case-insensitive per RFC 7230, and CORS spec requires
// case-insensitive comparison. However, Supabase Edge Functions (running on Deno)
// appear to have a bug with case-sensitive header comparison in CORS preflight.
// Including both cases is a workaround until this is fixed upstream.
// See: https://github.com/bdougie/contributor.info/issues/732
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-idempotency-key, X-Idempotency-Key, x-inngest-signature, X-Inngest-Signature, x-inngest-sdk, X-Inngest-SDK, x-inngest-server-kind, X-Inngest-Server-Kind',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, HEAD',
};

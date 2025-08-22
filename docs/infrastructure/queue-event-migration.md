# Queue Event Endpoint Migration

## Overview
The `/api/queue-event` endpoint has been migrated from Netlify Functions to Supabase Edge Functions to address timeout and stability issues.

## Migration Date
**August 22, 2025**

## Reasons for Migration

1. **Timeout Limitations**: Netlify Functions have a 10-second timeout limit, which was insufficient for processing larger event queues
2. **Stability Issues**: Frequent 404 errors in production due to Netlify cold starts and function instability
3. **Better Performance**: Supabase Edge Functions provide 150-second timeout and better reliability

## Architecture Changes

### Before (Netlify Function)
```
Client → /api/queue-event → Netlify Function → Inngest
         (10s timeout)
```

### After (Supabase Edge Function)
```
Client → /api/queue-event → Supabase Edge Function → Inngest
         (150s timeout)        (with fallback)
```

## Implementation Details

### Supabase Edge Function
- **Location**: Deployed to Supabase project `egcxzonpmmcirmgqdrla`
- **Endpoint**: `https://egcxzonpmmcirmgqdrla.supabase.co/functions/v1/queue-event`
- **Timeout**: 150 seconds
- **Authentication**: Uses Supabase anon key for public access

### Client Implementation
The client (`src/lib/inngest/client-safe.ts`) implements a fallback pattern:

1. **Primary**: Supabase Edge Function
2. **Fallback**: Netlify Function (if Supabase is unavailable)

This ensures zero downtime during the migration and provides redundancy.

### Required Secrets
The following secrets must be configured in Supabase:
- `INNGEST_EVENT_KEY`: For authenticating with Inngest
- `INNGEST_SIGNING_KEY`: For verifying webhook signatures

## Files Changed

### Removed (Deprecated)
- `netlify/functions/api-queue-event.js`
- `netlify/functions/api-queue-event.mts`
- `netlify/functions/queue-event.ts`

### Modified
- `netlify.toml`: Updated redirect to point to Supabase
- `netlify/functions/_health-check-queue-event.mts`: Updated to reflect migration
- `src/lib/inngest/client-safe.ts`: Added Supabase endpoint with fallback

### Added
- Supabase Edge Function `queue-event` (deployed via Supabase CLI)
- `docs/infrastructure/supabase-edge-function-secrets.md`: Secret configuration docs

## Testing

### Local Testing
```bash
# Test Supabase endpoint
node test-supabase-queue.js

# Test with fallback
node test-queue-endpoint.js
```

### Production Testing
The endpoint automatically uses the Supabase Edge Function in production with Netlify as a fallback.

## Monitoring

1. **Supabase Dashboard**: Monitor function invocations and errors
2. **Inngest Dashboard**: Verify events are being received
3. **Application Logs**: Check for fallback usage

## Rollback Plan

If issues arise, the client automatically falls back to the Netlify function. To fully rollback:

1. Update `netlify.toml` to restore the original redirect
2. Redeploy the Netlify functions
3. Update client to remove Supabase endpoint

## Benefits Achieved

1. **Increased Reliability**: No more 404 errors from cold starts
2. **Better Performance**: 15x longer timeout for complex operations
3. **Improved Monitoring**: Better observability through Supabase dashboard
4. **Cost Efficiency**: Edge Functions are more cost-effective for high-volume events

## Future Considerations

1. Consider migrating other time-sensitive endpoints to Edge Functions
2. Implement retry logic with exponential backoff
3. Add metrics collection for endpoint performance comparison
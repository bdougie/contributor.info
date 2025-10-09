# Postmortem: Inngest Embeddings Failures Investigation

**Date**: January 2025
**Branch**: `investigate/inngest-embeddings-failures`
**Status**: Root cause identified, fix implemented

## Problem Summary

The automated embeddings processing scripts were failing with the error:
```
Error: No x-inngest-signature provided
```

## Root Cause

The `trigger-embeddings.mjs` script was **sending events directly to the Inngest edge function endpoint** without proper Inngest cryptographic signatures.

### What Was Happening

1. Scripts called `https://egcxzonpmmcirmgqdrla.supabase.co/functions/v1/inngest-prod` directly
2. They sent Inngest event JSON but without the required `x-inngest-signature` header
3. The `InngestCommHandler` validates all incoming requests for proper signatures
4. Unsigned requests were correctly rejected as a security measure

### Architectural Misunderstanding

**Wrong approach**: Client → Edge Function directly
**Correct approach**: Client → Inngest API → Edge Function (with signature)

The edge function is designed to **receive** events from Inngest, not to be called directly by scripts. Inngest's API handles:
- Event queuing
- Signature generation
- Retry logic
- Rate limiting
- Monitoring

## Solution

Changed the trigger script to send events to **Inngest's event API** (`https://inn.gs/e/{event_key}`) instead of the edge function directly.

### Code Changes

#### Before (scripts/trigger-embeddings.mjs:10-27)
```javascript
const INNGEST_ENDPOINT = `${SUPABASE_URL}/functions/v1/inngest-prod`;

const response = await fetch(INNGEST_ENDPOINT, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  },
  body: JSON.stringify({
    name: 'embeddings/compute.requested',
    data: {},
    ts: Date.now(),
  }),
});
```

#### After (scripts/trigger-embeddings.mjs:8-31)
```javascript
const INNGEST_EVENT_KEY = process.env.INNGEST_EVENT_KEY || process.env.INNGEST_PRODUCTION_EVENT_KEY;
const INNGEST_API_URL = 'https://inn.gs/e';

const response = await fetch(`${INNGEST_API_URL}/${INNGEST_EVENT_KEY}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'embeddings/compute.requested',
    data: {},
    ts: Date.now(),
  }),
});
```

### Environment Variable Changes

- **Before**: Required `SUPABASE_SERVICE_ROLE_KEY`
- **After**: Requires `INNGEST_EVENT_KEY` or `INNGEST_PRODUCTION_EVENT_KEY`

## Files Modified

1. `scripts/trigger-embeddings.mjs` - Fixed to use Inngest API
2. `scripts/auto-process-embeddings-simple.sh` - Updated env var validation

## Testing Instructions

```bash
# Export the correct environment variable
export INNGEST_EVENT_KEY='your-inngest-event-key'

# Test single trigger
node scripts/trigger-embeddings.mjs

# Test automated processing
./scripts/auto-process-embeddings-simple.sh 20 5
```

## Related Systems

The edge function itself (`supabase/functions/inngest-prod/index.ts`) is **correctly implemented** and requires no changes. It properly:
- Validates Inngest signatures
- Handles CORS
- Processes multiple event types
- Includes proper error handling

## Lessons Learned

1. **Read the architecture**: Always understand how event-driven systems work before writing integration code
2. **Security by design**: Signature validation is a feature, not a bug
3. **Official SDKs exist**: Consider using Inngest's official SDK for event sending
4. **Test with proper auth**: Don't bypass security mechanisms during development

## Next Steps

1. ✅ Fix trigger script to use Inngest API
2. ✅ Update shell script environment validation
3. ⬜ Test with production Inngest credentials
4. ⬜ Monitor first successful run in Inngest dashboard
5. ⬜ Document proper usage in README
6. ⬜ Delete one-time use scripts per CLAUDE.md guidelines

## Monitoring

- Inngest Dashboard: https://app.inngest.com
- SQL Check: `SELECT * FROM embedding_jobs ORDER BY created_at DESC LIMIT 10;`
- Backlog: `SELECT COUNT(*) FROM items_needing_embeddings;`

# Request Deduplication with Idempotency Keys

## Overview

This document describes the implementation of request deduplication using idempotency keys to prevent duplicate event processing when clients retry failed requests or when network issues cause multiple submissions.

## Implementation Date
**January 16, 2025**

## Problem Solved

Previously, if a client retried a failed request or if network issues caused duplicate submissions, we would process the same event multiple times, leading to:
- Duplicate data in the database
- Wasted compute resources
- Potential data inconsistencies

## Solution Architecture

### 1. Database Storage

Created a `idempotency_keys` table in Supabase to store request deduplication information:

```sql
CREATE TABLE public.idempotency_keys (
    key TEXT PRIMARY KEY,
    request_hash TEXT NOT NULL,
    response JSONB,
    status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    endpoint TEXT NOT NULL,
    user_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb
);
```

Key features:
- **Automatic TTL**: Records expire after 24 hours
- **Status tracking**: Processing, completed, or failed states
- **Response caching**: Stores successful responses for duplicate requests
- **User association**: Optional user_id for authenticated requests

### 2. Client-Side Implementation

Updated `src/lib/inngest/client-safe.ts` to:
- Generate unique idempotency keys using `crypto.randomUUID()`
- Include idempotency keys in request headers (`X-Idempotency-Key`)
- Handle duplicate responses appropriately

```typescript
// Generate idempotency key
const idempotencyKey = generateIdempotencyKey();

// Send with idempotency header
headers: {
  'X-Idempotency-Key': idempotencyKey,
  // ... other headers
}
```

### 3. Edge Function Implementation

The `queue-event` Edge Function (`supabase/functions/queue-event/index.ts`) implements:

1. **Idempotency Check**:
   - Checks if the key exists in the database
   - Returns cached response for completed requests
   - Prevents concurrent processing of same key

2. **Race Condition Handling**:
   - Uses database unique constraint to handle concurrent requests
   - First request wins and processes
   - Subsequent requests wait or return cached response

3. **Failure Recovery**:
   - Failed requests can be retried with same idempotency key
   - Old failed records are automatically cleaned up

## Usage

### Basic Usage

```javascript
// Client automatically generates idempotency key
const result = await sendInngestEvent({
  name: 'user.created',
  data: { userId: '123' }
});

// Response includes idempotency info
console.log(result.idempotencyKey); // Generated key
console.log(result.duplicate);      // true if duplicate
```

### Custom Idempotency Key

```javascript
// Provide your own idempotency key
const result = await sendInngestEvent(
  {
    name: 'order.processed',
    data: { orderId: 'ABC123' }
  },
  {
    idempotencyKey: 'order-ABC123-process'
  }
);
```

## Testing

Run the test script to verify idempotency:

```bash
node scripts/testing-tools/test-idempotency.js
```

The test covers:
1. Unique requests with different keys
2. Duplicate detection with same key
3. Race condition handling (concurrent requests)
4. Requests without idempotency keys

## Monitoring

The Edge Function logs duplicate attempts for monitoring:

```javascript
console.log('Event queued successfully:', {
  eventId,
  idempotencyKey,
  isDuplicate,
  userId
});
```

Monitor duplicate rates in:
- Supabase Function logs
- Application logs (client-safe.ts)
- Database queries on `idempotency_keys` table

## Benefits

1. **Data Integrity**: Prevents duplicate processing
2. **Resource Efficiency**: Reduces unnecessary compute
3. **Better UX**: Clients can safely retry without side effects
4. **Observability**: Track retry patterns and failure rates

## Future Improvements

1. **Configurable TTL**: Allow different expiration times per endpoint
2. **Metrics Dashboard**: Visualize duplicate request patterns
3. **Smart Retry Logic**: Exponential backoff based on idempotency data
4. **Batch Operations**: Support idempotency for batch requests

## Related Documentation

- [Queue Event Migration](./queue-event-migration.md)
- [Edge Function Monitoring](#485)
- [Concurrency Limits Evaluation](#489)
# Inngest Client-Safe Event Sending

This document describes the client-safe wrapper for sending Inngest events from both browser and server environments.

## Overview

The `sendInngestEvent` function provides a unified interface for sending events to Inngest that works safely in both browser and server contexts. In the browser, it routes events through a server-side API endpoint to prevent exposing sensitive event keys. On the server, it sends events directly to Inngest.

## Usage

```typescript
import { sendInngestEvent } from '@/lib/inngest/client-safe';

// Send an event (works in both browser and server)
await sendInngestEvent({
  name: 'capture/repository.sync',
  data: {
    repositoryId: 'repo-123',
    days: 30,
    priority: 'high',
    reason: 'User requested sync'
  }
});
```

## Implementation Details

### Browser Environment
- Detects browser context using `typeof window !== 'undefined'`
- Sends events to `/api/queue-event` endpoint via POST request
- Server endpoint handles authentication with Inngest
- Prevents exposure of event keys to client-side code

### Server Environment
- Sends events directly to Inngest using the configured client
- Uses server-side environment variables for authentication
- More efficient than routing through API endpoint

## API Endpoint

The `/api/queue-event` endpoint (implemented in `netlify/functions/api-queue-event.mts`):
- Accepts POST requests with `eventName` and `data`
- Uses server-side Inngest client with proper authentication
- Returns success/error responses with event IDs

## Migration Guide

To migrate existing code:

```typescript
// Old (direct usage - fails in browser)
import { inngest } from '@/lib/inngest/client';
await inngest.send({ name: 'event', data: {} });

// New (works everywhere)
import { sendInngestEvent } from '@/lib/inngest/client-safe';
await sendInngestEvent({ name: 'event', data: {} });
```

## Error Handling

The function provides consistent error handling:
- Network errors are caught and re-thrown with context
- API errors include response details
- Console errors include helpful debugging information

## Security Benefits

1. **No Event Key Exposure**: Event keys remain server-side only
2. **Authentication**: Server validates all event submissions
3. **Rate Limiting**: API endpoint can implement rate limiting
4. **Audit Trail**: All events go through controlled endpoints

## Testing

When mocking in tests:

```typescript
vi.mock('@/lib/inngest/client-safe', () => ({
  sendInngestEvent: vi.fn().mockResolvedValue({ ids: ['mock-id'] })
}));
```

## Related Files

- `/src/lib/inngest/client-safe.ts` - Client-safe wrapper implementation
- `/netlify/functions/api-queue-event.mts` - API endpoint for browser events
- `/src/lib/inngest/client.ts` - Original Inngest client configuration
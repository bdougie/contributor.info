# Trending 502 Error Fix and Sentry Integration

**Date:** 2025-11-24  
**PR:** [#1245](https://github.com/bdougie/contributor.info/pull/1245)  
**Status:** ✅ Fixed

## Problem

The `/trending` page was returning a **502 Bad Gateway** error, preventing users from accessing trending repositories.

### Root Cause

The Netlify function `api-trending-repositories.mts` was calling a non-existent Supabase RPC function:
```typescript
// ❌ This function doesn't exist
await supabase.rpc('get_trending_repositories_with_fallback', { ... })
```

The actual function in the database is `get_trending_repositories` (without the `_with_fallback` suffix).

### Error Symptoms

```
.netlify/functions/api-trending-repositories?period=7d&limit=50&sort=trending_score:1 
Failed to load resource: the server responded with a status of 502 ()

Error fetching trending repositories: Error: HTTP 502
```

## Solution

### 1. Fixed RPC Function Name

**File:** `netlify/functions/api-trending-repositories.mts`

Changed from:
```typescript
const { data: trendingRepos, error } = await supabase.rpc(
  'get_trending_repositories_with_fallback', // ❌ Wrong
  { ... }
);
```

To:
```typescript
const { data: trendingRepos, error } = await supabase.rpc(
  'get_trending_repositories', // ✅ Correct
  { ... }
);
```

### 2. Added Sentry Error Tracking

To prevent similar issues in the future and improve observability, comprehensive Sentry error tracking was added.

#### Backend Error Tracking

**File:** `netlify/functions/api-trending-repositories.mts`

```typescript
import * as Sentry from '@sentry/react';

// Initialize Sentry
const sentryDsn = process.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.CONTEXT || 'development',
    tracesSampleRate: 0.1,
  });
}

// Track RPC errors with context
if (error) {
  Sentry.captureException(error, {
    tags: {
      function: 'api-trending-repositories',
      rpc_function: 'get_trending_repositories',
    },
    extra: {
      query,
      error_message: error.message,
      error_details: error.details,
      error_hint: error.hint,
      error_code: error.code,
    },
  });
}

// Track uncaught exceptions
catch (error) {
  Sentry.captureException(error, {
    tags: {
      function: 'api-trending-repositories',
      error_type: 'uncaught_exception',
    },
    extra: {
      event_method: event.httpMethod,
      event_path: event.path,
      query_params: event.queryStringParameters,
    },
  });
}
```

#### Frontend Error Tracking

**File:** `src/hooks/use-trending-repositories.ts`

```typescript
import { captureException } from '@/lib/sentry-lazy';

// In useTrendingRepositories hook
catch (err) {
  captureException(err, {
    tags: {
      hook: 'useTrendingRepositories',
      endpoint: 'api-trending-repositories',
    },
    extra: {
      query: currentQuery,
    },
  });
}

// In useTrendingStatistics hook
catch (err) {
  captureException(err, {
    tags: {
      hook: 'useTrendingStatistics',
      endpoint: 'api-trending-repositories',
    },
    extra: {
      period,
    },
  });
}
```

## Benefits

### Immediate
- ✅ `/trending` page now works correctly
- ✅ Users can view trending repositories

### Long-term
- 🔍 **Better Observability**: All errors are now tracked in Sentry
- 🚨 **Real-time Alerts**: Get notified when errors occur in production
- 🐛 **Faster Debugging**: Error context includes query params, stack traces, and environment details
- 📊 **Pattern Recognition**: Monitor error frequency and identify recurring issues
- 🛡️ **Proactive Monitoring**: Catch issues before users report them

## Error Context Captured

When errors occur, Sentry now captures:

### Backend
- Function name and RPC function name
- Query parameters (period, limit, language, minStars, sort)
- Error message, details, hint, and code from Supabase
- HTTP method and path
- Environment (production/development)

### Frontend
- Hook name and endpoint
- Query parameters
- Error stack trace
- User session context (from existing Sentry setup)

## Testing

- ✅ TypeScript compilation passes
- ✅ Sentry DSN uses existing environment variable (`VITE_SENTRY_DSN`)
- ✅ Leverages existing Sentry lazy-loading infrastructure
- ✅ Error tracking is non-blocking and fails gracefully
- ✅ No changes to user-facing functionality

## Database Function Reference

The correct function is defined in:  
`supabase/migrations/20250824_enhance_trending_capture.sql`

```sql
CREATE OR REPLACE FUNCTION get_trending_repositories(
  p_time_period INTERVAL DEFAULT INTERVAL '7 days',
  p_limit INTEGER DEFAULT 50,
  p_language TEXT DEFAULT NULL,
  p_min_stars INTEGER DEFAULT 0
) RETURNS TABLE (
  repository_id UUID,
  owner TEXT,
  name TEXT,
  -- ... other columns
) AS $$
-- Function implementation
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Related Files

- `netlify/functions/api-trending-repositories.mts` - Netlify function (fixed)
- `src/hooks/use-trending-repositories.ts` - Frontend hook (error tracking added)
- `src/lib/sentry-lazy.ts` - Sentry lazy-loading utility (existing)
- `supabase/migrations/20250824_enhance_trending_capture.sql` - Database function definition

## Lessons Learned

1. **Function Name Mismatches**: Always verify RPC function names match database definitions
2. **Error Tracking**: Early error tracking helps catch issues before they become critical
3. **Context Matters**: Rich error context makes debugging significantly easier
4. **Non-blocking Monitoring**: Sentry integration doesn't impact performance or user experience

## Future Improvements

1. Add integration tests that verify RPC function names
2. Add type checking for Supabase RPC function names
3. Create alerts for 502 errors in production
4. Add performance monitoring for trending endpoint

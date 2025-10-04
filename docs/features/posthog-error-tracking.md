# PostHog Error Tracking

## Overview

PostHog error tracking automatically captures and reports application errors to help monitor production issues, starting with 500 errors and critical failures. This integration provides detailed error context, stack traces, and user information to aid in debugging.

## Features

- ✅ Automatic error capture for unhandled exceptions
- ✅ React Error Boundaries for component-level error handling
- ✅ API error tracking (4xx, 5xx status codes)
- ✅ Supabase query error tracking
- ✅ Sensitive data sanitization
- ✅ Custom error grouping and categorization
- ✅ Error severity tagging
- ✅ Rate limiting to prevent spam
- ✅ Development-friendly error details

## Configuration

### PostHog Client Configuration

The PostHog client is configured in `src/lib/posthog-lazy.ts` with error tracking enabled:

```typescript
const POSTHOG_CONFIG = {
  api_host: env.POSTHOG_HOST || 'https://us.i.posthog.com',
  
  // Error tracking configuration
  capture_exceptions: true,       // Enable automatic error capture
  capture_performance: true,       // Capture performance issues
  
  // Error filtering and sanitization
  before_send: (event: any) => {
    if (event.properties && event.properties.$exception_message) {
      event.properties.$exception_message = sanitizeErrorMessage(
        event.properties.$exception_message
      );
    }
    return event;
  },
};
```

### Error Severity Levels

```typescript
enum ErrorSeverity {
  LOW = 'low',           // Minor issues, non-critical
  MEDIUM = 'medium',     // Default, moderate impact
  HIGH = 'high',         // Significant impact, needs attention
  CRITICAL = 'critical', // Severe issues, requires immediate action
}
```

### Error Categories

```typescript
enum ErrorCategory {
  API = 'api',               // API/Network errors
  DATABASE = 'database',     // Supabase/Database errors
  NETWORK = 'network',       // Network connectivity issues
  VALIDATION = 'validation', // Data validation errors
  UI = 'ui',                 // React component errors
  AUTH = 'auth',             // Authentication/Authorization errors
  UNKNOWN = 'unknown',       // Uncategorized errors
}
```

## Usage

### 1. React Error Boundaries

Wrap components with the ErrorBoundary to catch React errors:

```tsx
import { ErrorBoundary, ErrorFallback } from '@/components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary fallback={<ErrorFallback />}>
      <YourComponent />
    </ErrorBoundary>
  );
}
```

**Custom Error Handler:**

```tsx
<ErrorBoundary
  onError={(error, errorInfo) => {
    console.log('Custom error handling', error, errorInfo);
  }}
>
  <YourComponent />
</ErrorBoundary>
```

### 2. Manual Error Tracking

Track errors manually with full context:

```typescript
import { trackError, ErrorSeverity, ErrorCategory } from '@/lib/posthog-lazy';

try {
  await riskyOperation();
} catch (error) {
  await trackError(error as Error, {
    severity: ErrorSeverity.HIGH,
    category: ErrorCategory.API,
    metadata: {
      operation: 'fetchRepositoryData',
      userId: currentUser.id,
      timestamp: Date.now(),
    },
  });
  throw error;
}
```

### 3. API Error Tracking

Track HTTP errors from API calls:

```typescript
import { trackApiError } from '@/lib/posthog-lazy';

const response = await fetch('/api/data');
if (!response.ok) {
  await trackApiError(
    response.status,
    '/api/data',
    await response.text(),
    {
      method: 'GET',
      userId: currentUser.id,
    }
  );
}
```

**Or use the tracked fetch wrapper:**

```typescript
import { trackedFetch } from '@/lib/error-tracker';

// Automatically tracks errors
const response = await trackedFetch('/api/data', {
  method: 'POST',
  body: JSON.stringify(data),
});
```

### 4. Supabase Query Error Tracking

Track Supabase errors:

```typescript
import { trackSupabaseError } from '@/lib/posthog-lazy';

const { data, error } = await supabase
  .from('repositories')
  .select('*')
  .eq('id', repoId)
  .maybeSingle();

if (error) {
  await trackSupabaseError('fetchRepository', error, {
    repoId,
    userId: currentUser.id,
  });
}
```

**Or use the wrapper:**

```typescript
import { trackSupabaseQuery } from '@/lib/error-tracker';

const { data, error } = await trackSupabaseQuery(
  'fetchRepository',
  () => supabase
    .from('repositories')
    .select('*')
    .eq('id', repoId)
    .maybeSingle()
);
```

### 5. Global Error Tracking

Set up global error handlers (should be called once in your app initialization):

```typescript
import { setupGlobalErrorTracking } from '@/lib/error-tracker';

// In your main App component or entry point
useEffect(() => {
  setupGlobalErrorTracking();
}, []);
```

This automatically captures:
- Unhandled promise rejections
- Global JavaScript errors
- Uncaught exceptions

### 6. Function Wrapping

Wrap functions to automatically track errors:

```typescript
import { withErrorTracking } from '@/lib/error-tracker';

const fetchUserData = withErrorTracking(
  async (userId: string) => {
    const response = await fetch(`/api/users/${userId}`);
    return response.json();
  },
  {
    operation: 'fetchUserData',
    category: ErrorCategory.API,
    severity: ErrorSeverity.HIGH,
  }
);
```

### 7. Retry Logic with Tracking

Retry operations with automatic error tracking:

```typescript
import { retryWithTracking } from '@/lib/error-tracker';

const data = await retryWithTracking(
  () => fetchCriticalData(),
  {
    maxRetries: 3,
    delay: 1000,
    operation: 'fetchCriticalData',
    category: ErrorCategory.NETWORK,
  }
);
```

### 8. Custom Tracked Errors

Create errors that automatically track themselves:

```typescript
import { TrackedError } from '@/lib/error-tracker';

throw new TrackedError('Payment processing failed', {
  severity: ErrorSeverity.CRITICAL,
  category: ErrorCategory.API,
  metadata: {
    orderId: order.id,
    amount: order.total,
  },
});
```

## Security & Privacy

### Sensitive Data Sanitization

The error tracking system automatically sanitizes sensitive data:

- GitHub tokens (`ghp_*`, `gho_*`)
- PostHog API keys (`phc_*`)
- Generic API keys
- Email addresses
- URLs with auth tokens in query params

Example:

```typescript
// Before sanitization
"Failed to fetch with token ghp_abc123xyz and key api_key=secret123"

// After sanitization
"Failed to fetch with token [GITHUB_TOKEN] and key api_key=[REDACTED]"
```

### Privacy Best Practices

1. **Don't log user passwords or sensitive credentials**
2. **Sanitize user input before including in error context**
3. **Use generic error messages for public-facing errors**
4. **Include only necessary metadata**

## Error Dashboard

View errors in PostHog:

1. Navigate to [PostHog Dashboard](https://us.posthog.com/project/173101)
2. Go to **Error Tracking** section
3. Filter by:
   - **Severity**: `low`, `medium`, `high`, `critical`
   - **Category**: `api`, `database`, `network`, `ui`, `auth`, etc.
   - **Time range**: Last hour, day, week, month
   - **User ID**: Errors for specific users

### Error Grouping

Errors are automatically grouped by:
- Error name/type
- Error message (sanitized)
- Stack trace similarity
- Category and severity

## Development & Testing

### Enable in Development

PostHog error tracking is disabled by default in development. To enable:

```typescript
import { enablePostHogInDev } from '@/lib/posthog-lazy';

// In browser console or app initialization
enablePostHogInDev();
```

### Test Error Tracking

```typescript
// Test manual error tracking
import { trackError, ErrorSeverity, ErrorCategory } from '@/lib/posthog-lazy';

await trackError(new Error('Test error'), {
  severity: ErrorSeverity.LOW,
  category: ErrorCategory.UNKNOWN,
  metadata: { test: true },
});

// Test API error tracking
import { trackApiError } from '@/lib/posthog-lazy';

await trackApiError(500, '/api/test', 'Internal Server Error', {
  test: true,
});
```

### View Errors in Development

When in development mode, error details are visible in:
- Browser console
- Error boundary fallback UI
- PostHog events (if enabled)

## Rate Limiting

Error tracking includes rate limiting to prevent spam:

- **Per minute**: 60 error events max
- **Per hour**: 1000 error events max

Rate limits are tracked per event type:
- `error` - General errors
- `api_error` - API errors
- `supabase_error` - Database errors

## Monitoring & Alerts

### Key Metrics to Monitor

1. **Error Rate**: Errors per minute/hour
2. **Critical Errors**: Errors with `severity: CRITICAL`
3. **5xx Errors**: Server errors requiring immediate attention
4. **Error by Category**: Track which systems are failing
5. **User Impact**: How many users are affected

### Setting Up Alerts

Configure alerts in PostHog for critical errors:

1. Go to **Alerts** in PostHog dashboard
2. Create alert for:
   - `api_error` with `status_code >= 500`
   - `error` with `severity = CRITICAL`
   - Error rate > threshold

## Best Practices

### DO ✅

- **Always track 500 errors** from API calls
- **Use appropriate severity levels** for context
- **Include relevant metadata** (user ID, operation, etc.)
- **Wrap critical operations** with error boundaries
- **Test error tracking** in staging before production
- **Monitor error dashboards** regularly

### DON'T ❌

- **Don't track expected errors** (validation, 404s)
- **Don't include sensitive data** in error messages
- **Don't track errors in tight loops** (respect rate limits)
- **Don't ignore caught errors** - decide if they should be tracked
- **Don't over-track** - only track actionable errors

## Examples

### Complete API Call with Error Tracking

```typescript
import { trackedFetch } from '@/lib/error-tracker';
import { trackSupabaseQuery } from '@/lib/error-tracker';

async function fetchAndSaveData(userId: string) {
  // API call with automatic error tracking
  const response = await trackedFetch(`/api/users/${userId}`);
  const userData = await response.json();

  // Supabase query with automatic error tracking
  const { data, error } = await trackSupabaseQuery(
    'saveUserData',
    () => supabase
      .from('users')
      .upsert(userData)
      .select()
      .maybeSingle()
  );

  if (error) {
    throw new Error(`Failed to save user data: ${error.message}`);
  }

  return data;
}
```

### Complete Component with Error Boundary

```tsx
import { ErrorBoundary, ErrorFallback } from '@/components/ErrorBoundary';
import { trackError, ErrorSeverity, ErrorCategory } from '@/lib/posthog-lazy';

function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const data = await fetchAndSaveData(userId);
        setUser(data);
      } catch (error) {
        await trackError(error as Error, {
          severity: ErrorSeverity.HIGH,
          category: ErrorCategory.API,
          metadata: { userId, component: 'UserProfile' },
        });
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, [userId]);

  if (loading) return <div>Loading...</div>;
  if (!user) return <ErrorFallback />;

  return <div>{/* Render user */}</div>;
}

// Wrap with error boundary
export default function UserProfilePage() {
  return (
    <ErrorBoundary>
      <UserProfile userId="123" />
    </ErrorBoundary>
  );
}
```

## Troubleshooting

### Errors Not Appearing in PostHog

1. **Check PostHog is enabled**:
   ```typescript
   import { isPostHogEnabled } from '@/lib/posthog-lazy';
   console.log('PostHog enabled:', isPostHogEnabled());
   ```

2. **Verify API key**: Ensure `VITE_POSTHOG_KEY` is set in `.env`

3. **Check rate limits**: View rate limiter stats:
   ```typescript
   import { getRateLimiterStats } from '@/lib/posthog-lazy';
   console.log('Rate limits:', getRateLimiterStats());
   ```

4. **Review console**: Look for PostHog initialization messages

### Too Many Errors Tracked

1. **Increase specificity**: Only track actionable errors
2. **Add error deduplication**: Group similar errors
3. **Review rate limits**: Adjust if needed for your use case
4. **Filter out noise**: Exclude bot traffic, dev environments

## Related Documentation

- [PostHog Integration](./posthog-integration.md)
- [PostHog Analytics Strategy](../analytics/posthog-strategy.md)
- [Error Handling Best Practices](../testing/testing-best-practices.md)
- [Security Guidelines](../security/README.md)

## Support

- **PostHog Docs**: https://posthog.com/docs/error-tracking
- **GitHub Issues**: Report issues related to error tracking
- **Team Contact**: Reach out for dashboard access or alert setup

---

*Last updated: February 2025*

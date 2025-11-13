# Sentry Error Logging Guide

This guide explains how to use the centralized error logging utility that integrates Sentry with console logging.

## Overview

The error logging utility (`src/lib/error-logging.ts`) provides three functions that automatically:
- Log errors to the console with secure formatting
- Capture errors in Sentry with context (tags, extra data)
- Follow security best practices from CLAUDE.md

## Functions

### `logError(message, error, context?)`

Standard error logging for recoverable errors.

```typescript
import { logError } from '@/lib/error-logging';

try {
  await fetchData();
} catch (error) {
  logError('Failed to fetch user data', error, {
    tags: { feature: 'workspace', operation: 'fetch' },
    extra: { userId, workspaceId }
  });
}
```

### `logWarning(message, error, context?)`

For non-critical errors that don't require immediate action.

```typescript
import { logWarning } from '@/lib/error-logging';

try {
  await updateCache();
} catch (error) {
  logWarning('Cache update failed, will retry', error, {
    tags: { feature: 'cache', operation: 'update' },
    extra: { cacheKey, retryCount }
  });
}
```

### `logFatal(message, error, context?)`

For critical errors that prevent core functionality.

```typescript
import { logFatal } from '@/lib/error-logging';

try {
  await initializeDatabase();
} catch (error) {
  logFatal('Database initialization failed', error, {
    tags: { feature: 'database', operation: 'init' },
    extra: { connectionString: 'REDACTED' }
  });
}
```

## Context Structure

The `context` parameter is optional but highly recommended:

```typescript
interface ErrorContext {
  level?: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}
```

### Tags

Use tags for categorization and filtering in Sentry:

```typescript
tags: {
  feature: 'slack' | 'workspace' | 'github' | 'auth',
  operation: 'create' | 'update' | 'delete' | 'fetch',
  // Optional: add more specific tags
  component: 'SlackIntegrationCard',
  user_type: 'premium' | 'free'
}
```

### Extra

Use extra for debugging context:

```typescript
extra: {
  // IDs (safe to log)
  workspaceId: '123',
  userId: '456',
  integrationId: '789',

  // Counts and metrics
  itemCount: 42,
  retryCount: 3,

  // Status and state
  isEnabled: true,
  currentStep: 'validation',

  // DO NOT include sensitive data:
  // ❌ password, token, secret, apiKey
  // ❌ PII: email, phone, address
}
```

## Best Practices

### 1. Always Include Context

```typescript
// ❌ Bad: No context
logError('Failed to save', error);

// ✅ Good: With context
logError('Failed to save workspace', error, {
  tags: { feature: 'workspace', operation: 'save' },
  extra: { workspaceId, userId }
});
```

### 2. Use Descriptive Messages

```typescript
// ❌ Bad: Generic message
logError('Error occurred', error);

// ✅ Good: Specific message
logError('Failed to fetch Slack channels from backend', error);
```

### 3. Choose Appropriate Severity

```typescript
// Fatal: App cannot continue
logFatal('Database connection failed', error);

// Error: Feature broken but app works
logError('Failed to send notification', error);

// Warning: Non-critical issue
logWarning('Cache miss, fetching from API', error);
```

### 4. Never Log Sensitive Data

```typescript
// ❌ Bad: Contains tokens
logError('Auth failed', error, {
  extra: { token: userToken, apiKey: config.key }
});

// ✅ Good: Redacted or omitted
logError('Auth failed', error, {
  tags: { feature: 'auth', operation: 'login' },
  extra: { userId, tokenPresent: !!userToken }
});
```

### 5. Follow Console Logging Security

The utility automatically uses secure console formatting:

```typescript
// Internally calls:
console.error('%s', message, error);

// NOT this (security vulnerability):
console.error(`${message}`, error);
```

## Migration Guide

### Replacing console.error

Before:
```typescript
if (error) {
  console.error('Failed to fetch data: %s', error.message);
  throw new Error('Failed to fetch data');
}
```

After:
```typescript
if (error) {
  logError('Failed to fetch data', error, {
    tags: { feature: 'data', operation: 'fetch' },
    extra: { endpoint, params }
  });
  throw new Error('Failed to fetch data');
}
```

### Service Layer Pattern

```typescript
import { logError } from '@/lib/error-logging';

export async function getWorkspace(id: string): Promise<Workspace> {
  try {
    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      logError('Failed to fetch workspace', error, {
        tags: { feature: 'workspace', operation: 'fetch' },
        extra: { workspaceId: id }
      });
      throw new Error('Failed to fetch workspace');
    }

    return data;
  } catch (error) {
    logError('Workspace fetch error', error, {
      tags: { feature: 'workspace', operation: 'fetch' },
      extra: { workspaceId: id }
    });
    throw error;
  }
}
```

### React Component Pattern

```typescript
import { logError } from '@/lib/error-logging';

function MyComponent() {
  const handleSubmit = async () => {
    try {
      await saveData();
    } catch (error) {
      logError('Failed to save form data', error, {
        tags: { feature: 'form', operation: 'submit', component: 'MyComponent' },
        extra: { formId, fieldCount }
      });

      toast({
        title: 'Error',
        description: 'Failed to save changes',
        variant: 'destructive'
      });
    }
  };
}
```

### React Hook Pattern

```typescript
import { logError } from '@/lib/error-logging';

export function useData(id: string) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await getData(id);
        setData(result);
      } catch (err) {
        logError('Failed to fetch data in hook', err, {
          tags: { feature: 'data', operation: 'fetch', hook: 'useData' },
          extra: { id }
        });
        setError(err);
      }
    };

    fetchData();
  }, [id]);

  return { data, error };
}
```

## Sentry Dashboard

Errors are automatically captured in Sentry with:

- **Tags**: For filtering (feature, operation, component)
- **Extra**: For debugging context (IDs, counts, states)
- **Breadcrumbs**: Automatic tracking of user actions
- **Stack Traces**: Full error stack for debugging

### Querying in Sentry

Filter by tags:
```
feature:workspace operation:create
feature:slack operation:fetch_channels
component:SlackIntegrationCard
```

## Performance

The error logging utility is non-blocking:
- Sentry loads lazily after page load
- Errors are queued if Sentry isn't loaded yet
- Console logging happens immediately
- No impact on user experience

## Related Files

- `src/lib/error-logging.ts` - Error logging utility
- `src/lib/sentry-lazy.ts` - Lazy Sentry initialization
- `src/services/slack-integration.service.ts` - Example usage
- `src/services/workspace.service.ts` - Example usage

## Next Steps

See these issues for ongoing migration:
- Remaining workspace.service.ts error logs
- React component error logging
- React hook error logging

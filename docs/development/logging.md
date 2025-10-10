# Production-Safe Logging

## Overview

The project uses a custom logger utility (`@/lib/logger`) to prevent console noise in production while maintaining full logging capabilities during development.

## Why Logger Instead of console.log?

**Problems with console.log in production:**
- Creates excessive noise making real errors hard to spot
- Impacts browser performance (console operations are expensive)
- Exposes unnecessary debug information to users
- Makes production debugging harder (signal-to-noise ratio)

**Benefits of logger utility:**
- ✅ Clean production console (only errors)
- ✅ Full debug logs in development
- ✅ Consistent logging patterns
- ✅ Better performance in production
- ✅ Use Inngest logs for production debugging

## Logger API

```typescript
import { logger } from '@/lib/logger';

// Only logs in development
logger.log('User authenticated:', userId);
logger.info('Starting data sync...');
logger.debug('Debug info:', data);
logger.warn('Deprecated API used');

// Always logs (even in production)
logger.error('Failed to fetch data:', error);
```

### Methods

| Method | Development | Production | Use Case |
|--------|------------|------------|----------|
| `logger.log()` | ✅ Logs | ❌ Silent | General debug information |
| `logger.info()` | ✅ Logs | ❌ Silent | Informational messages |
| `logger.debug()` | ✅ Logs | ❌ Silent | Detailed debug info |
| `logger.warn()` | ✅ Logs | ❌ Silent | Warnings and deprecations |
| `logger.error()` | ✅ Logs | ✅ Logs | **Errors (always visible)** |

## Usage Examples

### Good Examples ✅

```typescript
import { logger } from '@/lib/logger';

// Feature initialization
export function initializeFeature(config: Config) {
  logger.log('Initializing feature with config:', config);
  
  try {
    // ... feature logic
    logger.info('Feature initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize feature:', error);
    throw error;
  }
}

// Data fetching
async function fetchUserData(userId: string) {
  logger.debug('Fetching user data for:', userId);
  
  try {
    const data = await api.getUser(userId);
    logger.log('User data fetched:', data.username);
    return data;
  } catch (error) {
    logger.error('Failed to fetch user data:', error);
    throw error;
  }
}

// Using printf-style formatting (prevents log injection)
logger.log('Processing request for %s/%s', owner, repo);
logger.log('User %s logged in', username);
```

### Bad Examples ❌

```typescript
// ❌ Don't use console.log directly in production code
console.log('User authenticated:', userId);

// ❌ Don't use template literals (security vulnerability)
logger.log(`Processing ${owner}/${repo}`);

// ❌ Don't silence errors
try {
  await riskyOperation();
} catch (error) {
  logger.log('Operation failed:', error); // Should be logger.error()
}
```

## When to Use console.log Directly

You can still use `console.log` directly in:

1. **Test files** (`.test.ts`, `.test.tsx`)
   ```typescript
   // tests/example.test.ts
   test('example test', () => {
     console.log('Test debug info'); // OK in tests
   });
   ```

2. **Story files** (`.stories.tsx`)
   ```typescript
   // components/Example.stories.tsx
   export const Interactive = {
     args: {
       onClick: () => console.log('Button clicked') // OK in stories
     }
   };
   ```

3. **Scripts** (`scripts/` directory)
   ```bash
   # scripts/example.js
   console.log('Running migration...'); // OK in scripts
   ```

4. **Documentation examples**

## Migration Guide

### Automatic Migration

Use the provided migration script to bulk-replace console.logs:

```bash
bash scripts/replace-console-logs.sh
```

This script will:
- Find all TypeScript/TSX files with console.log
- Add logger import if missing
- Replace console.log with logger.log
- Skip test files, story files, and docs
- Keep console.error unchanged

### Manual Migration

1. **Add import:**
   ```typescript
   import { logger } from '@/lib/logger';
   ```

2. **Replace calls:**
   ```typescript
   // Before
   console.log('Message:', data);
   
   // After
   logger.log('Message:', data);
   ```

3. **Update errors:**
   ```typescript
   // Before
   console.log('Error:', error);
   
   // After
   logger.error('Error:', error);
   ```

## Security: Printf-Style Formatting

Always use printf-style formatting (`%s`, `%d`, etc.) instead of template literals to prevent log injection attacks.

### Why This Matters

If user input contains ANSI escape sequences or special characters, template literals can:
- Forge log entries that appear legitimate
- Hide malicious activity in logs
- Potentially execute commands in log processing systems

### Examples

```typescript
// ❌ VULNERABLE - Template literals
logger.log(`User ${username} logged in`);
logger.log(`Processing ${owner}/${repo}`);

// ✅ SECURE - Printf-style
logger.log('User %s logged in', username);
logger.log('Processing %s/%s', owner, repo);
```

## Production Debugging

Since production logs are minimal, use these alternatives for debugging:

1. **Inngest Logs** - View function execution logs at inngest.com
2. **Sentry** - Error tracking and monitoring
3. **PostHog** - User behavior and analytics
4. **Supabase Logs** - Database queries and edge functions

## Implementation Details

The logger utility is implemented in `src/lib/logger.ts`:

```typescript
import { env } from './env';

const isDevelopment = env.DEV || env.MODE === 'development';

export const logger = {
  log: (...args: unknown[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  
  error: (...args: unknown[]) => {
    // Always log errors
    console.error(...args);
  },
  
  // ... other methods
};
```

Environment detection uses `env.DEV` or `env.MODE` which works in both Vite (browser) and Node.js (server) environments.

## Related Documentation

- [.continue/rules/console-log-security.md](../../.continue/rules/console-log-security.md) - Continue AI rules for logging
- [docs/security/](../security/) - Security best practices
- [docs/debugging/](../debugging/) - Production debugging strategies

## FAQ

**Q: Will this break existing code?**  
A: No. Existing console.log calls still work, but new code should use logger.

**Q: What about console.warn and console.info?**  
A: Use logger.warn() and logger.info() which follow the same pattern.

**Q: Can I override this in production for debugging?**  
A: No. If you need production debugging, use Inngest logs or Sentry.

**Q: What about third-party libraries that use console.log?**  
A: They're unaffected. This only applies to our application code.

**Q: How do I test logging behavior?**  
A: Mock the logger in tests or use console spies for verification.

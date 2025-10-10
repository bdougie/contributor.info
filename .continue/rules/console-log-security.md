---
globs: "**/*.{ts,tsx,js,jsx}"
description: Use logger utility and prevent security vulnerabilities
---

# Production-Safe Logging

## Use Logger Utility in Production Code

Always use the `logger` utility instead of `console.log` in production code. Console logs create noise in production and make debugging harder.

```typescript
import { logger } from '@/lib/logger';

// ✅ Good - Only logs in development
logger.log('Processing data for %s', userId);

// ✅ Good - Always logs (errors should be visible)
logger.error('Failed to fetch data:', error);

// ❌ Bad - Logs in production too
console.log('Processing data for', userId);
```

**Logger API:**
- `logger.log()` - Only logs in development
- `logger.warn()` - Only logs in development
- `logger.error()` - Always logs (even in production)
- `logger.info()` - Only logs in development
- `logger.debug()` - Only logs in development

**When to use `console.log` directly:**
- Test files (`.test.ts`, `.test.tsx`)
- Story files (`.stories.tsx`)
- Documentation examples
- Scripts in `scripts/` directory

## Security: Never Use Template Literals

Never use template literals with logging as they can create security vulnerabilities through log injection attacks. Always use printf-style formatting with `%s` placeholders.

## Security Issue

Template literals in console.log can allow attackers to inject malicious content into logs, potentially leading to log forging or command injection in log processing systems.

## Examples

❌ **VULNERABLE - Never do this:**
```javascript
logger.log(`User ${username} logged in`);
logger.log(`Processing request for ${owner}/${repo}`);
```

✅ **SECURE - Always use this pattern:**
```javascript
logger.log('User %s logged in', username);
logger.log('Processing request for %s/%s', owner, repo);
```

## Why This Matters

If `username` contains special characters or ANSI escape sequences, it could:
- Forge log entries that appear legitimate
- Hide malicious activity in logs
- Potentially execute commands if logs are processed by vulnerable systems

Always use the printf-style formatting to ensure user input is properly escaped and sanitized.
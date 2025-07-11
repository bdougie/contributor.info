# Environment Variable Security Guide

## Overview

This document outlines the secure environment variable practices implemented to prevent server secrets from being exposed to the browser.

## Security Architecture

### The Problem

Previously, the application had critical security vulnerabilities:

1. **Server secrets exposed to browser**: Variables like `VITE_INNGEST_EVENT_KEY` were prefixed with `VITE_`, making them accessible in browser bundles
2. **Mixed access patterns**: Server code trying to use `import.meta.env` in CommonJS contexts
3. **No access controls**: No prevention of server key access from client contexts

### The Solution

We implemented a secure environment variable system with strict separation:

#### 1. Client-Side Variables (Public)
- **Prefix**: `VITE_*`
- **Access**: Browser-accessible via `import.meta.env`
- **Security**: Only public information
- **Examples**: 
  - `VITE_SUPABASE_URL` - Public Supabase URL
  - `VITE_SUPABASE_ANON_KEY` - Public anonymous key
  - `VITE_GITHUB_TOKEN` - Read-only public token

#### 2. Server-Side Variables (Private)
- **Prefix**: No `VITE_` prefix
- **Access**: Server-only via `process.env`
- **Security**: Protected with runtime guards
- **Examples**:
  - `SUPABASE_SERVICE_ROLE_KEY` - Admin database access
  - `INNGEST_EVENT_KEY` - Server authentication
  - `INNGEST_SIGNING_KEY` - Server signing key

## Implementation

### Secure Access Helper (`src/lib/env.ts`)

```typescript
// Safe for browser - only public keys
export const clientEnv = {
  SUPABASE_URL: import.meta.env?.VITE_SUPABASE_URL || '',
  GITHUB_TOKEN: import.meta.env?.VITE_GITHUB_TOKEN || '',
  // ... other public keys
};

// Server-only with runtime protection
export const serverEnv = {
  get INNGEST_EVENT_KEY() {
    if (typeof window !== 'undefined') {
      console.error('🚨 SECURITY: Attempted to access server key from browser!');
      return '';
    }
    return process.env.INNGEST_EVENT_KEY || '';
  }
  // ... other protected keys
};
```

### Usage Patterns

#### Client Code (Browser)
```typescript
import { clientEnv } from '@/lib/env';

// ✅ Safe - only accesses public keys
const supabaseUrl = clientEnv.SUPABASE_URL;
const publicToken = clientEnv.GITHUB_TOKEN;
```

#### Server Code (Netlify Functions/Inngest)
```typescript
import { serverEnv } from '@/lib/env';

// ✅ Safe - server context only
const eventKey = serverEnv.INNGEST_EVENT_KEY;
const serviceKey = serverEnv.SUPABASE_SERVICE_ROLE_KEY;
```

## Security Guards

The system includes multiple security layers:

### 1. Runtime Context Detection
```typescript
const isServer = typeof window === 'undefined';
const isBrowser = typeof window !== 'undefined';
```

### 2. Access Guards
Server keys include runtime checks that prevent browser access:
```typescript
get INNGEST_EVENT_KEY() {
  if (isBrowser) {
    console.error('🚨 SECURITY: Attempted to access server key from browser!');
    return '';
  }
  return process.env.INNGEST_EVENT_KEY || '';
}
```

### 3. Environment Validation
Automatic validation ensures required keys are present:
```typescript
export function validateEnvironment(context: 'client' | 'server') {
  // Check required variables for each context
  // Log missing variables
  // Return validation status
}
```

## Migration Changes

### Fixed Files
1. **`src/lib/env.ts`** - New secure environment access system
2. **`src/lib/inngest/client.ts`** - Removed unsafe import.meta.env usage
3. **`src/lib/supabase.ts`** - Updated to use secure access
4. **`src/lib/github.ts`** - Fixed environment variable access
5. **`src/lib/inngest/graphql-client.ts`** - Server-only token access
6. **`src/lib/inngest/github-client.ts`** - Proper server token handling

### Environment Configuration
Updated `.env.example` with clear security guidance:
- Separated client vs server variables
- Added security warnings
- Documented proper usage patterns

## Security Checklist

When adding new environment variables:

- [ ] Is this a public value? → Use `VITE_*` prefix
- [ ] Is this a secret/private value? → No `VITE_*` prefix  
- [ ] Added to appropriate section in `.env.example`
- [ ] Uses secure access pattern from `env.ts`
- [ ] Tested in both client and server contexts

## Common Mistakes to Avoid

❌ **Never do this:**
```bash
# Exposes server secret to browser!
VITE_INNGEST_EVENT_KEY=secret-key
VITE_SUPABASE_SERVICE_ROLE_KEY=admin-key
```

❌ **Don't access server keys in browser:**
```typescript
// This will trigger security warning
const key = serverEnv.INNGEST_EVENT_KEY; // In browser context
```

❌ **Don't use import.meta.env in server functions:**
```typescript
// CommonJS error - use process.env instead
const key = import.meta.env.INNGEST_EVENT_KEY;
```

✅ **Correct patterns:**
```bash
# Public values with VITE_ prefix
VITE_SUPABASE_URL=https://project.supabase.co
VITE_GITHUB_TOKEN=public-readonly-token

# Private values without VITE_ prefix  
INNGEST_EVENT_KEY=secret-event-key
SUPABASE_SERVICE_ROLE_KEY=admin-key
```

## Incident Response

If server secrets are accidentally exposed:

1. **Immediate**: Rotate all affected keys
2. **Assess**: Check if keys were accessed maliciously
3. **Update**: Fix environment configuration
4. **Deploy**: Push corrected configuration
5. **Monitor**: Watch for unauthorized access

## Verification

To verify the security implementation:

1. **Build check**: `npm run build` should complete without CommonJS warnings
2. **Browser inspection**: Check Network tab - no server secrets in bundles
3. **Runtime test**: Server key access in browser should log security warnings
4. **Environment validation**: Missing required keys should be detected

## Resources

- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [Netlify Functions Environment](https://docs.netlify.com/functions/environment-variables/)
- [Security Best Practices](https://owasp.org/www-project-top-ten/)

---

**Remember**: The `VITE_` prefix makes variables public and accessible to anyone who visits your website. Only use it for truly public information!
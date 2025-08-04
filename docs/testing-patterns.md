# Testing Patterns and Best Practices

This document outlines the testing patterns and best practices used in the contributor.info codebase, with a focus on mocking external dependencies and ensuring tests run consistently across all environments.

## Table of Contents
- [Mocking Supabase in Tests](#mocking-supabase-in-tests)
- [Environment Variables in Tests](#environment-variables-in-tests)
- [CI/CD Compatibility](#cicd-compatibility)
- [Common Testing Patterns](#common-testing-patterns)

## Mocking Supabase in Tests

### The Problem
Supabase requires environment variables (`SUPABASE_URL` and `SUPABASE_ANON_KEY`) to initialize. We don't want to:
1. Require real Supabase credentials in test environments
2. Risk accidentally affecting production data during tests
3. Have tests fail in CI due to missing environment variables

### The Solution
Mock Supabase dependencies directly in test files using Vitest's `vi.mock()` with full relative paths.

### Correct Pattern ✅

```typescript
import { describe, it, expect, vi } from 'vitest';

// Mock dependencies BEFORE imports - use full relative paths
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
      signInWithOAuth: vi.fn(() => Promise.resolve({ data: {}, error: null })),
      signOut: vi.fn(() => Promise.resolve({ error: null }))
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({ data: [], error: null })),
      insert: vi.fn(() => ({ data: [], error: null })),
      update: vi.fn(() => ({ data: [], error: null })),
      delete: vi.fn(() => ({ data: [], error: null }))
    }))
  },
  createSupabaseClient: vi.fn(),
  debugAuthSession: vi.fn(() => Promise.resolve({ session: null, error: null }))
}));

// Import modules AFTER mocks are set up
import { yourFunction } from '../your-module';
import { supabase } from '../supabase';
```

### Incorrect Patterns ❌

1. **Don't use shorthand paths**
   ```typescript
   // ❌ This may not work consistently in CI
   vi.mock('../supabase');
   ```

2. **Don't rely on `__mocks__` directories**
   ```typescript
   // ❌ Module resolution can differ between environments
   // Don't create src/lib/__mocks__/supabase.ts
   ```

3. **Don't use environment variables in tests**
   ```typescript
   // ❌ Never do this
   process.env.SUPABASE_URL = 'test-url';
   ```

## Environment Variables in Tests

### Mocking the env Module
If your code uses the `env` module, mock it similarly:

```typescript
vi.mock('../../lib/env', () => ({
  env: {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_ANON_KEY: 'test-anon-key',
    GITHUB_TOKEN: 'test-github-token',
    // ... other env vars with test values
    DEV: true,
    PROD: false,
    MODE: 'test',
  },
  validateEnvironment: () => true
}));
```

## CI/CD Compatibility

### Why Full Relative Paths?
CI environments (like GitHub Actions) may resolve module paths differently than local development. Using full relative paths ensures consistent behavior:

- `../../lib/supabase` ✅ - Explicit and unambiguous
- `../supabase` ❌ - May work locally but fail in CI
- `@/lib/supabase` ❌ - Alias resolution can vary

### Example from Existing Tests
Follow the pattern established in tests like `git-history.test.ts`:

```typescript
// src/app/services/__tests__/git-history.test.ts
vi.mock('../../../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));
```

## Common Testing Patterns

### 1. Mocking Supabase Queries
```typescript
beforeEach(() => {
  vi.clearAllMocks();
  
  // Mock a successful query
  vi.mocked(supabase.from).mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ 
      data: { id: 'test-id', name: 'test' }, 
      error: null 
    })
  });
});
```

### 2. Mocking Different Table Operations
```typescript
vi.mocked(supabase.from).mockImplementation((table: string) => {
  if (table === 'repositories') {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ 
        data: mockRepository, 
        error: null 
      })
    };
  }
  if (table === 'pull_requests') {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ 
        data: mockPullRequests, 
        error: null 
      })
    };
  }
  // Default mock for other tables
  return {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ data: [], error: null })
  };
});
```

### 3. Testing Error Scenarios
```typescript
it('should handle database errors', async () => {
  vi.mocked(supabase.from).mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ 
      data: null, 
      error: { message: 'Database connection failed' }
    })
  });
  
  // Test your error handling
});
```

### 4. Mocking RPC Calls
```typescript
vi.mocked(supabase.rpc).mockResolvedValue({ 
  data: mockRpcResult,
  error: null 
});
```

## Best Practices

1. **Always mock before imports** - Place `vi.mock()` calls before any imports that use the mocked modules
2. **Use `vi.clearAllMocks()` in beforeEach** - Ensure test isolation
3. **Mock at the appropriate level** - Mock Supabase client methods, not the entire `@supabase/supabase-js` package
4. **Keep mocks simple** - Only mock the methods your test actually uses
5. **Test both success and error cases** - Ensure your code handles Supabase errors gracefully

## Troubleshooting

### Test fails with "Missing environment variable"
- Ensure mocks are defined BEFORE imports
- Use full relative paths in `vi.mock()`
- Check that the mock includes all required exports

### Tests pass locally but fail in CI
- Use full relative paths instead of shortcuts
- Don't rely on `__mocks__` directories
- Ensure no real environment variables are required

### Mock not being applied
- Verify the mock path matches the actual import path
- Check that the mock is defined before the import
- Use `vi.mocked()` to get proper TypeScript types

## References

- [Vitest Mocking Guide](https://vitest.dev/guide/mocking.html)
- [Example: git-history.test.ts](../src/app/services/__tests__/git-history.test.ts)
- [Example: supabase-pr-data-smart.test.ts](../src/lib/__tests__/supabase-pr-data-smart.test.ts)
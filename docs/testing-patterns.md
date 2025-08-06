# Testing Patterns and Best Practices

This document outlines the testing patterns and best practices used in the contributor.info codebase, with a focus on mocking external dependencies and ensuring tests run consistently across all environments.

## Table of Contents
- [Mocking Supabase in Tests](#mocking-supabase-in-tests)
- [Environment Variables in Tests](#environment-variables-in-tests)
- [CI/CD Compatibility](#cicd-compatibility)
- [Common Testing Patterns](#common-testing-patterns)
- [Memory-Efficient Testing](#memory-efficient-testing)
- [Debugging Test Issues](#debugging-test-issues)

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

## Memory-Efficient Testing

### The Problem
Tests can consume excessive memory leading to "JavaScript heap out of memory" errors in CI environments. This is especially common with:
- React component tests that don't clean up properly
- Tests that render components in loops
- Mock functions that accumulate call history
- DOM modifications that persist between tests

### Best Practices

#### 1. Always Clean Up Components
```typescript
import { render, cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup(); // Clean up all rendered components
  vi.clearAllMocks(); // Clear mock call history
});

it('test case', () => {
  const { unmount } = render(<Component />);
  // ... assertions ...
  unmount(); // Always unmount, especially in loops
});
```

#### 2. Optimize Mock Functions
```typescript
// ❌ Bad: Creating new mock instances in loops
beforeEach(() => {
  mockFn = vi.fn((arg) => {
    const heavy = new Array(1000).fill(arg);
    return heavy;
  });
});

// ✅ Good: Singleton mocks with lightweight implementations
const mockFn = vi.fn();
beforeEach(() => {
  mockFn.mockClear();
  mockFn.mockReturnValue('simple-value');
});
```

#### 3. Handle Loop Rendering
```typescript
// ❌ Bad: No cleanup in loops
items.forEach(item => {
  render(<Component item={item} />);
  // ... assertions ...
});

// ✅ Good: Clean up each iteration
items.forEach((item, index) => {
  const { unmount } = render(<Component item={item} />);
  // ... assertions ...
  unmount();
  cleanup();
  
  // Periodic deep cleanup
  if (index % 10 === 0) {
    vi.clearAllMocks();
  }
});
```

#### 4. Avoid Rerender Memory Buildup
```typescript
// ❌ Bad: Multiple rerenders accumulate memory
const { rerender } = render(<Component size="sm" />);
rerender(<Component size="md" />);
rerender(<Component size="lg" />);

// ✅ Good: Separate renders with cleanup
['sm', 'md', 'lg'].forEach(size => {
  const { unmount } = render(<Component size={size} />);
  // ... assertions ...
  unmount();
  cleanup();
});
```

#### 5. Clean Up DOM Modifications
```typescript
afterEach(() => {
  // Remove any elements added to document
  document.querySelectorAll('[data-testid]').forEach(el => el.remove());
  document.querySelectorAll('script[type="application/ld+json"]').forEach(el => el.remove());
});
```

### Vitest Configuration for Memory Management
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    // Limit concurrent tests to reduce memory pressure
    maxConcurrency: 4,
    // Ensure proper test isolation
    isolate: true,
    // ... other config
  }
});
```

### Memory Profiling
```bash
# Run tests with memory limit (similar to CI)
node --max-old-space-size=512 node_modules/.bin/vitest run

# Run with garbage collection exposed
node --expose-gc node_modules/.bin/vitest run
```

For detailed memory leak debugging, see [Memory Leak Fix Documentation](./debugging/memory-leak-fix-last-updated-tests.md).

## Debugging Test Issues

### Common Issues and Solutions

1. **"JavaScript heap out of memory"**
   - See [Memory-Efficient Testing](#memory-efficient-testing) section
   - Check for missing cleanup in loops
   - Look for heavy mock implementations

2. **"Cannot find module" in CI**
   - Use full relative paths in vi.mock()
   - Avoid path aliases in test files
   - Check case sensitivity (CI is case-sensitive)

3. **Flaky Tests**
   - Add explicit cleanup between tests
   - Clear timers with vi.clearAllTimers()
   - Check for test order dependencies

4. **Slow Tests**
   - Limit test concurrency in CI
   - Mock heavy operations (API calls, file I/O)
   - Use lightweight mock implementations

## References

- [Vitest Mocking Guide](https://vitest.dev/guide/mocking.html)
- [React Testing Library Cleanup](https://testing-library.com/docs/react-testing-library/api/#cleanup)
- [Memory Leak Fix for LastUpdated Tests](./debugging/memory-leak-fix-last-updated-tests.md)
- [Example: git-history.test.ts](../src/app/services/__tests__/git-history.test.ts)
- [Example: supabase-pr-data-smart.test.ts](../src/lib/__tests__/supabase-pr-data-smart.test.ts)
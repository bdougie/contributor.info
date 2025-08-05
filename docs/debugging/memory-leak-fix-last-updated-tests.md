# Memory Leak Fix for LastUpdated Component Tests

## Problem
The LastUpdated component tests were causing memory issues in GitHub Actions due to:
1. No React Testing Library cleanup between tests
2. Script tags accumulating in the DOM
3. Components not being unmounted after tests
4. Duplicate console mocking overhead
5. Multiple renders without cleanup

## Root Causes

### 1. Missing Cleanup
React Testing Library's `cleanup()` wasn't being called, causing:
- DOM nodes to accumulate
- Memory usage to grow linearly with each test
- Eventually exhausting available memory in CI

### 2. Script Tag Pollution
The component creates `<script type="application/ld+json">` tags for SEO that were never removed from the document.

### 3. Loop Rendering Without Cleanup
The XSS test rendered 4 components in a loop without unmounting any of them.

### 4. Double Console Mocking
Both global setup and test file were mocking console methods, creating unnecessary overhead.

## Solution

### 1. Added Explicit Cleanup
```typescript
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup(); // Clean up all rendered components
  // Clean up script tags
  document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
    script.remove();
  });
});
```

### 2. Unmount Components in Loops
```typescript
xssAttempts.forEach(attempt => {
  const { unmount } = render(<LastUpdated timestamp={attempt} />);
  // ... assertions ...
  unmount(); // Clean up each iteration
});
```

### 3. Use Global Console Mock
Removed duplicate console mocking and used the global mock from setup.ts.

### 4. Clean Up Rerenders
```typescript
const { rerender, unmount } = render(<LastUpdated />);
// ... rerenders ...
unmount(); // Clean up at end
```

## Memory Usage Comparison

### Before Fix
- Memory usage grew by ~50MB per test file
- GitHub Actions runner exhausted 7GB memory
- Tests failed with "JavaScript heap out of memory"

### After Fix
- Memory usage stays constant
- Tests complete successfully
- No memory accumulation between tests

## Prevention Guidelines

1. **Always import cleanup**: `import { cleanup } from '@testing-library/react'`
2. **Call cleanup in afterEach**: Ensures DOM is cleaned between tests
3. **Unmount components in loops**: When rendering multiple times, unmount each
4. **Clean up DOM modifications**: Remove any elements added to document
5. **Avoid duplicate mocking**: Use global setup for common mocks

## Testing the Fix

Run memory profiling:
```bash
# Check memory usage during tests
node --expose-gc --max-old-space-size=4096 node_modules/.bin/vitest run src/components/ui/__tests__/last-updated.test.tsx --reporter=verbose
```

## Related Issues
- PR #290: Data loading optimizations phase 2
- GitHub Actions run failure due to memory exhaustion
# Bulletproof Testing Guidelines

## Core Principles

**NEVER AGAIN SHALL WE HANG** - These guidelines prevent test hangs at all costs.

### ✅ ALLOWED Test Patterns

1. **Pure Function Tests Only**
   ```typescript
   it('should calculate correctly', () => {
     expect(add(2, 3)).toBe(5);
   });
   ```

2. **Simple Component Props Testing**
   ```typescript
   it('should render with props', () => {
     render(<Button>Click me</Button>);
     expect(screen.getByText('Click me')).toBeDefined();
   });
   ```

3. **Synchronous State Changes**
   ```typescript
   it('should toggle state', () => {
     const { getByRole } = render(<Toggle />);
     fireEvent.click(getByRole('button'));
     // Immediate assertion, no waiting
   });
   ```

### ❌ FORBIDDEN Test Patterns

1. **NO Async/Await Testing**
   ```typescript
   // ❌ FORBIDDEN - Will hang
   it('should load data', async () => {
     await someAsyncFunction();
   });
   ```

2. **NO setTimeout/setInterval**
   ```typescript
   // ❌ FORBIDDEN - Timers cause hangs
   it('should wait', (done) => {
     setTimeout(done, 1000);
   });
   ```

3. **NO Promise Testing**
   ```typescript
   // ❌ FORBIDDEN - Promises can hang
   it('should resolve', () => {
     return expect(promise).resolves.toBe(true);
   });
   ```

4. **NO Integration Testing**
   ```typescript
   // ❌ FORBIDDEN - Integration belongs in E2E
   it('should sync with database', async () => {
     await supabase.from('table').insert();
   });
   ```

5. **NO Complex Mocking**
   ```typescript
   // ❌ FORBIDDEN - Complex mocks cause issues
   vi.mock('complex-library', () => ({
     // 50+ lines of mock implementation
   }));
   ```

6. **NO waitFor/waitForElementToBeRemoved**
   ```typescript
   // ❌ FORBIDDEN - Can hang indefinitely
   await waitFor(() => {
     expect(element).toBeInTheDocument();
   });
   ```

## Test File Requirements

### 1. Maximum Test Duration: 5 seconds
- Any test taking longer is deleted
- Use `vi.useFakeTimers()` for time-dependent logic (sparingly)

### 2. Maximum File Size: 100 lines
- Split large test files
- Focus on critical functionality only

### 3. No External Dependencies
- Mock all network requests
- Mock all file system operations
- Mock all timers

### 4. Required Test Structure
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ComponentName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should do one specific thing', () => {
    // Simple, synchronous test
    expect(result).toBe(expected);
  });
});
```

## What to Test vs What NOT to Test

### ✅ TEST THESE
- Pure utility functions
- Component prop handling
- Basic state changes
- Input validation
- Simple calculations
- CSS class applications

### ❌ DON'T TEST THESE
- API integrations (use E2E)
- Database operations (use E2E)  
- Complex async flows (use E2E)
- Third-party library behavior
- Browser APIs
- Network requests
- File operations
- Real-time features

## Emergency Test Debugging

If a test hangs in CI:

1. **Immediate Action**: Delete the entire test file
2. **Root Cause**: Look for forbidden patterns above
3. **Replacement**: Write simpler unit tests or move to E2E

## ESLint Rules for Test Files

The following ESLint rules automatically prevent async/await patterns in test files:

```javascript
// In eslint.config.js
{
  files: ['**/*.test.{ts,tsx}', '**/__tests__/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: 'FunctionDeclaration[async=true]',
        message: 'Async functions are forbidden in unit tests. Use synchronous patterns only.',
      },
      {
        selector: 'ArrowFunctionExpression[async=true]',
        message: 'Async arrow functions are forbidden in unit tests. Use synchronous patterns only.',
      },
      {
        selector: 'AwaitExpression',
        message: 'await expressions are forbidden in unit tests. Use synchronous mocks instead.',
      },
      {
        selector: 'CallExpression[callee.name="waitFor"]',
        message: 'waitFor() is forbidden in unit tests as it can hang indefinitely.',
      },
    ],
  },
}
```

## CI Configuration

Update package.json scripts:
```json
{
  "test": "vitest run --config vitest.config.simple.ts",
  "test:quick": "vitest run --config vitest.config.simple.ts --bail 1"
}
```

Run ESLint before tests to catch async patterns:
```json
{
  "test:lint": "eslint src/**/*.test.{ts,tsx} --max-warnings=0"
}
```

## Success Metrics

- ✅ All tests complete in under 2 minutes
- ✅ Zero hanging tests in CI
- ✅ Tests are deterministic and reliable
- ✅ New developers can run tests without issues

## When in Doubt

**DELETE THE TEST** - Stability is more important than coverage.
# Test Organization Code Review Rule

## Purpose
Maintain proper test organization to improve discoverability and maintainability of tests.

## Test Location Rules

### Correct Test Locations

1. **Unit Tests** - Next to the code being tested:
   - `src/lib/__tests__/` → Library function tests
   - `src/lib/api/__tests__/` → API logic tests
   - `src/lib/utils/__tests__/` → Utility function tests
   - `src/services/__tests__/` → Service layer tests
   - `src/hooks/__tests__/` → React hook tests

2. **Component Tests**:
   - `src/components/__tests__/` → Shared component tests
   - `src/components/features/[feature]/__tests__/` → Feature component tests

3. **Integration Tests**:
   - `src/pages/__tests__/` → Page-level integration tests ONLY
   - Should NOT contain API logic tests

### What to Flag in Code Review

#### Always Flag
- API logic tests in `src/pages/__tests__/`
- Database query tests outside of service layer tests
- Business logic tests in component test files
- Test files not following naming conventions

#### Test File Naming
```typescript
// ✅ CORRECT
src/lib/api/__tests__/workspace-api.test.ts
src/components/__tests__/Button.test.tsx
src/services/__tests__/workspace.service.test.ts

// ❌ WRONG
src/pages/__tests__/workspace-page-api-fixes.test.tsx  // API test in pages
src/components/Button.spec.tsx  // Using .spec instead of .test
```

## Required Test Structure

```typescript
// Every test file MUST include:

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TIME_PERIODS, timeHelpers } from '@/lib/constants/time-constants';
import { API_LIMITS } from '@/lib/constants/api-constants';

describe('Feature/Component Name', () => {
  beforeEach(() => {
    // Setup
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup
    vi.resetAllMocks();
  });

  describe('Specific Functionality', () => {
    it('should behave as expected', () => {
      // Test implementation
      // Use constants, not magic numbers
      const daysAgo = timeHelpers.daysAgo(TIME_PERIODS.ONE_WEEK);
    });
  });
});
```

## Detection Patterns

```bash
# Find API tests in wrong location
find src/pages/__tests__ -name "*.test.*" -exec grep -l "supabase\|api\|fetch\|query" {} \;

# Find tests with magic numbers
rg '\b(30|60|24|1000|100)\b' --type ts --type tsx --glob '**/*.test.*'

# Find misnamed test files
find src -name "*.spec.*" -o -name "*test*.tsx" | grep -v ".test."
```

## Review Checklist

### Test Organization
- [ ] API logic tests are in `src/lib/api/__tests__/`
- [ ] Service tests are in `src/services/__tests__/`
- [ ] Component tests are with their components
- [ ] Page tests only test page-level integration

### Test Quality
- [ ] No magic numbers - use constants
- [ ] Proper setup/teardown with beforeEach/afterEach
- [ ] Mocks are cleaned up properly
- [ ] No test interdependencies
- [ ] Tests are isolated and can run independently

### Test Naming
- [ ] Files use `.test.ts` or `.test.tsx` extension
- [ ] Test descriptions are clear and specific
- [ ] Using `describe` blocks for grouping
- [ ] Test names describe expected behavior

## Example Migration

```typescript
// ❌ BEFORE: src/pages/__tests__/workspace-page-api-fixes.test.tsx
describe('Workspace Page API Fixes', () => {
  it('should handle date format correctly', () => {
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    // API logic testing...
  });
});

// ✅ AFTER: src/lib/api/__tests__/workspace-api.test.ts
import { TIME_PERIODS, timeHelpers } from '@/lib/constants/time-constants';

describe('Workspace API', () => {
  describe('Date handling', () => {
    it('should format dates correctly for API queries', () => {
      const startDate = timeHelpers.daysAgo(TIME_PERIODS.DEFAULT_METRICS_DAYS);
      // API logic testing...
    });
  });
});
```

## Benefits
1. **Discoverability**: Tests are easy to find next to the code
2. **Maintainability**: Clear separation of concerns
3. **Performance**: Can run unit tests separately from integration tests
4. **Clarity**: Test purpose is clear from location
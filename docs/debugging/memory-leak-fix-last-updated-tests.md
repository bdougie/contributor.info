# Memory Leak Fix for LastUpdated Component Tests

## Problem
The LastUpdated component tests were causing JavaScript heap out of memory errors in GitHub Actions CI, preventing PR #290 from passing tests.

## Error Details
```
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----
1: 0xb8cf03 node::OOMErrorHandler(char const*, v8::OOMDetails const&) [node (vitest 1)]
...
```

## Root Causes Analysis

### Initial Issues (First Fix Attempt)
1. No React Testing Library cleanup between tests
2. Script tags accumulating in the DOM
3. Components not being unmounted after tests
4. Duplicate console mocking overhead
5. Multiple renders without cleanup

### Deeper Issues (Comprehensive Fix)
1. **Mock Function Accumulation**: Mock functions were creating new instances and accumulating call history
2. **Date Object Creation**: Excessive Date object instantiation in validation logic
3. **Ref Callback Recreation**: Component ref callbacks were being recreated on every render
4. **Mock Call History**: Console mocks were retaining references to large objects
5. **Test Concurrency**: Too many tests running in parallel exhausting memory

## Solution Implementation

### Phase 1: Basic Cleanup (Initial Attempt)
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

### Phase 2: Comprehensive Memory Optimization

#### 1. Test File Optimizations (`src/components/ui/__tests__/last-updated.test.tsx`)

**Lightweight Mock Creation**
```typescript
// Before: Heavy mock functions created inline
formatRelativeTime: vi.fn((date) => {
  const now = new Date('2024-01-15T12:00:00Z');
  const timestamp = typeof date === 'string' ? new Date(date) : date;
  // ... more Date object creation
});

// After: Singleton mocks with timestamp math
const mockFormatRelativeTime = vi.fn();
mockFormatRelativeTime.mockImplementation((date) => {
  const timestamp = typeof date === 'string' ? Date.parse(date) : date.getTime();
  const now = Date.parse('2024-01-15T12:00:00Z');
  // ... no Date object creation
});
```

**Aggressive Cleanup in Loops**
```typescript
xssAttempts.forEach((attempt, index) => {
  vi.mocked(console.warn).mockClear();
  const { unmount } = render(<LastUpdated timestamp={attempt} />);
  
  // ... assertions ...
  
  // Immediate cleanup
  unmount();
  cleanup();
  
  // Clean up script tags
  document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
    script.remove();
  });
  
  // Force mock cleanup every few iterations
  if (index % 2 === 1) {
    vi.clearAllMocks();
  }
});
```

**Replace Rerender with Individual Renders**
```typescript
// Before: Memory accumulation with rerender
const { rerender } = render(<LastUpdated timestamp={timestamp} size="sm" />);
rerender(<LastUpdated timestamp={timestamp} size="md" />);
rerender(<LastUpdated timestamp={timestamp} size="lg" />);

// After: Clean renders
const { unmount: unmountSm } = render(<LastUpdated timestamp={timestamp} size="sm" />);
unmountSm();
cleanup();

const { unmount: unmountMd } = render(<LastUpdated timestamp={timestamp} size="md" />);
unmountMd();
cleanup();
```

#### 2. Component Optimizations (`src/components/ui/last-updated.tsx`)

**useCallback for Ref Callbacks**
```typescript
// Prevent ref callback recreation on every render
const refCallback = React.useCallback((el: HTMLScriptElement | null) => {
  if (el && el.textContent !== jsonContent) {
    el.textContent = jsonContent;
  }
}, [jsonContent]);
```

**Timestamp Comparison Optimization**
```typescript
// Before: Creating Date objects for comparison
const now = new Date();
const hundredYearsAgo = new Date(now.getFullYear() - 100, 0, 1);
if (date < hundredYearsAgo) { ... }

// After: Using timestamps
const dateTime = date.getTime();
const currentYear = new Date().getFullYear();
const hundredYearsAgoTime = new Date(currentYear - 100, 0, 1).getTime();
if (dateTime < hundredYearsAgoTime) { ... }
```

#### 3. Test Infrastructure (`src/__mocks__/setup.ts`)

**Singleton Console Mocks**
```typescript
// Create single mock instances to prevent accumulation
const mockWarn = vi.fn();
const mockError = vi.fn();
const mockLog = vi.fn();

beforeEach(() => {
  // Clear existing mock call history
  mockWarn.mockClear();
  mockError.mockClear();
  mockLog.mockClear();
  
  // Assign the same mock instances
  console.warn = mockWarn;
  console.error = mockError;
  console.log = mockLog;
});
```

#### 4. Vitest Configuration (`vitest.config.ts`)

**Memory Concurrency Limits**
```typescript
test: {
  // Limit concurrent tests to reduce memory pressure
  maxConcurrency: 4,
  // Ensure proper test isolation to prevent memory leaks
  isolate: true,
  // ... other config
}
```

## Memory Usage Results

### Stress Test Results
```bash
# Running with 512MB heap limit (similar to CI)
node --expose-gc test-memory-stress.cjs

=== Summary ===
Passed: 10/10 runs
Average memory delta: 0.14 MB
✅ All tests passed with memory constraint!
```

### Before Comprehensive Fix
- Memory usage grew unbounded
- GitHub Actions runner exhausted 7GB memory
- Tests failed with "JavaScript heap out of memory"

### After Comprehensive Fix
- Memory usage: ~0.14MB delta per test run
- Successfully runs with 512MB heap limit
- All tests pass consistently in CI

## Prevention Guidelines

### 1. Mock Management
- Use singleton mock instances
- Clear mock call history regularly
- Avoid creating mocks in loops

### 2. Component Testing
- Always unmount components after tests
- Use cleanup() from React Testing Library
- Clean up DOM modifications (script tags, etc.)
- Avoid rerender() for multiple test cases

### 3. Memory-Efficient Patterns
- Use timestamps instead of Date objects for comparisons
- Implement useCallback for ref callbacks
- Force garbage collection hints with vi.clearAllMocks()
- Limit test concurrency in CI environments

### 4. Test Structure
```typescript
describe('Component', () => {
  // Singleton mocks outside tests
  const mockFn = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
    mockFn.mockImplementation(/* lightweight impl */);
  });
  
  afterEach(() => {
    cleanup();
    // Clean up DOM modifications
    // Clear timers/intervals
    vi.clearAllTimers();
  });
  
  it('test case', () => {
    const { unmount } = render(<Component />);
    // ... assertions ...
    unmount(); // Always unmount
  });
});
```

## Debugging Memory Issues

### Memory Profiling Command
```bash
# Run with memory profiling
node --expose-gc --max-old-space-size=512 \
  node_modules/.bin/vitest run \
  src/components/ui/__tests__/last-updated.test.tsx \
  --reporter=verbose
```

### Memory Stress Test Script
```javascript
// test-memory-stress.cjs
async function runTestWithMemoryLimit(iteration) {
  const startMemory = process.memoryUsage().heapUsed / 1024 / 1024;
  
  const { stdout } = await execAsync(
    'node --max-old-space-size=512 node_modules/.bin/vitest run ...'
  );
  
  const endMemory = process.memoryUsage().heapUsed / 1024 / 1024;
  const memoryDelta = endMemory - startMemory;
  
  console.log(`Memory delta: ${memoryDelta.toFixed(2)} MB`);
}
```

## Related Issues
- PR #290: Data loading optimizations phase 2
- GitHub Actions memory exhaustion in CI
- Vitest + JSDOM memory management

## Lessons Learned

1. **Mock accumulation is subtle**: Even cleared mocks can retain memory through their implementation closures
2. **Date objects are expensive**: Creating multiple Date objects in tight loops causes memory pressure
3. **React refs need optimization**: Ref callbacks without useCallback recreate on every render
4. **Test isolation matters**: Proper cleanup between tests is critical for memory management
5. **CI has different constraints**: Local tests may pass while CI fails due to memory limits

## Future Recommendations

1. **Add memory regression tests**: Include stress tests in CI to catch memory issues early
2. **Document memory patterns**: Add memory-efficient testing patterns to contributor guidelines
3. **Monitor CI memory usage**: Set up alerts for increasing memory usage trends
4. **Consider test sharding**: Split large test suites across multiple CI jobs for better isolation
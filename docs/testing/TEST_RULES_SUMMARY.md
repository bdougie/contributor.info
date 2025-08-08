# Test Rules Summary - Bulletproof Testing

## 🚨 CRITICAL RULE: DELETE THE TEST
If a test hangs, takes >5 seconds, or causes CI issues → **DELETE IT IMMEDIATELY**

## ✅ Allowed Patterns (ONLY THESE)
- **Pure functions**: `expect(add(2,3)).toBe(5)`
- **Simple props**: `render(<Button>Text</Button>)`
- **Synchronous only**: No async/await/promises
- **Fast execution**: <5 seconds per test
- **Small files**: <100 lines per file

## ❌ Forbidden Patterns (DELETE ON SIGHT)
- `async/await` in tests
- `setTimeout`, `setInterval`
- `waitFor`, `waitForElementToBeRemoved`
- Promise testing
- Integration tests (move to E2E)
- Complex mocks (>10 lines)
- Network calls
- Database operations

## 📏 Hard Limits
- **Test duration**: 5 seconds max per test
- **Suite duration**: 2 minutes max total
- **File size**: 100 lines max
- **Mock complexity**: 10 lines max

## 🏃 Running Tests
```bash
npm test              # Run all tests (<2 min)
npm test -- --bail 1  # Stop on first failure
```

## 🔧 CI Configuration
- 3-minute timeout enforced
- Fails fast on any hang
- No parallel execution needed (tests are already fast)

## 📝 Test Structure Template
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should do one thing', () => {
    // Simple, synchronous test only
    expect(result).toBe(expected);
  });
});
```

## 🚫 Emergency Protocol
Test hanging in CI? → **DELETE THE ENTIRE TEST FILE**
No debugging, no fixing, just DELETE.

---
*Reference: /docs/testing/BULLETPROOF_TESTING_GUIDELINES.md for full details*
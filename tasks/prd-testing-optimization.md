# PRD: Testing Optimization with Vitest UI

## Executive Summary

Optimize testing infrastructure by adding Vitest UI for better unit test visibility while maintaining Playwright for E2E tests, following bulletproof testing guidelines.

## Current State

### Testing Stack
- **Unit Tests**: Vitest (configured with strict isolation)
- **E2E Tests**: Playwright (4 critical flow tests)
- **CI**: Runs Storybook tests, no dedicated unit test CI

### Problems
1. No CI pipeline for unit tests
2. Limited visibility into unit test failures
3. Storybook test runner has known issues (disabled in CI)

## Proposed Solution

### Phase 1: Add Vitest UI for Development (HIGH PRIORITY)
- [ ] Install @vitest/ui package
- [ ] Add npm script for UI mode
- [ ] Update developer documentation

### Phase 2: Create Unit Test CI Pipeline (HIGH PRIORITY)
- [ ] Add `.github/workflows/unit-tests.yml`
- [ ] Configure for fast execution (<2 minutes)
- [ ] Run on all PRs and main branch

### Phase 3: Optimize E2E Tests (MEDIUM PRIORITY)
- [ ] Keep Playwright for critical flows only
- [ ] Reduce test count if needed
- [ ] Ensure <3 minute execution time

### Phase 4: Remove Storybook Test Runner (LOW PRIORITY)
- [ ] Migrate essential tests to Vitest
- [ ] Clean up storybook-tests.yml
- [ ] Update documentation

## Technical Implementation

### 1. Vitest UI Setup
```bash
npm install --save-dev @vitest/ui
```

Add to package.json:
```json
{
  "scripts": {
    "test:ui": "vitest --ui",
    "test:unit": "vitest run --config vitest.config.ts",
    "test:unit:watch": "vitest watch --config vitest.config.ts"
  }
}
```

### 2. Unit Test CI Configuration
Create `.github/workflows/unit-tests.yml`:
- Matrix: Node 20
- Timeout: 5 minutes max
- Bail on first failure
- No async/integration tests

### 3. Testing Guidelines Compliance
- Maximum test duration: 5 seconds per test
- No async/await patterns
- No external dependencies
- Pure function tests only

## Success Metrics

- ✅ Unit tests complete in <2 minutes
- ✅ Zero hanging tests in CI
- ✅ Clear separation between unit and E2E tests
- ✅ Developer visibility into test failures via UI

## Migration Path

1. **Week 1**: Add Vitest UI and unit test CI
2. **Week 2**: Monitor and optimize test performance
3. **Week 3**: Clean up Storybook test runner
4. **Ongoing**: Maintain <2 minute test execution

## Notes

- Vitest UI is NOT replacing Playwright
- E2E tests remain critical for user flows
- Unit tests follow bulletproof guidelines strictly
- Delete flaky tests rather than fix them
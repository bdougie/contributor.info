# Test Mocks

This directory contains mock implementations for testing.

## Current Test Setup

### Active Setup File
- [**no-mocks-setup.ts**](./no-mocks-setup.ts) - Current minimal test setup without mocks (used by vitest.config.ts)
  - Only includes DOM cleanup utilities
  - No global mocks or shared state
  - Ensures complete test isolation

### Mock Implementations
- **@nivo/** - Chart library mocks
  - [core.tsx](./@nivo/core.tsx) - Core chart components
  - [scatterplot.tsx](./@nivo/scatterplot.tsx) - Scatterplot chart mock
- **@react-spring/** - Animation library mocks
  - [web.ts](./@react-spring/web.ts) - Spring animation mocks
- [**d3-interpolate.ts**](./d3-interpolate.ts) - D3 interpolation functions mock
- [**lucide-react.tsx**](./lucide-react.tsx) - Icon library mocks
- [**ui-components.tsx**](./ui-components.tsx) - UI component mocks
- [**github-api.ts**](./github-api.ts) - GitHub API mock utilities

### Legacy/Backup Setup Files
These files are kept for reference but not currently used:
- `setup.ts` - Original setup with full mocks (causes hanging)
- `setup.backup.ts` - Backup of original setup
- `simple-setup.ts` - Simplified setup attempt
- `minimal-setup.ts` - Minimal setup attempt
- `isolated-setup.ts` - Isolation attempt

## Documentation
- [**MOCK_ISOLATION_SOLUTION.md**](./MOCK_ISOLATION_SOLUTION.md) - Details on the mock isolation approach

## Important Notes

### Current Strategy
We're using `no-mocks-setup.ts` which provides:
1. No global mocks (prevents shared state issues)
2. Only DOM cleanup utilities
3. Complete test isolation

### Excluded Tests
18 test files that depend on mocks are currently excluded in `vitest.config.ts`. These will be migrated to use local Supabase in Issue #299.

### Future Direction
The plan is to move away from mocks entirely:
1. Use local Supabase for integration tests
2. Extract business logic into pure functions for unit tests
3. Remove mock dependencies completely

## Usage

The current setup is automatically loaded by Vitest:
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    setupFiles: ['./src/__mocks__/no-mocks-setup.ts'],
    // ... other config
  }
})
```

## Adding New Mocks

**Note:** We're moving away from mocks. Before adding new mocks:
1. Consider if the test can use a real local database instead
2. Try to extract logic into pure functions that don't need mocking
3. If mocking is absolutely necessary, ensure proper cleanup

## References
- [Test Isolation Solution](/docs/test-isolation-solution.md) - Complete documentation
- [Issue #299](https://github.com/bdougie/contributor.info/issues/299) - Integration test migration plan
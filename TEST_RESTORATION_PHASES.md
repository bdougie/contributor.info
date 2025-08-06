# Test Suite Restoration Plan

## Overview
This document outlines the phased approach to re-enable the 20+ tests currently excluded due to mock isolation issues.

## Phase 1: High Priority Component Tests (Days 1-2)
**Goal**: Re-enable core component tests with simple dependencies

### Tests to Re-enable:
- `**/ContributorCard.test.tsx` - Core contributor display component
- `**/ContributorOfTheMonth.test.tsx` - Winner display component  
- `**/ContributorEmptyState.test.tsx` - Empty state handling
- `**/optimized-avatar.test.tsx` - Avatar component with fallbacks
- `**/skeleton-components.test.tsx` - Loading state components

### Success Criteria:
- All tests pass individually and in batch
- No mock bleeding between tests
- Proper cleanup verified

### Process:
1. Remove from vitest config exclude list
2. Run `npm test` to verify they pass
3. If failures occur, add specific cleanup in individual test files
4. Document any remaining issues

## Phase 2: UI State & Navigation Tests (Days 3-4)
**Goal**: Re-enable tests with routing and state management dependencies

### Tests to Re-enable:
- `**/repo-not-found.test.tsx` - 404 page with routing
- `**/auth-redirect.test.tsx` - Authentication flows
- `**/home.test.tsx` - Main page with multiple dependencies
- `**/data-state-indicator.test.tsx` - Loading/error states
- `**/last-updated.test.tsx` - Time-based display components

### Success Criteria:
- React Router mocks work consistently
- No state bleeding between navigation tests
- Authentication state properly isolated

### Process:
1. Remove from exclude list in small batches
2. Test router mock isolation
3. Verify authentication state cleanup
4. Address any timing-related issues

## Phase 3: Data Visualization Tests (Days 5-6)
**Goal**: Re-enable complex chart and visualization tests

### Tests to Re-enable:
- `**/distribution-charts.test.tsx` - Chart rendering tests
- `**/distribution.test.tsx` - Data distribution components
- `**/language-legend.test.tsx` - Chart legend components
- `**/activity-item-styling.test.tsx` - Activity visualization

### Success Criteria:
- Chart library mocks work properly
- Canvas/SVG rendering doesn't interfere between tests
- Data processing mocks are isolated

### Process:
1. Verify chart library mocks (@nivo, recharts)
2. Check canvas/DOM cleanup
3. Test data transformation isolation
4. Ensure visual component state cleanup

## Phase 4: Feature Integration Tests (Days 7-8)
**Goal**: Re-enable complex feature tests with multiple dependencies

### Tests to Re-enable:
- `**/bulk-add-repos.test.tsx` - Multi-repo management
- `**/contributor-confidence-card.test.tsx` - Confidence scoring
- `**/github-auth-hook.test.tsx` - GitHub authentication
- `**/use-repository-discovery.test.ts` - Repository discovery hook
- `**/yolo-behavior.test.ts` - Edge case behaviors
- `**/login-functionality.test.tsx` - Login flow integration

### Success Criteria:
- Supabase mocks work across complex flows
- GitHub API mocks properly isolated
- Authentication state doesn't leak
- Hook dependencies properly mocked

### Process:
1. Start with simpler hook tests
2. Move to authentication tests
3. Test complex integration scenarios
4. Verify no cross-test contamination

## Phase 5: Validation & Cleanup (Days 9-10)
**Goal**: Ensure all tests are stable and remove workarounds

### Tasks:
1. **Full Test Suite Run**: Verify all re-enabled tests pass together
2. **Cleanup Individual Tests**: Remove redundant mocks from test files
3. **Performance Check**: Ensure test runtime is acceptable
4. **Documentation**: Update test documentation and patterns

### Success Criteria:
- All tests pass in CI/CD environment
- No flaky test failures
- Test runtime under 2 minutes (as per current goal)
- Clean test files without duplicate mocks

## Rollback Plan
If any phase encounters issues:

1. **Immediate**: Re-add failing tests to exclude list
2. **Investigation**: Run tests individually to isolate issues
3. **Fix**: Address specific mock isolation problems
4. **Retry**: Attempt re-enablement with fixes

## Monitoring
Track progress with these metrics:

- **Tests Passing**: Number of tests re-enabled successfully
- **Test Runtime**: Ensure performance goals are maintained
- **Flaky Test Rate**: Monitor for intermittent failures
- **Coverage**: Ensure code coverage doesn't decrease

## Final Goal
- Remove all test exclusions from `vitest.config.ts`
- Achieve stable, fast test suite
- Enable `isolate: true` if performance allows
- Restore previously deleted tests if they can be fixed

---

*This phased approach ensures systematic restoration while maintaining test stability and performance.*
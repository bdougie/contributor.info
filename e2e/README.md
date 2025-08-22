# End-to-End Tests

This directory contains Playwright E2E tests for the contributor.info application, focusing on critical user flows and performance regression prevention.

## 🎯 Test Strategy

Our E2E testing strategy focuses on:
1. **Critical User Flows** - Core functionality that must never break
2. **Performance Regression Prevention** - Ensuring optimizations don't degrade UX
3. **Accessibility Compliance** - WCAG 2.1 AA standards
4. **Mobile Responsiveness** - Cross-device compatibility

## 🚀 Quick Start

### Install Dependencies
```bash
npm ci
npm run install-browsers
```

### Run All Tests
```bash
npm run test:e2e          # All tests headless
npm run test:e2e:ui       # Interactive test runner
npm run test:e2e:headed   # See browser actions
```

### Run Specific Test Suites
```bash
# Critical user flows only
npx playwright test critical-flows.spec.ts

# Performance regression tests only  
npx playwright test performance-regression.spec.ts

# Mobile responsiveness
npx playwright test --project=mobile-responsive
```

## 📋 Test Files

### `critical-flows.spec.ts`
Tests essential user journeys that drive core business value:

- **Homepage Performance** - Under 3s load time requirement
- **Repository Discovery** - Search and navigation workflows  
- **Contributor Profiles** - Lazy-loaded component interactions
- **Data Filtering** - Search/filter functionality without full reloads
- **Background Sync** - Non-blocking data refresh operations
- **Responsive Design** - Mobile and tablet layout verification

### `performance-regression.spec.ts`
Prevents performance degradation after optimizations:

- **Lazy Component Loading** - Ensures components load under 2s
- **Service Worker Caching** - Verifies 20%+ faster cached loads
- **Background Fetching** - Maintains UI responsiveness during data sync
- **Bundle Size Impact** - Enforces under 1MB initial JS bundle
- **Memory Management** - Prevents memory leaks during navigation
- **Large Dataset Rendering** - Virtual list performance with many contributors

## ⚙️ Configuration

### Test Projects
- **chromium-performance** - Performance regression tests on Desktop Chrome
- **chromium-critical-flows** - Core functionality tests on Desktop Chrome
- **mobile-responsive** - Mobile UX tests on iPhone 13 simulation

### Environment Variables
- `PLAYWRIGHT_BASE_URL` - Override default test server URL (useful for testing against preview/production)
- `CI` - Enables CI-specific configurations (retries, single worker)

### Performance Budgets
- **Page Load Time**: < 3 seconds
- **Lazy Component Load**: < 2 seconds  
- **Input Responsiveness**: < 100ms
- **Bundle Size**: < 1MB initial JavaScript
- **Memory Usage**: < 50MB heap size

## 🔍 Debugging & Development

### Local Development
```bash
# Run with browser visible
npm run test:e2e:headed

# Interactive test runner with time-travel debugging
npm run test:e2e:ui

# Debug specific test
npx playwright test critical-flows.spec.ts --debug

# Pause execution for inspection
# Add `await page.pause()` in test code
```

### CI/CD Integration

Tests run automatically on:
- **Pull Requests** - Prevents regressions before merge
- **Main Branch** - Continuous monitoring of performance

Performance failures trigger:
- **PR Comments** with regression details
- **Artifact Upload** with detailed reports
- **Build Failure** to prevent deployment

### Troubleshooting Common Issues

**Port Conflicts**: Tests use dynamic port allocation in CI
**Flaky Tests**: 2 retries in CI, enhanced with wait strategies
**Memory Issues**: Single worker in CI prevents resource conflicts
**Network Timeouts**: Extended timeouts for background operations

## 📊 Performance Monitoring

### Metrics Tracked
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP) 
- Cumulative Layout Shift (CLS)
- Time to Interactive (TTI)
- JavaScript heap size
- Bundle size impact

### Regression Detection
- **Baseline Comparison** - Compare against previous builds
- **Threshold Enforcement** - Fail builds that exceed budgets
- **Trend Analysis** - Track performance over time
- **Impact Attribution** - Link regressions to specific changes

## 🧪 Writing New Tests

### Best Practices
1. **Focus on User Value** - Test workflows users actually experience
2. **Performance First** - Include timing assertions for critical paths
3. **Resilient Selectors** - Use `data-testid` or semantic selectors
4. **Graceful Degradation** - Handle missing elements gracefully
5. **Mobile Considerations** - Test responsive behavior

### Example Test Structure
```typescript
test('new user flow', async ({ page }) => {
  // Setup performance monitoring
  const startTime = Date.now();
  
  // Navigate and verify
  await page.goto('/feature');
  await expect(page.locator('[data-testid="main-content"]')).toBeVisible();
  
  // Performance assertion
  const loadTime = Date.now() - startTime;
  expect(loadTime).toBeLessThan(3000);
  
  // User interaction
  await page.locator('[data-testid="action-button"]').click();
  
  // Verify outcome
  await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
});
```

## 🎛️ Advanced Features

### Performance Profiling
```bash
# Generate lighthouse reports during tests
npx playwright test --reporter=html --headed
```

### Cross-Browser Testing
```bash
# Run on multiple browsers (when needed)
npx playwright test --project=chromium --project=firefox --project=webkit
```

### Visual Regression (Future)
Tests are structured to easily add visual regression testing:
- Screenshot comparison on layout changes
- Pixel-perfect component rendering
- Cross-browser visual consistency

## 📈 Success Metrics

### Coverage Goals
- ✅ 100% critical user flows covered
- ✅ Performance budgets enforced on all key paths
- ✅ Mobile responsiveness verified
- 🎯 Zero flaky tests in CI
- 🎯 95%+ test success rate

### Performance Impact
- Catch regressions before production
- Maintain Core Web Vitals compliance
- Ensure consistent user experience
- Support confident deployment cycles

---

**Note**: This E2E testing strategy complements Storybook interaction tests by focusing on full user journeys and performance characteristics in production-like environments.
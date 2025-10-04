# Slow Network Testing Guide

## Overview

This guide documents comprehensive testing of lazy loading and performance optimizations on slow network connections to ensure a good user experience for all users.

**Related Issue:** [#476 - Test lazy loading on slow network connections](https://github.com/bdougie/contributor.info/issues/476)

## Quick Start

### Run Automated Tests

```bash
# Build the app first
npm run build

# Start preview server
npm run preview &

# Run tests with default Slow 3G settings
node scripts/performance/test-slow-network.js

# Test with Fast 3G
node scripts/performance/test-slow-network.js --condition=fast3g

# Test with custom URL
node scripts/performance/test-slow-network.js --url=https://contributor.info

# Run in CI mode (exits with error if tests fail)
node scripts/performance/test-slow-network.js --ci
```

### Add to package.json

```json
{
  "scripts": {
    "test:slow-network": "npm run build && npm run preview & sleep 3 && node scripts/performance/test-slow-network.js && kill %1",
    "test:slow-network:fast3g": "npm run build && npm run preview & sleep 3 && node scripts/performance/test-slow-network.js --condition=fast3g && kill %1"
  }
}
```

## Network Conditions Tested

### Slow 3G
- **Download:** 400kb/s
- **Upload:** 400kb/s  
- **Latency:** 300ms RTT
- **Use Case:** Developing regions, poor rural coverage

### Fast 3G
- **Download:** 1.6 Mbps
- **Upload:** 750kb/s
- **Latency:** 150ms RTT
- **Use Case:** Standard mobile connections

### Slow 4G
- **Download:** 4 Mbps
- **Upload:** 3 Mbps
- **Latency:** 100ms RTT
- **Use Case:** Typical urban mobile connections

## Test Scenarios

### 1. Initial Page Load ✅

**What it tests:**
- Time until loading skeletons appear
- Time until page is fully interactive
- Cumulative Layout Shift (CLS)
- Resource loading patterns

**Success Criteria:**
| Metric | Slow 3G | Fast 3G | Slow 4G |
|--------|---------|---------|---------|
| Skeleton Visible | < 1000ms | < 800ms | < 600ms |
| Charts Loaded | < 5000ms | < 3000ms | < 2000ms |
| CLS | < 0.1 | < 0.1 | < 0.1 |

**Expected Behavior:**
- Loading skeletons appear immediately
- No blank screens during loading
- Smooth transitions from skeleton to content
- Minimal layout shifts

### 2. Chart Lazy Loading ✅

**What it tests:**
- IntersectionObserver triggers correctly
- Charts load only when scrolled into view
- Above-the-fold charts load immediately
- Smooth skeleton → chart transition

**Success Criteria:**
- Charts above fold load within 1 second
- Charts below fold load within 2 seconds of scrolling into view
- No blank spaces where charts should appear
- Loading skeletons visible during chart loading

**Expected Behavior:**
```
1. Page loads with skeletons for above-fold charts
2. Above-fold charts render when data arrives
3. Below-fold charts remain as skeletons
4. User scrolls down
5. IntersectionObserver triggers (50px before viewport)
6. Below-fold charts start loading
7. Charts render smoothly without layout shift
```

### 3. Navigation Prefetching ✅

**What it tests:**
- Prefetching on link hover doesn't block current page
- Navigation is faster with prefetch
- Prefetch respects network conditions

**Success Criteria:**
| Metric | Slow 3G | Fast 3G |
|--------|---------|---------|
| Navigation Time | < 3000ms | < 2000ms |

**Expected Behavior:**
- Hover triggers route prefetch in background
- Current page remains fully interactive
- Navigation feels instant when prefetched
- No console errors from failed prefetch

### 4. Chunk Loading Failure ✅

**What it tests:**
- Error boundaries catch chunk loading failures
- App provides helpful error messages
- Graceful degradation when chunks fail

**Success Criteria:**
- Error boundary displays user-friendly message
- App shell remains functional
- User can retry or navigate away
- No blank screen of death

**Expected Behavior:**
```
1. Chunk fails to load (simulated)
2. Error boundary catches the error
3. User sees friendly error message:
   "Something went wrong loading this content. 
    Please refresh the page or try again later."
4. Navigation and app shell still work
5. User can recover without losing work
```

### 5. Progressive Enhancement ✅

**What it tests:**
- App is usable before all chunks load
- Core content visible quickly
- Navigation remains responsive during loading

**Success Criteria:**
- Core content visible within 1 second
- Navigation interactive during chunk loading
- App doesn't block waiting for heavy components

**Expected Behavior:**
- Page shell loads immediately
- Navigation works while charts load
- User can read content while heavy components load
- Loading states are clear and informative

## Manual Testing with DevTools

### Chrome DevTools Network Throttling

1. **Open DevTools** (F12 or Cmd+Opt+I)
2. **Go to Network tab**
3. **Select throttling profile:**
   - Slow 3G
   - Fast 3G
   - Custom (set your own speeds)
4. **Reload page** and observe:
   - When do skeletons appear?
   - When do charts load?
   - Any layout shifts?
   - Any failed requests?

### Performance Tab Analysis

1. **Open Performance tab**
2. **Start recording**
3. **Reload page with network throttling**
4. **Stop recording after page loads**
5. **Analyze:**
   - Main thread activity
   - Network waterfall
   - Layout shifts
   - Time to Interactive (TTI)

### Lighthouse with Custom Throttling

```bash
# Slow 3G simulation
lighthouse http://localhost:4173 \
  --throttling.cpuSlowdownMultiplier=4 \
  --throttling.requestLatencyMs=300 \
  --throttling.downloadThroughputKbps=400 \
  --throttling.uploadThroughputKbps=400 \
  --view

# Fast 3G simulation  
lighthouse http://localhost:4173 \
  --throttling.cpuSlowdownMultiplier=4 \
  --throttling.requestLatencyMs=150 \
  --throttling.downloadThroughputKbps=1600 \
  --throttling.uploadThroughputKbps=750 \
  --view
```

## Real-World Testing

### Using WebPageTest

1. Go to [WebPageTest.org](https://www.webpagetest.org)
2. Enter your URL (production or staging)
3. Select test location (choose slower regions)
4. Select connection speed: 3G, 4G, etc.
5. Run test and analyze:
   - Filmstrip view (visual progression)
   - Network waterfall
   - Core Web Vitals
   - Opportunities for improvement

### Mobile Device Testing

**iOS - Network Link Conditioner:**
1. Install Xcode and Additional Tools
2. Enable Developer mode on device
3. Settings → Developer → Network Link Conditioner
4. Select "3G" or custom profile
5. Test your app

**Android - Developer Options:**
1. Enable Developer Options
2. Settings → Developer Options → Networking
3. Select "Mobile data always active" and limit speed
4. Test your app

## Monitoring in Production

### PostHog Web Vitals Tracking

Our app automatically tracks Core Web Vitals:

```typescript
// Already implemented in src/lib/posthog.ts
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

// Reports to PostHog dashboard
getCLS(sendToPostHog);
getFID(sendToPostHog);
getFCP(sendToPostHog);
getLCP(sendToPostHog);
getTTFB(sendToPostHog);
```

**Dashboard:** https://app.posthog.com (filter by network speed)

### Key Metrics to Monitor

1. **Largest Contentful Paint (LCP)**
   - Target: < 2.5s
   - Track: 75th percentile by connection type

2. **Cumulative Layout Shift (CLS)**
   - Target: < 0.1
   - Track: Chart loading transitions

3. **First Input Delay (FID)**
   - Target: < 100ms
   - Track: Interactive during loading

4. **Time to Interactive (TTI)**
   - Target: < 5s on Slow 3G
   - Track: When can users actually use the app

## Common Issues and Solutions

### Issue: Charts cause layout shift

**Symptoms:**
- Content jumps when charts load
- CLS score > 0.1

**Solution:**
```tsx
// Always set explicit dimensions
<div style={{ minHeight: '400px' }}>
  {isLoading ? <Skeleton height={400} /> : <Chart data={data} />}
</div>
```

### Issue: Blank screen during loading

**Symptoms:**
- White screen for 2-3 seconds
- No loading indicators

**Solution:**
```tsx
// Show skeleton immediately
{!hasIntersected && <ChartSkeleton />}
{hasIntersected && (
  <Suspense fallback={<ChartSkeleton />}>
    <LazyChart data={data} />
  </Suspense>
)}
```

### Issue: IntersectionObserver not triggering

**Symptoms:**
- Charts never load on scroll
- No requests in Network tab

**Solution:**
```typescript
// Increase rootMargin for earlier loading
const { ref, hasIntersected } = useIntersectionObserver({
  rootMargin: '200px', // Load 200px before visible
  threshold: 0.01,
});
```

### Issue: Chunk loading fails

**Symptoms:**
- Console error: "ChunkLoadError"
- Blank screen or broken features

**Solution:**
```tsx
// Add error boundary
<ErrorBoundary fallback={<ErrorMessage />}>
  <Suspense fallback={<Loading />}>
    <LazyComponent />
  </Suspense>
</ErrorBoundary>

// Implement retry logic
const retryImport = (fn, retriesLeft = 3, interval = 1000) => {
  return new Promise((resolve, reject) => {
    fn()
      .then(resolve)
      .catch((error) => {
        setTimeout(() => {
          if (retriesLeft === 1) {
            reject(error);
            return;
          }
          retryImport(fn, retriesLeft - 1, interval).then(resolve, reject);
        }, interval);
      });
  });
};

const LazyChart = lazy(() =>
  retryImport(() => import('./charts/ContributionsChart'))
);
```

## Best Practices

### 1. Always Use Loading Skeletons

```tsx
// Good ✅
{isLoading ? <Skeleton height={400} /> : <Chart />}

// Bad ❌
{isLoading ? null : <Chart />}
```

### 2. Set IntersectionObserver rootMargin

```typescript
// Start loading before component is visible
const { ref, hasIntersected } = useIntersectionObserver({
  rootMargin: '50px', // Goldilocks zone
});
```

### 3. Prioritize Above-the-Fold Content

```tsx
// Load immediately if above fold
<OptimizedImage 
  src="/hero.jpg" 
  priority={true} // Disables lazy loading
/>

// Lazy load below fold
<OptimizedImage 
  src="/chart.jpg" 
  lazy={true} 
/>
```

### 4. Handle Chunk Loading Failures

```tsx
// Always wrap lazy components in error boundaries
<ErrorBoundary>
  <Suspense fallback={<Loading />}>
    <LazyComponent />
  </Suspense>
</ErrorBoundary>
```

### 5. Test with Real Throttling

```bash
# Don't just test on fast WiFi
npm run test:slow-network
```

## Continuous Monitoring

### GitHub Actions Integration

Add to `.github/workflows/performance.yml`:

```yaml
name: Performance Tests

on:
  pull_request:
    branches: [main]

jobs:
  slow-network-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - run: npm run preview &
      - run: sleep 5
      - run: node scripts/performance/test-slow-network.js --ci
      - name: Upload Reports
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: slow-network-reports
          path: reports/slow-network/
```

### PostHog Dashboard Setup

1. Create custom dashboard: "Slow Network Performance"
2. Add insights:
   - LCP by connection type (p75)
   - CLS distribution
   - FID by device
   - TTI by geography
3. Set alerts:
   - LCP > 4s on any connection
   - CLS > 0.1 for any page
   - Chunk load errors > 1%

## Resources

- [Web.dev - Performance Testing](https://web.dev/how-to-measure-speed/)
- [Chrome DevTools Network Throttling](https://developer.chrome.com/docs/devtools/network/)
- [WebPageTest Documentation](https://docs.webpagetest.org/)
- [Core Web Vitals](https://web.dev/vitals/)
- [Intersection Observer API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)

## Next Steps

After verifying slow network performance:

1. **Implement Retry Logic** for chunk loading failures
2. **Optimize Chunk Sizes** further if needed
3. **Add Connection-Aware Loading** (detect slow connections and adjust)
4. **Monitor Production Metrics** via PostHog
5. **Iterate Based on Real User Data** from slow connections

## Success Criteria Summary

✅ **All tests pass on Slow 3G:**
- Skeleton visible < 1s
- Charts load < 5s
- CLS < 0.1
- Navigation < 3s
- Error boundaries work
- Progressive enhancement works

✅ **Production monitoring shows:**
- LCP < 2.5s for 75th percentile
- CLS < 0.1 for all pages
- < 1% chunk load errors
- Good UX reported by users on slow connections

---

**Related Documentation:**
- [Lazy Loading Implementation Guide](../performance/lazy-loading-implementation.md)
- [Performance Best Practices](../performance/PERFORMANCE_BEST_PRACTICES.md)
- [Testing Best Practices](./testing-best-practices.md)

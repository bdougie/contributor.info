import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// Performance thresholds
const PERFORMANCE_THRESHOLDS = {
  LCP: 2500, // 2.5 seconds
  FCP: 1800, // 1.8 seconds
  CLS: 0.1,
  TTI: 3800, // 3.8 seconds
  TBT: 300, // 300ms
  INP: 200, // 200ms
};

// Helper to measure Core Web Vitals
async function measureWebVitals(page: Page) {
  return await page.evaluate(() => {
    return new Promise((resolve) => {
      const metrics: any = {};

      // Observe LCP
      new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const lastEntry = entries[entries.length - 1];
        metrics.LCP = lastEntry.renderTime || lastEntry.loadTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });

      // Observe FCP
      new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        if (entries.length > 0) {
          metrics.FCP = entries[0].startTime;
        }
      }).observe({ type: 'paint', buffered: true });

      // Observe CLS
      let clsValue = 0;
      new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }
        metrics.CLS = clsValue;
      }).observe({ type: 'layout-shift', buffered: true });

      // Get navigation timing
      const navigation = performance.getEntriesByType(
        'navigation'
      )[0] as PerformanceNavigationTiming;
      metrics.TTFB = navigation.responseStart - navigation.requestStart;
      metrics.FCP = navigation.responseEnd - navigation.responseStart;
      metrics.domContentLoaded =
        navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart;
      metrics.loadComplete = navigation.loadEventEnd - navigation.loadEventStart;

      // Resolve after a delay to capture all metrics
      setTimeout(() => resolve(metrics), 3000);
    });
  });
}

test.describe('Core Web Vitals', () => {
  test.beforeEach(async ({ page }) => {
    // Set up performance monitoring
    await page.evaluateOnNewDocument(() => {
      window.performanceMetrics = [];

      // Track long tasks
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.performanceMetrics.push({
            type: 'long-task',
            duration: entry.duration,
            startTime: entry.startTime,
          });
        }
      });
      observer.observe({ entryTypes: ['longtask'] });
    });
  });

  test('Home page meets Core Web Vitals thresholds', async ({ page }) => {
    // Start navigation
    await page.goto('/');

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Measure Web Vitals
    const metrics = await measureWebVitals(page);

    // Assert thresholds
    expect(metrics.LCP, 'LCP should be under 2.5s').toBeLessThan(PERFORMANCE_THRESHOLDS.LCP);
    expect(metrics.FCP, 'FCP should be under 1.8s').toBeLessThan(PERFORMANCE_THRESHOLDS.FCP);
    expect(metrics.CLS, 'CLS should be under 0.1').toBeLessThan(PERFORMANCE_THRESHOLDS.CLS);
    expect(metrics.TTFB, 'TTFB should be under 800ms').toBeLessThan(800);
  });

  test('Repository page meets Core Web Vitals thresholds', async ({ page }) => {
    await page.goto('/vercel/next.js');
    await page.waitForLoadState('networkidle');

    const metrics = await measureWebVitals(page);

    expect(metrics.LCP).toBeLessThan(PERFORMANCE_THRESHOLDS.LCP);
    expect(metrics.FCP).toBeLessThan(PERFORMANCE_THRESHOLDS.FCP);
    expect(metrics.CLS).toBeLessThan(PERFORMANCE_THRESHOLDS.CLS);
  });

  test('Navigation between pages maintains performance', async ({ page }) => {
    // Start on home page
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate to repository
    const navigationPromise = page.waitForNavigation();
    await page.click('a[href*="/vercel/next.js"]');
    await navigationPromise;

    // Measure metrics after navigation
    const metrics = await measureWebVitals(page);

    expect(metrics.LCP).toBeLessThan(PERFORMANCE_THRESHOLDS.LCP);
    expect(metrics.CLS).toBeLessThan(PERFORMANCE_THRESHOLDS.CLS);
  });

  test('Interaction responsiveness (INP proxy)', async ({ page }) => {
    await page.goto('/vercel/next.js');
    await page.waitForLoadState('networkidle');

    // Measure interaction timing
    const interactionDelay = await page.evaluate(async () => {
      const button = document.querySelector('button');
      if (!button) return 0;

      const startTime = performance.now();
      button.click();

      // Wait for next frame
      await new Promise((resolve) => requestAnimationFrame(resolve));

      return performance.now() - startTime;
    });

    expect(interactionDelay, 'Interaction delay should be under 200ms').toBeLessThan(
      PERFORMANCE_THRESHOLDS.INP
    );
  });
});

test.describe('Performance Budget', () => {
  test('JavaScript bundle size is within budget', async ({ page }) => {
    const response = await page.goto('/');

    // Track all JS resources
    const jsResources = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      return resources
        .filter((r) => r.name.endsWith('.js'))
        .map((r) => ({
          name: r.name,
          size: r.transferSize,
          duration: r.duration,
        }));
    });

    const totalJsSize = jsResources.reduce((sum, r) => sum + r.size, 0);
    const maxJsSize = 350 * 1024; // 350KB

    expect(totalJsSize, `Total JS size (${totalJsSize} bytes) should be under 350KB`).toBeLessThan(
      maxJsSize
    );
  });

  test('CSS bundle size is within budget', async ({ page }) => {
    await page.goto('/');

    const cssResources = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      return resources
        .filter((r) => r.name.endsWith('.css'))
        .map((r) => ({
          name: r.name,
          size: r.transferSize,
        }));
    });

    const totalCssSize = cssResources.reduce((sum, r) => sum + r.size, 0);
    const maxCssSize = 100 * 1024; // 100KB

    expect(totalCssSize, `Total CSS size should be under 100KB`).toBeLessThan(maxCssSize);
  });

  test('No long tasks blocking main thread', async ({ page }) => {
    await page.goto('/vercel/next.js');
    await page.waitForLoadState('networkidle');

    // Get long tasks
    const longTasks = await page.evaluate(() => {
      return window.performanceMetrics?.filter((m) => m.type === 'long-task') || [];
    });

    // Should have minimal long tasks
    expect(longTasks.length, 'Should have fewer than 5 long tasks').toBeLessThan(5);

    // No single task should be over 100ms
    const veryLongTasks = longTasks.filter((t) => t.duration > 100);
    expect(veryLongTasks.length, 'Should have no tasks over 100ms').toBe(0);
  });
});

test.describe('Progressive Enhancement', () => {
  test('Progressive data loading works correctly', async ({ page }) => {
    await page.goto('/vercel/next.js');

    // Check that critical data loads first
    const criticalDataTime = await page.evaluate(() => {
      return new Promise((resolve) => {
        const startTime = performance.now();
        const checkCriticalData = setInterval(() => {
          // Check if basic metrics are visible
          const metricsVisible = document.querySelector('[data-testid="basic-metrics"]');
          if (metricsVisible) {
            clearInterval(checkCriticalData);
            resolve(performance.now() - startTime);
          }
        }, 100);
      });
    });

    expect(criticalDataTime, 'Critical data should load within 500ms').toBeLessThan(500);
  });

  test('Lazy loading images works correctly', async ({ page }) => {
    await page.goto('/');

    // Get all images
    const lazyImages = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img[loading="lazy"]'));
      return images.length;
    });

    expect(lazyImages, 'Should have lazy-loaded images').toBeGreaterThan(0);
  });

  test('Virtualized lists handle large datasets', async ({ page }) => {
    await page.goto('/facebook/react');
    await page.waitForLoadState('networkidle');

    // Check if virtualization is active
    const virtualizedList = await page.evaluate(() => {
      // Look for virtualized list indicators
      const virtualContainer = document.querySelector('[data-virtualized="true"]');
      return virtualContainer !== null;
    });

    // If we have many contributors, virtualization should be active
    const contributorCount = await page.evaluate(() => {
      return document.querySelectorAll('[data-testid="contributor-card"]').length;
    });

    if (contributorCount > 20) {
      expect(virtualizedList, 'Should use virtualized list for large datasets').toBeTruthy();
    }
  });
});

test.describe('Performance Monitoring', () => {
  test('Web Vitals are being tracked', async ({ page }) => {
    await page.goto('/');

    // Check if Web Vitals monitoring is initialized
    const vitalsTracking = await page.evaluate(() => {
      return typeof window.webVitals !== 'undefined';
    });

    expect(vitalsTracking, 'Web Vitals tracking should be initialized').toBeTruthy();
  });

  test('Performance metrics are sent to analytics', async ({ page }) => {
    // Intercept analytics calls
    const analyticsRequests: any[] = [];
    await page.route('**/web_vitals_events', (route) => {
      analyticsRequests.push(route.request().postDataJSON());
      route.fulfill({ status: 200 });
    });

    await page.goto('/');
    await page.waitForTimeout(5000); // Wait for metrics to be batched

    expect(analyticsRequests.length, 'Should send analytics events').toBeGreaterThan(0);
  });
});

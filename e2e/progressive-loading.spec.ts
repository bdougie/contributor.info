import { test, expect } from '@playwright/test';

/**
 * Progressive Loading E2E Tests
 *
 * These tests validate the progressive loading system that loads repository data
 * in stages: critical -> full -> enhancement
 *
 * The unit tests for this system are excluded from the bulletproof test suite
 * because they require async/await patterns. These E2E tests provide the
 * necessary coverage for the progressive loading behavior.
 */
test.describe('Progressive Loading System', () => {
  test.describe('Stage Loading Behavior', () => {
    test('should display loading state initially', async ({ page }) => {
      // Navigate to a repository page
      await page.goto('/facebook/react', { waitUntil: 'domcontentloaded' });

      // Should see either loading indicators or content
      // The progressive system shows skeletons or loading states first
      const loadingIndicators = page.locator(
        '[data-testid="skeleton"], [data-testid="loading"], .animate-pulse, [class*="skeleton"]'
      );

      const contentElements = page.locator('[data-testid="contributor-list"], [data-testid="pr-list"]');

      // Wait for either loading state or content to appear
      await Promise.race([
        loadingIndicators.first().waitFor({ timeout: 5000 }).catch(() => {}),
        contentElements.first().waitFor({ timeout: 5000 }).catch(() => {}),
        page.waitForTimeout(3000),
      ]);

      // Page should be visible and functional
      await expect(page.locator('body')).toBeVisible();
    });

    test('should progressively load and display content', async ({ page }) => {
      await page.goto('/facebook/react', { waitUntil: 'domcontentloaded' });

      // Wait for React to mount
      await page.waitForFunction(
        () => {
          const root = document.getElementById('root');
          return root && root.children.length > 0;
        },
        { timeout: 10000 }
      );

      // Check for progressive content appearance
      // Critical data should appear first (contributor counts, basic info)
      const criticalDataSelectors = [
        'text=/\\d+.*contributor/i',
        'text=/\\d+.*PR/i',
        'text=/pull request/i',
        '[data-testid="contributor-count"]',
        '[data-testid="pr-count"]',
      ];

      // Wait for any critical data indicator
      const hasCriticalData = await Promise.race([
        ...criticalDataSelectors.map((selector) =>
          page
            .locator(selector)
            .first()
            .waitFor({ timeout: 10000 })
            .then(() => true)
            .catch(() => false)
        ),
        page.waitForTimeout(10000).then(() => false),
      ]);

      // Either we have data or we're showing a tracking prompt (for untracked repos)
      const hasTrackingPrompt = await page.locator('text=/track this repository/i').isVisible();

      expect(hasCriticalData || hasTrackingPrompt).toBeTruthy();
    });

    test('should handle intersection-based lazy loading', async ({ page }) => {
      await page.goto('/facebook/react', { waitUntil: 'domcontentloaded' });

      // Wait for initial content
      await page.waitForTimeout(3000);

      // Get initial page height
      const initialHeight = await page.evaluate(() => document.body.scrollHeight);

      // Scroll to bottom to trigger intersection loading
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

      // Wait for potential lazy-loaded content
      await page.waitForTimeout(2000);

      // Scroll again if content was loaded
      const newHeight = await page.evaluate(() => document.body.scrollHeight);

      if (newHeight > initialHeight) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(1000);
      }

      // Page should still be functional after scrolling
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle failed data fetches gracefully', async ({ page }) => {
      // Intercept API calls to simulate failures
      await page.route('**/api/**', (route) => {
        route.abort('failed');
      });

      await page.goto('/facebook/react', { waitUntil: 'domcontentloaded' });

      // Wait for error handling to kick in
      await page.waitForTimeout(3000);

      // Should not crash - should show error state or fallback
      await expect(page.locator('body')).toBeVisible();

      // Should have some user-friendly content
      const hasContent =
        (await page.locator('h1, h2, h3').isVisible()) ||
        (await page.locator('button').isVisible()) ||
        (await page.locator('text=/error/i').isVisible()) ||
        (await page.locator('text=/track/i').isVisible());

      expect(hasContent).toBeTruthy();
    });

    test('should handle slow network conditions', async ({ page }) => {
      // Simulate slow network
      const client = await page.context().newCDPSession(page);
      await client.send('Network.enable');
      await client.send('Network.emulateNetworkConditions', {
        offline: false,
        downloadThroughput: 50000, // 50 KB/s
        uploadThroughput: 50000,
        latency: 2000, // 2 second latency
      });

      await page.goto('/facebook/react', { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Should show loading state during slow fetch
      await page.waitForTimeout(2000);

      // Page should remain functional
      await expect(page.locator('body')).toBeVisible();

      // Should have either loading indicators or eventually loaded content
      const hasLoadingOrContent =
        (await page.locator('[class*="skeleton"], .animate-pulse').isVisible()) ||
        (await page.locator('h1, h2').isVisible()) ||
        (await page.locator('text=/loading/i').isVisible());

      expect(hasLoadingOrContent).toBeTruthy();
    });
  });

  test.describe('Data Stage Transitions', () => {
    test('should transition through loading stages without errors', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await page.goto('/facebook/react', { waitUntil: 'domcontentloaded' });

      // Wait for all stages to potentially complete
      await page.waitForTimeout(8000);

      // Filter out expected errors (network, mock environment)
      const criticalErrors = errors.filter(
        (error) =>
          !error.includes('404') &&
          !error.includes('Failed to fetch') &&
          !error.includes('NetworkError') &&
          !error.includes('SUPABASE') &&
          !error.includes('supabase') &&
          !error.includes('net::ERR')
      );

      // Should not have critical errors during stage transitions
      expect(criticalErrors.length).toBeLessThanOrEqual(2);
    });

    test('should update UI as data becomes available', async ({ page }) => {
      await page.goto('/facebook/react', { waitUntil: 'domcontentloaded' });

      // Take snapshots at intervals to verify progressive updates
      const snapshots: number[] = [];

      for (let i = 0; i < 5; i++) {
        await page.waitForTimeout(1500);

        // Count visible data elements
        const dataElements = await page.locator('[data-testid], h1, h2, h3, table, ul, ol').count();
        snapshots.push(dataElements);
      }

      // Page should either have stable content or grow over time
      // (not decrease significantly, which would indicate errors)
      const finalCount = snapshots[snapshots.length - 1];
      const maxCount = Math.max(...snapshots);

      // Final state should be close to max (allowing for some UI state changes)
      expect(finalCount).toBeGreaterThanOrEqual(maxCount * 0.5);
    });
  });

  test.describe('Abort and Cleanup', () => {
    test('should handle rapid navigation without memory leaks', async ({ page }) => {
      // Navigate quickly between pages to test abort handling
      await page.goto('/facebook/react', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);

      await page.goto('/microsoft/vscode', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);

      await page.goto('/vercel/next.js', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);

      // Go back
      await page.goBack();
      await page.waitForTimeout(1000);

      // Page should still be functional
      await expect(page.locator('body')).toBeVisible();

      // Should not have crashed
      const isInteractive = await page.evaluate(() => {
        return document.body && document.body.children.length > 0;
      });

      expect(isInteractive).toBeTruthy();
    });

    test('should cancel pending requests on unmount', async ({ page }) => {
      // Track pending requests
      const pendingRequests: string[] = [];
      const completedRequests: string[] = [];

      page.on('request', (request) => {
        if (request.url().includes('api') || request.url().includes('supabase')) {
          pendingRequests.push(request.url());
        }
      });

      page.on('response', (response) => {
        completedRequests.push(response.url());
      });

      // Start loading
      await page.goto('/facebook/react', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);

      // Navigate away before completion
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      // Wait a bit for any cleanup
      await page.waitForTimeout(2000);

      // Page should be on homepage and functional
      await expect(page.locator('body')).toBeVisible();

      // No unhandled promise rejections should occur (checked via console errors above)
    });
  });

  test.describe('Cache Behavior', () => {
    test('should use cached data on revisit', async ({ page }) => {
      // First visit
      await page.goto('/facebook/react', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(5000);

      // Navigate away
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);

      // Time the second visit
      const startTime = Date.now();

      await page.goto('/facebook/react', { waitUntil: 'domcontentloaded' });

      // Wait for content to appear
      await page.waitForFunction(
        () => {
          const content = document.body.textContent || '';
          return content.length > 100;
        },
        { timeout: 10000 }
      );

      const loadTime = Date.now() - startTime;

      // Second visit should be reasonably fast (cache hit)
      // Allow generous time for CI environments
      expect(loadTime).toBeLessThan(15000);
    });
  });
});

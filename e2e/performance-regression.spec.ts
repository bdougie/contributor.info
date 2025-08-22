import { test, expect } from '@playwright/test';

test.describe('Performance Regression Prevention', () => {
  test.beforeEach(async ({ page }) => {
    // Set up performance monitoring
    page.setDefaultTimeout(30000);
  });

  test('lazy-loaded components performance', async ({ page }) => {
    // Navigate to repository page
    await page.goto('/facebook/react');
    
    // Measure initial page load
    const navigationStart = await page.evaluate(() => performance.timing.navigationStart);
    const loadComplete = await page.evaluate(() => performance.timing.loadEventEnd);
    const initialLoadTime = loadComplete - navigationStart;
    
    // Initial load should be under 3 seconds
    expect(initialLoadTime).toBeLessThan(3000);
    
    // Test lazy component loading doesn't block main thread
    const startTime = Date.now();
    
    // Try to trigger lazy component loading (modals, additional data)
    const triggerElements = page.locator('[data-testid="contributor-card"]')
      .or(page.locator('button:has-text("View Details")'))
      .or(page.locator('button:has-text("Load More")'));
    
    if (await triggerElements.count() > 0) {
      await triggerElements.first().click();
      
      // Lazy loading should complete quickly
      const lazyLoadTime = Date.now() - startTime;
      expect(lazyLoadTime).toBeLessThan(2000);
    }
  });

  test('service worker caching performance', async ({ page }) => {
    // First visit - cache population
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Record first load timing
    const firstLoadStart = Date.now();
    await page.reload();
    await page.waitForLoadState('networkidle');
    const firstLoadTime = Date.now() - firstLoadStart;
    
    // Second visit should be faster due to caching
    const cachedLoadStart = Date.now();
    await page.reload();
    await page.waitForLoadState('networkidle');
    const cachedLoadTime = Date.now() - cachedLoadStart;
    
    // Cached load should be at least 20% faster
    expect(cachedLoadTime).toBeLessThan(firstLoadTime * 0.8);
  });

  test('background data fetching performance', async ({ page }) => {
    await page.goto('/facebook/react');
    await page.waitForLoadState('networkidle');
    
    // Monitor network requests for background fetching
    const networkRequests: string[] = [];
    page.on('request', request => {
      if (request.resourceType() === 'fetch' || request.resourceType() === 'xhr') {
        networkRequests.push(request.url());
      }
    });
    
    // Wait for potential background requests
    await page.waitForTimeout(2000);
    
    // Check that main UI remains responsive during background fetching
    const searchInput = page.locator('input[placeholder*="Search"]')
      .or(page.locator('input[placeholder*="filter"]'));
    
    if (await searchInput.count() > 0) {
      const inputStart = Date.now();
      await searchInput.fill('test');
      const inputTime = Date.now() - inputStart;
      
      // Input should remain responsive (under 100ms)
      expect(inputTime).toBeLessThan(100);
    }
  });

  test('bundle size impact on load time', async ({ page }) => {
    // Monitor resource loading
    const resourceSizes: { [key: string]: number } = {};
    
    page.on('response', async response => {
      const contentLength = response.headers()['content-length'];
      if (contentLength && response.url().includes('.js')) {
        resourceSizes[response.url()] = parseInt(contentLength);
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check that main bundle size is reasonable
    const totalJSSize = Object.values(resourceSizes).reduce((sum, size) => sum + size, 0);
    
    // Total JS should be under 1MB for initial load
    expect(totalJSSize).toBeLessThan(1024 * 1024);
  });

  test('memory usage during navigation', async ({ page }) => {
    // Navigate between different pages to test memory management
    const pages = ['/', '/facebook/react', '/microsoft/vscode'];
    
    for (const url of pages) {
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      
      // Check for memory leaks by measuring heap size
      const heapSize = await page.evaluate(() => {
        if ('memory' in performance) {
          // @ts-expect-error - performance.memory exists in Chrome but not in types
          return (performance as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize;
        }
        return 0;
      });
      
      // Heap size should remain reasonable (under 50MB)
      if (heapSize > 0) {
        expect(heapSize).toBeLessThan(50 * 1024 * 1024);
      }
    }
  });

  test('large dataset rendering performance', async ({ page }) => {
    // Test performance with repositories that have many contributors
    await page.goto('/facebook/react');
    await page.waitForLoadState('networkidle');
    
    // Measure rendering time for contributor list
    const renderStart = Date.now();
    
    // Wait for contributor cards to render
    const contributorCards = page.locator('[data-testid="contributor-card"]');
    await contributorCards.first().waitFor({ state: 'visible', timeout: 10000 });
    
    const renderTime = Date.now() - renderStart;
    
    // Rendering should complete within reasonable time
    expect(renderTime).toBeLessThan(5000);
    
    // Test scrolling performance with virtual list
    if (await contributorCards.count() > 10) {
      const scrollStart = Date.now();
      await page.keyboard.press('End'); // Scroll to bottom
      await page.waitForTimeout(500);
      const scrollTime = Date.now() - scrollStart;
      
      // Scrolling should remain smooth
      expect(scrollTime).toBeLessThan(1000);
    }
  });
});
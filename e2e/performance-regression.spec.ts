import { test, expect } from '@playwright/test';

test.describe.skip('Performance Budget Guards', () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(10000);
  });

  test('CRITICAL: initial JS bundle must be under 500KB', async ({ page }) => {
    // Track the INITIAL JS loaded (not lazy loaded chunks)
    const initialResources: { url: string; size: number }[] = [];
    
    page.on('response', async response => {
      const url = response.url();
      const contentLength = response.headers()['content-length'];
      
      // Only count JS that blocks initial render
      if (url.includes('.js') && !url.includes('chunk') && contentLength) {
        initialResources.push({
          url,
          size: parseInt(contentLength)
        });
      }
    });
    
    await page.goto('/');
    
    // Wait for initial JS to load
    await page.waitForLoadState('domcontentloaded');
    
    const totalInitialJS = initialResources.reduce((sum, r) => sum + r.size, 0);
    const totalInitialMB = (totalInitialJS / 1024 / 1024).toFixed(2);
    
    // Log what we're actually loading
    console.log(`Initial JS bundle: ${totalInitialMB}MB`);
    initialResources.forEach(r => {
      console.log(`  - ${r.url.split('/').pop()}: ${(r.size / 1024).toFixed(1)}KB`);
    });
    
    // FAIL if initial bundle > 500KB (this is already generous)
    expect(totalInitialJS).toBeLessThan(500 * 1024);
  });

  test('largest single JS chunk must be under 200KB', async ({ page }) => {
    let largestChunk = 0;
    let largestChunkName = '';
    
    page.on('response', async response => {
      const url = response.url();
      const contentLength = response.headers()['content-length'];
      
      if (url.includes('.js') && contentLength) {
        const size = parseInt(contentLength);
        if (size > largestChunk) {
          largestChunk = size;
          largestChunkName = url.split('/').pop() || '';
        }
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    console.log(`Largest chunk: ${largestChunkName} - ${(largestChunk / 1024).toFixed(1)}KB`);
    
    // No single chunk should be over 200KB
    expect(largestChunk).toBeLessThan(200 * 1024);
  });

  test('time to first byte under 800ms', async ({ page }) => {
    const startTime = Date.now();
    const response = await page.goto('/');
    const ttfb = Date.now() - startTime;
    
    console.log(`Time to First Byte: ${ttfb}ms`);
    
    // TTFB should be under 800ms
    expect(ttfb).toBeLessThan(800);
  });

  test('first contentful paint under 1.5s', async ({ page }) => {
    await page.goto('/');
    
    // Get FCP from Performance API
    const fcp = await page.evaluate(() => {
      const paintEntry = performance.getEntriesByType('paint')
        .find(entry => entry.name === 'first-contentful-paint');
      return paintEntry ? Math.round(paintEntry.startTime) : 0;
    });
    
    console.log(`First Contentful Paint: ${fcp}ms`);
    
    // FCP should be under 1.5s
    expect(fcp).toBeGreaterThan(0);
    expect(fcp).toBeLessThan(1500);
  });

  test('no render-blocking resources', async ({ page }) => {
    const blockingResources: string[] = [];
    
    page.on('response', response => {
      const headers = response.headers();
      const url = response.url();
      
      // Check for render-blocking CSS/JS in head
      if (url.includes('.css') || url.includes('.js')) {
        const cacheControl = headers['cache-control'];
        // If no cache headers or short cache, it's likely blocking
        if (!cacheControl || !cacheControl.includes('max-age')) {
          blockingResources.push(url);
        }
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Should have minimal render-blocking resources
    expect(blockingResources.length).toBeLessThanOrEqual(2);
  });
});
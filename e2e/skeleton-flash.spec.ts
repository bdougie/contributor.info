import { test, expect } from '@playwright/test';

test.describe('Skeleton Loading Flash Issue', () => {
  // Test on slow 3G to better capture the skeleton flash
  test.use({
    // Simulate slow 3G network
    offline: false,
    // Note: We'll use CDP to throttle network in the test
  });

  test('should not show 2x3 grid skeleton on repository page', async ({ page, context }) => {
    // Enable network throttling to slow 3G
    const client = await context.newCDPSession(page);
    await client.send('Network.enable');
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: ((750 * 1024) / 8), // 750 kbps
      uploadThroughput: ((250 * 1024) / 8),   // 250 kbps
      latency: 100, // 100ms latency
    });

    // Track if we see the problematic 2x3 grid skeleton
    let foundProblematicSkeleton = false;
    
    // Monitor for the problematic grid skeleton
    page.on('response', async () => {
      try {
        // Check for grid-cols-2 which indicates 2x3 layout
        const gridSkeleton = await page.locator('.grid.grid-cols-1.md\\:grid-cols-2').first().isVisible().catch(() => false);
        if (gridSkeleton) {
          foundProblematicSkeleton = true;
          console.log('❌ Found problematic 2x3 grid skeleton!');
        }
      } catch {
        // Ignore errors when checking
      }
    });

    // Navigate to a repository page
    await page.goto('https://deploy-preview-327--contributor-info.netlify.app/vercel/next.js', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait a bit to ensure we've checked for skeletons
    await page.waitForTimeout(2000);

    // Take screenshot for evidence
    await page.screenshot({ 
      path: 'tests/screenshots/skeleton-check.png',
      fullPage: true 
    });

    // Assert that we didn't find the problematic skeleton
    expect(foundProblematicSkeleton).toBe(false);
  });

  test('should not show 2x3 grid skeleton on organization page', async ({ page, context }) => {
    // Enable network throttling to slow 3G
    const client = await context.newCDPSession(page);
    await client.send('Network.enable');
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: ((750 * 1024) / 8), // 750 kbps
      uploadThroughput: ((250 * 1024) / 8),   // 250 kbps
      latency: 100, // 100ms latency
    });

    // Track if we see the problematic 2x3 grid skeleton
    let foundProblematicSkeleton = false;
    
    // Monitor for the problematic grid skeleton
    page.on('response', async () => {
      try {
        // Check for grid-cols-2 which indicates 2x3 layout
        const gridSkeleton = await page.locator('.grid.grid-cols-1.md\\:grid-cols-2').first().isVisible().catch(() => false);
        if (gridSkeleton) {
          foundProblematicSkeleton = true;
          console.log('❌ Found problematic 2x3 grid skeleton on org page!');
        }
      } catch {
        // Ignore errors when checking
      }
    });

    // Navigate to an organization page
    await page.goto('https://deploy-preview-327--contributor-info.netlify.app/orgs/vercel', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait a bit to ensure we've checked for skeletons
    await page.waitForTimeout(2000);

    // Take screenshot for evidence
    await page.screenshot({ 
      path: 'tests/screenshots/org-skeleton-check.png',
      fullPage: true 
    });

    // Assert that we didn't find the problematic skeleton
    expect(foundProblematicSkeleton).toBe(false);
  });

  test('capture skeleton flash with visual check', async ({ page, context }) => {
    // Enable network throttling to slow 3G
    const client = await context.newCDPSession(page);
    await client.send('Network.enable');
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: ((750 * 1024) / 8), // 750 kbps
      uploadThroughput: ((250 * 1024) / 8),   // 250 kbps
      latency: 100, // 100ms latency
    });

    const screenshots = [];
    let captureScreenshots = true;

    // Start capturing screenshots rapidly to catch the flash
    const screenshotInterval = setInterval(async () => {
      if (captureScreenshots) {
        try {
          const timestamp = Date.now();
          await page.screenshot({ 
            path: `tests/screenshots/flash-${timestamp}.png`,
            fullPage: false 
          });
          screenshots.push(timestamp);
        } catch {
          // Ignore screenshot errors
        }
      }
    }, 100); // Capture every 100ms

    // Navigate to repository page
    await page.goto('https://deploy-preview-327--contributor-info.netlify.app/vercel/next.js', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Wait for content to load
    await page.waitForSelector('[data-testid="repository-content"], .animate-pulse', { 
      timeout: 10000 
    }).catch(() => {});

    // Stop capturing after content loads
    await page.waitForTimeout(2000);
    captureScreenshots = false;
    clearInterval(screenshotInterval);

    console.log(`Captured ${screenshots.length} screenshots to analyze skeleton flash`);

    // Check if any screenshot contains the problematic grid
    const hasGridSkeleton = await page.evaluate(() => {
      const elements = document.querySelectorAll('.grid.grid-cols-1.md\\:grid-cols-2');
      return elements.length > 0;
    });

    if (hasGridSkeleton) {
      console.log('⚠️ Page still contains grid-cols-2 skeleton elements');
    }
  });
});
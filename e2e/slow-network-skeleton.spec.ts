import { test, expect } from '@playwright/test';

test.describe('Slow Network Skeleton Detection', () => {
  test('capture skeleton flash with extremely slow network', async ({ page, context }) => {
    // Enable CDP for network throttling
    const client = await context.newCDPSession(page);
    await client.send('Network.enable');
    
    // Set to extremely slow network (slower than 3G)
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: ((50 * 1024) / 8), // 50 kbps (very slow)
      uploadThroughput: ((20 * 1024) / 8),   // 20 kbps
      latency: 2000, // 2 second latency
    });

    // Track skeleton observations
    const skeletonObservations: any[] = [];
    
    // Set up console logging to capture any skeleton renders
    page.on('console', msg => {
      if (msg.text().includes('SKELETON')) {
        console.log('Console:', msg.text());
      }
    });

    // Inject observer before navigation
    await page.addInitScript(() => {
      window.skeletonFlashDetected = false;
      window.allSkeletonStates = [];
      
      // Override React rendering to catch skeleton components
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement) {
              // Check for 2x3 grid pattern
              const hasGrid = node.classList?.contains('grid') || 
                            node.querySelector?.('.grid');
              const hasGridCols2 = node.classList?.contains('md:grid-cols-2') ||
                                  node.classList?.contains('grid-cols-2') ||
                                  node.querySelector?.('.md\\:grid-cols-2, .grid-cols-2');
              const hasPulse = node.classList?.contains('animate-pulse') ||
                              node.querySelector?.('.animate-pulse');
              
              if (hasGrid && hasGridCols2 && hasPulse) {
                window.skeletonFlashDetected = true;
                window.allSkeletonStates.push({
                  time: Date.now(),
                  type: '2x3-grid',
                  html: node.outerHTML.substring(0, 200)
                });
                console.log('SKELETON: 2x3 grid detected!', node.className);
              }
            }
          });
        });
      });
      
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    });

    console.log('Starting navigation with very slow network...');
    
    // Navigate and don't wait for load
    const navigationPromise = page.goto('https://deploy-preview-327--contributor-info.netlify.app/vercel/next.js', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    // Take rapid screenshots during loading
    const screenshots = [];
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(200);
      const screenshotPath = `tests/screenshots/slow-${i}.png`;
      await page.screenshot({ path: screenshotPath });
      screenshots.push(screenshotPath);
      
      // Check for skeleton at each interval
      const hasGridSkeleton = await page.evaluate(() => {
        const gridSkeletons = document.querySelectorAll('.grid.md\\:grid-cols-2 .animate-pulse, .grid.grid-cols-2 .animate-pulse');
        return gridSkeletons.length > 0;
      });
      
      if (hasGridSkeleton) {
        console.log(`❌ 2x3 grid skeleton detected at interval ${i}`);
        skeletonObservations.push({ interval: i, hasGrid: true });
      }
    }

    await navigationPromise;

    // Get final observations
    const finalObservations = await page.evaluate(() => ({
      flashDetected: window.skeletonFlashDetected,
      states: window.allSkeletonStates
    }));

    console.log('Final observations:', finalObservations);
    console.log('Screenshot observations:', skeletonObservations);

    // Report findings
    if (finalObservations.flashDetected || skeletonObservations.length > 0) {
      console.log('\n❌ ISSUE CONFIRMED: 2x3 grid skeleton still appears!');
      console.log('The skeleton flash issue is NOT fixed.');
    } else {
      console.log('\n✅ No 2x3 grid skeleton detected even with slow network');
    }

    // This test will fail if the issue exists
    expect(finalObservations.flashDetected).toBe(false);
    expect(skeletonObservations.length).toBe(0);
  });

  test('inspect source code for grid-cols-2 skeleton', async ({ page }) => {
    // Check the actual source code being served
    const response = await page.goto('https://deploy-preview-327--contributor-info.netlify.app/vercel/next.js');
    
    if (response) {
      const html = await response.text();
      
      // Search for grid-cols-2 in combination with skeleton/pulse
      const gridCols2Matches = html.match(/grid-cols-2.*?animate-pulse|animate-pulse.*?grid-cols-2/gs);
      const mdGridCols2Matches = html.match(/md:grid-cols-2.*?animate-pulse|animate-pulse.*?md:grid-cols-2/gs);
      
      if (gridCols2Matches || mdGridCols2Matches) {
        console.log('⚠️ Found grid-cols-2 skeleton patterns in HTML source!');
        console.log('Matches:', {
          gridCols2: gridCols2Matches?.length || 0,
          mdGridCols2: mdGridCols2Matches?.length || 0
        });
      } else {
        console.log('✅ No grid-cols-2 skeleton patterns found in source');
      }
    }
  });
});

// TypeScript declarations
declare global {
  interface Window {
    skeletonFlashDetected: boolean;
    allSkeletonStates: Array<{
      time: number;
      type: string;
      html: string;
    }>;
  }
}
import { test, expect } from '@playwright/test';

test.describe('Verify 2x3 Skeleton Fix', () => {
  test('detect 2x3 grid skeleton on repository page', async ({ page }) => {
    // List to track all skeleton states we observe
    const skeletonStates: string[] = [];
    
    // Listen for DOM changes to catch the skeleton flash
    await page.addInitScript(() => {
      window.skeletonObservations = [];
      
      // Create observer to watch for skeleton elements
      const observer = new MutationObserver(() => {
        // Look for grid-cols-2 which indicates the 2x3 layout
        const gridElements = document.querySelectorAll('.grid.md\\:grid-cols-2, .grid-cols-2');
        const pulseElements = document.querySelectorAll('.animate-pulse');
        
        if (gridElements.length > 0 && pulseElements.length > 0) {
          // Found skeleton with 2-column grid
          const hasGridSkeleton = Array.from(gridElements).some(el => 
            el.querySelector('.animate-pulse') !== null
          );
          
          if (hasGridSkeleton) {
            window.skeletonObservations.push({
              time: Date.now(),
              type: '2x3-grid-skeleton',
              gridCount: gridElements.length,
              pulseCount: pulseElements.length
            });
          }
        }
      });
      
      // Start observing
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    });
    
    // Navigate to repo page
    await page.goto('https://deploy-preview-327--contributor-info.netlify.app/vercel/next.js', {
      waitUntil: 'domcontentloaded'
    });
    
    // Wait for content to stabilize
    await page.waitForTimeout(3000);
    
    // Get skeleton observations
    const observations = await page.evaluate(() => window.skeletonObservations);
    
    // Log what we found
    if (observations && observations.length > 0) {
      console.log('❌ FOUND 2x3 GRID SKELETON FLASH!');
      console.log('Observations:', JSON.stringify(observations, null, 2));
      skeletonStates.push('2x3-grid-detected');
    } else {
      console.log('✅ No 2x3 grid skeleton detected');
      skeletonStates.push('no-grid-detected');
    }
    
    // Take screenshot of current state
    await page.screenshot({ 
      path: 'tests/screenshots/final-state-repo.png',
      fullPage: true 
    });
    
    // Assert - EXPECTING THIS TO FAIL if the issue still exists
    expect(observations.length).toBe(0);
  });

  test('detect 2x3 grid skeleton on organization page', async ({ page }) => {
    // List to track all skeleton states we observe
    const skeletonStates: string[] = [];
    
    // Listen for DOM changes to catch the skeleton flash
    await page.addInitScript(() => {
      window.skeletonObservations = [];
      
      // Create observer to watch for skeleton elements
      const observer = new MutationObserver(() => {
        // Look for grid-cols-2 which indicates the 2x3 layout
        const gridElements = document.querySelectorAll('.grid.md\\:grid-cols-2, .grid-cols-2');
        const pulseElements = document.querySelectorAll('.animate-pulse');
        
        if (gridElements.length > 0 && pulseElements.length > 0) {
          // Found skeleton with 2-column grid
          const hasGridSkeleton = Array.from(gridElements).some(el => 
            el.querySelector('.animate-pulse') !== null
          );
          
          if (hasGridSkeleton) {
            window.skeletonObservations.push({
              time: Date.now(),
              type: '2x3-grid-skeleton',
              gridCount: gridElements.length,
              pulseCount: pulseElements.length
            });
          }
        }
      });
      
      // Start observing
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    });
    
    // Navigate to org page
    await page.goto('https://deploy-preview-327--contributor-info.netlify.app/orgs/vercel', {
      waitUntil: 'domcontentloaded'
    });
    
    // Wait for content to stabilize
    await page.waitForTimeout(3000);
    
    // Get skeleton observations
    const observations = await page.evaluate(() => window.skeletonObservations);
    
    // Log what we found
    if (observations && observations.length > 0) {
      console.log('❌ FOUND 2x3 GRID SKELETON FLASH ON ORG PAGE!');
      console.log('Observations:', JSON.stringify(observations, null, 2));
      skeletonStates.push('2x3-grid-detected');
    } else {
      console.log('✅ No 2x3 grid skeleton detected on org page');
      skeletonStates.push('no-grid-detected');
    }
    
    // Take screenshot of current state
    await page.screenshot({ 
      path: 'tests/screenshots/final-state-org.png',
      fullPage: true 
    });
    
    // Assert - EXPECTING THIS TO FAIL if the issue still exists
    expect(observations.length).toBe(0);
  });

  test('check current DOM for grid skeletons', async ({ page }) => {
    // Navigate to repo page
    await page.goto('https://deploy-preview-327--contributor-info.netlify.app/vercel/next.js');
    
    // Check if any grid-cols-2 elements exist in the DOM
    const gridSkeletons = await page.evaluate(() => {
      const selectors = [
        '.grid.md\\:grid-cols-2 .animate-pulse',
        '.grid-cols-2 .animate-pulse',
        '.md\\:grid-cols-2 .animate-pulse'
      ];
      
      const results = [];
      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          results.push({
            selector,
            count: elements.length,
            parentClasses: Array.from(elements[0].parentElement?.classList || [])
          });
        }
      });
      
      return results;
    });
    
    if (gridSkeletons.length > 0) {
      console.log('⚠️ Found grid skeleton elements in DOM:');
      console.log(JSON.stringify(gridSkeletons, null, 2));
    } else {
      console.log('✅ No grid skeleton elements found in final DOM');
    }
  });
});

// Add TypeScript declarations
declare global {
  interface Window {
    skeletonObservations: Array<{
      time: number;
      type: string;
      gridCount: number;
      pulseCount: number;
    }>;
  }
}
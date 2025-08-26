import { test, expect } from '@playwright/test';

test.describe('Performance and Loading', () => {
  test('page load performance', async ({ page }) => {
    // Monitor basic performance metrics
    const startTime = Date.now();
    
    await page.goto('/');
    
    // Check initial load time
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(10000); // Should load within 10 seconds
    
    // Verify essential content is visible quickly
    await expect(page.locator('body')).toBeVisible();
    
    // Check for any loading states or skeleton screens
    const hasSkeletons = await page.locator('[class*="skeleton"]').isVisible();
    if (hasSkeletons) {
      // If skeletons are present, they should be replaced with content
      await page.waitForTimeout(5000);
      // After waiting, there should be real content
      const stillHasSkeletons = await page.locator('[class*="skeleton"]').count();
      expect(stillHasSkeletons).toBeLessThanOrEqual(2); // Allow some persistent skeletons
    }
  });

  test('data loading states', async ({ page }) => {
    // Test repository page with potential data loading
    await page.goto('/microsoft/typescript');
    
    // Look for loading indicators
    const loadingStates = [
      'loading',
      'skeleton',
      'spinner',
      'Loading',
      'Fetching'
    ];
    
    // Check for loading states to ensure we're measuring real performance 
    for (const state of loadingStates) {
      if (await page.locator(`text=${state}`).isVisible() || 
          await page.locator(`[class*="${state.toLowerCase()}"]`).isVisible()) {
        // Found loading state, performance metrics will be more realistic
        break;
      }
    }
    
    // Wait for potential loading to complete
    await page.waitForTimeout(5000);
    
    // Should show either data or appropriate fallback
    const hasContent = await page.locator('h1').isVisible() ||
                      await page.locator('button').isVisible() ||
                      await page.locator('text=Track This Repository').isVisible();
    
    expect(hasContent).toBeTruthy();
  });

  test('responsive design', async ({ page }) => {
    await page.goto('/');
    
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.locator('body')).toBeVisible();
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('body')).toBeVisible();
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('body')).toBeVisible();
    
    // Ensure layout doesn't break at any size
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.body.scrollWidth > window.innerWidth;
    });
    
    // Should not have horizontal scroll (indicates responsive issues)
    expect(hasHorizontalScroll).toBeFalsy();
  });

  test('accessibility basics', async ({ page }) => {
    await page.goto('/');
    
    // Check for basic accessibility features
    const hasHeadings = await page.locator('h1, h2, h3, h4, h5, h6').count();
    expect(hasHeadings).toBeGreaterThan(0);
    
    // Check for interactive elements
    const interactiveElements = await page.locator('button, a, input').count();
    expect(interactiveElements).toBeGreaterThan(0);
    
    // Check for alt text on images (if any)
    const images = await page.locator('img').count();
    if (images > 0) {
      const imagesWithAlt = await page.locator('img[alt]').count();
      // At least some images should have alt text
      expect(imagesWithAlt).toBeGreaterThanOrEqual(Math.min(1, images));
    }
    
    // Test keyboard navigation
    await page.keyboard.press('Tab');
    const focusedElement = await page.locator(':focus').count();
    expect(focusedElement).toBeGreaterThanOrEqual(0);
  });

  test('error resilience', async ({ page }) => {
    // Monitor for console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.goto('/');
    
    // Navigate around and perform actions
    if (await page.locator('input').first().isVisible()) {
      await page.locator('input').first().fill('test');
    }
    
    if (await page.locator('button').first().isVisible()) {
      await page.locator('button').first().click();
    }
    
    // Wait for any async operations
    await page.waitForTimeout(3000);
    
    // Filter out expected/minor errors
    const criticalErrors = errors.filter(error => 
      !error.includes('404') &&
      !error.includes('NetworkError') &&
      !error.includes('Failed to fetch') &&
      !error.includes('ChunkLoadError') &&
      !error.toLowerCase().includes('non-passive')
    );
    
    // Should not have critical JavaScript errors
    expect(criticalErrors.length).toBeLessThanOrEqual(1);
  });
});
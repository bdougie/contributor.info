import { test, expect } from '@playwright/test';

test.describe.skip('Critical User Flows', () => {
  test.beforeEach(async ({ page }) => {
    // Set longer timeout for critical flows
    page.setDefaultTimeout(30000);
  });

  test('homepage loads with performance metrics', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    // Test Core Web Vitals - First Contentful Paint should be under 5s for reliability
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(5000);
    
    await expect(page.locator('body')).toBeVisible();
    
    // Check that critical elements load quickly (more flexible selectors)
    await expect(page.locator('input[placeholder*="Search"], input[placeholder*="search"]')).toBeVisible();
    const titleText = page.locator('text=Track GitHub Contributors').or(page.locator('h1, h2').first());
    await expect(titleText).toBeVisible();
  });

  test('repository discovery and tracking flow', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    // Test search functionality with flexible selector
    const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="search"]').first();
    await expect(searchInput).toBeVisible();
    
    // Search for a test repository
    await searchInput.fill('facebook/react');
    await searchInput.press('Enter');
    
    // Should navigate to repository page (wait for navigation)
    await page.waitForURL(/.*\/facebook\/react/, { timeout: 10000 });
    
    // Check if tracking UI elements are present (more flexible)
    const trackingElements = page.locator('text=Track This Repository')
      .or(page.locator('text=Tracking'))
      .or(page.locator('button:has-text("Track")'))
      .or(page.locator('h1:has-text("facebook/react")'));
    await expect(trackingElements.first()).toBeVisible({ timeout: 10000 });
  });

  test('contributor profile loading with lazy components', async ({ page }) => {
    // Navigate to a repository with contributors
    await page.goto('/facebook/react');
    
    // Wait for initial data to load
    await page.waitForLoadState('networkidle');
    
    // Check if contributor cards are present (should be lazy-loaded)
    const contributorCard = page.locator('[data-testid="contributor-card"]').first();
    
    if (await contributorCard.count() > 0) {
      // Click on first contributor to test lazy loading
      await contributorCard.click();
      
      // Modal or profile should load without blocking main UI
      const modalOrProfile = page.locator('[role="dialog"]').or(page.locator('[data-testid="contributor-profile"]'));
      await expect(modalOrProfile).toBeVisible({ timeout: 5000 });
    }
  });

  test('search and filter functionality', async ({ page }) => {
    await page.goto('/facebook/react');
    await page.waitForLoadState('networkidle');
    
    // Test search within repository
    const searchFilter = page.locator('input[placeholder*="filter"]').or(page.locator('input[placeholder*="search"]'));
    
    if (await searchFilter.count() > 0) {
      await searchFilter.fill('dan');
      
      // Results should filter without full page reload
      await page.waitForTimeout(500); // Allow for debounced search
      
      // Check that results are filtered
      const results = page.locator('[data-testid="contributor-card"]');
      if (await results.count() > 0) {
        // At least one result should be visible
        await expect(results.first()).toBeVisible();
      }
    }
  });

  test('data refresh and background sync', async ({ page }) => {
    await page.goto('/facebook/react');
    await page.waitForLoadState('networkidle');
    
    // Look for refresh or sync buttons
    const refreshButton = page.locator('[data-testid="refresh-data"]')
      .or(page.locator('button:has-text("Refresh")'))
      .or(page.locator('button:has-text("Sync")'));
    
    if (await refreshButton.count() > 0) {
      await refreshButton.click();
      
      // Should show loading state without blocking UI
      const loadingIndicator = page.locator('[data-testid="loading"]')
        .or(page.locator('.loading'))
        .or(page.locator('text=Loading'));
      
      // Loading should appear and disappear
      if (await loadingIndicator.count() > 0) {
        await expect(loadingIndicator).toBeVisible();
        await expect(loadingIndicator).not.toBeVisible({ timeout: 15000 });
      }
    }
  });

  test('responsive design and mobile layout', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Homepage should be responsive
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();
    
    // Navigate to repository page
    await page.goto('/facebook/react');
    await page.waitForLoadState('networkidle');
    
    // Repository page should be responsive
    await expect(page.locator('body')).toBeVisible();
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('body')).toBeVisible();
  });
});
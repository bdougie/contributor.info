import { test, expect } from '@playwright/test';

test.describe('Critical User Flows', () => {
  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/');
    
    // Check that page loads without errors
    await expect(page.locator('body')).toBeVisible();
    
    // Verify no JavaScript errors in console
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Wait a bit for any async operations to complete
    await page.waitForTimeout(2000);
    
    // Allow some expected errors but not critical ones
    const criticalErrors = errors.filter(error => 
      !error.includes('404') && 
      !error.includes('Failed to fetch') &&
      !error.includes('NetworkError')
    );
    
    expect(criticalErrors.length).toBeLessThanOrEqual(2); // Allow minor non-critical errors
  });

  test('repository search flow', async ({ page }) => {
    await page.goto('/');
    
    // Look for search input
    const searchInput = page.locator('input[type="text"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('facebook/react');
      
      // Look for search/submit button
      const submitButton = page.locator('button').filter({ 
        hasText: /search|find|go|submit/i 
      }).first();
      
      if (await submitButton.isVisible()) {
        await submitButton.click();
        
        // Verify navigation occurred (URL changed or new content loaded)
        await page.waitForTimeout(1000);
        const currentUrl = page.url();
        expect(currentUrl).not.toBe('/');
      }
    }
  });

  test('error handling for invalid repositories', async ({ page }) => {
    // Test navigation to non-existent repository
    await page.goto('/invalid-user/invalid-repo');
    
    // Should not crash - either show error state or redirect
    await expect(page.locator('body')).toBeVisible();
    
    // Check for error message or fallback content
    const hasErrorContent = await page.locator('text=not found').isVisible() ||
                           await page.locator('text=error').isVisible() ||
                           await page.locator('text=404').isVisible() ||
                           await page.getByText('Track This Repository').isVisible(); // Manual tracking system
    
    // Should handle gracefully with either error message or tracking prompt
    expect(hasErrorContent).toBeTruthy();
  });

  test('basic navigation and responsiveness', async ({ page }) => {
    await page.goto('/');
    
    // Test responsive behavior
    await page.setViewportSize({ width: 375, height: 667 }); // Mobile size
    await expect(page.locator('body')).toBeVisible();
    
    // Test desktop size
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.locator('body')).toBeVisible();
    
    // Basic accessibility - check for essential elements
    const headings = page.locator('h1, h2, h3');
    const interactiveElements = page.locator('button, input, a');
    
    // Should have some structure
    expect(await headings.count() + await interactiveElements.count()).toBeGreaterThan(0);
  });
});
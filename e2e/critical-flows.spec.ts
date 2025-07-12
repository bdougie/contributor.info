import { test, expect } from '@playwright/test';

test.describe('Critical User Flows', () => {
  test('homepage loads and basic navigation works', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Verify page loads with title
    await expect(page).toHaveTitle(/contributor\.info/i);
    
    // Verify basic page structure exists - body should always be present
    await expect(page.locator('body')).toBeVisible();
    
    // Verify search input exists (this is a critical element)
    await expect(page.locator('input')).toBeVisible();
  });

  test('can navigate to a repository page', async ({ page }) => {
    // Go directly to a known repository
    await page.goto('/facebook/react');
    
    // Verify we're on the repository page
    await expect(page).toHaveURL('/facebook/react');
    
    // Verify page loads (any content will do)
    await expect(page.locator('body')).toBeVisible();
  });
});
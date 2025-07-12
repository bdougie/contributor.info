import { test, expect } from '@playwright/test';

test.describe('Critical User Flows', () => {
  test('homepage loads and basic navigation works', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Verify page loads with title
    await expect(page).toHaveTitle(/contributor\.info/i);    
    // Verify main content is visible
    await expect(page.locator('text=Analyze GitHub Repository Contributors')).toBeVisible();
    
    // Verify search input exists
    await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();
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
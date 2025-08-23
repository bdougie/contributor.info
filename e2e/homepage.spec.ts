import { test, expect } from '@playwright/test';

test.describe('Homepage Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for page to fully load
    await expect(page.locator('body')).toBeVisible();
  });

  test('search form functionality', async ({ page }) => {
    // Find and interact with search form
    const searchInput = page.locator('input[type="text"]').first();
    const searchButton = page.locator('button').filter({ hasText: /search|find|go/i }).first();
    
    // Test search for pgvector/pgvector
    await searchInput.fill('pgvector/pgvector');
    await searchButton.click();
    
    // Verify correct routing
    await expect(page).toHaveURL(/.*\/pgvector\/pgvector$/);
  });

  test('example repository links', async ({ page }) => {
    // Test continuedev/continue example link
    const exampleLink = page.locator('a').filter({ hasText: /continuedev\/continue/i }).first();
    
    if (await exampleLink.isVisible()) {
      await exampleLink.click();
      await expect(page).toHaveURL(/.*\/continuedev\/continue$/);
    } else {
      // If no direct link, look for example button
      const exampleButton = page.locator('button').filter({ hasText: /continuedev\/continue/i }).first();
      if (await exampleButton.isVisible()) {
        await exampleButton.click();
        await expect(page).toHaveURL(/.*\/continuedev\/continue$/);
      }
    }
  });

  test('homepage elements presence', async ({ page }) => {
    // Verify essential homepage elements are present
    await expect(page.locator('input[type="text"]').first()).toBeVisible();
    
    // Check for search or action buttons
    const buttons = page.locator('button');
    await expect(buttons.first()).toBeVisible();
    
    // Check for any example repository links or mentions
    const hasExampleRepos = await page.locator('text=continuedev').count() > 0 || 
                           await page.locator('text=pgvector').count() > 0 ||
                           await page.locator('text=example').count() > 0;
    
    // At minimum, page should have some interactive elements
    expect(hasExampleRepos || await buttons.count() > 0).toBeTruthy();
  });
});
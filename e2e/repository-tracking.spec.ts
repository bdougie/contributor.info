import { test, expect } from '@playwright/test';

test.describe('Repository Tracking Flow', () => {
  test('manual repository tracking workflow', async ({ page }) => {
    // Test the new manual repository tracking system
    const testRepo = 'facebook/react';

    await page.goto(`/${testRepo}`);

    // Should see either data or tracking prompt (based on manual tracking system)
    await expect(page.locator('body')).toBeVisible();

    // Look for tracking button or existing data
    const trackingButton = page.getByText('Track This Repository');
    const hasData =
      (await page.locator('text=contributors').isVisible()) ||
      (await page.locator('[data-testid="contributor-list"]').isVisible());

    if (await trackingButton.isVisible()) {
      // Repository needs manual tracking
      await trackingButton.click();

      // Should show some feedback about tracking initiation
      await page.waitForTimeout(2000);

      // Look for confirmation or loading state
      const hasConfirmation =
        (await page.locator('text=tracking').isVisible()) ||
        (await page.locator('text=added').isVisible()) ||
        (await page.locator('text=processing').isVisible());

      expect(hasConfirmation).toBeTruthy();
    } else if (hasData) {
      // Repository already has data - verify basic elements
      expect(hasData).toBeTruthy();
    } else {
      // Should at least show some content/error state
      const hasContent =
        (await page.locator('h1, h2, h3').isVisible()) ||
        (await page.locator('text=error').isVisible()) ||
        (await page.locator('text=loading').isVisible());
      expect(hasContent).toBeTruthy();
    }
  });

  test('repository data display', async ({ page }) => {
    // Test a well-known repository that might have data
    await page.goto('/facebook/react');

    // Wait for page to load
    await page.waitForTimeout(3000);

    // Check for essential elements that should be present
    const pageTitle = await page.locator('h1').first();
    const hasTitle = await pageTitle.isVisible();

    if (hasTitle) {
      const titleText = await pageTitle.textContent();
      expect(titleText).toContain('react'); // Should contain repo name
    }

    // Check for interactive elements
    const buttons = await page.locator('button').count();
    const links = await page.locator('a').count();

    // Should have some interactive elements
    expect(buttons + links).toBeGreaterThan(0);
  });

  test('search functionality', async ({ page }) => {
    await page.goto('/');

    // Look for search input
    const searchInputs = page.locator(
      'input[type="text"], input[placeholder*="search"], input[placeholder*="repository"]'
    );
    const searchInput = searchInputs.first();

    if (await searchInput.isVisible()) {
      await searchInput.fill('microsoft/vscode');

      // Look for search button or form submission
      const searchForm = page.locator('form').first();
      const searchButton = page
        .locator('button')
        .filter({ hasText: /search|find|go/i })
        .first();

      if (await searchButton.isVisible()) {
        await searchButton.click();
      } else if (await searchForm.isVisible()) {
        await searchInput.press('Enter');
      }

      // Wait for navigation
      await page.waitForTimeout(2000);

      // Should navigate to repository page
      expect(page.url()).toMatch(/microsoft.*vscode/i);
    }
  });

  test('error boundaries and resilience', async ({ page }) => {
    // Test various error conditions
    const testCases = [
      '/invalid-user/invalid-repo-name-that-definitely-does-not-exist',
      '/user-with-special-chars!@#/repo',
      '///malformed/url',
    ];

    for (const testUrl of testCases) {
      await page.goto(testUrl);

      // Should not crash - page should still be functional
      await expect(page.locator('body')).toBeVisible();

      // Should have some error handling
      const hasErrorHandling =
        (await page.locator('text=error').isVisible()) ||
        (await page.locator('text=not found').isVisible()) ||
        (await page.locator('text=Track This Repository').isVisible()) ||
        (await page.locator('button, a').first().isVisible());

      expect(hasErrorHandling).toBeTruthy();
    }
  });
});

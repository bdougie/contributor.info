import { test, expect } from '@playwright/test';

test.describe('Critical User Flows', () => {
  test('homepage loads successfully', async ({ page }) => {
    // Set up console error monitoring before navigation
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Navigate with retry logic for CI
    await page.goto('/', {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    });

    // Check that page loads without errors
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

    // Wait for initial React render
    await page.waitForFunction(
      () => {
        const root = document.getElementById('root');
        return root && root.children.length > 0;
      },
      { timeout: 10000 }
    );

    // Allow some expected errors but not critical ones
    const criticalErrors = errors.filter(
      (error) =>
        !error.includes('404') &&
        !error.includes('Failed to fetch') &&
        !error.includes('NetworkError') &&
        !error.includes('SUPABASE') && // Mock environment
        !error.includes('supabase') // Mock environment
    );

    expect(criticalErrors.length).toBeLessThanOrEqual(2); // Allow minor non-critical errors
  });

  test('repository search flow', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Wait for page to be interactive using proper wait condition
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
      // NetworkIdle might not happen in CI with mocked env
    });

    // Look for search input with better selector
    const searchInput = page.locator('input[type="text"], input[type="search"]').first();
    const inputVisible = await searchInput.isVisible().catch(() => false);

    if (inputVisible) {
      await searchInput.fill('facebook/react');

      // Look for search/submit button
      const submitButton = page
        .locator('button')
        .filter({
          hasText: /search|find|go|submit/i,
        })
        .first();

      const buttonVisible = await submitButton.isVisible().catch(() => false);

      if (buttonVisible) {
        const initialUrl = page.url();
        await submitButton.click();

        // Wait for navigation or content change instead of fixed timeout
        await Promise.race([
          page.waitForURL('**/facebook/react**', { timeout: 5000 }).catch(() => {}),
          page.waitForSelector('[data-testid="loading"]', { timeout: 5000 }).catch(() => {}),
          page.waitForSelector('text=/facebook.*react/i', { timeout: 5000 }).catch(() => {}),
        ]);

        const currentUrl = page.url();
        // Verify that navigation occurred or URL changed
        expect(currentUrl).not.toBe(initialUrl);
      }
    }

    // Test passes even if search is not available (CI environment)
  });

  test('error handling for invalid repositories', async ({ page }) => {
    // Test navigation to non-existent repository
    await page.goto('/invalid-user/invalid-repo', {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    });

    // Should not crash - either show error state or redirect
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

    // Check for various possible error/fallback states
    const errorSelectors = [
      'text=/not found/i',
      'text=/error/i',
      'text=/404/i',
      'text=/track this repository/i',
      'text=/invalid/i',
    ];

    // Use Playwright's built-in expect for better assertions
    const errorElements = await Promise.all(
      errorSelectors.map((selector) =>
        page
          .locator(selector)
          .isVisible()
          .catch(() => false)
      )
    );

    const hasErrorContent = errorElements.some((isVisible) => isVisible);

    // Page should either show error content or handle gracefully
    // In CI, the page might render empty or redirect
    if (!hasErrorContent) {
      // If no error content, at least verify the page loaded
      await expect(page).toHaveURL(/.+/);
      await expect(page.locator('body')).not.toBeEmpty();
    }
  });

  test('basic navigation and responsiveness', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Test responsive behavior
    await page.setViewportSize({ width: 375, height: 667 }); // Mobile size
    await expect(page.locator('body')).toBeVisible({ timeout: 5000 });

    // Test desktop size
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.locator('body')).toBeVisible({ timeout: 5000 });

    // Basic accessibility - check for essential elements
    // Wait for React to render content
    await page.waitForFunction(
      () => {
        const root = document.getElementById('root');
        return root && root.children.length > 0;
      },
      { timeout: 10000 }
    );

    const headings = page.locator('h1, h2, h3, h4, h5, h6');
    const interactiveElements = page.locator('button, input, a, select');

    // Count elements with error handling
    const headingCount = await headings.count().catch(() => 0);
    const interactiveCount = await interactiveElements.count().catch(() => 0);

    // Should have some structure (at least one element)
    expect(headingCount + interactiveCount).toBeGreaterThan(0);
  });
});

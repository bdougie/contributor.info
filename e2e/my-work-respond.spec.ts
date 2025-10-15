import { test, expect } from '@playwright/test';

/**
 * E2E tests for "My Work" Mark as Responded functionality
 * Tests that the button appears and functions correctly in the ResponsePreviewModal
 */
test.describe('My Work - Mark as Responded', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Mock authentication for testing
    await page.evaluate(() => {
      localStorage.setItem('test-auth', 'true');
      localStorage.setItem(
        'test-user',
        JSON.stringify({
          id: 'test-user-id',
          email: 'test@example.com',
          user_metadata: {
            user_name: 'testuser',
          },
        })
      );
    });
  });

  test('should show Mark as Responded button in modal when opening from My Work', async ({
    page,
  }) => {
    // Navigate to workspace page with My Work tab
    await page.goto('/i/continue');

    // Wait for My Work section to appear (avoid networkidle due to ongoing polling)
    await expect(page.locator('text=My Work')).toBeVisible({ timeout: 10000 });

    // Look for a discussion or issue in My Work list
    const respondButton = page.locator('button:has-text("Respond")').first();

    // If there are no items, skip the test
    if ((await respondButton.count()) === 0) {
      test.skip();
    }

    // Click the Respond button to open modal
    await respondButton.click();

    // Wait for the ResponsePreviewModal to open
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // CRITICAL: Verify "Mark as Responded" button appears in modal footer
    const markRespondedButton = page.locator('button:has-text("Mark as Responded")');
    await expect(markRespondedButton).toBeVisible({ timeout: 5000 });

    // Verify button is not disabled
    await expect(markRespondedButton).toBeEnabled();
  });

  test('should show loading state when marking as responded', async ({ page }) => {
    // Navigate to workspace
    await page.goto('/i/continue');
    await expect(page.locator('text=My Work')).toBeVisible({ timeout: 10000 });

    // Find and click Respond button
    const respondButton = page.locator('button:has-text("Respond")').first();
    if ((await respondButton.count()) === 0) {
      test.skip();
    }

    await respondButton.click();

    // Wait for modal
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Click Mark as Responded
    const markRespondedButton = page.locator('button:has-text("Mark as Responded")');
    await markRespondedButton.click();

    // Verify loading state appears briefly
    await expect(page.locator('button:has-text("Marking...")')).toBeVisible({ timeout: 2000 });
  });

  test('should show success toast after marking as responded', async ({ page }) => {
    // Navigate to workspace
    await page.goto('/i/continue');
    await expect(page.locator('text=My Work')).toBeVisible({ timeout: 10000 });

    // Find and click Respond button
    const respondButton = page.locator('button:has-text("Respond")').first();
    if ((await respondButton.count()) === 0) {
      test.skip();
    }

    await respondButton.click();

    // Wait for modal
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Click Mark as Responded
    await page.locator('button:has-text("Mark as Responded")').click();

    // Verify success toast appears
    await expect(page.locator('text=/marked as responded/i')).toBeVisible({ timeout: 3000 });

    // Verify modal closes after marking
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 2000 });
  });

  test('should remove item from My Work list after marking as responded', async ({ page }) => {
    // Navigate to workspace
    await page.goto('/i/continue');
    await expect(page.locator('text=My Work')).toBeVisible({ timeout: 10000 });

    // Get initial count of items
    const initialCount = await page.locator('button:has-text("Respond")').count();

    if (initialCount === 0) {
      test.skip();
    }

    // Get the title of the first item
    const firstItemTitle = await page
      .locator('[data-testid="my-work-item"]')
      .first()
      .locator('text=')
      .first()
      .textContent();

    // Click Respond button
    await page.locator('button:has-text("Respond")').first().click();

    // Wait for modal and mark as responded
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await page.locator('button:has-text("Mark as Responded")').click();

    // Wait for modal to close
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 2000 });

    // Verify the item no longer appears in My Work (optimistic update)
    // The item should be removed immediately due to onItemMarkedAsResponded callback
    await expect(page.locator(`text=${firstItemTitle}`)).not.toBeVisible({ timeout: 3000 });

    // Verify count decreased or list updated
    const newCount = await page.locator('button:has-text("Respond")').count();
    expect(newCount).toBeLessThan(initialCount);
  });

  test('should handle error gracefully when marking fails', async ({ page }) => {
    // Mock a network failure
    await page.route('**/rest/v1/discussions*', (route) => {
      route.abort();
    });

    await page.route('**/rest/v1/issues*', (route) => {
      route.abort();
    });

    // Navigate to workspace
    await page.goto('/i/continue');
    await expect(page.locator('text=My Work')).toBeVisible({ timeout: 10000 });

    const respondButton = page.locator('button:has-text("Respond")').first();
    if ((await respondButton.count()) === 0) {
      test.skip();
    }

    await respondButton.click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Click Mark as Responded
    await page.locator('button:has-text("Mark as Responded")').click();

    // Verify error toast appears
    await expect(page.locator('text=/failed to mark/i')).toBeVisible({ timeout: 3000 });

    // Modal may stay open or close - verify error is shown either way
    const errorMessage = page.locator('text=/error|failed/i');
    await expect(errorMessage).toBeVisible();
  });
});

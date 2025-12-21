import { test, expect } from '@playwright/test';

test('verify github search input accessibility and clear button', async ({ page }) => {
  // Go to test page
  await page.goto('http://localhost:5173/test-palette');

  // Debug
  console.log('Page Title:', await page.title());

  // Wait explicitly
  await page.waitForTimeout(1000);

  // The GitHubSearchInput is inside a form
  const input = page.locator('form input').first();
  await expect(input).toBeVisible();

  // Check initial ARIA attributes
  await expect(input).toHaveAttribute('role', 'combobox');
  await expect(input).toHaveAttribute('aria-expanded', 'false');
  await expect(input).toHaveAttribute('aria-label', 'Search repositories (e.g., facebook/react)');

  // Type something
  await input.fill('react');

  // Verify Clear button appears
  const clearButton = page.getByLabel('Clear search');
  await expect(clearButton).toBeVisible();

  // Take screenshot of input with text and clear button
  await page.screenshot({ path: 'verification_capture.png' });

  // Click clear button
  await clearButton.click();

  // Verify input is empty
  await expect(input).toHaveValue('');

  // Verify Clear button disappears
  await expect(clearButton).toBeHidden();
});

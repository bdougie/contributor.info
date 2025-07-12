import { test, expect } from '@playwright/test';

test.describe('Critical User Flows', () => {
  test('homepage loads', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('input')).toBeVisible();
  });
});
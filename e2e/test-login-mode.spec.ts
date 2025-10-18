import { test, expect } from '@playwright/test';

test('login page renders test mode with email/password fields', async ({ page }) => {
  // Set test mode environment
  process.env.VITE_SUPABASE_URL = 'http://localhost:54321';

  await page.goto('/login');

  // Check for email and password inputs
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 5000 });

  // Check for test mode indicator
  await expect(page.getByText('Test mode active')).toBeVisible();

  // Try filling the fields
  await page.fill('input[type="email"]', 'test-owner@example.com');
  await page.fill('input[type="password"]', 'test-password-123');

  // Verify the button exists
  await expect(page.getByRole('button', { name: /test login/i })).toBeVisible();
});

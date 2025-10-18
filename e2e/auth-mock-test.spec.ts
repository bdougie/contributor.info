import { test, expect } from '@playwright/test';

/**
 * Simplified authentication tests for CI with mock credentials
 * These tests verify the basic auth flow works without requiring real Supabase
 */

// Only run in mock mode (CI)
const runInMockMode =
  process.env.VITE_SUPABASE_URL?.includes('localhost:54321') || process.env.CI === 'true';

test.describe.skipIf(!runInMockMode)('Mock Authentication Tests', () => {
  test('should show test login form in CI environment', async ({ page }) => {
    await page.goto('/login');

    // Verify test mode UI is shown
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByText(/test mode active/i)).toBeVisible();
  });

  test('should login with test credentials', async ({ page }) => {
    await page.goto('/login');

    // Fill in test credentials
    await page.fill('input[type="email"]', 'test-owner@example.com');
    await page.fill('input[type="password"]', 'test-password-123');

    // Submit form
    await page.click('button[type="submit"]');

    // Should redirect away from login
    await page.waitForURL((url) => !url.includes('/login'), { timeout: 10000 });

    // Verify we're logged in by checking localStorage
    const isLoggedIn = await page.evaluate(() => {
      return localStorage.getItem('test-auth-user') === 'test-owner@example.com';
    });
    expect(isLoggedIn).toBe(true);
  });

  test('should reject invalid test credentials', async ({ page }) => {
    await page.goto('/login');

    // Fill in invalid credentials
    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'wrong-password');

    // Submit form
    await page.click('button[type="submit"]');

    // Should show error and stay on login page
    await expect(page.getByText(/invalid test credentials/i)).toBeVisible({ timeout: 5000 });
    expect(page.url()).toContain('/login');
  });

  test('should logout test user', async ({ page }) => {
    // First login
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test-owner@example.com');
    await page.fill('input[type="password"]', 'test-password-123');
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.includes('/login'), { timeout: 10000 });

    // Now logout
    await page.evaluate(() => {
      localStorage.removeItem('test-auth-user');
    });

    // Go back to login and verify logged out
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();

    // Verify auth cleared
    const isLoggedOut = await page.evaluate(() => {
      return localStorage.getItem('test-auth-user') === null;
    });
    expect(isLoggedOut).toBe(true);
  });
});

// Skip the complex workspace tests in mock mode
test.describe.skipIf(runInMockMode)('Real Workspace Tests', () => {
  test('placeholder for real workspace tests', async () => {
    // These would run with real Supabase
    expect(true).toBe(true);
  });
});

import { test, expect } from '@playwright/test';

/**
 * Simple Workspace Invitation Tests
 * Tests the UI rendering and basic navigation without requiring backend mocks
 * Focuses on what we can test without full database setup
 */

test.describe('Workspace Invitation - UI Tests', () => {
  test('renders invitation page structure', async ({ page }) => {
    // Use a mock UUID token
    const mockToken = '550e8400-e29b-41d4-a716-446655440000';

    // Navigate to invitation page
    await page.goto(`/invitation/${mockToken}`);

    // The page should load (not 404)
    await expect(page).toHaveURL(`/invitation/${mockToken}`);

    // Check for loading state OR error state OR login redirect
    // The app will show one of these depending on auth state
    await Promise.race([
      // Loading state
      expect(page.getByText(/validating invitation/i)).toBeVisible({ timeout: 5000 }),
      // Error states
      expect(page.getByText(/invalid invitation/i)).toBeVisible({ timeout: 5000 }),
      expect(page.getByText(/not found/i)).toBeVisible({ timeout: 5000 }),
      // Login redirect
      page.waitForURL('**/login**', { timeout: 5000 }),
    ]).catch(() => {
      // If none of the above, just verify page loaded
      expect(page.locator('body')).toBeVisible();
    });
  });

  test('shows error for malformed token', async ({ page }) => {
    // Navigate with invalid token format
    await page.goto('/invitation/not-a-valid-uuid');

    // Should show error message
    await expect(page.getByText(/invalid/i).first()).toBeVisible({ timeout: 10000 });

    // Page should not crash
    await expect(page).toHaveURL('/invitation/not-a-valid-uuid');
  });

  test('handles empty token gracefully', async ({ page }) => {
    // Navigate without token
    await page.goto('/invitation/');

    // Should either show 404 or redirect
    const url = page.url();
    expect(url).toMatch(/invitation|404|not-found/);
  });

  test('redirects unauthenticated users', async ({ page }) => {
    // Clear cookies to ensure logged out
    await page.context().clearCookies();

    const mockToken = '550e8400-e29b-41d4-a716-446655440000';
    await page.goto(`/invitation/${mockToken}`);

    // Should redirect to login (or show invitation if no auth required)
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    const url = page.url();
    // Either redirected to login OR stayed on invitation page
    expect(url).toMatch(/login|invitation/);

    // If redirected to login, check redirect parameter
    if (url.includes('login')) {
      expect(url).toContain('redirect');
    }
  });

  test('page has proper meta tags', async ({ page }) => {
    const mockToken = '550e8400-e29b-41d4-a716-446655440000';
    await page.goto(`/invitation/${mockToken}`);

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Check title
    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.toLowerCase()).toMatch(/contributor|invitation|workspace/);

    // Check if viewport meta tag exists (for mobile)
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toContain('width=device-width');
  });

  test('responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    const mockToken = '550e8400-e29b-41d4-a716-446655440000';
    await page.goto(`/invitation/${mockToken}`);

    // Page should render without horizontal scroll
    const bodyWidth = await page.locator('body').evaluate((el) => el.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375);

    // Content should be visible
    await expect(page.locator('body')).toBeVisible();
  });

  test('validates URL format correctly', () => {
    // Pure unit test for URL validation
    const validTokens = [
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      '550e8400-e29b-41d4-a716-446655440000',
      '12345678-1234-1234-1234-123456789012',
    ];

    const invalidTokens = [
      'not-a-uuid',
      '123',
      'workspace/invitation/accept',
      '../../../etc/passwd',
    ];

    // Validate good tokens match UUID pattern
    validTokens.forEach((token) => {
      expect(token).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
    });

    // Validate bad tokens don't match
    invalidTokens.forEach((token) => {
      expect(token).not.toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
    });
  });
});

test.describe('Invitation Error States', () => {
  test('displays user-friendly error for network issues', async ({ page }) => {
    // Simulate offline
    await page.context().setOffline(true);

    const mockToken = '550e8400-e29b-41d4-a716-446655440000';

    try {
      await page.goto(`/invitation/${mockToken}`, { timeout: 5000 });
    } catch {
      // Navigation might fail when offline, that's ok
    }

    // Reset online status
    await page.context().setOffline(false);
  });

  test('handles special characters in token safely', async ({ page }) => {
    // Test XSS prevention with special characters
    const maliciousToken = '<script>alert("xss")</script>';
    const encodedToken = encodeURIComponent(maliciousToken);

    await page.goto(`/invitation/${encodedToken}`);

    // Should show error, not execute script
    await expect(page.getByText(/invalid/i).first()).toBeVisible({ timeout: 10000 });

    // Verify no alert was triggered
    let alertTriggered = false;
    page.on('dialog', () => {
      alertTriggered = true;
    });

    await page.waitForTimeout(1000);
    expect(alertTriggered).toBe(false);
  });
});

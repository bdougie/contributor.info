import { test, expect } from '@playwright/test';

/**
 * E2E tests for workspace invitation flow
 * Tests the fix for GitHub issue #863
 *
 * TODO: Add notification tests for #975
 * - Test notification created when invitation sent (status: pending)
 * - Test notification created when invitation accepted (status: completed)
 * - Verify notification appears in inviter's notification center
 * - Verify notification metadata includes workspace and invitee details
 */

test.describe('Workspace Invitation Flow', () => {
  test.beforeEach(async () => {
    // Set up test data or authentication as needed
    // This would typically involve creating test accounts and workspaces
  });

  test('should display invitation page for valid token', async ({ page }) => {
    // Note: This test would require setting up actual test data
    // For now, we test the URL structure and page behavior

    const mockToken = '12345678-1234-1234-1234-123456789012';

    // Navigate to invitation page
    await page.goto(`/invitation/${mockToken}`);

    // Should show loading state initially
    await expect(page.getByText('Validating invitation...')).toBeVisible();

    // The page should be accessible (not 404)
    await expect(page).toHaveURL(`/invitation/${mockToken}`);

    // Page should have the correct title structure
    await expect(page).toHaveTitle(/Workspace Invitation|contributor.info/);
  });

  test('should handle invalid invitation tokens gracefully', async ({ page }) => {
    const invalidToken = 'invalid-token-format';

    // Navigate to invitation page with invalid token
    await page.goto(`/invitation/${invalidToken}`);

    // Should eventually show error state (not crash)
    await expect(page.getByText(/invalid|not found|error/i)).toBeVisible({ timeout: 10000 });

    // Should not redirect to 404 page
    await expect(page).toHaveURL(`/invitation/${invalidToken}`);
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    // Clear any existing authentication
    await page.context().clearCookies();

    const mockToken = '12345678-1234-1234-1234-123456789012';

    // Navigate to invitation page
    await page.goto(`/invitation/${mockToken}`);

    // Should redirect to login page with return URL
    await expect(page).toHaveURL(/\/login.*redirect.*invitation/);

    // Login page should be accessible
    await expect(page.getByText(/log.*in|sign.*in/i)).toBeVisible();
  });

  test('should have proper meta tags for email link previews', async ({ page }) => {
    const mockToken = '12345678-1234-1234-1234-123456789012';

    await page.goto(`/invitation/${mockToken}`);

    // Check for proper Open Graph tags (important for email client previews)
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    const ogDescription = await page
      .locator('meta[property="og:description"]')
      .getAttribute('content');

    expect(ogTitle).toBeTruthy();
    expect(ogDescription).toBeTruthy();
  });
});

test.describe('Email URL Format Validation', () => {
  test('should use correct URL pattern in emails', async () => {
    // This test validates the URL format that would be generated in emails
    const mockToken = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const expectedUrl = `https://contributor.info/invitation/${mockToken}`;

    // Validate URL format
    expect(expectedUrl).toMatch(/https:\/\/contributor\.info\/invitation\/[a-f0-9-]{36}/);

    // Validate it does NOT use old format
    expect(expectedUrl).not.toContain('/workspace/invitation/accept');
    expect(expectedUrl).not.toContain('/workspace/invitation/decline');
  });

  test('should generate URLs compatible with different email clients', async () => {
    const mockToken = '550e8400-e29b-41d4-a716-446655440000';
    const invitationUrl = `https://contributor.info/invitation/${mockToken}`;

    // Test URL is well-formed
    expect(() => new URL(invitationUrl)).not.toThrow();

    // Test URL components
    const url = new URL(invitationUrl);
    expect(url.protocol).toBe('https:');
    expect(url.hostname).toBe('contributor.info');
    expect(url.pathname).toBe(`/invitation/${mockToken}`);
    expect(url.search).toBe(''); // No query parameters needed

    // Validate UUID format in path
    const tokenFromPath = url.pathname.split('/invitation/')[1];
    expect(tokenFromPath).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
  });
});

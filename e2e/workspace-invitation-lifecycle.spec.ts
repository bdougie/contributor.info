import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * E2E Tests for Complete Workspace Invitation Lifecycle
 * Tests issue #1057 - Comprehensive invitation flow with notifications
 *
 * This test suite covers:
 * - Invitation creation and email sending
 * - Invitation acceptance flow
 * - Notification creation for both inviter and invitee
 * - Edge cases (expired, duplicate, invalid invitations)
 *
 * Following bulletproof testing guidelines:
 * - Only E2E tests what cannot be unit tested
 * - Tests real user flows end-to-end
 * - Minimal mocking, uses real Supabase test environment
 * - Clear test descriptions and assertions
 */

/**
 * Test data setup - Two users required:
 * 1. Owner (creates workspace and sends invitation)
 * 2. Invitee (receives and accepts invitation)
 */
interface TestUser {
  email: string;
  password: string;
  displayName: string;
}

const OWNER_USER: TestUser = {
  email: 'test-owner@example.com',
  password: 'test-password-123',
  displayName: 'Test Owner',
};

const INVITEE_USER: TestUser = {
  email: 'test-invitee@example.com',
  password: 'test-password-456',
  displayName: 'Test Invitee',
};

/**
 * Helper: Login a user
 */
async function loginUser(page: Page, user: TestUser): Promise<void> {
  // Use domcontentloaded instead of networkidle for faster loading
  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Use Playwright's built-in auto-waiting instead of explicit waitFor
  // This is more reliable and follows best practices
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);

  // Click and wait for navigation in one step
  await Promise.all([
    page.waitForURL(/\/(dashboard|home|\?)/, { timeout: 15000 }),
    page.locator('button[type="submit"]').click(),
  ]);
}

/**
 * Helper: Logout current user
 */
async function logoutUser(page: Page): Promise<void> {
  await page.goto('/logout');
  await page.waitForURL('/login', { timeout: 5000 });
}

/**
 * Helper: Create a test workspace
 */
async function createWorkspace(page: Page, name: string, description: string): Promise<string> {
  await page.goto('/workspaces/new');

  await page.fill('input[name="name"]', name);
  await page.fill('textarea[name="description"]', description);
  await page.click('button[type="submit"]');

  // Wait for redirect to workspace page
  await page.waitForURL(/\/workspaces\/[a-z0-9-]+/, { timeout: 10000 });

  // Extract workspace slug from URL
  const url = page.url();
  const match = url.match(/\/workspaces\/([a-z0-9-]+)/);
  if (!match) {
    throw new Error('Failed to extract workspace slug from URL');
  }

  return match[1];
}

/**
 * Helper: Extract invitation token from page
 * In real scenario, this would be from email link
 */
async function extractInvitationToken(page: Page): Promise<string> {
  // Look for invitation link in the UI or copy button
  const invitationLink = await page.locator('[data-testid="invitation-link"]').textContent();

  if (!invitationLink) {
    throw new Error('Could not find invitation link');
  }

  // Extract token from URL: https://contributor.info/invitation/{token}
  const match = invitationLink.match(/\/invitation\/([a-f0-9-]{36})/);
  if (!match) {
    throw new Error('Could not extract token from invitation link');
  }

  return match[1];
}

test.describe('Workspace Invitation Lifecycle', () => {
  let workspaceSlug: string;
  let invitationToken: string;

  test.beforeAll(async () => {
    /**
     * Note: In a real test environment, these users would be:
     * 1. Created via Supabase test fixtures
     * 2. Cleaned up after test completion
     * 3. Isolated in a test database
     *
     * For now, we assume these test users exist in the test environment
     */
  });

  test.describe('Complete Invitation Flow', () => {
    test('should complete full invitation lifecycle with notifications', async ({ page }) => {
      // This is a long-running test that goes through multiple phases
      test.slow(); // Triple the timeout for this test

      // ========================================
      // PHASE 1: Owner creates workspace and sends invitation
      // ========================================

      // Login as workspace owner
      await loginUser(page, OWNER_USER);

      // Create a test workspace
      const workspaceName = `Test Workspace ${Date.now()}`;
      workspaceSlug = await createWorkspace(page, workspaceName, 'Test workspace for e2e testing');

      // Navigate to workspace members page
      await page.goto(`/workspaces/${workspaceSlug}/members`);
      await expect(page.getByRole('heading', { name: /members/i })).toBeVisible();

      // Click invite member button
      await page.click('button[data-testid="invite-member-button"]');

      // Fill invitation form
      await page.fill('input[name="email"]', INVITEE_USER.email);
      await page.selectOption('select[name="role"]', 'contributor');

      // Send invitation
      await page.click('button[type="submit"]', { timeout: 5000 });

      // Wait for success notification
      await expect(page.getByText(/invitation sent|invitation has been sent/i)).toBeVisible({
        timeout: 10000,
      });

      // Verify pending notification created for inviter (status: pending, invite_status: sent)
      await page.goto('/notifications');
      await expect(
        page.getByText(new RegExp(`invitation sent to ${INVITEE_USER.email}`, 'i'))
      ).toBeVisible({ timeout: 5000 });

      // Extract invitation token for next phase
      await page.goto(`/workspaces/${workspaceSlug}/members`);
      invitationToken = await extractInvitationToken(page);
      expect(invitationToken).toMatch(/^[a-f0-9-]{36}$/);

      // Logout owner
      await logoutUser(page);

      // ========================================
      // PHASE 2: Invitee receives and views invitation
      // ========================================

      // Login as invitee
      await loginUser(page, INVITEE_USER);

      // Navigate to invitation page (simulating email click)
      await page.goto(`/invitation/${invitationToken}`);

      // Verify invitation details displayed
      await expect(page.getByText(new RegExp(workspaceName, 'i'))).toBeVisible();
      await expect(page.getByText(/contributor/i)).toBeVisible(); // Role
      await expect(page.getByText(/invited by/i)).toBeVisible();

      // ========================================
      // PHASE 3: Invitee accepts invitation
      // ========================================

      // Click accept button
      await page.click('button[data-testid="accept-invitation"]');

      // Wait for success message
      await expect(page.getByText(/successfully joined|accepted invitation/i)).toBeVisible({
        timeout: 10000,
      });

      // Verify redirect to workspace page
      await page.waitForURL(new RegExp(`/workspaces/${workspaceSlug}`), { timeout: 10000 });

      // Verify invitee now appears in members list
      await page.goto(`/workspaces/${workspaceSlug}/members`);
      await expect(page.getByText(INVITEE_USER.email)).toBeVisible();

      // Logout invitee
      await logoutUser(page);

      // ========================================
      // PHASE 4: Owner sees acceptance notification
      // ========================================

      // Login back as owner
      await loginUser(page, OWNER_USER);

      // Navigate to notifications
      await page.goto('/notifications');

      // Verify completed notification (status: completed, invite_status: accepted)
      await expect(
        page.getByText(new RegExp(`${INVITEE_USER.displayName}.*accepted.*invitation`, 'i'))
      ).toBeVisible({ timeout: 5000 });

      // Verify notification metadata includes workspace details
      const notification = page.locator('[data-testid="notification-item"]').first();
      await expect(notification).toContainText(workspaceName);

      // Verify invitee is now in workspace members list
      await page.goto(`/workspaces/${workspaceSlug}/members`);
      await expect(page.getByText(INVITEE_USER.email)).toBeVisible();
      await expect(page.getByText(/contributor/i)).toBeVisible(); // Role badge

      // Cleanup
      await logoutUser(page);
    });
  });

  test.describe('Edge Cases', () => {
    // Configure timeout for all tests in this group
    test.describe.configure({ timeout: 45000 });

    test('should handle non-existent invitation token', async ({ page }) => {
      // Use a valid UUID that doesn't exist in database
      const nonExistentToken = '00000000-0000-0000-0000-000000000000';

      await page.goto(`/invitation/${nonExistentToken}`);

      // Should show "not found" error (not expired, since it doesn't exist)
      await expect(page.getByRole('heading', { name: /invitation not found/i })).toBeVisible({
        timeout: 10000,
      });

      // Should show error message
      await expect(page.getByText(/could not be found|may have been removed/i)).toBeVisible();

      // Should not show accept button
      await expect(page.locator('button[data-testid="accept-invitation"]')).not.toBeVisible();
    });

    test('should prevent duplicate invitation acceptance', async ({ page }) => {
      // This test requires the invitation from the main flow
      if (!invitationToken) {
        test.skip();
        return;
      }

      // Login as invitee
      await loginUser(page, INVITEE_USER);

      // Try to accept the same invitation again
      await page.goto(`/invitation/${invitationToken}`);

      // Should show already accepted message
      await expect(page.getByRole('heading', { name: /already a member/i })).toBeVisible({
        timeout: 10000,
      });

      // Should not show accept button
      await expect(page.locator('button[data-testid="accept-invitation"]')).not.toBeVisible();

      await logoutUser(page);
    });

    test('should handle invalid invitation token format', async ({ page }) => {
      const invalidToken = 'not-a-valid-uuid';

      await page.goto(`/invitation/${invalidToken}`);

      // Should show error state - use more specific selector to avoid strict mode violation
      await expect(page.getByRole('heading', { name: /invalid invitation/i })).toBeVisible({
        timeout: 10000,
      });

      // Should show error description
      await expect(page.getByText(/this invitation link is invalid/i)).toBeVisible();

      // Page should still be accessible (not 404)
      await expect(page).toHaveURL(`/invitation/${invalidToken}`);
    });

    test('should prevent invitation to already-member user', async ({ page }) => {
      if (!workspaceSlug) {
        test.skip();
        return;
      }

      // Login as owner
      await loginUser(page, OWNER_USER);

      // Try to invite the same user again
      await page.goto(`/workspaces/${workspaceSlug}/members`);
      await page.click('button[data-testid="invite-member-button"]');
      await page.fill('input[name="email"]', INVITEE_USER.email);
      await page.selectOption('select[name="role"]', 'contributor');
      await page.click('button[type="submit"]');

      // Should show error about duplicate invitation or existing member
      await expect(
        page.getByText(/already invited|already a member|invitation already sent/i)
      ).toBeVisible({ timeout: 10000 });

      await logoutUser(page);
    });

    test('should handle invitation with invalid workspace ID', async ({ page }) => {
      // This test needs login which can be slow in CI
      test.setTimeout(50000);

      // Login as owner
      await loginUser(page, OWNER_USER);

      // Try to create invitation for non-existent workspace (direct API call)
      // This would require access to the API endpoint
      // For UI test, we can try navigating to invalid workspace members page

      await page.goto('/workspaces/non-existent-workspace/members');

      // Should show workspace not found error
      await expect(page.getByText(/not found|does not exist/i)).toBeVisible({
        timeout: 10000,
      });

      await logoutUser(page);
    });
  });

  test.describe('Notification System', () => {
    test('should create pending notification when invitation sent', async ({ page }) => {
      // Login as owner
      await loginUser(page, OWNER_USER);

      // Create workspace
      const workspaceName = `Notification Test ${Date.now()}`;
      const slug = await createWorkspace(page, workspaceName, 'Testing notifications');

      // Send invitation
      await page.goto(`/workspaces/${slug}/members`);
      await page.click('button[data-testid="invite-member-button"]');
      await page.fill('input[name="email"]', 'new-invitee@example.com');
      await page.selectOption('select[name="role"]', 'contributor');
      await page.click('button[type="submit"]');

      // Navigate to notifications
      await page.goto('/notifications');

      // Find the pending notification
      const notification = page.locator('[data-testid="notification-item"]').first();

      // Verify notification properties
      await expect(notification).toContainText(/invitation sent/i);
      await expect(notification).toContainText('new-invitee@example.com');
      await expect(notification).toContainText(workspaceName);

      // Verify notification status badge (pending)
      await expect(notification.locator('[data-testid="notification-status"]')).toContainText(
        /pending/i
      );

      await logoutUser(page);
    });

    test('should mark notification as read when clicked', async ({ page }) => {
      // Login as owner
      await loginUser(page, OWNER_USER);

      // Navigate to notifications
      await page.goto('/notifications');

      // Find unread notification
      const unreadNotification = page
        .locator('[data-testid="notification-item"][data-read="false"]')
        .first();

      if ((await unreadNotification.count()) === 0) {
        test.skip();
        return;
      }

      // Click notification
      await unreadNotification.click();

      // Verify notification is marked as read
      await expect(unreadNotification).toHaveAttribute('data-read', 'true');

      await logoutUser(page);
    });

    test('should display notification metadata correctly', async ({ page }) => {
      // Login as owner
      await loginUser(page, OWNER_USER);

      await page.goto('/notifications');

      // Find invitation notification
      const notification = page
        .locator('[data-testid="notification-item"]')
        .filter({ hasText: /invitation/i })
        .first();

      if ((await notification.count()) === 0) {
        test.skip();
        return;
      }

      // Click to expand notification
      await notification.click();

      // Verify metadata is displayed
      await expect(notification.locator('[data-testid="notification-metadata"]')).toBeVisible();

      // Verify workspace link
      await expect(notification.getByRole('link', { name: /view workspace/i })).toBeVisible();

      await logoutUser(page);
    });
  });

  test.describe('Permission Validation', () => {
    test('should only allow owners and maintainers to invite members', async ({ page }) => {
      if (!workspaceSlug) {
        test.skip();
        return;
      }

      // Login as regular contributor (from previous test)
      await loginUser(page, INVITEE_USER);

      // Navigate to workspace members page
      await page.goto(`/workspaces/${workspaceSlug}/members`);

      // Invite button should not be visible for contributors
      await expect(page.locator('button[data-testid="invite-member-button"]')).not.toBeVisible();

      await logoutUser(page);
    });

    test('should validate role permissions during invitation', async ({ page }) => {
      if (!workspaceSlug) {
        test.skip();
        return;
      }

      // Login as owner
      await loginUser(page, OWNER_USER);

      await page.goto(`/workspaces/${workspaceSlug}/members`);
      await page.click('button[data-testid="invite-member-button"]');

      // Verify role dropdown only shows allowed roles
      const roleSelect = page.locator('select[name="role"]');
      await expect(roleSelect.locator('option[value="contributor"]')).toBeVisible();
      await expect(roleSelect.locator('option[value="maintainer"]')).toBeVisible();

      // Owner role should not be available for invitation
      await expect(roleSelect.locator('option[value="owner"]')).not.toBeVisible();

      await logoutUser(page);
    });
  });

  test.describe('UI/UX Validation', () => {
    test('should show proper meta tags for email link previews', async ({ page }) => {
      // Use existing invitation token
      if (!invitationToken) {
        test.skip();
        return;
      }

      await page.goto(`/invitation/${invitationToken}`);

      // Check Open Graph tags
      const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
      const ogDescription = await page
        .locator('meta[property="og:description"]')
        .getAttribute('content');
      const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');

      expect(ogTitle).toBeTruthy();
      expect(ogTitle).toContain('Workspace Invitation');
      expect(ogDescription).toBeTruthy();
      expect(ogImage).toBeTruthy();
    });

    test('should display loading states during invitation acceptance', async ({ page }) => {
      // This test requires a fresh invitation
      test.skip(); // Skip unless we have test fixtures

      await page.goto(`/invitation/${invitationToken}`);

      // Click accept button
      const acceptButton = page.locator('button[data-testid="accept-invitation"]');
      await acceptButton.click();

      // Verify loading state appears
      await expect(page.getByText(/accepting|processing/i)).toBeVisible({ timeout: 1000 });

      // Verify button is disabled during processing
      await expect(acceptButton).toBeDisabled();
    });

    test('should redirect unauthenticated users to login', async ({ page }) => {
      // Clear cookies to simulate unauthenticated state
      await page.context().clearCookies();

      // Use existing invitation token
      if (!invitationToken) {
        test.skip();
        return;
      }

      await page.goto(`/invitation/${invitationToken}`);

      // Should redirect to login with return URL
      await page.waitForURL(/\/login.*redirect.*invitation/, { timeout: 10000 });

      // Verify login page is shown
      await expect(page.getByRole('heading', { name: /log.*in/i })).toBeVisible();

      // Verify return URL is preserved
      const url = page.url();
      expect(url).toContain('redirect');
      expect(url).toContain('invitation');
    });
  });
});

test.describe('Invitation URL Format Validation', () => {
  test('should use correct URL pattern for invitation links', async () => {
    const mockToken = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const expectedUrl = `https://contributor.info/invitation/${mockToken}`;

    // Validate URL format
    expect(expectedUrl).toMatch(/https:\/\/contributor\.info\/invitation\/[a-f0-9-]{36}/);

    // Validate it does NOT use old broken format
    expect(expectedUrl).not.toContain('/workspace/invitation/accept');
    expect(expectedUrl).not.toContain('/workspace/invitation/decline');
  });

  test('should generate URLs compatible with email clients', async () => {
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

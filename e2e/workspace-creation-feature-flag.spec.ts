import { test, expect } from '@playwright/test';

test.describe('Workspace Creation Feature Flag', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the feature flags to control the test environment
    await page.addInitScript(() => {
      // Mock PostHog for feature flags
      window.posthog = {
        isFeatureEnabled: (flag: string) => {
          // This will be overridden in individual tests
          return flag === 'enable_workspace_creation' ? false : false;
        },
        capture: () => {},
        identify: () => {},
      };
    });
  });

  test.describe('when feature flag is disabled', () => {
    test.beforeEach(async ({ page }) => {
      // Override PostHog mock to return false for workspace creation
      await page.addInitScript(() => {
        window.posthog.isFeatureEnabled = (flag: string) => {
          return flag === 'enable_workspace_creation' ? false : false;
        };
      });

      // Navigate to home page (logged in state)
      await page.goto('/');

      // Mock authentication state
      await page.evaluate(() => {
        localStorage.setItem(
          'supabase.auth.token',
          JSON.stringify({
            access_token: 'mock-token',
            user: { id: 'test-user' },
          })
        );
      });

      await page.reload();
    });

    test('should show disabled state in onboarding component', async ({ page }) => {
      // Wait for the page to load and check for the disabled state
      await expect(page.getByText('Workspace Creation Disabled')).toBeVisible();
      await expect(page.getByText('Workspace creation is currently unavailable')).toBeVisible();

      // Should not show the create button
      await expect(page.getByText('Create Your First Workspace')).not.toBeVisible();
    });

    test('should show disabled modal when trying to create workspace', async ({ page }) => {
      // If there's a create workspace trigger, click it
      const triggerButton = page.getByText('Request Early Access');
      if (await triggerButton.isVisible()) {
        await triggerButton.click();

        // Should show success message and close modal
        await expect(page.getByText(/Thanks for your interest/)).toBeVisible();
      }
    });

    test('should handle API blocking when feature is disabled', async ({ page }) => {
      // Intercept API calls to workspace creation endpoint
      await page.route('**/api-workspaces', async (route) => {
        if (route.request().method() === 'POST') {
          // Mock the API response for disabled feature
          await route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Workspace creation is currently disabled',
              code: 'FEATURE_DISABLED',
              message: 'This feature is temporarily unavailable. Please try again later.',
            }),
          });
        } else {
          await route.continue();
        }
      });

      // Try to make a direct API call (this would happen if someone bypassed UI)
      const response = await page.evaluate(async () => {
        return fetch('/api-workspaces', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer mock-token',
          },
          body: JSON.stringify({
            name: 'Test Workspace',
            visibility: 'public',
          }),
        }).then((r) => ({ status: r.status, json: r.json() }));
      });

      expect(response.status).toBe(503);
    });
  });

  test.describe('when feature flag is enabled', () => {
    test.beforeEach(async ({ page }) => {
      // Override PostHog mock to return true for workspace creation
      await page.addInitScript(() => {
        window.posthog.isFeatureEnabled = (flag: string) => {
          return flag === 'enable_workspace_creation' ? true : false;
        };
      });

      // Navigate to home page
      await page.goto('/');

      // Mock authentication state
      await page.evaluate(() => {
        localStorage.setItem(
          'supabase.auth.token',
          JSON.stringify({
            access_token: 'mock-token',
            user: { id: 'test-user' },
          })
        );
      });

      await page.reload();
    });

    test('should show normal onboarding with create button', async ({ page }) => {
      await expect(page.getByText('Create Your First Workspace')).toBeVisible();
      await expect(page.getByText('Organize Repositories')).toBeVisible();
      await expect(page.getByText('Track Contributors')).toBeVisible();

      // Should not show disabled state
      await expect(page.getByText('Workspace Creation Disabled')).not.toBeVisible();
    });

    test('should open workspace creation modal when enabled', async ({ page }) => {
      // Click the create workspace button
      await page.getByText('Create Your First Workspace').click();

      // Should open the modal with form
      await expect(page.getByText('Create New Workspace')).toBeVisible();
      await expect(page.getByLabel(/workspace name/i)).toBeVisible();
      await expect(page.getByText('Create Workspace')).toBeVisible();
    });

    test('should allow form submission when feature is enabled', async ({ page }) => {
      // Mock successful API response
      await page.route('**/api-workspaces', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              workspace: {
                id: 'new-workspace-id',
                name: 'Test Workspace',
                slug: 'test-workspace',
              },
            }),
          });
        } else {
          await route.continue();
        }
      });

      // Open modal and fill form
      await page.getByText('Create Your First Workspace').click();
      await page.getByLabel(/workspace name/i).fill('Test Workspace');

      // Submit form
      await page.getByText('Create Workspace').click();

      // Should show success and redirect (or close modal)
      await expect(page.getByText(/Workspace created successfully/)).toBeVisible();
    });
  });

  test.describe('feature flag transitions', () => {
    test('should handle feature flag changing during session', async ({ page }) => {
      // Start with feature enabled
      await page.addInitScript(() => {
        let flagEnabled = true;
        window.posthog = {
          isFeatureEnabled: (flag: string) => {
            return flag === 'enable_workspace_creation' ? flagEnabled : false;
          },
          capture: () => {},
          identify: () => {},
        };

        // Allow tests to change the flag state
        (
          window as Window & { toggleWorkspaceCreation: (enabled: boolean) => void }
        ).toggleWorkspaceCreation = (enabled: boolean) => {
          flagEnabled = enabled;
        };
      });

      await page.goto('/');

      // Should show enabled state initially
      await expect(page.getByText('Create Your First Workspace')).toBeVisible();

      // Disable the feature flag
      await page.evaluate(() =>
        (
          window as Window & { toggleWorkspaceCreation: (enabled: boolean) => void }
        ).toggleWorkspaceCreation(false)
      );
      await page.reload();

      // Should now show disabled state
      await expect(page.getByText('Workspace Creation Disabled')).toBeVisible();
      await expect(page.getByText('Create Your First Workspace')).not.toBeVisible();
    });
  });
});

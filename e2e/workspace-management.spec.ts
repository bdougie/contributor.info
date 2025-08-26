import { test, expect } from '@playwright/test';

// Mock user for testing (currently not used in tests but may be needed for future auth tests)
// const testUser = {
//   email: 'test@example.com',
//   password: 'TestPassword123!'
// };

test.describe('Workspace Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Mock authentication - adjust based on your auth implementation
    // This assumes you have a way to mock auth in test environment
    await page.evaluate(() => {
      localStorage.setItem('test-auth', 'true');
      localStorage.setItem('test-user', JSON.stringify({
        id: 'test-user-id',
        email: 'test@example.com',
        tier: 'free'
      }));
    });
  });

  test('should create a new workspace', async ({ page }) => {
    // Navigate to dashboard/workspaces
    await page.goto('/dashboard');
    
    // Click on create workspace button
    await page.click('button:has-text("Create Workspace")');
    
    // Wait for modal to appear
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    
    // Fill in workspace details
    await page.fill('input[name="name"]', 'Test Workspace');
    await page.fill('textarea[name="description"]', 'This is a test workspace for E2E testing');
    
    // Select visibility
    await page.click('button[role="combobox"]');
    await page.click('text=Public');
    
    // Submit the form
    await page.click('button:has-text("Create")');
    
    // Wait for success message
    await expect(page.locator('text=Workspace created successfully')).toBeVisible();
    
    // Verify redirect to new workspace
    await expect(page).toHaveURL(/\/i\/[a-zA-Z0-9-]+/);
    
    // Verify workspace details are displayed
    await expect(page.locator('h1:has-text("Test Workspace")')).toBeVisible();
    await expect(page.locator('text=This is a test workspace for E2E testing')).toBeVisible();
  });

  test('should enforce free tier repository limit', async ({ page }) => {
    // Navigate to existing workspace
    await page.goto('/i/test-workspace');
    
    // Open add repository modal
    await page.click('button:has-text("Add Repository")');
    
    // Wait for modal
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    
    // Verify free tier message is shown
    await expect(page.locator('text=/Free tier is limited to \\d+ repositories/')).toBeVisible();
    
    // Verify repository slots display
    await expect(page.locator('text=Repository Slots:')).toBeVisible();
    await expect(page.locator('text=/\\d+\\/4/')).toBeVisible(); // Free tier has 4 repos
  });

  test('should add repositories to workspace', async ({ page }) => {
    // Navigate to workspace
    await page.goto('/i/test-workspace');
    
    // Open add repository modal
    await page.click('button:has-text("Add Repository")');
    
    // Wait for modal
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    
    // Search for repositories
    await page.fill('input[placeholder*="Search"]', 'vercel/next.js');
    
    // Wait for search results
    await page.waitForTimeout(1000); // Wait for debounce
    
    // Select repository from results
    await page.click('text=vercel/next.js >> .. >> button:has-text("Add to Cart")');
    
    // Verify repository is in staging area
    await expect(page.locator('[data-testid="staging-area"] text=vercel/next.js')).toBeVisible();
    
    // Add another repository
    await page.fill('input[placeholder*="Search"]', 'facebook/react');
    await page.waitForTimeout(1000);
    await page.click('text=facebook/react >> .. >> button:has-text("Add to Cart")');
    
    // Verify cart count
    await expect(page.locator('text=Cart (2)')).toBeVisible();
    
    // Add all repositories
    await page.click('button:has-text("Add 2 Repositories")');
    
    // Wait for success message
    await expect(page.locator('text=Successfully added 2 repositories')).toBeVisible();
    
    // Verify repositories appear in workspace
    await expect(page.locator('text=vercel/next.js')).toBeVisible();
    await expect(page.locator('text=facebook/react')).toBeVisible();
  });

  test('should prevent adding more than tier limit', async ({ page }) => {
    // Setup: Navigate to workspace that already has 3 repositories (near free tier limit)
    await page.goto('/i/test-workspace-near-limit');
    
    // Open add repository modal
    await page.click('button:has-text("Add Repository")');
    
    // Search and try to add 2 repositories (which would exceed the limit)
    await page.fill('input[placeholder*="Search"]', 'microsoft/typescript');
    await page.waitForTimeout(1000);
    await page.click('text=microsoft/typescript >> .. >> button:has-text("Add to Cart")');
    
    await page.fill('input[placeholder*="Search"]', 'angular/angular');
    await page.waitForTimeout(1000);
    await page.click('text=angular/angular >> .. >> button:has-text("Add to Cart")');
    
    // Try to add repositories
    await page.click('button:has-text("Add 2 Repositories")');
    
    // Verify error message about exceeding limit
    await expect(page.locator('text=/exceed.*limit|maximum.*reached/i')).toBeVisible();
    
    // Verify the button is disabled or shows warning
    const addButton = page.locator('button:has-text("Add 2 Repositories")');
    await expect(addButton).toHaveAttribute('disabled', '');
  });

  test('should pin and unpin repositories in workspace', async ({ page }) => {
    // Navigate to workspace with repositories
    await page.goto('/i/test-workspace');
    
    // Find a repository row
    const repoRow = page.locator('tr:has-text("vercel/next.js")');
    
    // Click pin button
    await repoRow.locator('button[aria-label*="Pin"]').click();
    
    // Verify repository is pinned (appears at top)
    const firstRow = page.locator('tbody tr').first();
    await expect(firstRow).toContainText('vercel/next.js');
    await expect(firstRow.locator('[data-testid="pinned-indicator"]')).toBeVisible();
    
    // Unpin the repository
    await repoRow.locator('button[aria-label*="Unpin"]').click();
    
    // Verify repository is unpinned
    await expect(repoRow.locator('[data-testid="pinned-indicator"]')).not.toBeVisible();
  });

  test('should remove repository from workspace', async ({ page }) => {
    // Navigate to workspace
    await page.goto('/i/test-workspace');
    
    // Find repository to remove
    const repoRow = page.locator('tr:has-text("vercel/next.js")');
    
    // Click remove button
    await repoRow.locator('button[aria-label*="Remove"]').click();
    
    // Confirm removal in dialog
    await page.click('button:has-text("Confirm")');
    
    // Wait for success message
    await expect(page.locator('text=Repository removed successfully')).toBeVisible();
    
    // Verify repository is no longer in the list
    await expect(page.locator('text=vercel/next.js')).not.toBeVisible();
    
    // Verify repository count updated
    await expect(page.locator('text=/\\d+ repositories?/')).toBeVisible();
  });

  test('should update workspace settings', async ({ page }) => {
    // Navigate to workspace settings
    await page.goto('/i/test-workspace');
    await page.click('button[aria-label="Settings"]');
    
    // Wait for settings panel/page
    await expect(page.locator('text=Workspace Settings')).toBeVisible();
    
    // Update workspace name
    await page.fill('input[name="name"]', 'Updated Workspace Name');
    
    // Update description
    await page.fill('textarea[name="description"]', 'Updated workspace description');
    
    // Change visibility
    await page.click('button[role="combobox"]:has-text("Public")');
    await page.click('text=Private');
    
    // Save changes
    await page.click('button:has-text("Save Changes")');
    
    // Verify success message
    await expect(page.locator('text=Settings updated successfully')).toBeVisible();
    
    // Verify changes are reflected
    await expect(page.locator('h1:has-text("Updated Workspace Name")')).toBeVisible();
    await expect(page.locator('text=Updated workspace description')).toBeVisible();
  });
});
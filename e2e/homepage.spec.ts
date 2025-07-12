import { test, expect } from '@playwright/test';

test.describe('Homepage Search Functionality', () => {
  // Configure longer timeouts for data-heavy repository tests
  test.use({ 
    actionTimeout: 15000,
    navigationTimeout: 30000 
  });

  // Mock heavy operations before each test for faster execution
  test.beforeEach(async ({ page }) => {
    // Mock analytics and progressive capture to speed up tests
    await page.addInitScript(() => {
      window.DISABLE_ANALYTICS = true;
      window.DISABLE_PROGRESSIVE_CAPTURE = true;
    });
  });

  test('search form works - user can search pgvector/pgvector and get routed correctly', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Verify homepage loads correctly
    await expect(page.locator('text=Analyze GitHub Repository Contributors')).toBeVisible();
    
    // Find the search input field
    const searchInput = page.locator('input[placeholder*="Search repositories"]');
    await expect(searchInput).toBeVisible();
    
    // Type the repository name
    await searchInput.fill('pgvector/pgvector');
    
    // Find and click the Analyze button
    const analyzeButton = page.locator('button:has-text("Analyze")');
    await expect(analyzeButton).toBeVisible();
    await analyzeButton.click();
    
    // Wait for navigation and verify we're on the correct repository page
    await expect(page).toHaveURL('/pgvector/pgvector');
    
    // Wait for skeleton loading to finish, then verify content
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=pgvector')).toBeVisible({ timeout: 20000 });
  });

  test('continuedev/continue example link works and routes correctly', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Verify homepage loads correctly
    await expect(page.locator('text=Analyze GitHub Repository Contributors')).toBeVisible();
    
    // Verify the "Popular examples:" section is visible
    await expect(page.locator('text=Popular examples:')).toBeVisible();
    
    // Find and click the continuedev/continue button
    const continueButton = page.locator('button:has-text("continuedev/continue")');
    await expect(continueButton).toBeVisible();
    await continueButton.click();
    
    // Wait for navigation and verify we're on the correct repository page
    await expect(page).toHaveURL('/continuedev/continue');
    
    // Wait for skeleton loading to finish, then verify content
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=continue')).toBeVisible({ timeout: 20000 });
  });

  test('homepage loads and has expected elements', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Verify main heading
    await expect(page.locator('text=Analyze GitHub Repository Contributors')).toBeVisible();
    
    // Verify description
    await expect(page.locator('text=Enter a GitHub repository URL or owner/repo to visualize contribution patterns')).toBeVisible();
    
    // Verify search input exists
    const searchInput = page.locator('input[placeholder*="Search repositories"]');
    await expect(searchInput).toBeVisible();
    
    // Verify Analyze button exists
    const analyzeButton = page.locator('button:has-text("Analyze")');
    await expect(analyzeButton).toBeVisible();
    
    // Verify example repositories section
    await expect(page.locator('text=Popular examples:')).toBeVisible();
    
    // Verify all example repository buttons are present
    const exampleRepos = [
      'continuedev/continue',
      'kubernetes/kubernetes', 
      'facebook/react',
      'etcd-io/etcd',
      'vitejs/vite'
    ];
    
    for (const repo of exampleRepos) {
      await expect(page.locator(`button:has-text("${repo}")`)).toBeVisible();
    }
  });
});
import { test, expect } from '@playwright/test';

test.describe('Homepage Search Functionality', () => {
  // Configure longer timeouts for data-heavy repository tests
  test.use({ 
    actionTimeout: 15000,
    navigationTimeout: 30000 
  });

  // Mock heavy operations before each test for faster execution
  test.beforeEach(async ({ page }) => {
    // Set up error handlers before page loads
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('BROWSER ERROR:', msg.text());
      }
    });
    page.on('pageerror', error => {
      console.log('BROWSER PAGE ERROR:', error.message);
      console.log('BROWSER ERROR STACK:', error.stack);
    });
    
    // Mock analytics and progressive capture to speed up tests
    await page.addInitScript(() => {
      window.DISABLE_ANALYTICS = true;
      window.DISABLE_PROGRESSIVE_CAPTURE = true;
      
      // Mock GitHub API to prevent resource exhaustion
      const originalFetch = window.fetch;
      window.fetch = async (url, options) => {
        if (typeof url === 'string' && (url.includes('api.github.com') || url.includes('github.com'))) {
          // Return minimal successful response for GitHub API calls
          return new Response(JSON.stringify({
            message: 'Mocked in e2e tests',
            total_count: 0,
            items: []
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        // Let other requests through normally
        return originalFetch(url, options);
      };
    });
  });

  test('search form works - user can search pgvector/pgvector and get routed correctly', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for all resources including JS modules to load
    await page.waitForLoadState('networkidle');
    
    // Give React time to mount
    await page.waitForTimeout(2000);
    
    // Add comprehensive debugging in CI
    if (process.env.CI) {
      console.log('=== CI DEBUG START ===');
      console.log('Page URL:', page.url());
      console.log('Page title:', await page.title());
      
      // Check for any unhandled script errors
      const jsErrors = await page.evaluate(() => {
        return window.jsErrors || [];
      });
      console.log('JavaScript errors:', jsErrors);
      
      // Get full page content
      const bodyContent = await page.textContent('body');
      console.log('Body content length:', bodyContent?.length || 0);
      console.log('Body content preview (first 500 chars):', bodyContent?.substring(0, 500) || 'EMPTY');
      
      // Check if React app is mounted
      const reactRoot = await page.locator('#root').textContent();
      console.log('React root content length:', reactRoot?.length || 0);
      
      // Check if main.tsx script loaded
      const scripts = await page.evaluate(() => {
        return Array.from(document.scripts).map(script => ({
          src: script.src,
          type: script.type
        }));
      });
      console.log('Scripts loaded:', scripts);
      
      // Check if React is available
      const reactAvailable = await page.evaluate(() => {
        return typeof window.React !== 'undefined' || document.querySelector('[data-reactroot]') !== null;
      });
      console.log('React available:', reactAvailable);
      
      // Look for specific elements
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').count();
      console.log('Number of headings found:', headings);
      
      if (headings > 0) {
        const headingTexts = await page.locator('h1, h2, h3, h4, h5, h6').allTextContents();
        console.log('Heading texts:', headingTexts);
      }
      
      // Check for buttons
      const buttons = await page.locator('button').count();
      console.log('Number of buttons found:', buttons);
      
      // Take screenshot
      await page.screenshot({ path: 'test-results/homepage-debug.png', fullPage: true });
      console.log('=== CI DEBUG END ===');
    }
    
    // Verify homepage loads correctly with more flexible selector
    await expect(page.locator('h1, h2, h3').filter({ hasText: 'Analyze GitHub Repository Contributors' })).toBeVisible({ timeout: 15000 });
    
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
    
    // Wait for page to fully load
    await page.waitForLoadState('domcontentloaded');
    
    // Verify homepage loads correctly with more flexible selector
    await expect(page.locator('h1, h2, h3').filter({ hasText: 'Analyze GitHub Repository Contributors' })).toBeVisible({ timeout: 15000 });
    
    // Verify the "Popular examples:" section is visible
    await expect(page.locator('text=Popular examples:')).toBeVisible();
    
    // Find and click the continuedev/continue button
    const continueButton = page.locator('button:has-text("continuedev/continue")');
    await expect(continueButton).toBeVisible();
    await continueButton.click();
    
    // Wait for navigation and verify we're on the correct repository page
    await expect(page).toHaveURL('/continuedev/continue');
    
    // Wait for skeleton loading to finish, then verify content with more specific selector
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h3:has-text("continuedev/continue")')).toBeVisible({ timeout: 20000 });
  });

  test('homepage loads and has expected elements', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for page to fully load
    await page.waitForLoadState('domcontentloaded');
    
    // Verify main heading with more flexible selector
    await expect(page.locator('h1, h2, h3').filter({ hasText: 'Analyze GitHub Repository Contributors' })).toBeVisible({ timeout: 15000 });
    
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
import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2, // More workers locally, single in CI for stability
  reporter: process.env.CI ? [['html'], ['github']] : 'html',
  
  // Performance-focused timeouts
  timeout: 30000,
  globalTimeout: 300000, // 5 minutes total for all tests
  expect: {
    timeout: 10000, // Individual assertion timeout
  },
  
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Performance monitoring
    launchOptions: {
      args: [
        '--disable-web-security',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
      ],
    },
  },

  // Test against Chromium for performance tests, add more browsers for compatibility
  projects: [
    {
      name: 'chromium-performance',
      use: { 
        ...devices['Desktop Chrome'],
        // Enable performance APIs for testing
        contextOptions: {
          // Enable performance measurement
          ignoreHTTPSErrors: true,
        },
      },
      testMatch: '**/performance-regression.spec.ts',
    },
    {
      name: 'chromium-critical-flows',
      use: { 
        ...devices['Desktop Chrome'],
      },
      testMatch: '**/critical-flows.spec.ts',
    },
    // Mobile testing disabled until webkit is installed
    // {
    //   name: 'mobile-responsive',
    //   use: { 
    //     ...devices['iPhone 13'],
    //   },
    //   testMatch: '**/critical-flows.spec.ts',
    // },
  ],

  // Dynamic server setup based on environment
  webServer: process.env.PLAYWRIGHT_BASE_URL 
    ? undefined 
    : {
        command: 'npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
        timeout: 60000,
      },
});
import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // Always use 1 worker to avoid resource conflicts
  reporter: 'html',
  
  // Reasonable timeouts for critical user flows only
  timeout: 30000,
  globalTimeout: 180000, // 3 minutes total
  
  use: {
    baseURL: process.env.CI ? 'http://localhost:4173' : 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // Only test Chromium for critical flows
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Server setup - different for CI vs local development
  webServer: process.env.CI ? {
    command: 'npm run preview',
    port: 4173,
    reuseExistingServer: false,
    timeout: 60000,
  } : {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60000,
  },
});
import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0, // Increased retries for CI
  workers: 1, // Always use 1 worker to avoid resource conflicts
  reporter: process.env.CI ? [['html'], ['list']] : 'html',

  // Increased timeouts for CI environment
  timeout: process.env.CI ? 60000 : 30000, // 60s for CI, 30s for local
  globalTimeout: 300000, // 5 minutes total

  // Configure expect assertions
  expect: {
    timeout: 10000, // 10s for assertions (was default 5s)
  },

  use: {
    baseURL: process.env.CI ? 'http://localhost:4173' : 'http://localhost:5173',

    // Action and navigation timeouts
    actionTimeout: 15000, // 15s for actions like click, fill
    navigationTimeout: 30000, // 30s for page navigations

    // Enhanced debugging for CI failures
    trace: process.env.CI ? 'on' : 'on-first-retry', // Always trace in CI
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Viewport size for consistency
    viewport: { width: 1280, height: 720 },
  },

  // Only test Chromium for critical flows
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Server setup - different for CI vs local development
  webServer: process.env.CI
    ? {
        command: 'npm run preview',
        port: 4173,
        reuseExistingServer: false,
        timeout: 120000, // Increased timeout for CI
        stdout: 'pipe',
        stderr: 'pipe',
      }
    : {
        command: 'npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: true,
        timeout: 60000,
      },
});

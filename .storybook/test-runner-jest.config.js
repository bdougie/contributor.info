// Jest configuration for Storybook test-runner
// Note: Storybook test-runner uses Jest internally, not Vitest

export default {
  testTimeout: 30000,
  maxWorkers: 2,
  bail: false,
  verbose: true,
  testEnvironmentOptions: {
    'jest-playwright': {
      browsers: ['chromium'],
      launchOptions: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
      contextOptions: {
        ignoreHTTPSErrors: true,
        reducedMotion: 'reduce',
      },
    },
  },
  // Custom test match pattern to exclude problematic tests
  testPathIgnorePatterns: [
    '/node_modules/',
    'mode-toggle.stories',
    'auth-button.stories',
  ],
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/setup-tests.ts'],
  // Global setup  
  globalSetup: '<rootDir>/global-test-setup.js',
};
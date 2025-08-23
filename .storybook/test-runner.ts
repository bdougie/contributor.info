import type { TestRunnerConfig } from '@storybook/test-runner';

const config: TestRunnerConfig = {
  // Include all interaction tests (which includes accessibility)
  tags: {
    include: ['interaction', 'accessibility'],
    exclude: ['skip-test'],
  },
  
  // Configure test timeouts
  testTimeout: 30000,
  
  // Log level for debugging
  logLevel: 'verbose',
};

export default config;

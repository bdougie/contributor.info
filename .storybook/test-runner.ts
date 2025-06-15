import type { TestRunnerConfig } from '@storybook/test-runner';

const config: TestRunnerConfig = {
  // Setup for interaction tests
  setup() {
    // Global test setup
  },
  
  // Tags to include/exclude  
  tags: {
    include: ['test', 'interaction'],
    exclude: ['skip-test'],
  },
};

export default config;

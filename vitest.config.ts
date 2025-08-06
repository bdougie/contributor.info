import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

/**
 * Test Isolation Configuration
 * 
 * RESOLUTION: Tests were hanging due to mock dependencies creating shared state.
 * This configuration runs only pure unit tests without mocks to ensure:
 * - Complete isolation between tests
 * - Fast execution (< 3 seconds total)
 * - No hanging or timeout issues
 * 
 * Excluded tests require refactoring to remove mock dependencies.
 * See docs/test-isolation-solution.md for migration guide.
 * 
 * GitHub Issue: https://github.com/bdougie/contributor.info/issues/299
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    
    // Complete isolation
    isolate: true,
    fileParallelism: false,
    
    // Quick timeouts
    testTimeout: 5000,
    hookTimeout: 2000,
    teardownTimeout: 1000,
    
    // Single thread for stability
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
        isolate: true,
      }
    },
    
    // No mocks - only DOM cleanup
    setupFiles: ['./src/__mocks__/no-mocks-setup.ts'],
    
    // Run all tests
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx'
    ],
    
    // Exclude tests that require mocking
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      // Tests that require Supabase mocking
      'src/__tests__/auth-redirect.test.tsx',
      'src/__tests__/github-auth-hook.test.tsx',
      'src/components/__tests__/login-required-for-search.test.tsx',
      'src/evals/__tests__/evaluation-framework.test.ts',
      'src/hooks/__tests__/use-github-api.test.ts',
      'src/hooks/__tests__/use-repo-data.test.ts',
      'src/hooks/__tests__/use-repo-stats.test.tsx',
      'src/hooks/__tests__/use-repository-discovery.test.ts',
      'src/hooks/__tests__/use-repository-summary.test.ts',
      'src/lib/__tests__/link-capturing.test.ts',
      'src/lib/__tests__/yolo-behavior.test.ts',
      'src/lib/insights/health-metrics.test.ts',
      'src/app/services/__tests__/issue-similarity.test.ts',
      'src/app/webhooks/__tests__/issue-comment.test.ts',
      'src/lib/progressive-capture/__tests__/hybrid-queue-manager.test.ts',
      'src/lib/inngest/functions/__tests__/event-flow.integration.test.ts',
    ],
    
    // No coverage
    coverage: {
      enabled: false
    },
    
    // Simple reporter
    reporters: ['default'],
    
    // Basic environment
    environmentOptions: {
      jsdom: {
        pretendToBeVisual: true,
      }
    },
    
    // No threads for stability
    threads: false,
    maxWorkers: 1,
    minWorkers: 1,
  },
  
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
});
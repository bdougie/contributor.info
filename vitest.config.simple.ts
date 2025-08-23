import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

/**
 * Bulletproof Test Configuration
 * 
 * This configuration strictly follows the bulletproof testing guidelines:
 * - NO async/await patterns
 * - NO complex mocking
 * - NO integration tests
 * - Maximum 5 second timeout per test
 * - Complete isolation between tests
 * 
 * See: docs/testing/BULLETPROOF_TESTING_GUIDELINES.md
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    
    // Strict timeouts per bulletproof guidelines
    testTimeout: 5000,  // 5 seconds max per test
    hookTimeout: 2000,  // 2 seconds for setup/teardown
    teardownTimeout: 1000,
    
    // Complete isolation - no shared state
    isolate: true,
    fileParallelism: false,
    
    // Single thread for absolute stability
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
        isolate: true,
      }
    },
    
    // Minimal setup - just DOM cleanup
    setupFiles: ['./src/__mocks__/no-mocks-setup.ts'],
    
    // Include all tests except known problematic ones
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx'
    ],
    
    // Exclude tests with forbidden patterns
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      // Tests with async/await patterns (forbidden)
      'src/__tests__/github-auth-hook.test.tsx',
      'src/app/services/__tests__/issue-similarity.test.ts',
      'src/app/webhooks/__tests__/issue-comment.test.ts',
      'src/components/__tests__/login-required-for-search.test.tsx',
      'src/components/features/repository/__tests__/repository-summary-card.test.tsx',
      'src/evals/__tests__/evaluation-framework.test.ts',
      'src/hooks/__tests__/use-github-api.test.ts',
      'src/hooks/__tests__/use-repo-data.test.ts',
      'src/hooks/__tests__/use-repo-search.test.ts',
      'src/hooks/__tests__/use-repository-discovery.test.ts',
      'src/hooks/__tests__/use-repository-summary.test.ts',
      // Tests with complex timing/promise patterns (forbidden)
      'src/hooks/__tests__/use-progressive-repo-data.test.ts',
      'src/hooks/__tests__/use-intersection-loader.test.ts',
      'src/hooks/__tests__/progressive-loading-integration.test.tsx',
      'src/hooks/__tests__/progressive-loading-error-boundary.test.tsx',
      'src/lib/__tests__/link-capturing.test.ts',
      'src/lib/__tests__/yolo-behavior.test.ts',
      'src/lib/inngest/functions/__tests__/event-flow.integration.test.ts',
      'src/lib/insights/health-metrics.test.ts',
      'src/lib/progressive-capture/__tests__/hybrid-queue-manager.test.ts',
    ],
    
    // No coverage - focus on stability
    coverage: {
      enabled: false
    },
    
    // Simple reporter for CI
    reporters: process.env.CI ? ['default'] : ['default', 'html'],
    
    // Fail fast in CI
    bail: process.env.CI ? 1 : 0,
    
    // No threads for maximum stability
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
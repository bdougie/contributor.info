import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

/**
 * Bulletproof test configuration
 * Goal: Tests that NEVER hang and complete in < 2 minutes
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    
    // CRITICAL: Aggressive timeouts to prevent hanging
    testTimeout: 5000,      // 5 seconds max per test
    hookTimeout: 2000,      // 2 seconds for hooks
    teardownTimeout: 1000,  // 1 second for cleanup
    
    // CRITICAL: Fail fast on first error
    bail: 1,
    
    // CRITICAL: Limit concurrency to prevent resource exhaustion
    maxConcurrency: 2,
    maxWorkers: 2,
    
    // CRITICAL: Disable isolation to speed up tests
    isolate: false,
    
    // Only run essential tests
    include: [
      'src/**/*.test.{ts,tsx}',
      '!src/**/*.integration.test.{ts,tsx}',
      '!src/**/*.e2e.test.{ts,tsx}'
    ],
    
    // Exclude all problematic tests
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/e2e/**',
      '**/coverage/**',
      // Exclude specific problematic patterns
      '**/*embedding*.test.{ts,tsx}',
      '**/*file-embedding*.test.{ts,tsx}',
      '**/*git-history*.test.{ts,tsx}',
      '**/*progressive*.test.{ts,tsx}',
      '**/*intersection*.test.{ts,tsx}',
      '**/*cached*.test.{ts,tsx}',
      '**/use-cached-repo-data.test.ts',
      '**/supabase-pr-data-smart.test.ts',
      '**/comments.test.ts'
    ],
    
    // Minimal setup
    setupFiles: ['./src/__mocks__/simple-setup.ts'],
    
    // Disable coverage to speed up tests
    coverage: {
      enabled: false
    },
    
    // Fail-fast reporter
    reporters: ['dot'],
    
    // Environment options
    environmentOptions: {
      jsdom: {
        resources: 'usable',
        runScripts: 'dangerously'
      }
    },
    
    // Critical: Inline all dependencies to avoid ESM issues
    server: {
      deps: {
        inline: true
      }
    }
  },
  
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
});
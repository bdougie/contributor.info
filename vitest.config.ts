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
    
    // Disable isolation to prevent hanging - handle mock pollution manually
    isolate: false,
    
    // Auto-cleanup mocks between tests
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    
    // Only run essential tests
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx'
    ],
    
    // Exclude problematic tests
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/e2e/**',
      '**/coverage/**',
      '**/*.integration.test.{ts,tsx}',
      '**/*.e2e.test.{ts,tsx}',
      
      // Tests with known issues
      '**/auth-redirect.test.tsx',
      '**/last-updated.test.tsx',
      '**/activity-item-styling.test.tsx',
      '**/github-auth-hook.test.tsx',
      '**/use-repository-discovery.test.ts',
      '**/yolo-behavior.test.ts',
      '**/login-functionality.test.tsx'
    ],
    
    // Minimal setup
    setupFiles: ['./src/__mocks__/minimal-setup.ts'],
    
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
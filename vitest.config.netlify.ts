import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

/**
 * Test configuration for Netlify Functions
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,

    // Complete isolation
    isolate: true,
    fileParallelism: false,

    // Timeouts
    testTimeout: 10000,
    hookTimeout: 5000,

    // Single thread for stability
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
        isolate: true,
      },
    },

    // Include Netlify function tests
    include: ['netlify/functions/**/*.test.ts', 'netlify/functions/**/*.test.mts'],

    exclude: ['**/node_modules/**', '**/dist/**', '**/coverage/**'],
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/types': resolve(__dirname, './src/types'),
    },
  },
});

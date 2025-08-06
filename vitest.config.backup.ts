import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    testTimeout: 10000, // 10 second timeout for tests
    // Memory optimization settings
    maxConcurrency: 4, // Limit concurrent tests to reduce memory pressure
    isolate: true, // Ensure proper test isolation to prevent memory leaks
    // Set up environment variables for testing
    environmentOptions: {
      jsdom: {
        // JSdom specific options
      }
    },
    // Define mock environment variables for tests
    env: {
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
      VITE_GITHUB_TOKEN: 'test-github-token',
      VITE_OPENAI_API_KEY: 'test-openai-key'
    },
    // Enhanced ES module handling for CI compatibility
    server: {
      deps: {
        inline: [
          // Core @nivo packages
          '@nivo/core', 
          '@nivo/scatterplot',
          // All d3 dependencies causing ES module issues
          /^d3-/,  // All d3 packages
          '@react-spring/web',
          // Victory vendor dependencies
          'victory-vendor'
        ]
      }
    },
    // Mock problematic modules early in setup
    setupFiles: ['./src/__mocks__/setup.ts']
  },
  // Enhanced resolve configuration for CI compatibility
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    },
    // Help resolve ES modules in Node 18
    conditions: ['import', 'module', 'browser', 'default']
  },
  // Optimize build for different environments
  optimizeDeps: {
    // Exclude problematic ES modules from pre-bundling
    exclude: [
      '@nivo/core',
      '@nivo/scatterplot',
      'd3-interpolate',
      '@react-spring/web'
    ]
  },
});
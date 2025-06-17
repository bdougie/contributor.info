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
    // Handle ES modules properly
    server: {
      deps: {
        external: [],
        inline: ['@nivo/core', '@nivo/scatterplot', 'd3-interpolate', 'victory-vendor']
      }
    },
    // Mock problematic modules
    setupFiles: ['./src/__mocks__/setup.ts']
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    },
  },
});
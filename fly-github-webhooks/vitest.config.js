import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'test/'],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});

// Setup file for Storybook tests
// Note: Storybook test-runner uses Playwright internally, not Vitest
// This file ensures proper environment setup for Storybook's test environment

// Mock environment variables for Supabase
if (typeof process !== 'undefined' && process.env) {
  process.env.VITE_SUPABASE_URL = 'http://localhost:54321';
  process.env.VITE_SUPABASE_ANON_KEY = 'mock-anon-key';
}

// Also set them on global window object for browser context
if (typeof window !== 'undefined') {
  (window as any).import = (window as any).import || {};
  (window as any).import.meta = (window as any).import.meta || {};
  (window as any).import.meta.env = {
    VITE_SUPABASE_URL: 'http://localhost:54321',
    VITE_SUPABASE_ANON_KEY: 'mock-anon-key',
    MODE: 'test',
    DEV: false,
    PROD: false,
    SSR: false,
  };
}

// Export empty object to make this a module
export {};

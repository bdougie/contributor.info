// Setup file for Storybook tests
// Note: Storybook test-runner uses Playwright internally, not Vitest
// This file ensures proper environment setup for Storybook's test environment

// Mock environment variables for Supabase
if (typeof process !== 'undefined' && process.env) {
  process.env.VITE_SUPABASE_URL = 'http://localhost:54321';
  process.env.VITE_SUPABASE_ANON_KEY = 'mock-anon-key';
}

// Also set them on import.meta.env for Vite
if (typeof import.meta !== 'undefined' && import.meta.env) {
  (import.meta.env as any).VITE_SUPABASE_URL = 'http://localhost:54321';
  (import.meta.env as any).VITE_SUPABASE_ANON_KEY = 'mock-anon-key';
}

// Export empty object to make this a module
export {};
/**
 * Minimal test setup - focusing on simplicity and reliability
 * Uses @testing-library/react's built-in utilities
 */
import { vi, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';

// Mock fetch globally
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  } as Response)
);

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
  takeRecords: vi.fn(() => []),
})) as any;

// Mock ResizeObserver
global.ResizeObserver = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
})) as any;

// Mock matchMedia
global.matchMedia = vi.fn((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
})) as any;

// Minimal Supabase mock
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => Promise.resolve({ data: [], error: null })),
      insert: vi.fn(() => Promise.resolve({ data: [], error: null })),
      update: vi.fn(() => Promise.resolve({ data: [], error: null })),
      delete: vi.fn(() => Promise.resolve({ data: [], error: null })),
    })),
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
    },
  },
}));

// Comprehensive cleanup after each test
afterEach(() => {
  cleanup(); // Clean up React Testing Library DOM
  vi.clearAllMocks(); // Clear all mock call history
  vi.restoreAllMocks(); // Restore original implementations
});
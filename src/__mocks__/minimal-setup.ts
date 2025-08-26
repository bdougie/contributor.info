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
  } as Response),
);

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
  takeRecords: vi.fn(() => []),
})) as unknown as typeof IntersectionObserver;

// Mock ResizeObserver
global.ResizeObserver = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
})) as unknown as typeof IntersectionObserver;

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
})) as unknown as typeof IntersectionObserver;

// Minimal Supabase mock with method chaining support
vi.mock('@/lib/supabase', () => {
  const createQueryBuilder = () => {
    const queryBuilder: Record<string, unknown> = {
      select: vi.fn(() => queryBuilder),
      insert: vi.fn(() => queryBuilder),
      update: vi.fn(() => queryBuilder),
      delete: vi.fn(() => queryBuilder),
      eq: vi.fn(() => queryBuilder),
      neq: vi.fn(() => queryBuilder),
      gt: vi.fn(() => queryBuilder),
      gte: vi.fn(() => queryBuilder),
      lt: vi.fn(() => queryBuilder),
      lte: vi.fn(() => queryBuilder),
      like: vi.fn(() => queryBuilder),
      ilike: vi.fn(() => queryBuilder),
      in: vi.fn(() => queryBuilder),
      order: vi.fn(() => queryBuilder),
      limit: vi.fn(() => queryBuilder),
      single: vi.fn(() => Promise.resolve({ _data: null, error: null })),
      maybeSingle: vi.fn(() => Promise.resolve({ _data: null, error: null })),
      then: (resolve: (value: { _data: unknown[]; error: null }) => void) =>
        resolve({ _data: [], error: null }),
    };
    return queryBuilder;
  };

  return {
    supabase: {
      from: vi.fn(() => createQueryBuilder()),
      auth: {
        getSession: vi.fn(() => Promise.resolve({ _data: { session: null }, error: null })),
        signOut: vi.fn(() => Promise.resolve({ error: null })),
      },
    },
  };
});

// Comprehensive cleanup after each test
afterEach(() => {
  cleanup(); // Clean up React Testing Library DOM
  vi.clearAllMocks(); // Clear all mock call history
  vi.restoreAllMocks(); // Restore original implementations
});

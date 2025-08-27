/**
 * Minimal mock setup for bulletproof testing
 * Goal: Minimal mocking to prevent hanging and speed up tests
 */
import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock fetch globally - simple and synchronous
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  } as Response)
);

// Mock IntersectionObserver - simple and synchronous
global.IntersectionObserver = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
  takeRecords: vi.fn(() => []),
})) as any;

// Mock console to reduce noise
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Mock Supabase - minimal, synchronous
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

// Mock problematic dependencies with empty implementations
vi.mock('@nivo/scatterplot', () => ({ default: vi.fn() }));
vi.mock('@nivo/core', () => ({ default: vi.fn() }));
vi.mock('d3-interpolate', () => ({ default: vi.fn() }));

// Clear all mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});

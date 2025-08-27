/**
 * Isolated test setup - ensures complete isolation between tests
 * Each test gets fresh mocks with no shared state
 */
import { vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';

// Factory functions to create fresh mocks for each test
const createFetchMock = () =>
  vi.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
    } as Response)
  );

const createIntersectionObserverMock = () =>
  vi.fn(() => ({
    disconnect: vi.fn(),
    observe: vi.fn(),
    unobserve: vi.fn(),
    takeRecords: vi.fn(() => []),
  }));

const createResizeObserverMock = () =>
  vi.fn(() => ({
    disconnect: vi.fn(),
    observe: vi.fn(),
    unobserve: vi.fn(),
  }));

const createMatchMediaMock = () =>
  vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

// Reset and recreate all global mocks before each test
beforeEach(() => {
  // Reset all modules to ensure clean state
  vi.resetModules();

  // Create fresh global mocks
  global.fetch = createFetchMock();
  global.IntersectionObserver = createIntersectionObserverMock() as any;
  global.ResizeObserver = createResizeObserverMock() as any;
  global.matchMedia = createMatchMediaMock() as any;

  // Clear console mocks
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// Comprehensive cleanup after each test
afterEach(() => {
  // Clean up React Testing Library DOM
  cleanup();

  // Clear all timers
  vi.clearAllTimers();

  // Clear all mock state
  vi.clearAllMocks();

  // Restore all mocks to original
  vi.restoreAllMocks();

  // Remove all global mock references
  delete (global as any).fetch;
  delete (global as any).IntersectionObserver;
  delete (global as any).ResizeObserver;
  delete (global as any).matchMedia;

  // Reset modules to clear module-level state
  vi.resetModules();
});

// Isolated Supabase mock factory
export const createSupabaseMock = () => {
  const createQueryBuilder = () => {
    const queryBuilder: any = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      like: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
      then: vi.fn((resolve: any) => resolve({ data: [], error: null })),
    };

    // Make each method return the builder for chaining
    Object.keys(queryBuilder).forEach((key) => {
      if (key !== 'single' && key !== 'maybeSingle' && key !== 'then') {
        queryBuilder[key].mockReturnValue(queryBuilder);
      }
    });

    return queryBuilder;
  };

  return {
    from: vi.fn(() => createQueryBuilder()),
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
      signIn: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      signUp: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  };
};

// Mock Supabase with isolation
vi.mock('@/lib/supabase', () => {
  // Create a new mock for each import
  let supabaseMock: any = null;

  return {
    get supabase() {
      if (!supabaseMock) {
        supabaseMock = createSupabaseMock();
      }
      return supabaseMock;
    },
    // Reset the mock between tests
    __resetMock: () => {
      supabaseMock = null;
    },
  };
});

// Reset Supabase mock before each test
beforeEach(() => {
  const supabaseModule = vi.importActual('@/lib/supabase') as any;
  if (supabaseModule.__resetMock) {
    supabaseModule.__resetMock();
  }
});

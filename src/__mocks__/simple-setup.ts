/**
 * Comprehensive mock setup for bulletproof testing with proper isolation
 * Goal: Minimal mocking to prevent hanging while ensuring complete mock isolation
 * 
 * Key changes:
 * 1. Added vi.resetModules() to clear module cache between tests
 * 2. Added vi.unstubAllGlobals() to reset global mocks  
 * 3. Added DOM cleanup to prevent state leakage
 * 4. Enhanced Supabase mock with proper chainable methods
 * 5. Added React Router mock at global level
 * 6. Added cleanup for all common global state
 */
import { vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';

// Store original implementations for restoration
const originalConsole = global.console;
const originalFetch = global.fetch;

// Mock fetch globally - simple and synchronous
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    clone: () => ({
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
    }),
    headers: new Headers(),
  } as Response)
);

// Mock IntersectionObserver - simple and synchronous
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
}));

// Mock console to reduce noise while preserving functionality
global.console = {
  ...originalConsole,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
};

// Mock Supabase - comprehensive, chainable implementation
vi.mock('@/lib/supabase', () => {
  const createChainableMock = () => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    containedBy: vi.fn().mockReturnThis(),
    rangeGt: vi.fn().mockReturnThis(),
    rangeGte: vi.fn().mockReturnThis(),
    rangeLt: vi.fn().mockReturnThis(),
    rangeLte: vi.fn().mockReturnThis(),
    rangeAdjacent: vi.fn().mockReturnThis(),
    overlaps: vi.fn().mockReturnThis(),
    textSearch: vi.fn().mockReturnThis(),
    match: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    abortSignal: vi.fn().mockReturnThis(),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    csv: vi.fn(() => Promise.resolve({ data: '', error: null })),
    geojson: vi.fn(() => Promise.resolve({ data: {}, error: null })),
    explain: vi.fn(() => Promise.resolve({ data: '', error: null })),
    then: vi.fn((resolve) => resolve({ data: [], error: null })),
  });

  return {
    supabase: {
      from: vi.fn(() => createChainableMock()),
      auth: {
        getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
        getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
        signOut: vi.fn(() => Promise.resolve({ error: null })),
        signInWithOAuth: vi.fn(() => Promise.resolve({ data: {}, error: null })),
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
      },
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn(() => Promise.resolve({ data: null, error: null })),
          download: vi.fn(() => Promise.resolve({ data: null, error: null })),
          remove: vi.fn(() => Promise.resolve({ data: null, error: null })),
          list: vi.fn(() => Promise.resolve({ data: [], error: null })),
          getPublicUrl: vi.fn(() => ({ data: { publicUrl: '' } })),
        })),
      },
    },
    createSupabaseClient: vi.fn(() => ({
      from: vi.fn(() => createChainableMock()),
      auth: {
        getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
        signOut: vi.fn(() => Promise.resolve({ error: null })),
      },
    })),
  };
});

// Mock React Router globally to prevent conflicts
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: vi.fn(() => ({})),
    useNavigate: vi.fn(() => vi.fn()),
    useLocation: vi.fn(() => ({ pathname: '/', search: '', hash: '', state: null, key: 'default' })),
    useSearchParams: vi.fn(() => [new URLSearchParams(), vi.fn()]),
    useOutletContext: vi.fn(() => ({})),
    Outlet: () => null,
    Navigate: ({ to }: { to: string }) => `Navigate to ${to}`,
    Link: ({ children, to, ...props }: any) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
    NavLink: ({ children, to, ...props }: any) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  };
});

// Mock problematic dependencies with empty implementations
vi.mock('@nivo/scatterplot', () => ({ default: () => null }));
vi.mock('@nivo/core', () => ({ 
  default: () => null,
  ResponsiveWrapper: ({ children }: any) => children,
}));
vi.mock('d3-interpolate', () => ({ 
  default: vi.fn(),
  interpolate: vi.fn(),
}));

// Mock other common problematic imports
vi.mock('@/hooks/use-github-auth', () => ({
  useGitHubAuth: vi.fn(() => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  })),
}));

// Reset all state before each test for maximum isolation
beforeEach(() => {
  // Reset all mocks to their initial state
  vi.resetAllMocks();
  
  // Clear all mock implementations but keep the mocks themselves
  vi.clearAllMocks();
  
  // Reset modules to clear any cached state
  vi.resetModules();
  
  // Reset global stubs
  vi.unstubAllGlobals();
  
  // Clean up any DOM state from previous tests
  cleanup();
  
  // Clear any remaining DOM content
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  
  // Reset document state
  if (document.title !== 'Test') {
    document.title = 'Test';
  }
  
  // Clear localStorage and sessionStorage
  localStorage.clear();
  sessionStorage.clear();
  
  // Reset location if it was modified
  if (typeof window !== 'undefined' && window.location) {
    // Reset history state
    window.history.replaceState({}, '', '/');
  }
});

// Comprehensive cleanup after each test
afterEach(() => {
  // Clear all mocks
  vi.clearAllMocks();
  
  // Clean up React Testing Library state
  cleanup();
  
  // Clear any timers
  vi.clearAllTimers();
  
  // Reset any fake timers
  if (vi.isFakeTimers()) {
    vi.useRealTimers();
  }
  
  // Clear DOM completely
  document.body.innerHTML = '';
  document.head.innerHTML = '<title>Test</title>';
  
  // Clear storage
  localStorage.clear();
  sessionStorage.clear();
  
  // Clear any event listeners on window/document
  ['error', 'unhandledrejection', 'resize', 'scroll', 'beforeunload'].forEach(event => {
    window.removeAllListeners?.(event);
  });
});
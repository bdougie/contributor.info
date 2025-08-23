import { vi } from 'vitest';

// Mock browser APIs that jsdom doesn't provide
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  takeRecords: vi.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock scrollTo
window.scrollTo = vi.fn();

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock performance.timing for performance tests
Object.defineProperty(performance, 'timing', {
  writable: true,
  value: {
    navigationStart: Date.now(),
    loadEventEnd: Date.now() + 100,
  },
});

// Suppress console errors from chart libraries
const originalError = console.error;
console.error = (...args: any[]) => {
  // Suppress uplot and recharts warnings
  if (
    args[0]?.includes?.('uplot') ||
    args[0]?.includes?.('recharts') ||
    args[0]?.includes?.('ResizeObserver')
  ) {
    return;
  }
  originalError.apply(console, args);
};
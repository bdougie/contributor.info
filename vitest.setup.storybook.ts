// Vitest setup for Storybook tests
// This ensures environment variables are available during tests

import { beforeEach, afterEach, vi } from 'vitest';

// Set environment variables
if (typeof process !== 'undefined' && process.env) {
  process.env.VITE_SUPABASE_URL = 'http://localhost:54321';
  process.env.VITE_SUPABASE_ANON_KEY = 'mock-anon-key';
}

// Mock import.meta.env for browser context
if (typeof window !== 'undefined') {
  const windowWithImport = window as typeof window & {
    import?: {
      meta?: {
        env?: Record<string, unknown>;
      };
    };
  };
  windowWithImport.import = windowWithImport.import || {};
  windowWithImport.import.meta = windowWithImport.import.meta || {};
  windowWithImport.import.meta.env = {
    VITE_SUPABASE_URL: 'http://localhost:54321',
    VITE_SUPABASE_ANON_KEY: 'mock-anon-key',
    MODE: 'test',
    DEV: false,
    PROD: false,
    SSR: false,
  };
}

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
} as typeof IntersectionObserver;

// Setup before each test
beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks();

  // Reset document body
  document.body.innerHTML = '';

  // Ensure Storybook root exists
  if (!document.getElementById('storybook-root')) {
    const root = document.createElement('div');
    root.id = 'storybook-root';
    document.body.appendChild(root);
  }
});

// Cleanup after each test
afterEach(() => {
  // Clean up any leftover portals or modals
  const portals = document.querySelectorAll('[data-radix-portal], [data-portal], .portal-root');
  portals.forEach((portal) => portal.remove());

  const dialogs = document.querySelectorAll('[role="dialog"], [role="alertdialog"]');
  dialogs.forEach((dialog) => dialog.remove());
});

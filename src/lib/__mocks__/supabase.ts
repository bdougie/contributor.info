import { vi } from 'vitest';

// Create a mock client instance
const mockClient = {
  auth: {
    getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
    signInWithOAuth: vi.fn(() => Promise.resolve({ data: {}, error: null })),
    signOut: vi.fn(() => Promise.resolve({ error: null }))
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({ data: [], error: null })),
    insert: vi.fn(() => ({ data: [], error: null })),
    update: vi.fn(() => ({ data: [], error: null })),
    delete: vi.fn(() => ({ data: [], error: null }))
  }))
};

// Mock Supabase client that doesn't require environment variables
export const createSupabaseClient = vi.fn(() => mockClient);

// Use the same mock client instance
export const supabase = mockClient;

export const debugAuthSession = vi.fn(() => Promise.resolve({ session: null, error: null }));
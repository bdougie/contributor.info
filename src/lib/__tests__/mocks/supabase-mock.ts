import { vi } from 'vitest';

export const mockSupabaseClient = {
  auth: {
    getSession: vi.fn().mockResolvedValue({
      data: {
        session: {
          provider_token: 'mock-provider-token'
        }
      }
    }),
    signInWithOAuth: vi.fn(),
    signOut: vi.fn(),
  }
};

// For testing with no auth session
export const mockSupabaseClientNoSession = {
  auth: {
    getSession: vi.fn().mockResolvedValue({
      data: { session: null }
    }),
    signInWithOAuth: vi.fn(),
    signOut: vi.fn(),
  }
};

// For testing auth errors
export const mockSupabaseClientError = {
  auth: {
    getSession: vi.fn().mockRejectedValue(new Error('Auth error')),
    signInWithOAuth: vi.fn(),
    signOut: vi.fn(),
  }
};
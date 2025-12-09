/* eslint-disable no-restricted-syntax */
// Integration tests for safe-auth timeout protection - requires async patterns
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { safeGetUser, safeGetSession, isAuthenticated, requireAuth } from '../safe-auth';
import type { User, AuthError } from '@supabase/supabase-js';

// Create mock Supabase client
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
  },
};

// Mock the supabase-lazy module
vi.mock('@/lib/supabase-lazy', () => ({
  getSupabase: () => Promise.resolve(mockSupabaseClient),
}));

// Mock the logger to avoid console noise in tests
vi.mock('@/lib/logger', () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('safe-auth utilities', () => {
  beforeEach(() => {
    // Reset mocks but keep default implementations
    vi.mocked(mockSupabaseClient.auth.getUser).mockReset().mockResolvedValue({ data: { user: null }, error: null });
    vi.mocked(mockSupabaseClient.auth.getSession).mockReset().mockResolvedValue({ data: { session: null }, error: null });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('safeGetUser', () => {
    it('should return user when auth succeeds quickly', async () => {
      const mockUser: User = {
        id: 'user-123',
        email: 'test@example.com',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      };

      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const result = await safeGetUser();

      expect(result.user).toEqual(mockUser);
      expect(result.error).toBeNull();
    });

    it('should timeout and fallback when getUser takes too long', async () => {
      // Use real timers for this test since we're testing actual timeout behavior
      vi.useRealTimers();

      const mockUser: User = {
        id: 'user-fallback',
        email: 'fallback@example.com',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      };

      // Mock getUser to delay longer than timeout
      vi.mocked(mockSupabaseClient.auth.getUser).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () => resolve({ data: { user: mockUser }, error: null }),
              5000 // Longer than timeout
            )
          )
      );

      // Mock getSession to succeed quickly
      vi.mocked(mockSupabaseClient.auth.getSession).mockResolvedValue({
        data: {
          session: {
            user: mockUser,
            access_token: 'token',
            refresh_token: 'refresh',
            expires_in: 3600,
            expires_at: Date.now() + 3600000,
            token_type: 'bearer',
          },
        },
        error: null,
      });

      const result = await safeGetUser(100); // Very short timeout

      // Should get user from session fallback
      expect(result.user).toEqual(mockUser);
      expect(result.error).toBeNull();

      // Restore fake timers for other tests
      vi.useFakeTimers();
    });

    it('should fallback to getSession when getUser times out', async () => {
      const mockUser: User = {
        id: 'user-456',
        email: 'fallback@example.com',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      };

      // Mock getUser to hang
      vi.mocked(mockSupabaseClient.auth.getUser).mockImplementation(() => new Promise(() => {}));

      // Mock getSession to succeed
      vi.mocked(mockSupabaseClient.auth.getSession).mockResolvedValue({
        data: {
          session: {
            user: mockUser,
            access_token: 'token',
            refresh_token: 'refresh',
            expires_in: 3600,
            expires_at: Date.now() + 3600000,
            token_type: 'bearer',
          },
        },
        error: null,
      });

      const resultPromise = safeGetUser(500);

      // Trigger timeout
      vi.advanceTimersByTime(500);
      await vi.runAllTimersAsync();

      const result = await resultPromise;

      expect(result.user).toEqual(mockUser);
      expect(result.error).toBeNull();
    });

    it('should handle getUser errors with session fallback', async () => {
      const mockUser: User = {
        id: 'user-789',
        email: 'error-fallback@example.com',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      };

      const authError: AuthError = {
        name: 'AuthError',
        message: 'Invalid token',
        status: 401,
      };

      // Mock getUser to return error
      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: authError,
      });

      // Mock getSession to succeed
      vi.mocked(mockSupabaseClient.auth.getSession).mockResolvedValue({
        data: {
          session: {
            user: mockUser,
            access_token: 'token',
            refresh_token: 'refresh',
            expires_in: 3600,
            expires_at: Date.now() + 3600000,
            token_type: 'bearer',
          },
        },
        error: null,
      });

      const result = await safeGetUser();

      expect(result.user).toEqual(mockUser);
      expect(result.error).toBeNull();
    });

    it('should return error when both getUser and getSession fail', async () => {
      const authError: AuthError = {
        name: 'AuthError',
        message: 'Authentication failed',
        status: 401,
      };

      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: authError,
      });

      vi.mocked(mockSupabaseClient.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: authError,
      });

      const result = await safeGetUser();

      expect(result.user).toBeNull();
      expect(result.error).toBeTruthy();
    });
  });

  describe('safeGetSession', () => {
    it('should return session when auth succeeds', async () => {
      const mockUser: User = {
        id: 'user-123',
        email: 'test@example.com',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      };

      const mockSession = {
        user: mockUser,
        access_token: 'token',
        refresh_token: 'refresh',
        expires_in: 3600,
        expires_at: Date.now() + 3600000,
        token_type: 'bearer' as const,
      };

      vi.mocked(mockSupabaseClient.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const result = await safeGetSession();

      expect(result.user).toEqual(mockUser);
      expect(result.session).toEqual(mockSession);
      expect(result.error).toBeNull();
    });

    it('should timeout after specified duration', async () => {
      // Mock getSession to never resolve
      vi.mocked(mockSupabaseClient.auth.getSession).mockImplementation(() => new Promise(() => {}));

      const resultPromise = safeGetSession(1000);

      // Trigger timeout
      await vi.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;

      expect(result.user).toBeNull();
      expect(result.session).toBeNull();
      expect(result.error).toBeTruthy();
      expect(result.error?.message).toContain('timed out');
    });

    it('should handle session errors', async () => {
      const authError: AuthError = {
        name: 'AuthError',
        message: 'No session',
        status: 401,
      };

      vi.mocked(mockSupabaseClient.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: authError,
      });

      const result = await safeGetSession();

      expect(result.user).toBeNull();
      expect(result.session).toBeNull();
      expect(result.error).toEqual(authError);
    });

    it('should return null when no session exists', async () => {
      vi.mocked(mockSupabaseClient.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const result = await safeGetSession();

      expect(result.user).toBeNull();
      expect(result.session).toBeNull();
      expect(result.error).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when user is authenticated', async () => {
      const mockUser: User = {
        id: 'user-123',
        email: 'test@example.com',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      };

      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const result = await isAuthenticated();

      expect(result).toBe(true);
    });

    it('should return false when user is not authenticated', async () => {
      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      vi.mocked(mockSupabaseClient.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const result = await isAuthenticated();

      expect(result).toBe(false);
    });

    it('should return false on auth errors', async () => {
      const authError: AuthError = {
        name: 'AuthError',
        message: 'Auth failed',
        status: 401,
      };

      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: authError,
      });

      vi.mocked(mockSupabaseClient.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: authError,
      });

      const result = await isAuthenticated();

      expect(result).toBe(false);
    });
  });

  describe('requireAuth', () => {
    it('should return user when authenticated', async () => {
      const mockUser: User = {
        id: 'user-123',
        email: 'test@example.com',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      };

      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const result = await requireAuth();

      expect(result).toEqual(mockUser);
    });

    it('should throw error when user is not authenticated', async () => {
      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      vi.mocked(mockSupabaseClient.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      });

      await expect(requireAuth()).rejects.toThrow('User not authenticated');
    });

    it('should throw error on auth failure', async () => {
      const authError: AuthError = {
        name: 'AuthError',
        message: 'Auth failed',
        status: 401,
      };

      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: authError,
      });

      vi.mocked(mockSupabaseClient.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: authError,
      });

      await expect(requireAuth()).rejects.toThrow('Authentication failed');
    });
  });

  describe('timeout behavior', () => {
    it('should respect custom timeout values with fallback', async () => {
      // Use real timers for this test since we're testing actual timeout behavior
      vi.useRealTimers();

      const mockUser: User = {
        id: 'user-custom',
        email: 'custom@example.com',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      };

      // Mock getUser to delay longer than custom timeout
      vi.mocked(mockSupabaseClient.auth.getUser).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ data: { user: mockUser }, error: null }), 1000)
          )
      );

      // Mock getSession to succeed quickly
      vi.mocked(mockSupabaseClient.auth.getSession).mockResolvedValue({
        data: {
          session: {
            user: mockUser,
            access_token: 'token',
            refresh_token: 'refresh',
            expires_in: 3600,
            expires_at: Date.now() + 3600000,
            token_type: 'bearer',
          },
        },
        error: null,
      });

      const result = await safeGetUser(100); // Short custom timeout

      // Should use session fallback
      expect(result.user).toEqual(mockUser);
      expect(result.error).toBeNull();

      // Restore fake timers for other tests
      vi.useFakeTimers();
    });

    it('should use default timeout with fallback when not specified', async () => {
      // Use real timers for this test since we're testing actual timeout behavior
      vi.useRealTimers();

      const mockUser: User = {
        id: 'user-default',
        email: 'default@example.com',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      };

      // Mock getUser to delay longer than default timeout
      vi.mocked(mockSupabaseClient.auth.getUser).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ data: { user: mockUser }, error: null }), 5000)
          )
      );

      // Mock getSession to succeed quickly
      vi.mocked(mockSupabaseClient.auth.getSession).mockResolvedValue({
        data: {
          session: {
            user: mockUser,
            access_token: 'token',
            refresh_token: 'refresh',
            expires_in: 3600,
            expires_at: Date.now() + 3600000,
            token_type: 'bearer',
          },
        },
        error: null,
      });

      const result = await safeGetUser(); // Default 2000ms timeout

      // Should use session fallback before getUser completes
      expect(result.user).toEqual(mockUser);
      expect(result.error).toBeNull();

      // Restore fake timers for other tests
      vi.useFakeTimers();
    });
  });
});

/**
 * Tests for auth-helpers.ts
 * Ensures proper mapping between auth.users.id and app_users.id
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getAppUserId, getAuthUserWithAppId } from '../auth-helpers';
import { supabase } from '../supabase';

// Mock supabase
vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

// Mock logger to prevent console output during tests
vi.mock('../logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('auth-helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAppUserId', () => {
    it('should return app_users.id when user is authenticated', async () => {
      const mockAuthUserId = '1eaf7821-2ead-4711-9727-1983205e7899';
      const mockAppUserId = 'c44084f7-4f3a-450a-aee8-ea30f3480b07';

      // Mock auth.getUser() to return authenticated user
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: {
          user: {
            id: mockAuthUserId,
            email: 'test@example.com',
            app_metadata: {},
            user_metadata: {},
            aud: 'authenticated',
            created_at: new Date().toISOString(),
          },
        },
        error: null,
      });

      // Mock app_users query
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: mockAppUserId },
              error: null,
            }),
          }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await getAppUserId();

      expect(result).toBe(mockAppUserId);
      expect(supabase.auth.getUser).toHaveBeenCalledOnce();
      expect(supabase.from).toHaveBeenCalledWith('app_users');
    });

    it('should return null when user is not authenticated', async () => {
      // Mock auth.getUser() to return no user
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await getAppUserId();

      expect(result).toBeNull();
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('should return null when auth error occurs', async () => {
      // Mock auth.getUser() to return error
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: { message: 'Auth error', name: 'AuthError', status: 401 },
      });

      const result = await getAppUserId();

      expect(result).toBeNull();
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('should return null when app_users record not found', async () => {
      const mockAuthUserId = '1eaf7821-2ead-4711-9727-1983205e7899';

      // Mock auth.getUser() to return authenticated user
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: {
          user: {
            id: mockAuthUserId,
            email: 'test@example.com',
            app_metadata: {},
            user_metadata: {},
            aud: 'authenticated',
            created_at: new Date().toISOString(),
          },
        },
        error: null,
      });

      // Mock app_users query to return no data
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await getAppUserId();

      expect(result).toBeNull();
    });

    it('should return null when app_users query fails', async () => {
      const mockAuthUserId = '1eaf7821-2ead-4711-9727-1983205e7899';

      // Mock auth.getUser() to return authenticated user
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: {
          user: {
            id: mockAuthUserId,
            email: 'test@example.com',
            app_metadata: {},
            user_metadata: {},
            aud: 'authenticated',
            created_at: new Date().toISOString(),
          },
        },
        error: null,
      });

      // Mock app_users query to return error
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error', code: '500' },
            }),
          }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await getAppUserId();

      expect(result).toBeNull();
    });

    it('should handle exceptions gracefully', async () => {
      // Mock auth.getUser() to throw exception
      vi.mocked(supabase.auth.getUser).mockRejectedValue(new Error('Network error'));

      const result = await getAppUserId();

      expect(result).toBeNull();
    });
  });

  describe('getAuthUserWithAppId', () => {
    it('should return both user and appUserId when authenticated', async () => {
      const mockAuthUserId = '1eaf7821-2ead-4711-9727-1983205e7899';
      const mockAppUserId = 'c44084f7-4f3a-450a-aee8-ea30f3480b07';
      const mockUser = {
        id: mockAuthUserId,
        email: 'test@example.com',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      };

      // Mock auth.getUser() to return authenticated user
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock app_users query
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: mockAppUserId },
              error: null,
            }),
          }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await getAuthUserWithAppId();

      expect(result.user).toEqual(mockUser);
      expect(result.appUserId).toBe(mockAppUserId);
    });

    it('should return null for both when not authenticated', async () => {
      // Mock auth.getUser() to return no user
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await getAuthUserWithAppId();

      expect(result.user).toBeNull();
      expect(result.appUserId).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      // Mock auth.getUser() to throw exception
      vi.mocked(supabase.auth.getUser).mockRejectedValue(new Error('Network error'));

      const result = await getAuthUserWithAppId();

      expect(result.user).toBeNull();
      expect(result.appUserId).toBeNull();
    });
  });

  describe('Regression Test: PR #1148 workspace access issue', () => {
    it('should correctly map auth.users.id to app_users.id for workspace queries', async () => {
      // This test ensures the bug from PR #1148 doesn't happen again
      // The bug: auth.users.id (auth_user_id) was used instead of app_users.id

      const authUserId = '1eaf7821-2ead-4711-9727-1983205e7899'; // auth.users.id
      const appUserId = 'c44084f7-4f3a-450a-aee8-ea30f3480b07'; // app_users.id

      // These should be different UUIDs (the root cause of the bug)
      expect(authUserId).not.toBe(appUserId);

      // Mock auth.getUser() to return auth.users.id
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: {
          user: {
            id: authUserId, // This is auth.users.id, NOT app_users.id
            email: 'test@example.com',
            app_metadata: {},
            user_metadata: {},
            aud: 'authenticated',
            created_at: new Date().toISOString(),
          },
        },
        error: null,
      });

      // Mock app_users query to return app_users.id
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: appUserId },
              error: null,
            }),
          }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await getAppUserId();

      // CRITICAL: getAppUserId() must return app_users.id, NOT auth.users.id
      expect(result).toBe(appUserId);
      expect(result).not.toBe(authUserId);

      // Verify the query used auth_user_id to look up app_users.id
      const selectCall = mockFrom().select;
      const eqCall = selectCall().eq;
      expect(eqCall).toHaveBeenCalledWith('auth_user_id', authUserId);
    });

    it('should ensure workspace member queries use app_users.id not auth.users.id', async () => {
      // Simulate the exact scenario that caused the bug
      const authUserId = '1eaf7821-2ead-4711-9727-1983205e7899';
      const appUserId = 'c44084f7-4f3a-450a-aee8-ea30f3480b07';

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: {
          user: {
            id: authUserId,
            email: 'owner@example.com',
            app_metadata: {},
            user_metadata: {},
            aud: 'authenticated',
            created_at: new Date().toISOString(),
          },
        },
        error: null,
      });

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: appUserId },
              error: null,
            }),
          }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await getAppUserId();

      // Workspace queries MUST use this app_users.id, not the auth.users.id
      expect(result).toBe(appUserId);

      // If this test fails, it means workspace queries would break again
      // because they would be comparing auth.users.id to workspace.owner_id (app_users.id)
    });
  });
});

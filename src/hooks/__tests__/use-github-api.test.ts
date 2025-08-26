import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGitHubApi } from '../use-github-api';

// Mock the GitHub API service functions
vi.mock('@/lib/github/api-service', () => ({
  fetchFromGitHub: vi.fn(),
  fetchRepository: vi.fn(),
  fetchUser: vi.fn(),
  fetchUserOrganizations: vi.fn(),
  fetchPullRequests: vi.fn(),
  isRateLimited: vi.fn(),
  parseRateLimit: vi.fn(),
  createHeaders: vi.fn()
}));

// Mock supabase locally in this test file
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn()
    }
  }
}));

import * as GitHubApiService from '@/lib/github/api-service';
import { supabase } from '@/lib/supabase';

describe('useGitHubApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up default mock for getSession
    const getSessionMock = vi.mocked(supabase.auth.getSession);
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          provider_token: 'mock-github-token'
        }
      },
      error: null
    } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return initial state', () => {
    const { result } = renderHook(() => useGitHubApi());
    
    expect(result.current.isLoading).toBe(false);
    expect(result.current._error).toBeNull();
    expect(result.current.rateLimit).toBeNull();
    expect(typeof result.current.fetchFromGitHub).toBe('function');
    expect(typeof result.current.fetchRepository).toBe('function');
    expect(typeof result.current.fetchUser).toBe('function');
    expect(typeof result.current.fetchUserOrganizations).toBe('function');
    expect(typeof result.current.fetchPullRequests).toBe('function');
    expect(typeof result.current.isRateLimited).toBe('function');
    expect(typeof result.current.getAuthToken).toBe('function');
  });

  it('should fetch repository information', async () => {
    // Mock response data
    const mockRepo = {
      id: 12345,
      name: 'test-repo',
      full_name: 'testuser/test-repo',
      description: 'Test repository',
      owner: {
        login: 'testuser',
        id: 6789,
        avatar_url: 'https://github.com/testuser.png'
      }
    };

    const mockRateLimit = {
      limit: 5000,
      remaining: 4999,
      reset: new Date(),
      used: 1
    };

    // Mock the service function
    const fetchRepositoryMock = vi.mocked(GitHubApiService.fetchRepository);
    fetchRepositoryMock.mockResolvedValue({
      data: mockRepo,
      rateLimit: mockRateLimit
    });

    const { result } = renderHook(() => useGitHubApi());
    
    let repoResult;
    
    await act(async () => {
      repoResult = await result.current.fetchRepository('testuser', 'test-repo');
    });
    
    // Verify response data
    expect(repoResult).toEqual(mockRepo);
    
    // Verify loading state is set back to false after request completes
    expect(result.current.isLoading).toBe(false);
    
    // Verify rate limit info was updated
    expect(result.current.rateLimit).toEqual(mockRateLimit);
    
    // Verify the service was called with correct parameters
    expect(fetchRepositoryMock).toHaveBeenCalledWith('testuser', 'test-repo', { token: 'mock-github-token' });
  });

  it('should fetch user information', async () => {
    const mockUser = {
      login: 'testuser',
      id: 6789,
      avatar_url: 'https://github.com/testuser.png',
      name: 'Test User',
      company: 'Test Company',
      blog: 'https://example.com',
      location: 'San Francisco, CA'
    };

    const mockRateLimit = {
      limit: 5000,
      remaining: 4998,
      reset: new Date(),
      used: 2
    };

    const fetchUserMock = vi.mocked(GitHubApiService.fetchUser);
    fetchUserMock.mockResolvedValue({
      data: mockUser,
      rateLimit: mockRateLimit
    });

    const { result } = renderHook(() => useGitHubApi());
    
    let userResult;
    
    await act(async () => {
      userResult = await result.current.fetchUser('testuser');
    });
    
    expect(userResult).toEqual(mockUser);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.rateLimit).toEqual(mockRateLimit);
    expect(fetchUserMock).toHaveBeenCalledWith('testuser', { token: 'mock-github-token' });
  });

  it('should fetch user organizations', async () => {
    const mockOrgs = [
      {
        login: 'testorg1',
        id: 10001,
        avatar_url: 'https://github.com/testorg1.png',
        description: 'Test Organization 1'
      },
      {
        login: 'testorg2',
        id: 10002,
        avatar_url: 'https://github.com/testorg2.png',
        description: 'Test Organization 2'
      }
    ];

    const mockRateLimit = {
      limit: 5000,
      remaining: 4997,
      reset: new Date(),
      used: 3
    };

    const fetchUserOrganizationsMock = vi.mocked(GitHubApiService.fetchUserOrganizations);
    fetchUserOrganizationsMock.mockResolvedValue({
      data: mockOrgs,
      rateLimit: mockRateLimit
    });

    const { result } = renderHook(() => useGitHubApi());
    
    let orgsResult;
    
    await act(async () => {
      orgsResult = await result.current.fetchUserOrganizations('testuser');
    });
    
    expect(orgsResult).toEqual(mockOrgs);
    expect(result.current.isLoading).toBe(false);
    expect(fetchUserOrganizationsMock).toHaveBeenCalledWith('testuser', { token: 'mock-github-token' });
  });

  it('should fetch pull requests', async () => {
    const mockPRs = [
      {
        id: 20001,
        number: 123,
        title: 'Test PR 1',
        state: 'closed',
        user: {
          login: 'testuser',
          id: 6789,
          avatar_url: 'https://github.com/testuser.png'
        },
        created_at: '2025-04-01T10:00:00Z',
        updated_at: '2025-04-02T10:00:00Z',
        merged_at: '2025-04-02T10:00:00Z',
        additions: 100,
        deletions: 50
      },
      {
        id: 20002,
        number: 124,
        title: 'Test PR 2',
        state: 'open',
        user: {
          login: 'anotheruser',
          id: 9876,
          avatar_url: 'https://github.com/anotheruser.png'
        },
        created_at: '2025-04-10T10:00:00Z',
        updated_at: '2025-04-11T10:00:00Z',
        merged_at: null,
        additions: 20,
        deletions: 5
      }
    ];

    const mockRateLimit = {
      limit: 5000,
      remaining: 4996,
      reset: new Date(),
      used: 4
    };

    const fetchPullRequestsMock = vi.mocked(GitHubApiService.fetchPullRequests);
    fetchPullRequestsMock.mockResolvedValue({
      data: mockPRs,
      rateLimit: mockRateLimit
    });

    const { result } = renderHook(() => useGitHubApi());
    
    let prsResult;
    
    await act(async () => {
      prsResult = await result.current.fetchPullRequests('testuser', 'test-repo');
    });
    
    expect(prsResult).toEqual(mockPRs);
    expect(result.current.isLoading).toBe(false);
    expect(fetchPullRequestsMock).toHaveBeenCalledWith('testuser', 'test-repo', 'all', { token: 'mock-github-token' });
  });

  it('should handle API _errors', async () => {
    const mockError = new Error('GitHub API _error: 404 Not Found');
    
    const fetchRepositoryMock = vi.mocked(GitHubApiService.fetchRepository);
    fetchRepositoryMock.mockRejectedValue(mockError);

    const { result } = renderHook(() => useGitHubApi());
    
    // Use try/catch to test error handling
    let error: Error | undefined;
    await act(async () => {
      try {
        await result.current.fetchRepository('nonexistent', 'repo');
      } catch (err) {
        error = err as Error;
      }
    });
    
    expect(_error).toBeInstanceOf(Error);
    expect(_error?.message).toContain('GitHub API _error: 404 Not Found');
    expect(result.current.isLoading).toBe(false);
    expect(result.current._error).not.toBeUndefined();
    expect(result.current._error instanceof Error).toBe(true);
    expect(result.current._error?.message).toContain('GitHub API _error: 404 Not Found');
  });

  it('should detect rate limiting', async () => {
    const isRateLimitedMock = vi.mocked(GitHubApiService.isRateLimited);
    isRateLimitedMock.mockReturnValue(false);

    const mockUser = { login: 'testuser' };
    const mockRateLimit = {
      limit: 5000,
      remaining: 0, // No remaining requests
      reset: new Date(),
      used: 5000
    };

    const fetchUserMock = vi.mocked(GitHubApiService.fetchUser);
    fetchUserMock.mockResolvedValue({
      data: mockUser,
      rateLimit: mockRateLimit
    });

    const { result } = renderHook(() => useGitHubApi());
    
    // Initially not rate limited
    expect(result.current.isRateLimited()).toBe(false);
    
    await act(async () => {
      await result.current.fetchUser('testuser');
    });
    
    // Update mock to return true after rate limit is set
    isRateLimitedMock.mockReturnValue(true);
    
    // Should detect rate limiting after the response
    expect(result.current.isRateLimited()).toBe(true);
  });

  it('should get auth token from session', async () => {
    const { result } = renderHook(() => useGitHubApi());
    
    let token;
    await act(async () => {
      token = await result.current.getAuthToken();
    });
    
    expect(token).toBe('mock-github-token');
  });

  it('should handle missing session', async () => {
    // Mock getSession to return null session
    const getSessionMock = vi.mocked(supabase.auth.getSession);
    getSessionMock.mockResolvedValue({
      data: { session: null },
      error: null
    } as any);

    const { result } = renderHook(() => useGitHubApi());
    
    let token;
    await act(async () => {
      token = await result.current.getAuthToken();
    });
    
    expect(token).toBeNull();
  });

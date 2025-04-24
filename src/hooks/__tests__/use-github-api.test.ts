import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import nock from 'nock';
import { useGitHubApi } from '../use-github-api';

// Mock the supabase authentication
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            provider_token: 'mock-github-token'
          }
        }
      })
    }
  }
}));

describe('useGitHubApi', () => {
  beforeEach(() => {
    // Enable nock for mocking HTTP requests
    nock.disableNetConnect();
  });

  afterEach(() => {
    // Clean up nock mocks
    nock.cleanAll();
    nock.enableNetConnect();
    vi.clearAllMocks();
  });

  it('should return initial state', () => {
    const { result } = renderHook(() => useGitHubApi());
    
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
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

    // Set up nock to intercept GitHub API calls
    nock('https://api.github.com')
      .get('/repos/testuser/test-repo')
      .reply(200, mockRepo, {
        'x-ratelimit-limit': '5000',
        'x-ratelimit-remaining': '4999',
        'x-ratelimit-reset': (Math.floor(Date.now() / 1000) + 3600).toString(),
        'x-ratelimit-used': '1'
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
    expect(result.current.rateLimit).toEqual({
      limit: 5000,
      remaining: 4999,
      reset: expect.any(Date),
      used: 1
    });
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

    nock('https://api.github.com')
      .get('/users/testuser')
      .reply(200, mockUser, {
        'x-ratelimit-limit': '5000',
        'x-ratelimit-remaining': '4998',
        'x-ratelimit-reset': (Math.floor(Date.now() / 1000) + 3600).toString(),
        'x-ratelimit-used': '2'
      });

    const { result } = renderHook(() => useGitHubApi());
    
    let userResult;
    
    await act(async () => {
      userResult = await result.current.fetchUser('testuser');
    });
    
    expect(userResult).toEqual(mockUser);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.rateLimit).toEqual({
      limit: 5000,
      remaining: 4998,
      reset: expect.any(Date),
      used: 2
    });
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

    nock('https://api.github.com')
      .get('/users/testuser/orgs')
      .reply(200, mockOrgs, {
        'x-ratelimit-limit': '5000',
        'x-ratelimit-remaining': '4997',
        'x-ratelimit-reset': (Math.floor(Date.now() / 1000) + 3600).toString(),
        'x-ratelimit-used': '3'
      });

    const { result } = renderHook(() => useGitHubApi());
    
    let orgsResult;
    
    await act(async () => {
      orgsResult = await result.current.fetchUserOrganizations('testuser');
    });
    
    expect(orgsResult).toEqual(mockOrgs);
    expect(result.current.isLoading).toBe(false);
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

    nock('https://api.github.com')
      .get('/repos/testuser/test-repo/pulls?state=all&per_page=100')
      .reply(200, mockPRs, {
        'x-ratelimit-limit': '5000',
        'x-ratelimit-remaining': '4996',
        'x-ratelimit-reset': (Math.floor(Date.now() / 1000) + 3600).toString(),
        'x-ratelimit-used': '4'
      });

    const { result } = renderHook(() => useGitHubApi());
    
    let prsResult;
    
    await act(async () => {
      prsResult = await result.current.fetchPullRequests('testuser', 'test-repo');
    });
    
    expect(prsResult).toEqual(mockPRs);
    expect(result.current.isLoading).toBe(false);
  });

  it('should handle API errors', async () => {
    nock('https://api.github.com')
      .get('/repos/nonexistent/repo')
      .reply(404, {
        message: 'Not Found',
        documentation_url: 'https://docs.github.com/rest/reference/repos#get-a-repository'
      }, {
        'x-ratelimit-limit': '5000',
        'x-ratelimit-remaining': '4995',
        'x-ratelimit-reset': (Math.floor(Date.now() / 1000) + 3600).toString(),
        'x-ratelimit-used': '5'
      });

    const { result } = renderHook(() => useGitHubApi());
    
    // Use try/catch to test error handling
    let error;
    await act(async () => {
      try {
        await result.current.fetchRepository('nonexistent', 'repo');
      } catch (err) {
        error = err;
      }
    });
    
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('GitHub API error: 404 Not Found');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toContain('GitHub API error: 404 Not Found');
  });

  it('should detect rate limiting', async () => {
    // Mock a rate-limited response
    nock('https://api.github.com')
      .get('/users/testuser')
      .reply(200, { login: 'testuser' }, {
        'x-ratelimit-limit': '5000',
        'x-ratelimit-remaining': '0', // No remaining requests
        'x-ratelimit-reset': (Math.floor(Date.now() / 1000) + 3600).toString(),
        'x-ratelimit-used': '5000'
      });

    const { result } = renderHook(() => useGitHubApi());
    
    // Initially not rate limited
    expect(result.current.isRateLimited()).toBe(false);
    
    await act(async () => {
      await result.current.fetchUser('testuser');
    });
    
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
});
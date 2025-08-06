import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as GitHubApiService from '../api-service';

describe('GitHub API Service', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('parseRateLimit', () => {
    it('should parse rate limit headers correctly', () => {
      const headers = new Headers({
        'x-ratelimit-limit': '5000',
        'x-ratelimit-remaining': '4999',
        'x-ratelimit-reset': '1234567890',
        'x-ratelimit-used': '1'
      });

      const result = GitHubApiService.parseRateLimit(headers);

      expect(result).toEqual({
        limit: 5000,
        remaining: 4999,
        reset: new Date(1234567890 * 1000),
        used: 1
      });
    });

    it('should return null when headers are missing', () => {
      const headers = new Headers();
      const result = GitHubApiService.parseRateLimit(headers);
      expect(result).toBeNull();
    });
  });

  describe('createHeaders', () => {
    it('should create headers without token', () => {
      const headers = GitHubApiService.createHeaders(null);
      expect(headers).toEqual({
        'Accept': 'application/vnd.github.v3+json'
      });
    });

    it('should create headers with token', () => {
      const headers = GitHubApiService.createHeaders('test-token');
      expect(headers).toEqual({
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': 'Bearer test-token'
      });
    });
  });

  describe('isRateLimited', () => {
    it('should return false when no rate limit info', () => {
      expect(GitHubApiService.isRateLimited(null)).toBe(false);
    });

    it('should return false when remaining > 0', () => {
      const rateLimit = {
        limit: 5000,
        remaining: 100,
        reset: new Date(),
        used: 4900
      };
      expect(GitHubApiService.isRateLimited(rateLimit)).toBe(false);
    });

    it('should return true when remaining is 0', () => {
      const rateLimit = {
        limit: 5000,
        remaining: 0,
        reset: new Date(),
        used: 5000
      };
      expect(GitHubApiService.isRateLimited(rateLimit)).toBe(true);
    });
  });

  describe('fetchFromGitHub', () => {
    it('should fetch data successfully', async () => {
      const mockData = { id: 123, name: 'test-repo' };
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({
          'x-ratelimit-limit': '5000',
          'x-ratelimit-remaining': '4999',
          'x-ratelimit-reset': '1234567890',
          'x-ratelimit-used': '1'
        }),
        json: vi.fn().mockResolvedValue(mockData)
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const result = await GitHubApiService.fetchFromGitHub('/repos/test/repo', { token: 'test-token' });

      expect(result.data).toEqual(mockData);
      expect(result.rateLimit).toEqual({
        limit: 5000,
        remaining: 4999,
        reset: new Date(1234567890 * 1000),
        used: 1
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/test/repo',
        {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': 'Bearer test-token'
          }
        }
      );
    });

    it('should throw error on non-ok response', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers(),
        text: vi.fn().mockResolvedValue('Not Found')
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      await expect(
        GitHubApiService.fetchFromGitHub('/repos/nonexistent/repo', { token: null })
      ).rejects.toThrow('GitHub API error: 404 Not Found');
    });
  });

  describe('fetchRepository', () => {
    it('should fetch repository data', async () => {
      const mockData = { id: 123, name: 'test-repo' };
      const mockResponse = {
        ok: true,
        headers: new Headers(),
        json: vi.fn().mockResolvedValue(mockData)
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const result = await GitHubApiService.fetchRepository('owner', 'repo', { token: 'test-token' });

      expect(result.data).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo',
        expect.any(Object)
      );
    });
  });

  describe('fetchUser', () => {
    it('should fetch user data', async () => {
      const mockData = { login: 'testuser', id: 123 };
      const mockResponse = {
        ok: true,
        headers: new Headers(),
        json: vi.fn().mockResolvedValue(mockData)
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const result = await GitHubApiService.fetchUser('testuser', { token: 'test-token' });

      expect(result.data).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/users/testuser',
        expect.any(Object)
      );
    });
  });

  describe('fetchUserOrganizations', () => {
    it('should fetch user organizations', async () => {
      const mockData = [{ login: 'org1' }, { login: 'org2' }];
      const mockResponse = {
        ok: true,
        headers: new Headers(),
        json: vi.fn().mockResolvedValue(mockData)
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const result = await GitHubApiService.fetchUserOrganizations('testuser', { token: 'test-token' });

      expect(result.data).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/users/testuser/orgs',
        expect.any(Object)
      );
    });
  });

  describe('fetchPullRequests', () => {
    it('should fetch pull requests', async () => {
      const mockData = [{ id: 1, number: 123 }, { id: 2, number: 124 }];
      const mockResponse = {
        ok: true,
        headers: new Headers(),
        json: vi.fn().mockResolvedValue(mockData)
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const result = await GitHubApiService.fetchPullRequests('owner', 'repo', 'all', { token: 'test-token' });

      expect(result.data).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/pulls?state=all&per_page=100',
        expect.any(Object)
      );
    });
  });
});
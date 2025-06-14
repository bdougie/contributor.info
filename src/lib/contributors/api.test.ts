/**
 * Unit tests for API integration functions
 */

import { describe, it, expect, beforeEach, vi, MockedFunction } from 'vitest';
import {
  GitHubApiClient,
  ContributorApiError,
  fetchContributorActivity,
} from './api';

// Mock fetch globally
const mockFetch = vi.fn() as MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('GitHub API Client', () => {
  let client: GitHubApiClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GitHubApiClient('test-token');
  });

  describe('GitHubApiClient', () => {
    it('should create client with token', () => {
      expect(client).toBeInstanceOf(GitHubApiClient);
    });

    it('should make successful API request', async () => {
      const mockResponse = { login: 'testuser', name: 'Test User' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await client.getUser('testuser');
      
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/users/testuser',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'ContributorInfo/1.0',
          }),
        })
      );
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'User not found',
      } as Response);

      await expect(client.getUser('nonexistent')).rejects.toThrow(ContributorApiError);
    });

    it('should work without token', async () => {
      const clientWithoutToken = new GitHubApiClient();
      const mockResponse = { login: 'testuser' };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await clientWithoutToken.getUser('testuser');
      
      const call = mockFetch.mock.calls[0];
      const headers = call[1]?.headers as Record<string, string>;
      expect(headers).not.toHaveProperty('Authorization');
    });
  });

  describe('getPullRequests', () => {
    it('should fetch and filter pull requests by date range', async () => {
      const startDate = new Date('2024-06-01');
      const endDate = new Date('2024-06-30');
      
      const mockPullRequests = [
        {
          number: 1,
          user: { login: 'user1', name: 'User 1', avatar_url: 'avatar1', html_url: 'profile1' },
          created_at: '2024-06-15T10:00:00Z',
          html_url: 'pr1',
        },
        {
          number: 2,
          user: { login: 'user2', name: 'User 2', avatar_url: 'avatar2', html_url: 'profile2' },
          created_at: '2024-05-15T10:00:00Z', // Outside date range
          html_url: 'pr2',
        },
        {
          number: 3,
          user: { login: 'user3', name: 'User 3', avatar_url: 'avatar3', html_url: 'profile3' },
          created_at: '2024-06-20T10:00:00Z',
          html_url: 'pr3',
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPullRequests,
      } as Response);

      const result = await client.getPullRequests('owner', 'repo', startDate, endDate);
      
      // Should only include PRs from June 2024
      expect(result).toHaveLength(2);
      expect(result[0].number).toBe(1);
      expect(result[1].number).toBe(3);
    });
  });

  describe('getRepository', () => {
    it('should fetch repository information', async () => {
      const mockRepo = {
        name: 'test-repo',
        full_name: 'owner/test-repo',
        stargazers_count: 100,
        fork: false,
        html_url: 'https://github.com/owner/test-repo',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRepo,
      } as Response);

      const result = await client.getRepository('owner', 'test-repo');
      
      expect(result).toEqual(mockRepo);
    });
  });
});

describe('fetchContributorActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch activity for multiple repositories', async () => {
    const repositories = ['owner1/repo1', 'owner2/repo2'];
    const month = 5; // June
    const year = 2024;

    // Mock successful responses for all API calls
    const mockResponse = { ok: true, json: async () => [] };
    mockFetch.mockResolvedValue(mockResponse as Response);

    const result = await fetchContributorActivity(repositories, month, year, 'test-token');
    
    expect(result.success).toBe(true);
    expect(result.data).toBeInstanceOf(Array);
    expect(result.metadata.total).toBe(0);
    expect(result.metadata.fromCache).toBe(false);
    expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0);
  });

  it('should handle invalid repository format', async () => {
    const repositories = ['invalid-format', 'owner/repo'];
    const month = 5;
    const year = 2024;

    mockFetch.mockResolvedValue({ ok: true, json: async () => [] } as Response);

    const result = await fetchContributorActivity(repositories, month, year, 'test-token');
    
    // Should still succeed, just skip invalid repository
    expect(result.success).toBe(true);
  });

  it('should handle API errors and continue with other repositories', async () => {
    const repositories = ['owner/repo'];
    const month = 5;
    const year = 2024;

    // Mock all API calls to fail
    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await fetchContributorActivity(repositories, month, year, 'test-token');
    
    // Should still succeed but with empty data since repo processing continues
    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });
});

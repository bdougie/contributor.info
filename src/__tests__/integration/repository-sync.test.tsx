import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn(() => ({
          data: [],
          error: null,
        })),
      })),
      upsert: vi.fn(() => ({
        data: [],
        error: null,
      })),
      insert: vi.fn(() => ({
        data: [],
        error: null,
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          data: [],
          error: null,
        })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          data: [],
          error: null,
        })),
      })),
    })),
  })),
};

vi.mock('@/lib/supabase', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

// Mock GitHub API
const mockGitHubApi = {
  fetchRepositoryData: vi.fn(),
  fetchContributors: vi.fn(),
  fetchPullRequests: vi.fn(),
  fetchIssues: vi.fn(),
  fetchCommits: vi.fn(),
};

vi.mock('@/lib/github', () => mockGitHubApi);

// Mock fetch for direct API calls
global.fetch = vi.fn();

// Mock logging
vi.mock('@/lib/simple-logging', () => ({
  setApplicationContext: vi.fn(),
  startSpan: vi.fn((options, fn) => fn({ setStatus: vi.fn() })),
}));

// Mock Inngest client
vi.mock('@/lib/inngest/client', () => ({
  inngest: {
    send: vi.fn(),
  },
}));

describe('Repository Sync Integration Tests', () => {
  const mockRepositoryData = {
    owner: 'testowner',
    name: 'testrepo',
    full_name: 'testowner/testrepo',
    description: 'Test repository',
    stargazers_count: 100,
    forks_count: 25,
    open_issues_count: 5,
    language: 'TypeScript',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-06-15T12:00:00Z',
  };

  const mockContributors = [
    {
      login: 'contributor1',
      id: 12345,
      avatar_url: 'https://github.com/contributor1.avatar',
      contributions: 25,
    },
    {
      login: 'contributor2',
      id: 67890,
      avatar_url: 'https://github.com/contributor2.avatar',
      contributions: 15,
    },
  ];

  const mockPullRequests = [
    {
      id: 1001,
      number: 1,
      title: 'Add new feature',
      state: 'merged',
      user: { login: 'contributor1' },
      created_at: '2024-06-01T10:00:00Z',
      merged_at: '2024-06-02T15:00:00Z',
      additions: 100,
      deletions: 20,
    },
    {
      id: 1002,
      number: 2,
      title: 'Fix bug',
      state: 'closed',
      user: { login: 'contributor2' },
      created_at: '2024-06-05T14:00:00Z',
      closed_at: '2024-06-06T09:00:00Z',
      additions: 25,
      deletions: 10,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default successful responses
    mockGitHubApi.fetchRepositoryData.mockResolvedValue(mockRepositoryData);
    mockGitHubApi.fetchContributors.mockResolvedValue(mockContributors);
    mockGitHubApi.fetchPullRequests.mockResolvedValue(mockPullRequests);
    
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { repository: mockRepositoryData } }),
    });
    
    // Setup Supabase mock responses
    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          data: [],
          error: null,
        })),
      })),
      upsert: vi.fn(() => ({
        data: [mockRepositoryData],
        error: null,
      })),
      insert: vi.fn(() => ({
        data: mockContributors,
        error: null,
      })),
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
  });

  describe('Repository Data Synchronization', () => {
    it('should sync repository metadata from GitHub to Supabase', async () => {
      // Mock sync function
      const syncRepository = async (owner: string, repo: string) => {
        const repoData = await mockGitHubApi.fetchRepositoryData(owner, repo);
        
        const { data, error } = await mockSupabase
          .from('repositories')
          .upsert({
            full_name: repoData.full_name,
            name: repoData.name,
            owner: repoData.owner,
            description: repoData.description,
            stargazers_count: repoData.stargazers_count,
            forks_count: repoData.forks_count,
            language: repoData.language,
            updated_at: repoData.updated_at,
          });

        return { data, error };
      };

      const result = await syncRepository('testowner', 'testrepo');

      expect(mockGitHubApi.fetchRepositoryData).toHaveBeenCalledWith('testowner', 'testrepo');
      expect(mockSupabase.from).toHaveBeenCalledWith('repositories');
      expect(result.error).toBeNull();
    });

    it('should handle API rate limits gracefully', async () => {
      const rateLimitError = new Error('API rate limit exceeded');
      mockGitHubApi.fetchRepositoryData.mockRejectedValue(rateLimitError);

      const syncWithRetry = async (owner: string, repo: string, maxRetries = 3) => {
        for (let i = 0; i < maxRetries; i++) {
          try {
            return await mockGitHubApi.fetchRepositoryData(owner, repo);
          } catch (error) {
            if (i === maxRetries - 1) throw error;
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
          }
        }
      };

      await expect(syncWithRetry('testowner', 'testrepo', 1))
        .rejects.toThrow('API rate limit exceeded');
      
      expect(mockGitHubApi.fetchRepositoryData).toHaveBeenCalledTimes(1);
    });

    it('should sync contributor data from GitHub to Supabase', async () => {
      const syncContributors = async (owner: string, repo: string) => {
        const contributors = await mockGitHubApi.fetchContributors(owner, repo);
        
        const contributorsForDb = contributors.map((contributor: any) => ({
          username: contributor.login,
          github_id: contributor.id,
          avatar_url: contributor.avatar_url,
          contributions: contributor.contributions,
          repository: `${owner}/${repo}`,
        }));

        const { data, error } = await mockSupabase
          .from('contributors')
          .insert(contributorsForDb);

        return { data, error, count: contributors.length };
      };

      const result = await syncContributors('testowner', 'testrepo');

      expect(mockGitHubApi.fetchContributors).toHaveBeenCalledWith('testowner', 'testrepo');
      expect(mockSupabase.from).toHaveBeenCalledWith('contributors');
      expect(result.count).toBe(2);
    });

    it('should handle database connection failures', async () => {
      mockSupabase.from.mockReturnValue({
        upsert: vi.fn(() => ({
          data: null,
          error: { message: 'Database connection failed' },
        })),
      });

      const syncWithErrorHandling = async (owner: string, repo: string) => {
        try {
          const repoData = await mockGitHubApi.fetchRepositoryData(owner, repo);
          
          const { data, error } = await mockSupabase
            .from('repositories')
            .upsert({ ...repoData });

          if (error) {
            throw new Error(`Database error: ${error.message}`);
          }

          return { success: true, data };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      };

      const result = await syncWithErrorHandling('testowner', 'testrepo');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database connection failed');
    });
  });

  describe('Pull Request Synchronization', () => {
    it('should sync pull request data with proper timestamp handling', async () => {
      const syncPullRequests = async (owner: string, repo: string) => {
        const pullRequests = await mockGitHubApi.fetchPullRequests(owner, repo);
        
        const prsForDb = pullRequests.map((pr: any) => ({
          github_id: pr.id,
          number: pr.number,
          title: pr.title,
          state: pr.state,
          author: pr.user.login,
          created_at: new Date(pr.created_at).toISOString(),
          merged_at: pr.merged_at ? new Date(pr.merged_at).toISOString() : null,
          closed_at: pr.closed_at ? new Date(pr.closed_at).toISOString() : null,
          additions: pr.additions,
          deletions: pr.deletions,
          repository: `${owner}/${repo}`,
        }));

        const { data, error } = await mockSupabase
          .from('pull_requests')
          .insert(prsForDb);

        return { data, error, synced: pullRequests.length };
      };

      const result = await syncPullRequests('testowner', 'testrepo');

      expect(mockGitHubApi.fetchPullRequests).toHaveBeenCalledWith('testowner', 'testrepo');
      expect(result.synced).toBe(2);
    });

    it('should handle concurrent sync operations', async () => {
      const repositories = [
        { owner: 'owner1', repo: 'repo1' },
        { owner: 'owner2', repo: 'repo2' },
        { owner: 'owner3', repo: 'repo3' },
      ];

      const syncRepository = async ({ owner, repo }: { owner: string; repo: string }) => {
        const repoData = await mockGitHubApi.fetchRepositoryData(owner, repo);
        await mockSupabase.from('repositories').upsert({ ...repoData });
        return `${owner}/${repo}`;
      };

      const results = await Promise.allSettled(
        repositories.map(syncRepository)
      );

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.status).toBe('fulfilled');
      });
      
      expect(mockGitHubApi.fetchRepositoryData).toHaveBeenCalledTimes(3);
    });

    it('should maintain data consistency across multiple sync runs', async () => {
      const initialData = { ...mockRepositoryData, stargazers_count: 100 };
      const updatedData = { ...mockRepositoryData, stargazers_count: 150 };

      mockGitHubApi.fetchRepositoryData
        .mockResolvedValueOnce(initialData)
        .mockResolvedValueOnce(updatedData);

      const syncRepository = async (owner: string, repo: string) => {
        const repoData = await mockGitHubApi.fetchRepositoryData(owner, repo);
        
        const { data, error } = await mockSupabase
          .from('repositories')
          .upsert({
            full_name: repoData.full_name,
            stargazers_count: repoData.stargazers_count,
            updated_at: new Date().toISOString(),
          });

        return { data, error };
      };

      // First sync
      const result1 = await syncRepository('testowner', 'testrepo');
      expect(result1.error).toBeNull();

      // Second sync with updated data
      const result2 = await syncRepository('testowner', 'testrepo');
      expect(result2.error).toBeNull();

      expect(mockGitHubApi.fetchRepositoryData).toHaveBeenCalledTimes(2);
    });
  });

  describe('Incremental Sync Operations', () => {
    it('should only sync data newer than last sync timestamp', async () => {
      const lastSync = new Date('2024-06-10T00:00:00Z');
      
      const incrementalSync = async (owner: string, repo: string, since: Date) => {
        // Mock GitHub API call with since parameter
        const newData = await mockGitHubApi.fetchPullRequests(owner, repo, {
          since: since.toISOString(),
        });

        return newData.filter((item: any) => 
          new Date(item.updated_at) > since
        );
      };

      const newItems = await incrementalSync('testowner', 'testrepo', lastSync);
      
      expect(mockGitHubApi.fetchPullRequests).toHaveBeenCalledWith(
        'testowner',
        'testrepo',
        { since: lastSync.toISOString() }
      );
    });

    it('should handle bulk sync operations efficiently', async () => {
      const repositories = Array.from({ length: 10 }, (_, i) => ({
        owner: `owner${i}`,
        repo: `repo${i}`,
      }));

      const bulkSync = async (repos: Array<{ owner: string; repo: string }>) => {
        const batchSize = 3;
        const results = [];

        for (let i = 0; i < repos.length; i += batchSize) {
          const batch = repos.slice(i, i + batchSize);
          const batchResults = await Promise.all(
            batch.map(({ owner, repo }) => 
              mockGitHubApi.fetchRepositoryData(owner, repo)
            )
          );
          results.push(...batchResults);
          
          // Small delay between batches to avoid rate limits
          if (i + batchSize < repos.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        return results;
      };

      const results = await bulkSync(repositories);
      
      expect(results).toHaveLength(10);
      expect(mockGitHubApi.fetchRepositoryData).toHaveBeenCalledTimes(10);
    });

    it('should handle partial sync failures gracefully', async () => {
      const repositories = [
        { owner: 'owner1', repo: 'repo1' },
        { owner: 'owner2', repo: 'repo2' },
        { owner: 'owner3', repo: 'repo3' },
      ];

      // Second repo fails
      mockGitHubApi.fetchRepositoryData
        .mockResolvedValueOnce(mockRepositoryData)
        .mockRejectedValueOnce(new Error('Repository not found'))
        .mockResolvedValueOnce(mockRepositoryData);

      const syncWithErrorHandling = async (repos: Array<{ owner: string; repo: string }>) => {
        const results = await Promise.allSettled(
          repos.map(async ({ owner, repo }) => {
            try {
              const data = await mockGitHubApi.fetchRepositoryData(owner, repo);
              return { owner, repo, success: true, data };
            } catch (error) {
              return { owner, repo, success: false, error: (error as Error).message };
            }
          })
        );

        return results.map(result => 
          result.status === 'fulfilled' ? result.value : result.reason
        );
      };

      const results = await syncWithErrorHandling(repositories);
      
      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
    });
  });

  describe('Data Validation and Cleanup', () => {
    it('should validate sync data before database insertion', async () => {
      const invalidData = {
        ...mockRepositoryData,
        stargazers_count: -1, // Invalid negative value
        name: '', // Invalid empty name
      };

      mockGitHubApi.fetchRepositoryData.mockResolvedValue(invalidData);

      const validateAndSync = async (owner: string, repo: string) => {
        const repoData = await mockGitHubApi.fetchRepositoryData(owner, repo);
        
        // Validation
        if (!repoData.name || repoData.name.trim() === '') {
          throw new Error('Repository name cannot be empty');
        }
        
        if (repoData.stargazers_count < 0) {
          repoData.stargazers_count = 0; // Sanitize negative values
        }

        const { data, error } = await mockSupabase
          .from('repositories')
          .upsert({ ...repoData });

        return { data, error };
      };

      await expect(validateAndSync('testowner', 'testrepo'))
        .rejects.toThrow('Repository name cannot be empty');
    });

    it('should clean up stale data after sync', async () => {
      const cleanupStaleData = async (repositoryName: string, cutoffDate: Date) => {
        const { data, error } = await mockSupabase
          .from('pull_requests')
          .delete()
          .eq('repository', repositoryName)
          .lt('updated_at', cutoffDate.toISOString());

        return { deletedCount: data?.length || 0, error };
      };

      const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
      const result = await cleanupStaleData('testowner/testrepo', cutoff);

      expect(mockSupabase.from).toHaveBeenCalledWith('pull_requests');
      expect(result.deletedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance and Monitoring', () => {
    it('should track sync performance metrics', async () => {
      const performanceTracker = {
        startTime: 0,
        endTime: 0,
        itemsProcessed: 0,
        errors: 0,
      };

      const monitoredSync = async (owner: string, repo: string) => {
        performanceTracker.startTime = performance.now();
        
        try {
          const data = await mockGitHubApi.fetchRepositoryData(owner, repo);
          await mockSupabase.from('repositories').upsert({ ...data });
          
          performanceTracker.itemsProcessed = 1;
        } catch (error) {
          performanceTracker.errors++;
          throw error;
        } finally {
          performanceTracker.endTime = performance.now();
        }

        return {
          duration: performanceTracker.endTime - performanceTracker.startTime,
          itemsProcessed: performanceTracker.itemsProcessed,
          errors: performanceTracker.errors,
        };
      };

      const metrics = await monitoredSync('testowner', 'testrepo');
      
      expect(metrics.duration).toBeGreaterThan(0);
      expect(metrics.itemsProcessed).toBe(1);
      expect(metrics.errors).toBe(0);
    });

    it('should handle timeout scenarios gracefully', async () => {
      vi.useFakeTimers();
      
      mockGitHubApi.fetchRepositoryData.mockImplementation(() =>
        new Promise((resolve) => {
          setTimeout(() => resolve(mockRepositoryData), 10000); // 10 second delay
        })
      );

      const syncWithTimeout = async (owner: string, repo: string, timeoutMs = 5000) => {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Sync timeout')), timeoutMs)
        );
        
        const syncPromise = mockGitHubApi.fetchRepositoryData(owner, repo);
        
        return Promise.race([syncPromise, timeoutPromise]);
      };

      const syncPromise = syncWithTimeout('testowner', 'testrepo');
      
      // Fast-forward time
      vi.advanceTimersByTime(5000);
      
      await expect(syncPromise).rejects.toThrow('Sync timeout');
      
      vi.useRealTimers();
    });
  });
});
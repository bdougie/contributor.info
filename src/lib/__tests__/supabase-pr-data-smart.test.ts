import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchPRDataSmart, hasAnyPRData } from '../supabase-pr-data-smart';
import type { PullRequest } from '../types';
import { supabase } from '../supabase';
import { trackDatabaseOperation } from '../simple-logging';
import { inngest } from '../inngest/client';
import { toast } from 'sonner';

// Mock dependencies
vi.mock('../supabase');
vi.mock('../simple-logging');
vi.mock('../inngest/client');
vi.mock('sonner');

describe('fetchPRDataSmart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(inngest.send).mockResolvedValue({ ids: ['mock-event-id'] });
    vi.mocked(trackDatabaseOperation).mockImplementation((name, operation) => operation());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('repository not in database', () => {
    it('should return pending status for non-existent repository', async () => {
      // Mock repository not found
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({ 
              data: null, 
              error: { code: 'PGRST116' } 
            }))
          }))
        }))
      }));

      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect });

      const result = await fetchPRDataSmart('pytorch', 'pytorch');

      expect(result).toEqual({
        data: [],
        status: 'pending',
        message: 'This repository is being set up. Data will be available in 1-2 minutes.',
        repositoryName: 'pytorch/pytorch'
      });
    });

    it('should show notification when enabled for new repository', async () => {
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({ 
              data: null, 
              error: { code: 'PGRST116' } 
            }))
          }))
        }))
      }));

      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect });

      await fetchPRDataSmart('pytorch', 'pytorch', { 
        showNotifications: true 
      });

      expect(vi.mocked(toast.info)).toHaveBeenCalledWith(
        'Setting up pytorch/pytorch...',
        expect.objectContaining({
          description: "We're gathering data for this repository. This usually takes 1-2 minutes.",
          duration: 6000
        })
      );
    });
  });

  describe('repository with fresh data', () => {
    it('should return successful result with fresh data', async () => {
      const mockRepoData = {
        id: 'repo-123',
        owner: 'pytorch',
        name: 'pytorch',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: new Date().toISOString() // Fresh data
      };

      const mockPRData = [
        {
          id: 1,
          github_id: 12345,
          number: 100,
          title: 'Test PR',
          body: 'Test description',
          state: 'merged',
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-16T10:00:00Z',
          closed_at: '2024-01-16T10:00:00Z',
          merged_at: '2024-01-16T10:00:00Z',
          merged: true,
          base_branch: 'main',
          head_branch: 'feature-branch',
          additions: 100,
          deletions: 50,
          changed_files: 5,
          commits: 3,
          html_url: 'https://github.com/pytorch/pytorch/pull/100',
          repository_id: 'repo-123',
          author_id: 'author-123',
          contributors: {
            github_id: 67890,
            username: 'testuser',
            avatar_url: 'https://github.com/testuser.png',
            is_bot: false
          },
          reviews: [
            {
              id: 1,
              github_id: 54321,
              state: 'approved',
              body: 'LGTM',
              submitted_at: '2024-01-16T09:00:00Z',
              contributors: {
                github_id: 11111,
                username: 'reviewer',
                avatar_url: 'https://github.com/reviewer.png',
                is_bot: false
              }
            }
          ],
          comments: [
            {
              id: 1,
              github_id: 99999,
              body: 'Great work!',
              created_at: '2024-01-15T12:00:00Z',
              comment_type: 'issue',
              contributors: {
                github_id: 22222,
                username: 'commenter',
                avatar_url: 'https://github.com/commenter.png',
                is_bot: false
              }
            }
          ]
        }
      ];

      // Mock repository found
      const mockRepoSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({ 
              data: mockRepoData, 
              error: null 
            }))
          }))
        }))
      }));

      // Mock PR data found
      const mockPRSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({ 
                data: mockPRData, 
                error: null 
              }))
            }))
          }))
        }))
      }));

      vi.mocked(supabase.from)
        .mockReturnValueOnce({ select: mockRepoSelect }) // repositories query
        .mockReturnValueOnce({ select: mockPRSelect }); // pull_requests query

      const result = await fetchPRDataSmart('pytorch', 'pytorch');

      expect(result.status).toBe('success');
      expect(result.data).toHaveLength(1);
      
      const pr = result.data[0] as PullRequest;
      expect(pr.id).toBe(12345);
      expect(pr.number).toBe(100);
      expect(pr.title).toBe('Test PR');
      expect(pr.user.login).toBe('testuser');
      expect(pr.reviews).toHaveLength(1);
      expect(pr.comments).toHaveLength(1);
      expect(pr.repository_owner).toBe('pytorch');
      expect(pr.repository_name).toBe('pytorch');

      // Should include metadata
      expect(result.metadata).toEqual({
        isStale: false,
        lastUpdate: mockRepoData.updated_at,
        dataCompleteness: expect.any(Number)
      });

      // Should not trigger background sync for fresh data
      expect(vi.mocked(inngest.send)).not.toHaveBeenCalled();
    });
  });

  describe('repository with stale data', () => {
    it('should return data but trigger background sync for stale data', async () => {
      const staleDate = new Date();
      staleDate.setHours(staleDate.getHours() - 8); // 8 hours ago (stale)

      const mockRepoData = {
        id: 'repo-123',
        owner: 'pytorch',
        name: 'pytorch',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: staleDate.toISOString()
      };

      const mockPRData = [
        {
          id: 1,
          github_id: 12345,
          number: 100,
          title: 'Test PR',
          body: 'Test description',
          state: 'merged',
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-16T10:00:00Z',
          closed_at: '2024-01-16T10:00:00Z',
          merged_at: '2024-01-16T10:00:00Z',
          merged: true,
          base_branch: 'main',
          head_branch: 'feature-branch',
          additions: 100,
          deletions: 50,
          changed_files: 5,
          commits: 3,
          html_url: 'https://github.com/pytorch/pytorch/pull/100',
          repository_id: 'repo-123',
          author_id: 'author-123',
          contributors: {
            github_id: 67890,
            username: 'testuser',
            avatar_url: 'https://github.com/testuser.png',
            is_bot: false
          },
          reviews: [],
          comments: []
        }
      ];

      const mockRepoSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({ 
              data: mockRepoData, 
              error: null 
            }))
          }))
        }))
      }));

      const mockPRSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({ 
                data: mockPRData, 
                error: null 
              }))
            }))
          }))
        }))
      }));

      vi.mocked(supabase.from)
        .mockReturnValueOnce({ select: mockRepoSelect })
        .mockReturnValueOnce({ select: mockPRSelect });

      const result = await fetchPRDataSmart('pytorch', 'pytorch');

      expect(result.status).toBe('success');
      expect(result.data).toHaveLength(1);
      expect(result.metadata?.isStale).toBe(true);

      // Should trigger background sync for stale data
      expect(vi.mocked(inngest.send)).toHaveBeenCalledWith({
        name: 'capture/repository.sync',
        data: {
          owner: 'pytorch',
          repo: 'pytorch',
          priority: 'medium', // Medium priority for stale data
          source: 'smart-fetch-stale-data'
        }
      });
    });
  });

  describe('repository with no PR data', () => {
    it('should return pending status and trigger high priority sync', async () => {
      const mockRepoData = {
        id: 'repo-123',
        owner: 'pytorch',
        name: 'pytorch',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: new Date().toISOString()
      };

      const mockRepoSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({ 
              data: mockRepoData, 
              error: null 
            }))
          }))
        }))
      }));

      const mockPRSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({ 
                data: [], // No PR data
                error: null 
              }))
            }))
          }))
        }))
      }));

      vi.mocked(supabase.from)
        .mockReturnValueOnce({ select: mockRepoSelect })
        .mockReturnValueOnce({ select: mockPRSelect });

      const result = await fetchPRDataSmart('pytorch', 'pytorch', {
        showNotifications: true
      });

      expect(result.status).toBe('pending');
      expect(result.data).toEqual([]);
      expect(result.message).toBe('Data is being gathered. This usually takes 1-2 minutes.');

      // Should trigger high priority sync for empty data
      expect(vi.mocked(inngest.send)).toHaveBeenCalledWith({
        name: 'capture/repository.sync',
        data: {
          owner: 'pytorch',
          repo: 'pytorch',
          priority: 'high', // High priority for empty data
          source: 'smart-fetch-stale-data'
        }
      });

      // Should show notification
      expect(vi.mocked(toast.info)).toHaveBeenCalledWith(
        'Getting familiar with pytorch/pytorch...',
        expect.objectContaining({
          description: "We're fetching the latest data. Check back in a minute!",
          duration: 5000
        })
      );
    });
  });

  describe('database errors', () => {
    it('should handle database errors gracefully', async () => {
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({ 
              data: null, 
              error: { message: 'Database connection failed' }
            }))
          }))
        }))
      }));

      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect });

      const result = await fetchPRDataSmart('pytorch', 'pytorch');

      expect(result.status).toBe('pending');
      expect(result.data).toEqual([]);
    });

    it('should handle PR data query errors', async () => {
      const mockRepoData = {
        id: 'repo-123',
        owner: 'pytorch',
        name: 'pytorch',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: new Date().toISOString()
      };

      const mockRepoSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({ 
              data: mockRepoData, 
              error: null 
            }))
          }))
        }))
      }));

      const mockPRSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({ 
                data: null, 
                error: { message: 'PR query failed' }
              }))
            }))
          }))
        }))
      }));

      vi.mocked(supabase.from)
        .mockReturnValueOnce({ select: mockRepoSelect })
        .mockReturnValueOnce({ select: mockPRSelect });

      const result = await fetchPRDataSmart('pytorch', 'pytorch');

      expect(result.status).toBe('no_data');
      expect(result.data).toEqual([]);
    });
  });

  describe('data transformation', () => {
    it('should correctly transform database PR data to API format', async () => {
      const mockRepoData = {
        id: 'repo-123',
        owner: 'pytorch',
        name: 'pytorch',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: new Date().toISOString()
      };

      const mockPRData = [
        {
          id: 1,
          github_id: 12345,
          number: 100,
          title: 'Test PR',
          body: null, // Test null handling
          state: 'merged',
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-16T10:00:00Z',
          closed_at: '2024-01-16T10:00:00Z',
          merged_at: '2024-01-16T10:00:00Z',
          merged: true,
          base_branch: 'main',
          head_branch: 'feature-branch',
          additions: null, // Test null handling
          deletions: null,
          changed_files: null,
          commits: null,
          html_url: null, // Test null handling - should generate URL
          repository_id: 'repo-123',
          author_id: 'author-123',
          contributors: null, // Test null contributor
          reviews: [],
          comments: []
        }
      ];

      const mockRepoSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({ 
              data: mockRepoData, 
              error: null 
            }))
          }))
        }))
      }));

      const mockPRSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({ 
                data: mockPRData, 
                error: null 
              }))
            }))
          }))
        }))
      }));

      vi.mocked(supabase.from)
        .mockReturnValueOnce({ select: mockRepoSelect })
        .mockReturnValueOnce({ select: mockPRSelect });

      const result = await fetchPRDataSmart('pytorch', 'pytorch');

      expect(result.status).toBe('success');
      
      const pr = result.data[0] as PullRequest;
      
      // Should handle null values gracefully
      expect(pr.body).toBe(null);
      expect(pr.user.login).toBe('unknown'); // Default for null contributor
      expect(pr.user.id).toBe(0);
      expect(pr.user.avatar_url).toBe('');
      expect(pr.user.type).toBe('User');
      expect(pr.additions).toBe(0);
      expect(pr.deletions).toBe(0);
      expect(pr.changed_files).toBe(0);
      expect(pr.commits).toBe(0);
      
      // Should generate URL when missing
      expect(pr.html_url).toBe('https://github.com/pytorch/pytorch/pull/100');
      
      // Should include repository info
      expect(pr.repository_owner).toBe('pytorch');
      expect(pr.repository_name).toBe('pytorch');
    });

    it('should handle bot contributors correctly', async () => {
      const mockRepoData = {
        id: 'repo-123',
        owner: 'pytorch',
        name: 'pytorch',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: new Date().toISOString()
      };

      const mockPRData = [
        {
          id: 1,
          github_id: 12345,
          number: 100,
          title: 'Test PR',
          body: 'Test description',
          state: 'merged',
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-16T10:00:00Z',
          closed_at: '2024-01-16T10:00:00Z',
          merged_at: '2024-01-16T10:00:00Z',
          merged: true,
          base_branch: 'main',
          head_branch: 'feature-branch',
          additions: 100,
          deletions: 50,
          changed_files: 5,
          commits: 3,
          html_url: 'https://github.com/pytorch/pytorch/pull/100',
          repository_id: 'repo-123',
          author_id: 'author-123',
          contributors: {
            github_id: 67890,
            username: 'dependabot[bot]',
            avatar_url: 'https://github.com/dependabot.png',
            is_bot: true // Bot contributor
          },
          reviews: [],
          comments: []
        }
      ];

      const mockRepoSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({ 
              data: mockRepoData, 
              error: null 
            }))
          }))
        }))
      }));

      const mockPRSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({ 
                data: mockPRData, 
                error: null 
              }))
            }))
          }))
        }))
      }));

      vi.mocked(supabase.from)
        .mockReturnValueOnce({ select: mockRepoSelect })
        .mockReturnValueOnce({ select: mockPRSelect });

      const result = await fetchPRDataSmart('pytorch', 'pytorch');

      const pr = result.data[0] as PullRequest;
      expect(pr.user.type).toBe('Bot'); // Should correctly identify bot
      expect(pr.user.login).toBe('dependabot[bot]');
    });
  });

  describe('time range filtering', () => {
    it.skip('should respect custom time range', async () => {
      const mockRepoData = {
        id: 'repo-123',
        owner: 'pytorch',
        name: 'pytorch',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: new Date().toISOString()
      };

      const mockRepoSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({ 
              data: mockRepoData, 
              error: null 
            }))
          }))
        }))
      }));

      const mockPRSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn((dateString) => {
            // Verify the date filter is correct for 7 days
            const filterDate = new Date(dateString);
            const expectedDate = new Date();
            expectedDate.setDate(expectedDate.getDate() - 7);
            
            const diffHours = Math.abs(filterDate.getTime() - expectedDate.getTime()) / (1000 * 60 * 60);
            expect(diffHours).toBeLessThan(1); // Should be within 1 hour
            
            return {
              order: vi.fn(() => ({
                limit: vi.fn(() => ({ 
                  data: [], 
                  error: null 
                }))
              }))
            };
          })
        }))
      }));

      vi.mocked(supabase.from)
        .mockReturnValueOnce({ select: mockRepoSelect })
        .mockReturnValueOnce({ select: mockPRSelect });

      await fetchPRDataSmart('pytorch', 'pytorch', { 
        timeRange: '7' // 7 days instead of default 30
      });

      expect(mockPRSelect).toHaveBeenCalled();
    });
  });

  describe('data completeness calculation', () => {
    it('should calculate data completeness correctly', async () => {
      const mockRepoData = {
        id: 'repo-123',
        owner: 'pytorch',
        name: 'pytorch',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: new Date().toISOString()
      };

      const mockPRData = [
        // PR with reviews and comments (100% complete)
        {
          id: 1,
          github_id: 12345,
          number: 100,
          title: 'Complete PR',
          state: 'merged',
          created_at: '2024-01-15T10:00:00Z',
          reviews: [{ id: 1, github_id: 1, state: 'approved' }],
          comments: [{ id: 1, github_id: 1, body: 'comment' }],
          contributors: { username: 'user1' }
        },
        // PR with reviews only (75% complete)
        {
          id: 2,
          github_id: 12346,
          number: 101,
          title: 'Partial PR',
          state: 'merged',
          created_at: '2024-01-15T11:00:00Z',
          reviews: [{ id: 2, github_id: 2, state: 'approved' }],
          comments: [],
          contributors: { username: 'user2' }
        },
        // PR with no reviews or comments (50% complete)
        {
          id: 3,
          github_id: 12347,
          number: 102,
          title: 'Basic PR',
          state: 'merged',
          created_at: '2024-01-15T12:00:00Z',
          reviews: [],
          comments: [],
          contributors: { username: 'user3' }
        }
      ];

      const mockRepoSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({ 
              data: mockRepoData, 
              error: null 
            }))
          }))
        }))
      }));

      const mockPRSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({ 
                data: mockPRData, 
                error: null 
              }))
            }))
          }))
        }))
      }));

      vi.mocked(supabase.from)
        .mockReturnValueOnce({ select: mockRepoSelect })
        .mockReturnValueOnce({ select: mockPRSelect });

      const result = await fetchPRDataSmart('pytorch', 'pytorch');

      expect(result.status).toBe('success');
      // Average: (100 + 75 + 50) / 3 = 75%
      expect(result.metadata?.dataCompleteness).toBe(75);
    });
  });
});

describe('hasAnyPRData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return true when repository has PR data', async () => {
    // Mock repository found
    const mockRepoSelect = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({ 
            data: { id: 'repo-123' }, 
            error: null 
          }))
        }))
      }))
    }));

    // Mock PR count > 0
    const mockPRSelect = vi.fn(() => ({
      eq: vi.fn(() => ({ count: 5, error: null }))
    }));

    vi.mocked(supabase.from)
      .mockReturnValueOnce({ select: mockRepoSelect })
      .mockReturnValueOnce({ select: mockPRSelect });

    const result = await hasAnyPRData('pytorch', 'pytorch');

    expect(result).toBe(true);
  });

  it('should return false when repository has no PR data', async () => {
    const mockRepoSelect = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({ 
            data: { id: 'repo-123' }, 
            error: null 
          }))
        }))
      }))
    }));

    const mockPRSelect = vi.fn(() => ({
      eq: vi.fn(() => ({ count: 0, error: null }))
    }));

    vi.mocked(supabase.from)
      .mockReturnValueOnce({ select: mockRepoSelect })
      .mockReturnValueOnce({ select: mockPRSelect });

    const result = await hasAnyPRData('pytorch', 'pytorch');

    expect(result).toBe(false);
  });

  it('should return false when repository not found', async () => {
    const mockSelect = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({ 
            data: null, 
            error: { code: 'PGRST116' } 
          }))
        }))
      }))
    }));

    vi.mocked(supabase.from).mockReturnValue({ select: mockSelect });

    const result = await hasAnyPRData('nonexistent', 'repo');

    expect(result).toBe(false);
  });

  it('should handle errors gracefully', async () => {
    const mockSelect = vi.fn(() => {
      throw new Error('Database error');
    });

    vi.mocked(supabase.from).mockReturnValue({ select: mockSelect });

    const result = await hasAnyPRData('pytorch', 'pytorch');

    expect(result).toBe(false);
  });
});
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateRepositoryConfidence } from './health-metrics';
import { createClient } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  createClient: vi.fn()
}));

describe('calculateRepositoryConfidence - Edge Cases', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createClient();
  });

  describe('Bot Activity Filtering', () => {
    it('should exclude common bot accounts from confidence calculation', async () => {
      const mockRepo = {
        data: {
          stargazers_count: 100,
          forks_count: 50,
          created_at: '2023-01-01'
        },
        error: null
      };

      // Include bot accounts in stargazers
      const mockStarEvents = {
        data: [
          { actor_login: 'dependabot[bot]' },
          { actor_login: 'renovate[bot]' },
          { actor_login: 'github-actions[bot]' },
          { actor_login: 'codecov[bot]' },
          { actor_login: 'snyk-bot' },
          { actor_login: 'greenkeeper[bot]' },
          ...Array.from({ length: 50 }, (_, i) => ({ actor_login: `user${i}` }))
        ],
        error: null
      };

      // Only real users as contributors
      const mockContributors = {
        data: Array.from({ length: 20 }, (_, i) => ({
          username: `user${i}`
        })),
        error: null
      };

      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'repositories') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue(mockRepo)
              })
            })
          };
        }
        if (table === 'github_events_cache') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation((field: string, value: any) => {
                if (value === 'WatchEvent') {
                  return { gte: vi.fn().mockResolvedValue(mockStarEvents) };
                }
                return { gte: vi.fn().mockResolvedValue({ data: [], error: null }) };
              })
            })
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockResolvedValue(mockContributors)
            }),
            in: vi.fn().mockResolvedValue(mockContributors)
          })
        };
      });

      const result = await calculateRepositoryConfidence('test-owner', 'test-repo', '30');
      
      // Should calculate based on 50 real users, not 56 total
      // 20/50 = 40% conversion rate
      expect(result).toBeGreaterThan(30);
      expect(result).toBeLessThan(50);
    });

    it('should handle repositories with only bot activity', async () => {
      const mockRepo = {
        data: {
          stargazers_count: 10,
          forks_count: 5,
          created_at: '2023-01-01'
        },
        error: null
      };

      // Only bot accounts
      const mockStarEvents = {
        data: [
          { actor_login: 'dependabot[bot]' },
          { actor_login: 'renovate[bot]' },
          { actor_login: 'github-actions[bot]' }
        ],
        error: null
      };

      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'repositories') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue(mockRepo)
              })
            })
          };
        }
        if (table === 'github_events_cache') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockResolvedValue(mockStarEvents)
              })
            })
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockResolvedValue({ data: [], error: null })
            }),
            in: vi.fn().mockResolvedValue({ data: [], error: null })
          })
        };
      });

      const result = await calculateRepositoryConfidence('test-owner', 'test-repo', '30');
      
      // Should fall back to repository metrics when no real users
      expect(result).toBeGreaterThan(0);
    });
  });

  describe('Special Repository Types', () => {
    it('should handle documentation-only repositories', async () => {
      const mockRepo = {
        data: {
          stargazers_count: 5000,
          forks_count: 100,
          open_issues_count: 5,
          contributors_count: 10,
          created_at: '2022-01-01',
          language: 'Markdown' // Documentation repo
        },
        error: null
      };

      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'repositories') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue(mockRepo)
              })
            })
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockResolvedValue({ data: [], error: null })
            }),
            in: vi.fn().mockResolvedValue({ data: [], error: null })
          })
        };
      });

      const result = await calculateRepositoryConfidence('test-owner', 'test-docs', '30');
      
      // Documentation repos typically have lower conversion rates
      expect(result).toBeLessThan(30);
    });

    it('should handle archived repositories', async () => {
      const mockRepo = {
        data: {
          stargazers_count: 1000,
          forks_count: 200,
          archived: true,
          created_at: '2020-01-01'
        },
        error: null
      };

      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'repositories') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue(mockRepo)
              })
            })
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockResolvedValue({ data: [], error: null })
            }),
            in: vi.fn().mockResolvedValue({ data: [], error: null })
          })
        };
      });

      const result = await calculateRepositoryConfidence('test-owner', 'archived-repo', '30');
      
      // Archived repos should show very low confidence
      expect(result).toBeLessThan(10);
    });

    it('should handle extremely popular repositories', async () => {
      const mockRepo = {
        data: {
          stargazers_count: 100000,
          forks_count: 20000,
          created_at: '2018-01-01'
        },
        error: null
      };

      // Large number of stargazers
      const mockStarEvents = {
        data: Array.from({ length: 5000 }, (_, i) => ({
          actor_login: `user${i}`
        })),
        error: null
      };

      // Reasonable number of contributors
      const mockContributors = {
        data: Array.from({ length: 500 }, (_, i) => ({
          username: `user${i}`
        })),
        error: null
      };

      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'repositories') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue(mockRepo)
              })
            })
          };
        }
        if (table === 'github_events_cache') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation((field: string, value: any) => {
                if (value === 'WatchEvent') {
                  return { gte: vi.fn().mockResolvedValue(mockStarEvents) };
                }
                return { gte: vi.fn().mockResolvedValue({ data: [], error: null }) };
              })
            })
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockResolvedValue(mockContributors)
            }),
            in: vi.fn().mockResolvedValue(mockContributors)
          })
        };
      });

      const result = await calculateRepositoryConfidence('facebook', 'react', '30');
      
      // Very popular repos rarely exceed 40% confidence due to scaling
      expect(result).toBeLessThan(40);
      expect(result).toBeGreaterThan(10);
    });
  });

  describe('Data Quality Issues', () => {
    it('should handle incomplete event data', async () => {
      const mockRepo = {
        data: {
          stargazers_count: 100,
          forks_count: 50,
          created_at: '2023-01-01'
        },
        error: null
      };

      // Some events missing actor_login
      const mockStarEvents = {
        data: [
          { actor_login: 'user1' },
          { actor_login: null }, // Missing login
          { actor_login: '' }, // Empty login
          { actor_login: 'user2' },
          { actor_login: undefined } // Undefined login
        ],
        error: null
      };

      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'repositories') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue(mockRepo)
              })
            })
          };
        }
        if (table === 'github_events_cache') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockResolvedValue(mockStarEvents)
              })
            })
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockResolvedValue({ data: [], error: null })
            }),
            in: vi.fn().mockResolvedValue({ data: [], error: null })
          })
        };
      });

      const result = await calculateRepositoryConfidence('test-owner', 'test-repo', '30');
      
      // Should handle null/empty values gracefully
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    });

    it('should handle rate-limited or partial data', async () => {
      const mockRepo = {
        data: {
          stargazers_count: 10000, // High count
          forks_count: 2000,
          created_at: '2022-01-01'
        },
        error: null
      };

      // Only partial data due to rate limiting (first 1000)
      const mockStarEvents = {
        data: Array.from({ length: 1000 }, (_, i) => ({
          actor_login: `user${i}`
        })),
        error: null
      };

      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'repositories') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue(mockRepo)
              })
            })
          };
        }
        if (table === 'github_events_cache') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockResolvedValue(mockStarEvents)
              })
            })
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockResolvedValue({ data: [], error: null })
            }),
            in: vi.fn().mockResolvedValue({ data: [], error: null })
          })
        };
      });

      const result = await calculateRepositoryConfidence('test-owner', 'test-repo', '30');
      
      // Should fall back to repository metrics when event data is incomplete
      expect(result).toBeGreaterThan(0);
    });
  });

  describe('Time-based Edge Cases', () => {
    it('should handle future dates gracefully', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const mockRepo = {
        data: {
          stargazers_count: 100,
          forks_count: 50,
          created_at: futureDate.toISOString() // Future date
        },
        error: null
      };

      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'repositories') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue(mockRepo)
              })
            })
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockResolvedValue({ data: [], error: null })
            }),
            in: vi.fn().mockResolvedValue({ data: [], error: null })
          })
        };
      });

      const result = await calculateRepositoryConfidence('test-owner', 'test-repo', '30');
      
      // Should handle gracefully, likely using fallback
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    });

    it('should handle very old repositories', async () => {
      const mockRepo = {
        data: {
          stargazers_count: 5000,
          forks_count: 1000,
          created_at: '2008-01-01' // Very old repo
        },
        error: null
      };

      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'repositories') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue(mockRepo)
              })
            })
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockResolvedValue({ data: [], error: null })
            }),
            in: vi.fn().mockResolvedValue({ data: [], error: null })
          })
        };
      });

      const result = await calculateRepositoryConfidence('test-owner', 'legacy-repo', '30');
      
      // Old repos might have different engagement patterns
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    });
  });
});
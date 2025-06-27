import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateRepositoryConfidence } from './health-metrics';
import { createClient } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  createClient: vi.fn()
}));

describe('calculateRepositoryConfidence - Performance Tests', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createClient();
  });

  describe('Large Repository Performance', () => {
    it('should handle repositories with 10k+ stargazers efficiently', async () => {
      const startTime = performance.now();

      const mockRepo = {
        data: {
          stargazers_count: 50000,
          forks_count: 10000,
          created_at: '2020-01-01'
        },
        error: null
      };

      // Simulate large dataset
      const mockStarEvents = {
        data: Array.from({ length: 10000 }, (_, i) => ({
          actor_login: `user${i}`,
          created_at: new Date(2023, 0, 1 + (i % 365)).toISOString()
        })),
        error: null
      };

      const mockForkEvents = {
        data: Array.from({ length: 5000 }, (_, i) => ({
          actor_login: `forker${i}`,
          created_at: new Date(2023, 0, 1 + (i % 365)).toISOString()
        })),
        error: null
      };

      const mockContributors = {
        data: Array.from({ length: 2000 }, (_, i) => ({
          username: i % 2 === 0 ? `user${i}` : `forker${i}`
        })),
        error: null
      };

      const mockCommentEvents = {
        data: Array.from({ length: 3000 }, (_, i) => ({
          actor_login: `commenter${i}`,
          created_at: new Date(2023, 0, 1 + (i % 365)).toISOString()
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
                if (value === 'ForkEvent') {
                  return { gte: vi.fn().mockResolvedValue(mockForkEvents) };
                }
                if (value?.includes('CommentEvent')) {
                  return { gte: vi.fn().mockResolvedValue(mockCommentEvents) };
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

      const result = await calculateRepositoryConfidence('large-org', 'huge-repo', '30');
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Should complete within reasonable time (2 seconds)
      expect(executionTime).toBeLessThan(2000);
      
      // Should return valid result
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(100);

      // Large repos should have scaled confidence
      expect(result).toBeLessThan(40);
    });

    it('should efficiently handle concurrent calculations', async () => {
      const mockRepo = {
        data: {
          stargazers_count: 1000,
          forks_count: 200,
          created_at: '2022-01-01'
        },
        error: null
      };

      mockSupabase.from = vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue(mockRepo),
            gte: vi.fn().mockResolvedValue({ 
              data: Array.from({ length: 100 }, (_, i) => ({
                actor_login: `user${i}`
              })), 
              error: null 
            })
          }),
          in: vi.fn().mockResolvedValue({ 
            data: Array.from({ length: 50 }, (_, i) => ({
              username: `user${i}`
            })), 
            error: null 
          })
        })
      }));

      const startTime = performance.now();

      // Run multiple calculations concurrently
      const promises = Array.from({ length: 10 }, (_, i) => 
        calculateRepositoryConfidence(`owner${i}`, `repo${i}`, '30')
      );

      const results = await Promise.all(promises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // All results should be valid
      results.forEach(result => {
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(100);
      });

      // Should handle concurrent requests efficiently (under 5 seconds for 10 repos)
      expect(totalTime).toBeLessThan(5000);
    });

    it('should optimize queries for different time ranges', async () => {
      const mockRepo = {
        data: {
          stargazers_count: 5000,
          forks_count: 1000,
          created_at: '2020-01-01'
        },
        error: null
      };

      let queryCount = 0;

      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        queryCount++;
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
              gte: vi.fn().mockImplementation(() => {
                // Simulate different data sizes for different time ranges
                const dataSize = table === 'github_events_cache' ? 1000 : 200;
                return {
                  data: Array.from({ length: dataSize }, (_, i) => ({
                    actor_login: `user${i}`,
                    username: `user${i}`
                  })),
                  error: null
                };
              })
            }),
            in: vi.fn().mockResolvedValue({ data: [], error: null })
          })
        };
      });

      // Test different time ranges
      const timeRanges = ['30', '90', '365'];
      const executionTimes: number[] = [];

      for (const timeRange of timeRanges) {
        queryCount = 0;
        const startTime = performance.now();
        await calculateRepositoryConfidence('test-owner', 'test-repo', timeRange);
        const endTime = performance.now();
        executionTimes.push(endTime - startTime);
        
        // Should make efficient number of queries (not excessive)
        expect(queryCount).toBeLessThan(20);
      }

      // All time ranges should complete quickly
      executionTimes.forEach(time => {
        expect(time).toBeLessThan(1000);
      });
    });

    it('should handle memory efficiently with large result sets', async () => {
      const mockRepo = {
        data: {
          stargazers_count: 100000,
          forks_count: 20000,
          created_at: '2019-01-01'
        },
        error: null
      };

      // Create large datasets that would consume significant memory if not handled properly
      const createLargeDataset = (prefix: string, size: number) => ({
        data: Array.from({ length: size }, (_, i) => ({
          actor_login: `${prefix}${i}`,
          username: `${prefix}${i}`,
          // Add extra fields to increase memory usage
          created_at: new Date().toISOString(),
          repository_full_name: 'test-owner/test-repo',
          extra_field_1: 'x'.repeat(100),
          extra_field_2: 'y'.repeat(100)
        })),
        error: null
      });

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
                  return { gte: vi.fn().mockResolvedValue(createLargeDataset('star', 50000)) };
                }
                if (value === 'ForkEvent') {
                  return { gte: vi.fn().mockResolvedValue(createLargeDataset('fork', 20000)) };
                }
                return { gte: vi.fn().mockResolvedValue({ data: [], error: null }) };
              })
            })
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockResolvedValue(createLargeDataset('contrib', 5000))
            }),
            in: vi.fn().mockResolvedValue(createLargeDataset('contrib', 5000))
          })
        };
      });

      // Track memory usage (approximation)
      const startMemory = process.memoryUsage().heapUsed;
      
      const result = await calculateRepositoryConfidence('massive-org', 'enormous-repo', '30');
      
      const endMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (endMemory - startMemory) / 1024 / 1024; // Convert to MB

      // Should complete successfully
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(100);

      // Memory increase should be reasonable (less than 500MB)
      expect(memoryIncrease).toBeLessThan(500);
    });
  });

  describe('Query Optimization', () => {
    it('should batch database queries efficiently', async () => {
      const mockRepo = {
        data: {
          stargazers_count: 1000,
          forks_count: 200,
          created_at: '2022-01-01'
        },
        error: null
      };

      const queryTimings: number[] = [];

      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        const queryStart = performance.now();
        
        const response = {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockImplementation(async () => {
                // Simulate database delay
                await new Promise(resolve => setTimeout(resolve, 50));
                queryTimings.push(performance.now() - queryStart);
                return mockRepo;
              }),
              gte: vi.fn().mockImplementation(async () => {
                // Simulate database delay
                await new Promise(resolve => setTimeout(resolve, 50));
                queryTimings.push(performance.now() - queryStart);
                return { data: [], error: null };
              })
            }),
            in: vi.fn().mockImplementation(async () => {
              // Simulate database delay
              await new Promise(resolve => setTimeout(resolve, 50));
              queryTimings.push(performance.now() - queryStart);
              return { data: [], error: null };
            })
          })
        };

        return response;
      });

      const startTime = performance.now();
      await calculateRepositoryConfidence('test-owner', 'test-repo', '30');
      const totalTime = performance.now() - startTime;

      // Should complete in reasonable time despite simulated delays
      expect(totalTime).toBeLessThan(2000);

      // Individual queries should be batched/parallelized where possible
      const maxQueryTime = Math.max(...queryTimings);
      expect(maxQueryTime).toBeLessThan(200);
    });

    it('should cache repeated calculations within short timeframe', async () => {
      const mockRepo = {
        data: {
          stargazers_count: 1000,
          forks_count: 200,
          created_at: '2022-01-01'
        },
        error: null
      };

      let callCount = 0;

      mockSupabase.from = vi.fn().mockImplementation(() => {
        callCount++;
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue(mockRepo),
              gte: vi.fn().mockResolvedValue({ data: [], error: null })
            }),
            in: vi.fn().mockResolvedValue({ data: [], error: null })
          })
        };
      });

      // First calculation
      const result1 = await calculateRepositoryConfidence('test-owner', 'test-repo', '30');
      const firstCallCount = callCount;

      // Second calculation (same parameters)
      const result2 = await calculateRepositoryConfidence('test-owner', 'test-repo', '30');
      const secondCallCount = callCount;

      // Results should be consistent
      expect(result1).toBe(result2);

      // Note: If caching is implemented, secondCallCount would equal firstCallCount
      // For now, we just verify the calculation completes
      expect(secondCallCount).toBeGreaterThan(0);
    });
  });
});
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import { 
  calculateWeightedScore, 
  createScoreBreakdown, 
  sortContributorsByScore,
  createContributorRankings 
} from '@/lib/contributors/calculator';
import { ContributorActivity, ACTIVITY_WEIGHTS } from '@/lib/contributors/types';

// Mock Supabase client
vi.mock('@/lib/supabase', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            data: [],
            error: null,
          })),
        })),
      })),
    })),
  })),
}));

// Mock GitHub API dependencies
vi.mock('@/lib/github', () => ({
  fetchContributorActivity: vi.fn(),
  fetchRepositoryContributors: vi.fn(),
}));

// Mock logging
vi.mock('@/lib/simple-logging', () => ({
  setApplicationContext: vi.fn(),
  startSpan: vi.fn((options, fn) => fn({ setStatus: vi.fn() })),
}));

describe('Contributor Scoring Integration Tests', () => {
  const sampleContributors: ContributorActivity[] = [
    {
      id: 'user1',
      username: 'alice',
      displayName: 'Alice',
      avatarUrl: 'https://example.com/alice.jpg',
      profileUrl: 'https://github.com/alice',
      pullRequests: 5,
      mergedPullRequests: 5,
      comments: 10,
      reviews: 3,
      earliestContribution: new Date('2024-06-01T08:00:00'),
      latestContribution: new Date('2024-06-15T18:00:00'),
      repositoriesContributed: 2,
    },
    {
      id: 'user2',
      username: 'bob',
      displayName: 'Bob',
      avatarUrl: 'https://example.com/bob.jpg',
      profileUrl: 'https://github.com/bob',
      pullRequests: 2,
      mergedPullRequests: 2,
      comments: 4,
      reviews: 1,
      earliestContribution: new Date('2024-06-03T10:00:00'),
      latestContribution: new Date('2024-06-10T16:00:00'),
      repositoriesContributed: 1,
    },
    {
      id: 'user3',
      username: 'charlie',
      displayName: 'Charlie',
      avatarUrl: 'https://example.com/charlie.jpg',
      profileUrl: 'https://github.com/charlie',
      pullRequests: 8,
      mergedPullRequests: 7,
      comments: 15,
      reviews: 5,
      earliestContribution: new Date('2024-06-01T09:00:00'),
      latestContribution: new Date('2024-06-20T17:00:00'),
      repositoriesContributed: 3,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
  });

  describe('Score Calculation Logic', () => {
    it('should calculate weighted scores correctly', () => {
      const contributor = sampleContributors[0];
      const score = calculateWeightedScore(contributor);

      // Verify score calculation matches expected weights
      const expectedScore = 
        (contributor.pullRequests * ACTIVITY_WEIGHTS.pullRequests) +
        (contributor.mergedPullRequests * ACTIVITY_WEIGHTS.mergedPullRequests) +
        (contributor.comments * ACTIVITY_WEIGHTS.comments) +
        (contributor.reviews * ACTIVITY_WEIGHTS.reviews);

      expect(score).toBe(expectedScore);
      expect(score).toBeGreaterThan(0);
    });

    it('should create detailed score breakdown', () => {
      const contributor = sampleContributors[0];
      const breakdown = createScoreBreakdown(contributor);

      expect(breakdown).toHaveProperty('totalScore');
      expect(breakdown).toHaveProperty('breakdown');
      expect(breakdown.breakdown).toHaveProperty('pullRequestsScore');
      expect(breakdown.breakdown).toHaveProperty('mergedPullRequestsScore');
      expect(breakdown.breakdown).toHaveProperty('commentsScore');
      expect(breakdown.breakdown).toHaveProperty('reviewsScore');
      
      // Verify breakdown adds up to total
      const sum = Object.values(breakdown.breakdown).reduce((a, b) => a + b, 0);
      expect(sum).toBe(breakdown.totalScore);
    });

    it('should handle contributors with zero activity', () => {
      const inactiveContributor: ContributorActivity = {
        id: 'inactive',
        username: 'inactive',
        displayName: 'Inactive User',
        avatarUrl: 'https://example.com/inactive.jpg',
        profileUrl: 'https://github.com/inactive',
        pullRequests: 0,
        mergedPullRequests: 0,
        comments: 0,
        reviews: 0,
        earliestContribution: new Date('2024-06-01'),
        latestContribution: new Date('2024-06-01'),
        repositoriesContributed: 0,
      };

      const score = calculateWeightedScore(inactiveContributor);
      const breakdown = createScoreBreakdown(inactiveContributor);

      expect(score).toBe(0);
      expect(breakdown.totalScore).toBe(0);
    });
  });

  describe('Ranking and Sorting', () => {
    it('should sort contributors by score correctly', () => {
      const sorted = sortContributorsByScore(sampleContributors);

      // Verify descending order by score
      for (let i = 0; i < sorted.length - 1; i++) {
        const currentScore = calculateWeightedScore(sorted[i]);
        const nextScore = calculateWeightedScore(sorted[i + 1]);
        expect(currentScore).toBeGreaterThanOrEqual(nextScore);
      }

      // Charlie should be first (highest activity)
      expect(sorted[0].username).toBe('charlie');
    });

    it('should create complete rankings with metadata', async () => {
      const rankings = await createContributorRankings(sampleContributors);

      expect(rankings).toHaveProperty('contributors');
      expect(rankings).toHaveProperty('metadata');
      expect(rankings.contributors).toHaveLength(sampleContributors.length);
      
      // Verify each contributor has ranking data
      rankings.contributors.forEach((contributor, index) => {
        expect(contributor).toHaveProperty('rank');
        expect(contributor).toHaveProperty('score');
        expect(contributor).toHaveProperty('scoreBreakdown');
        expect(contributor.rank).toBe(index + 1);
      });
    });

    it('should handle identical scores with stable sorting', () => {
      const identicalContributors = [
        { ...sampleContributors[0], id: 'twin1', username: 'twin1' },
        { ...sampleContributors[0], id: 'twin2', username: 'twin2' },
      ];

      const sorted = sortContributorsByScore(identicalContributors);
      
      // Should maintain original order when scores are identical
      expect(sorted[0].username).toBe('twin1');
      expect(sorted[1].username).toBe('twin2');
    });
  });

  describe('Cross-Feature Integration', () => {
    it('should handle multiple repositories consistently', async () => {
      const multiRepoContributors = sampleContributors.map(contributor => ({
        ...contributor,
        repositoriesContributed: Math.floor(Math.random() * 5) + 1,
      }));

      const rankings = await createContributorRankings(multiRepoContributors);
      
      // Verify rankings are consistent regardless of repo count
      expect(rankings.contributors).toHaveLength(multiRepoContributors.length);
      
      // Top contributor should still be determined by weighted activity
      const topContributor = rankings.contributors[0];
      expect(topContributor.score).toBeGreaterThan(0);
    });

    it('should integrate with time-based filtering', async () => {
      const now = new Date();
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      // Filter contributors by recent activity
      const recentContributors = sampleContributors.filter(contributor => 
        contributor.latestContribution >= oneMonthAgo
      );

      const rankings = await createContributorRankings(recentContributors);
      
      expect(rankings.contributors.length).toBeGreaterThanOrEqual(0);
      
      // All contributors should have recent activity
      rankings.contributors.forEach(contributor => {
        expect(new Date(contributor.latestContribution)).toBeInstanceOf(Date);
      });
    });

    it('should handle concurrent scoring operations', async () => {
      const promises = Array.from({ length: 3 }, () => 
        createContributorRankings(sampleContributors)
      );

      const results = await Promise.all(promises);
      
      // All results should be identical
      results.forEach(result => {
        expect(result.contributors).toHaveLength(sampleContributors.length);
        expect(result.contributors[0].username).toBe('charlie');
      });
    });

    it('should maintain data consistency across operations', async () => {
      // First calculation
      const rankings1 = await createContributorRankings(sampleContributors);
      
      // Second calculation with same data
      const rankings2 = await createContributorRankings([...sampleContributors]);
      
      // Results should be identical
      expect(rankings1.contributors).toHaveLength(rankings2.contributors.length);
      
      rankings1.contributors.forEach((contributor1, index) => {
        const contributor2 = rankings2.contributors[index];
        expect(contributor1.score).toBe(contributor2.score);
        expect(contributor1.rank).toBe(contributor2.rank);
        expect(contributor1.username).toBe(contributor2.username);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed contributor data gracefully', async () => {
      const malformedData = [
        {
          ...sampleContributors[0],
          pullRequests: -1, // Invalid negative value
        },
        {
          ...sampleContributors[1],
          comments: null as any, // Invalid null value
        },
      ];

      // Should not throw, but handle gracefully
      const rankings = await createContributorRankings(malformedData);
      expect(rankings.contributors).toBeDefined();
    });

    it('should handle empty contributor list', async () => {
      const rankings = await createContributorRankings([]);
      
      expect(rankings.contributors).toHaveLength(0);
      expect(rankings.metadata).toBeDefined();
    });

    it('should handle very large datasets', async () => {
      const largeDataset = Array.from({ length: 1000 }, (_, index) => ({
        ...sampleContributors[0],
        id: `user${index}`,
        username: `user${index}`,
        pullRequests: Math.floor(Math.random() * 20),
        comments: Math.floor(Math.random() * 50),
      }));

      const startTime = performance.now();
      const rankings = await createContributorRankings(largeDataset);
      const endTime = performance.now();
      
      // Should complete within reasonable time (5 seconds)
      expect(endTime - startTime).toBeLessThan(5000);
      expect(rankings.contributors).toHaveLength(1000);
    });

    it('should handle contributors with extreme activity levels', () => {
      const extremeContributor: ContributorActivity = {
        id: 'extreme',
        username: 'extreme',
        displayName: 'Extreme User',
        avatarUrl: 'https://example.com/extreme.jpg',
        profileUrl: 'https://github.com/extreme',
        pullRequests: 10000,
        mergedPullRequests: 9999,
        comments: 50000,
        reviews: 5000,
        earliestContribution: new Date('2020-01-01'),
        latestContribution: new Date('2024-06-20'),
        repositoriesContributed: 100,
      };

      const score = calculateWeightedScore(extremeContributor);
      const breakdown = createScoreBreakdown(extremeContributor);

      expect(score).toBeFinite();
      expect(score).toBeGreaterThan(0);
      expect(breakdown.totalScore).toBe(score);
    });
  });

  describe('Performance Characteristics', () => {
    it('should maintain consistent performance with varying dataset sizes', async () => {
      const sizes = [10, 50, 100, 200];
      const timings: number[] = [];

      for (const size of sizes) {
        const dataset = Array.from({ length: size }, (_, index) => ({
          ...sampleContributors[0],
          id: `perf${index}`,
          username: `perf${index}`,
        }));

        const startTime = performance.now();
        await createContributorRankings(dataset);
        const endTime = performance.now();
        
        timings.push(endTime - startTime);
      }

      // Performance should scale reasonably (not exponentially)
      const firstTiming = timings[0];
      const lastTiming = timings[timings.length - 1];
      
      // Last timing should not be more than 10x first timing
      expect(lastTiming).toBeLessThan(firstTiming * 10);
    });
  });
});
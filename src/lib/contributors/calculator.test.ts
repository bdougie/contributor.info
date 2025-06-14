/**
 * Unit tests for contributor calculation and ranking logic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  calculateWeightedScore,
  createScoreBreakdown,
  calculateTotalActivity,
  meetsActivityThreshold,
  sortContributorsByScore,
  createContributorRankings,
  determineMonthlyWinner,
  createLeaderboard,
  getCurrentDisplayData,
  analyzeContributorTrends,
  validateContributorData,
  createContributorRankingsCached,
  cacheUtils,
  DEFAULT_CALCULATION_CONFIG,
} from './calculator';
import { ContributorActivity, ACTIVITY_WEIGHTS, CyclePhase } from './types';

describe('Contributor Calculator', () => {
  // Sample test data
  const sampleContributor: ContributorActivity = {
    id: 'user1',
    username: 'testuser',
    displayName: 'Test User',
    avatarUrl: 'https://example.com/avatar.jpg',
    profileUrl: 'https://github.com/testuser',
    pullRequests: 2,
    comments: 4,
    reviews: 1,
    earliestContribution: new Date('2024-06-01'),
    latestContribution: new Date('2024-06-15'),
    repositoriesContributed: 1,
  };

  const sampleContributors: ContributorActivity[] = [
    {
      ...sampleContributor,
      id: 'user1',
      username: 'alice',
      pullRequests: 5,
      comments: 10,
      reviews: 3,
      earliestContribution: new Date('2024-06-01T08:00:00'),
    },
    {
      ...sampleContributor,
      id: 'user2',
      username: 'bob',
      pullRequests: 3,
      comments: 6,
      reviews: 2,
      earliestContribution: new Date('2024-06-01T10:00:00'),
    },
    {
      ...sampleContributor,
      id: 'user3',
      username: 'charlie',
      pullRequests: 1,
      comments: 2,
      reviews: 0,
      earliestContribution: new Date('2024-06-02'),
    },
  ];

  beforeEach(() => {
    vi.useRealTimers();
    cacheUtils.clear();
  });

  describe('calculateWeightedScore', () => {
    it('should calculate correct weighted score', () => {
      const score = calculateWeightedScore(sampleContributor);
      const expected = 
        (2 * ACTIVITY_WEIGHTS.PULL_REQUESTS) +
        (4 * ACTIVITY_WEIGHTS.COMMENTS) +
        (1 * ACTIVITY_WEIGHTS.REVIEWS);
      
      expect(score).toBe(expected); // 2*1 + 4*3 + 1*3 = 17
    });

    it('should handle zero activity', () => {
      const zeroContributor = {
        ...sampleContributor,
        pullRequests: 0,
        comments: 0,
        reviews: 0,
      };
      
      expect(calculateWeightedScore(zeroContributor)).toBe(0);
    });

    it('should use correct activity weights', () => {
      const contributor = {
        ...sampleContributor,
        pullRequests: 1,
        comments: 1,
        reviews: 1,
      };
      
      const score = calculateWeightedScore(contributor);
      const expected = ACTIVITY_WEIGHTS.PULL_REQUESTS + ACTIVITY_WEIGHTS.COMMENTS + ACTIVITY_WEIGHTS.REVIEWS;
      
      expect(score).toBe(expected); // 1 + 3 + 3 = 7
    });
  });

  describe('createScoreBreakdown', () => {
    it('should create detailed score breakdown', () => {
      const breakdown = createScoreBreakdown(sampleContributor);
      
      expect(breakdown).toEqual({
        pullRequestsScore: 2 * ACTIVITY_WEIGHTS.PULL_REQUESTS,
        commentsScore: 4 * ACTIVITY_WEIGHTS.COMMENTS,
        reviewsScore: 1 * ACTIVITY_WEIGHTS.REVIEWS,
      });
    });
  });

  describe('calculateTotalActivity', () => {
    it('should sum all activity types', () => {
      const total = calculateTotalActivity(sampleContributor);
      expect(total).toBe(7); // 2 + 4 + 1
    });

    it('should handle zero activity', () => {
      const zeroContributor = {
        ...sampleContributor,
        pullRequests: 0,
        comments: 0,
        reviews: 0,
      };
      
      expect(calculateTotalActivity(zeroContributor)).toBe(0);
    });
  });

  describe('meetsActivityThreshold', () => {
    it('should return true when activity meets threshold', () => {
      expect(meetsActivityThreshold(sampleContributor, 5)).toBe(true); // 7 >= 5
      expect(meetsActivityThreshold(sampleContributor, 7)).toBe(true); // 7 >= 7
    });

    it('should return false when activity below threshold', () => {
      expect(meetsActivityThreshold(sampleContributor, 8)).toBe(false); // 7 < 8
      expect(meetsActivityThreshold(sampleContributor, 10)).toBe(false); // 7 < 10
    });
  });

  describe('sortContributorsByScore', () => {
    it('should sort by weighted score descending', () => {
      const sorted = sortContributorsByScore(sampleContributors);
      
      // Alice should be first (highest score), then Bob, then Charlie
      expect(sorted[0].username).toBe('alice');
      expect(sorted[1].username).toBe('bob');
      expect(sorted[2].username).toBe('charlie');
    });

    it('should use tie-breaker for equal scores', () => {
      const tiedContributors: ContributorActivity[] = [
        {
          ...sampleContributor,
          id: 'user1',
          username: 'early',
          pullRequests: 5, // Score: 5
          comments: 0,
          reviews: 0,
          earliestContribution: new Date('2024-06-01T08:00:00'),
        },
        {
          ...sampleContributor,
          id: 'user2',
          username: 'late',
          pullRequests: 5, // Score: 5 (same as above)
          comments: 0,
          reviews: 0,
          earliestContribution: new Date('2024-06-01T10:00:00'),
        },
      ];
      
      const sorted = sortContributorsByScore(tiedContributors);
      
      // Earlier contributor should come first in tie
      expect(sorted[0].username).toBe('early');
      expect(sorted[1].username).toBe('late');
    });

    it('should not modify original array', () => {
      const original = [...sampleContributors];
      sortContributorsByScore(sampleContributors);
      
      expect(sampleContributors).toEqual(original);
    });
  });

  describe('createContributorRankings', () => {
    it('should create proper rankings with scores and positions', () => {
      const rankings = createContributorRankings(sampleContributors);
      
      expect(rankings).toHaveLength(3);
      
      // Check first place (Alice)
      expect(rankings[0].contributor.username).toBe('alice');
      expect(rankings[0].rank).toBe(1);
      expect(rankings[0].weightedScore).toBe(44); // 5*1 + 10*3 + 3*3
      expect(rankings[0].isTied).toBe(false);
      
      // Check second place (Bob)
      expect(rankings[1].contributor.username).toBe('bob');
      expect(rankings[1].rank).toBe(2);
      expect(rankings[1].weightedScore).toBe(27); // 3*1 + 6*3 + 2*3
      
      // Check third place (Charlie)
      expect(rankings[2].contributor.username).toBe('charlie');
      expect(rankings[2].rank).toBe(3);
      expect(rankings[2].weightedScore).toBe(7); // 1*1 + 2*3 + 0*3
    });

    it('should filter by activity threshold', () => {
      const config = { minimumActivityThreshold: 6 };
      const rankings = createContributorRankings(sampleContributors, config);
      
      // Only Alice (15 total) and Bob (11 total) should qualify
      expect(rankings).toHaveLength(2);
      expect(rankings[0].contributor.username).toBe('alice');
      expect(rankings[1].contributor.username).toBe('bob');
    });

    it('should limit leaderboard size', () => {
      const config = { maxLeaderboardSize: 2 };
      const rankings = createContributorRankings(sampleContributors, config);
      
      expect(rankings).toHaveLength(2);
    });

    it('should detect ties correctly', () => {
      const tiedContributors: ContributorActivity[] = [
        {
          ...sampleContributor,
          id: 'user1',
          username: 'user1',
          pullRequests: 5, // Score: 5
          comments: 0,
          reviews: 0,
          earliestContribution: new Date('2024-06-01T08:00:00'),
        },
        {
          ...sampleContributor,
          id: 'user2',
          username: 'user2',
          pullRequests: 5, // Score: 5 (tied)
          comments: 0,
          reviews: 0,
          earliestContribution: new Date('2024-06-01T10:00:00'),
        },
        {
          ...sampleContributor,
          id: 'user3',
          username: 'user3',
          pullRequests: 3, // Score: 3 (different)
          comments: 0,
          reviews: 0,
          earliestContribution: new Date('2024-06-02'),
        },
      ];
      
      const rankings = createContributorRankings(tiedContributors);
      
      expect(rankings[0].rank).toBe(1);
      expect(rankings[0].isTied).toBe(true);
      expect(rankings[1].rank).toBe(1); // Same rank due to tie
      expect(rankings[1].isTied).toBe(true);
      expect(rankings[2].rank).toBe(3); // Rank 3, not 2, due to tie
      expect(rankings[2].isTied).toBe(false);
    });
  });

  describe('determineMonthlyWinner', () => {
    it('should return winner with highest score', () => {
      const winner = determineMonthlyWinner(sampleContributors, 5, 2024);
      
      expect(winner).not.toBeNull();
      expect(winner!.contributor.username).toBe('alice');
      expect(winner!.month.month).toBe(5);
      expect(winner!.month.year).toBe(2024);
      expect(winner!.wasTiebreaker).toBe(false);
    });

    it('should return null for empty contributor list', () => {
      const winner = determineMonthlyWinner([], 5, 2024);
      expect(winner).toBeNull();
    });

    it('should detect tiebreaker scenarios', () => {
      const tiedContributors: ContributorActivity[] = [
        {
          ...sampleContributor,
          id: 'user1',
          username: 'early',
          pullRequests: 5,
          comments: 0,
          reviews: 0,
          earliestContribution: new Date('2024-06-01T08:00:00'),
        },
        {
          ...sampleContributor,
          id: 'user2',
          username: 'late',
          pullRequests: 5,
          comments: 0,
          reviews: 0,
          earliestContribution: new Date('2024-06-01T10:00:00'),
        },
      ];
      
      const winner = determineMonthlyWinner(tiedContributors, 5, 2024);
      
      expect(winner!.contributor.username).toBe('early');
      expect(winner!.wasTiebreaker).toBe(true);
    });
  });

  describe('createLeaderboard', () => {
    it('should create complete leaderboard with metadata', () => {
      const leaderboard = createLeaderboard(sampleContributors, 5, 2024);
      
      expect(leaderboard.rankings).toHaveLength(3);
      expect(leaderboard.totalContributors).toBe(3);
      expect(leaderboard.period.month).toBe(5);
      expect(leaderboard.period.year).toBe(2024);
      expect(leaderboard.period.startDate).toEqual(new Date(2024, 5, 1));
      expect(leaderboard.minimumActivityThreshold).toBe(DEFAULT_CALCULATION_CONFIG.minimumActivityThreshold);
      expect(leaderboard.lastUpdated).toBeInstanceOf(Date);
    });

    it('should use custom configuration', () => {
      const config = { minimumActivityThreshold: 10 };
      const leaderboard = createLeaderboard(sampleContributors, 5, 2024, config);
      
      expect(leaderboard.minimumActivityThreshold).toBe(10);
      expect(leaderboard.rankings).toHaveLength(2); // Only Alice and Bob qualify
    });
  });

  describe('getCurrentDisplayData', () => {
    it('should return winner during announcement phase', () => {
      // Mock early month date (winner announcement phase)
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 5, 5)); // June 5, 2024
      
      const result = getCurrentDisplayData(sampleContributors, sampleContributors);
      
      expect(result.cycle.phase).toBe(CyclePhase.WINNER_ANNOUNCEMENT);
      expect(result.winner).toBeDefined();
      expect(result.leaderboard).toBeUndefined();
      
      vi.useRealTimers();
    });

    it('should return leaderboard during competition phase', () => {
      // Mock late month date (running leaderboard phase)
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 5, 15)); // June 15, 2024
      
      const result = getCurrentDisplayData(sampleContributors, sampleContributors);
      
      expect(result.cycle.phase).toBe(CyclePhase.RUNNING_LEADERBOARD);
      expect(result.leaderboard).toBeDefined();
      expect(result.winner).toBeUndefined();
      
      vi.useRealTimers();
    });
  });

  describe('analyzeContributorTrends', () => {
    const currentContributors: ContributorActivity[] = [
      { ...sampleContributor, id: 'user1', username: 'alice', pullRequests: 5 },
      { ...sampleContributor, id: 'user2', username: 'bob', pullRequests: 8 }, // Improved
      { ...sampleContributor, id: 'user4', username: 'diana', pullRequests: 3 }, // New
    ];

    const previousContributors: ContributorActivity[] = [
      { ...sampleContributor, id: 'user1', username: 'alice', pullRequests: 4 },
      { ...sampleContributor, id: 'user2', username: 'bob', pullRequests: 2 },
      { ...sampleContributor, id: 'user3', username: 'charlie', pullRequests: 1 }, // Left
    ];

    it('should identify new contributors', () => {
      const trends = analyzeContributorTrends(currentContributors, previousContributors);
      
      expect(trends.newContributors).toHaveLength(1);
      expect(trends.newContributors[0].username).toBe('diana');
    });

    it('should identify returning contributors', () => {
      const trends = analyzeContributorTrends(currentContributors, previousContributors);
      
      expect(trends.returningContributors).toHaveLength(2);
      expect(trends.returningContributors.map(c => c.username)).toContain('alice');
      expect(trends.returningContributors.map(c => c.username)).toContain('bob');
    });

    it('should identify top performers', () => {
      const trends = analyzeContributorTrends(currentContributors, previousContributors);
      
      expect(trends.topPerformers).toHaveLength(3);
      expect(trends.topPerformers[0].username).toBe('bob'); // Highest current score
    });

    it('should identify most improved contributors', () => {
      const trends = analyzeContributorTrends(currentContributors, previousContributors);
      
      expect(trends.mostImproved).toHaveLength(2);
      expect(trends.mostImproved[0].username).toBe('bob'); // Biggest improvement
    });

    it('should calculate total activity increase', () => {
      const trends = analyzeContributorTrends(currentContributors, previousContributors);
      
      // Current total: (5+4+1)*3 + (8+4+1)*3 + (3+4+1)*3 = 30 + 39 + 24 = 93
      // Previous total: (4+4+1)*3 + (2+4+1)*3 + (1+4+1)*3 = 27 + 21 + 18 = 66
      // Increase: 93 - 66 = 27
      expect(trends.totalActivityIncrease).toBeGreaterThan(0);
    });
  });

  describe('validateContributorData', () => {
    it('should validate correct data', () => {
      const result = validateContributorData(sampleContributors);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const invalidContributors = [
        { ...sampleContributor, id: '' }, // Missing ID
        { ...sampleContributor, username: '' }, // Missing username
      ];
      
      const result = validateContributorData(invalidContributors);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });

    it('should detect negative values', () => {
      const invalidContributors = [
        { ...sampleContributor, pullRequests: -1 },
      ];
      
      const result = validateContributorData(invalidContributors);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('negative activity values');
    });

    it('should detect date inconsistencies', () => {
      const invalidContributors = [
        {
          ...sampleContributor,
          earliestContribution: new Date('2024-06-15'),
          latestContribution: new Date('2024-06-01'), // Earlier than earliest
        },
      ];
      
      const result = validateContributorData(invalidContributors);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('earliest contribution after latest contribution');
    });

    it('should warn about zero activity', () => {
      const zeroActivityContributors = [
        {
          ...sampleContributor,
          pullRequests: 0,
          comments: 0,
          reviews: 0,
        },
      ];
      
      const result = validateContributorData(zeroActivityContributors);
      
      expect(result.isValid).toBe(true); // Still valid, just warning
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('zero activity');
    });

    it('should warn about unusually high activity', () => {
      const highActivityContributors = [
        {
          ...sampleContributor,
          pullRequests: 1001, // Over the 1000 threshold
          comments: 0,
          reviews: 0,
        },
      ];
      
      const result = validateContributorData(highActivityContributors);
      
      expect(result.isValid).toBe(true); // Still valid, just warning
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('unusually high activity');
    });

    it('should detect duplicate contributors', () => {
      const duplicateContributors = [
        sampleContributor,
        { ...sampleContributor }, // Same ID
      ];
      
      const result = validateContributorData(duplicateContributors);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Duplicate contributors');
    });
  });

  describe('caching functionality', () => {
    it('should cache rankings results', () => {
      const rankings1 = createContributorRankingsCached(sampleContributors);
      const rankings2 = createContributorRankingsCached(sampleContributors);
      
      expect(rankings1).toEqual(rankings2);
      expect(cacheUtils.size()).toBeGreaterThan(0);
    });

    it('should respect cache disabled setting', () => {
      const config = { cache: { enabled: false, ttl: 1000, keyPrefix: 'test' } };
      
      createContributorRankingsCached(sampleContributors, config);
      expect(cacheUtils.size()).toBe(0);
    });

    it('should clear cache', () => {
      createContributorRankingsCached(sampleContributors);
      expect(cacheUtils.size()).toBeGreaterThan(0);
      
      cacheUtils.clear();
      expect(cacheUtils.size()).toBe(0);
    });
  });
});

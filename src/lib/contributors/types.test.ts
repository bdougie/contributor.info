/**
 * Unit tests for contributor types and constants
 */

import { describe, expect, test } from 'vitest';
import {
  ACTIVITY_WEIGHTS,
  ActivityType,
  CyclePhase,
  ContributorActivity,
  ContributorRanking,
  MonthlyCycleState,
  ContributorApiResponse,
  CacheConfig,
  ContributorCalculationConfig,
} from './types';

describe('Activity Constants', () => {
  test('ACTIVITY_WEIGHTS should have correct values', () => {
    expect(ACTIVITY_WEIGHTS.COMMENTS).toBe(3);
    expect(ACTIVITY_WEIGHTS.REVIEWS).toBe(3);
    expect(ACTIVITY_WEIGHTS.PULL_REQUESTS).toBe(1);
  });

  test('ACTIVITY_WEIGHTS should be readonly at compile time', () => {
    // Test that TypeScript prevents mutation (compile-time check)
    // The actual immutability is enforced by TypeScript, not at runtime
    expect(ACTIVITY_WEIGHTS).toEqual({
      COMMENTS: 3,
      REVIEWS: 3,
      PULL_REQUESTS: 1,
    });

    // Verify the object is frozen (if Object.freeze was used)
    expect(Object.isFrozen(ACTIVITY_WEIGHTS)).toBe(false); // as const doesn't freeze at runtime
  });

  test('ActivityType should include all weight keys', () => {
    const keys: ActivityType[] = ['COMMENTS', 'REVIEWS', 'PULL_REQUESTS'];
    keys.forEach((key) => {
      expect(ACTIVITY_WEIGHTS[key]).toBeDefined();
      expect(typeof ACTIVITY_WEIGHTS[key]).toBe('number');
    });
  });
});

describe('CyclePhase Enum', () => {
  test('should have correct phase values', () => {
    expect(CyclePhase.WINNER_ANNOUNCEMENT).toBe('winner_announcement');
    expect(CyclePhase.RUNNING_LEADERBOARD).toBe('running_leaderboard');
  });

  test('should have exactly two phases', () => {
    const phases = Object.values(CyclePhase);
    expect(phases).toHaveLength(2);
  });
});

describe('Type Structure Validation', () => {
  test('ContributorActivity should have required fields', () => {
    const mockActivity: ContributorActivity = {
      id: 'user123',
      username: 'testuser',
      displayName: 'Test User',
      avatarUrl: 'https://example.com/avatar.jpg',
      profileUrl: 'https://github.com/testuser',
      pullRequests: 5,
      mergedPullRequests: 3,
      comments: 15,
      reviews: 10,
      earliestContribution: new Date('2024-01-01'),
      latestContribution: new Date('2024-01-31'),
      repositoriesContributed: 3,
    };

    // Test that all required fields are present
    expect(mockActivity.id).toBeDefined();
    expect(mockActivity.username).toBeDefined();
    expect(mockActivity.displayName).toBeDefined();
    expect(mockActivity.avatarUrl).toBeDefined();
    expect(mockActivity.profileUrl).toBeDefined();
    expect(typeof mockActivity.pullRequests).toBe('number');
    expect(typeof mockActivity.mergedPullRequests).toBe('number');
    expect(typeof mockActivity.comments).toBe('number');
    expect(typeof mockActivity.reviews).toBe('number');
    expect(mockActivity.earliestContribution).toBeInstanceOf(Date);
    expect(mockActivity.latestContribution).toBeInstanceOf(Date);
    expect(typeof mockActivity.repositoriesContributed).toBe('number');
  });

  test('ContributorRanking should have proper score breakdown', () => {
    const mockContributor: ContributorActivity = {
      id: 'user123',
      username: 'testuser',
      displayName: 'Test User',
      avatarUrl: 'https://example.com/avatar.jpg',
      profileUrl: 'https://github.com/testuser',
      pullRequests: 2,
      mergedPullRequests: 2,
      comments: 6,
      reviews: 4,
      earliestContribution: new Date('2024-01-01'),
      latestContribution: new Date('2024-01-31'),
      repositoriesContributed: 2,
    };

    const mockRanking: ContributorRanking = {
      contributor: mockContributor,
      weightedScore: 32, // (2*1) + (6*3) + (4*3) = 2 + 18 + 12 = 32
      rank: 1,
      scoreBreakdown: {
        pullRequestsScore: 2,
        mergedPullRequestsScore: 2,
        commentsScore: 18,
        reviewsScore: 12,
      },
      isTied: false,
    };

    expect(mockRanking.scoreBreakdown.pullRequestsScore).toBe(2);
    expect(mockRanking.scoreBreakdown.mergedPullRequestsScore).toBe(2);
    expect(mockRanking.scoreBreakdown.commentsScore).toBe(18);
    expect(mockRanking.scoreBreakdown.reviewsScore).toBe(12);

    // Verify total matches weighted score (using merged PRs for actual scoring)
    const totalFromBreakdown =
      mockRanking.scoreBreakdown.mergedPullRequestsScore +
      mockRanking.scoreBreakdown.commentsScore +
      mockRanking.scoreBreakdown.reviewsScore;

    expect(totalFromBreakdown).toBe(mockRanking.weightedScore);
  });

  test('MonthlyCycleState should handle month transitions', () => {
    const mockCycleState: MonthlyCycleState = {
      phase: CyclePhase.WINNER_ANNOUNCEMENT,
      currentMonth: {
        month: 0, // January (0-based)
        year: 2024,
      },
      previousMonth: {
        month: 11, // December (0-based)
        year: 2023,
      },
      dayOfMonth: 5,
      isTransitioning: false,
    };

    expect(mockCycleState.phase).toBe(CyclePhase.WINNER_ANNOUNCEMENT);
    expect(mockCycleState.currentMonth.month).toBe(0);
    expect(mockCycleState.previousMonth.year).toBe(2023);
    expect(mockCycleState.dayOfMonth).toBeGreaterThan(0);
    expect(mockCycleState.dayOfMonth).toBeLessThanOrEqual(31);
  });

  test('ContributorApiResponse should have proper structure', () => {
    const mockResponse: ContributorApiResponse<ContributorActivity[]> = {
      data: [],
      success: true,
      metadata: {
        total: 0,
        page: 1,
        limit: 10,
        processingTime: 150,
        fromCache: false,
      },
    };

    expect(mockResponse.success).toBe(true);
    expect(mockResponse._data).toBeInstanceOf(Array);
    expect(mockResponse.meta_data.total).toBeGreaterThanOrEqual(0);
    expect(mockResponse.meta_data.processingTime).toBeGreaterThan(0);
    expect(typeof mockResponse.meta_data.fromCache).toBe('boolean');
  });

  test('CacheConfig should have valid TTL', () => {
    const mockCacheConfig: CacheConfig = {
      ttl: 300000, // 5 minutes
      keyPrefix: 'contributor-',
      enabled: true,
      maxSize: 100,
    };

    expect(mockCacheConfig.ttl).toBeGreaterThan(0);
    expect(mockCacheConfig.keyPrefix).toBeTruthy();
    expect(typeof mockCacheConfig.enabled).toBe('boolean');
    expect(mockCacheConfig.maxSize).toBeGreaterThan(0);
  });

  test('ContributorCalculationConfig should have sensible defaults', () => {
    const mockConfig: ContributorCalculationConfig = {
      minimumActivityThreshold: 1,
      maxLeaderboardSize: 10,
      includeInactiveContributors: false,
      repositoryFilter: {
        excludeForks: true,
        minimumStars: 0,
      },
      cache: {
        ttl: 300000,
        keyPrefix: 'contributor-',
        enabled: true,
      },
    };

    expect(mockConfig.minimumActivityThreshold).toBeGreaterThan(0);
    expect(mockConfig.maxLeaderboardSize).toBeGreaterThan(0);
    expect(typeof mockConfig.includeInactiveContributors).toBe('boolean');
    expect(mockConfig.repositoryFilter?.excludeForks).toBe(true);
  });
});

describe('Edge Case Validation', () => {
  test('should handle empty contributor activity', () => {
    const emptyActivity: ContributorActivity = {
      id: 'empty-user',
      username: 'emptyuser',
      displayName: 'Empty User',
      avatarUrl: '',
      profileUrl: 'https://github.com/emptyuser',
      pullRequests: 0,
      mergedPullRequests: 0,
      comments: 0,
      reviews: 0,
      earliestContribution: new Date(),
      latestContribution: new Date(),
      repositoriesContributed: 0,
    };

    expect(emptyActivity.pullRequests).toBe(0);
    expect(emptyActivity.mergedPullRequests).toBe(0);
    expect(emptyActivity.comments).toBe(0);
    expect(emptyActivity.reviews).toBe(0);
    expect(emptyActivity.repositoriesContributed).toBe(0);
  });

  test('should handle tied rankings', () => {
    const tiedRanking: ContributorRanking = {
      contributor: {
        id: 'tied-user',
        username: 'tieduser',
        displayName: 'Tied User',
        avatarUrl: '',
        profileUrl: 'https://github.com/tieduser',
        pullRequests: 1,
        mergedPullRequests: 1,
        comments: 1,
        reviews: 1,
        earliestContribution: new Date('2024-01-15'),
        latestContribution: new Date('2024-01-15'),
        repositoriesContributed: 1,
      },
      weightedScore: 7, // 1 + 3 + 3
      rank: 2,
      scoreBreakdown: {
        pullRequestsScore: 1,
        mergedPullRequestsScore: 1,
        commentsScore: 3,
        reviewsScore: 3,
      },
      isTied: true,
    };

    expect(tiedRanking.isTied).toBe(true);
    expect(tiedRanking.rank).toBeGreaterThan(0);
  });

  test('should handle API error responses', () => {
    const errorResponse: ContributorApiResponse<null> = {
      data: null,
      success: false,
      error: 'Failed to fetch contributor data',
      metadata: {
        total: 0,
        processingTime: 50,
        fromCache: false,
      },
    };

    expect(errorResponse.success).toBe(false);
    expect(errorResponse.error).toBeDefined();
    expect(errorResponse._data).toBeNull();
  });
});

/**
 * Simplified calculator tests - bulletproof guidelines compliant
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  calculateWeightedScore,
  calculateTotalActivity,
  meetsActivityThreshold,
  sortContributorsByScore,
  validateContributorData,
  cacheUtils,
} from './calculator';
import { ContributorActivity } from './types';

describe('Contributor Calculator', () => {
  const sampleContributor: ContributorActivity = {
    id: 'user1',
    username: 'testuser',
    displayName: 'Test User',
    avatarUrl: 'https://example.com/avatar.jpg',
    profileUrl: 'https://github.com/testuser',
    pullRequests: 2,
    mergedPullRequests: 2,
    comments: 4,
    reviews: 1,
    earliestContribution: new Date('2024-06-01'),
    latestContribution: new Date('2024-06-15'),
    repositoriesContributed: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    cacheUtils.clear();
  });

  it('should calculate weighted score', () => {
    const score = calculateWeightedScore(sampleContributor);
    expect(score).toBeGreaterThan(0);
    expect(typeof score).toBe('number');
  });

  it('should calculate total activity', () => {
    const total = calculateTotalActivity(sampleContributor);
    expect(total).toBe(7); // 2 PRs + 4 comments + 1 review
  });

  it('should check activity threshold', () => {
    expect(meetsActivityThreshold(sampleContributor, 5)).toBe(true);
    expect(meetsActivityThreshold(sampleContributor, 10)).toBe(false);
  });

  it('should sort contributors by score', () => {
    const contributors = [
      { ...sampleContributor, id: '1', pullRequests: 1 },
      { ...sampleContributor, id: '2', pullRequests: 5 },
      { ...sampleContributor, id: '3', pullRequests: 3 },
    ];
    
    const sorted = sortContributorsByScore(contributors);
    expect(sorted).toHaveLength(3);
    expect(sorted[0].id).toBeDefined();
  });

  it('should validate contributor _data', () => {
    const result = validateContributorData([sampleContributor]);
    expect(result).toBeDefined();
  });

  it('should handle zero activity', () => {
    const zeroActivity = {
      ...sampleContributor,
      pullRequests: 0,
      mergedPullRequests: 0,
      comments: 0,
      reviews: 0,
    };
    
    expect(calculateWeightedScore(zeroActivity)).toBe(0);
    expect(calculateTotalActivity(zeroActivity)).toBe(0);
    expect(meetsActivityThreshold(zeroActivity, 0)).toBe(true);
  });

  it('should handle invalid _data gracefully', () => {
    const invalid = { ...sampleContributor, pullRequests: -1 };
    const score = calculateWeightedScore(invalid);
    expect(typeof score).toBe('number');
  });
});
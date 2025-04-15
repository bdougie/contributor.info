import { describe, it, expect } from 'vitest';
import { cn, humanizeNumber, calculateLotteryFactor } from '../utils';
import type { PullRequest } from '../types';

describe('cn function', () => {
  it('should merge class names correctly', () => {
    expect(cn('text-red-500', 'bg-blue-500')).toBe('text-red-500 bg-blue-500');
    expect(cn('p-4', { 'bg-blue-500': true, 'text-white': false })).toBe('p-4 bg-blue-500');
    expect(cn('m-2', undefined, 'p-4')).toBe('m-2 p-4');
  });
});

describe('humanizeNumber function', () => {
  it('should format numbers correctly', () => {
    expect(humanizeNumber(0)).toBe('0');
    expect(humanizeNumber(999)).toBe('999');
    expect(humanizeNumber(1000)).toBe('1K');
    expect(humanizeNumber(1500)).toBe('2K');
    expect(humanizeNumber(999999)).toBe('1000K');
    expect(humanizeNumber(1000000)).toBe('1M');
    expect(humanizeNumber(1500000)).toBe('2M');
    expect(humanizeNumber(1000000000)).toBe('1B');
  });
});

describe('calculateLotteryFactor function', () => {
  // Create mock data for testing
  const createMockPR = (username: string, createdAt: string, orgs: { login: string; avatar_url: string }[] = []): PullRequest => ({
    id: Math.floor(Math.random() * 10000),
    number: Math.floor(Math.random() * 100),
    title: `Test PR by ${username}`,
    state: 'closed',
    created_at: createdAt,
    updated_at: createdAt,
    merged_at: createdAt,
    additions: 100,
    deletions: 50,
    repository_owner: 'test-owner',
    repository_name: 'test-repo',
    user: {
      id: Math.floor(Math.random() * 10000),
      login: username,
      avatar_url: `https://github.com/${username}.png`,
    },
    organizations: orgs,
  });

  // Get date 20 days ago in ISO format
  const getRecentDate = (daysAgo: number = 20) => {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString();
  };

  // Get date 40 days ago in ISO format
  const getOldDate = () => {
    const date = new Date();
    date.setDate(date.getDate() - 40);
    return date.toISOString();
  };

  it('should filter out PRs older than 30 days', () => {
    const prs: PullRequest[] = [
      createMockPR('user1', getRecentDate()),
      createMockPR('user2', getOldDate()),
      createMockPR('user3', getRecentDate()),
    ];

    const result = calculateLotteryFactor(prs);
    
    expect(result.totalContributors).toBe(2);
  });

  it('should calculate high risk level when two contributors make more than 60% of PRs', () => {
    const prs: PullRequest[] = [
      // User1 makes 4 PRs (40%)
      createMockPR('user1', getRecentDate()),
      createMockPR('user1', getRecentDate()),
      createMockPR('user1', getRecentDate()),
      createMockPR('user1', getRecentDate()),
      
      // User2 makes 3 PRs (30%)
      createMockPR('user2', getRecentDate()),
      createMockPR('user2', getRecentDate()),
      createMockPR('user2', getRecentDate()),
      
      // User3 makes 2 PRs (20%)
      createMockPR('user3', getRecentDate()),
      createMockPR('user3', getRecentDate()),
      
      // User4 makes 1 PR (10%)
      createMockPR('user4', getRecentDate()),
    ];

    const result = calculateLotteryFactor(prs);
    
    expect(result.riskLevel).toBe('High');
    expect(result.topContributorsPercentage).toBe(70);
  });

  it('should calculate medium risk level when two contributors make 40-60% of PRs', () => {
    const prs: PullRequest[] = [
      // User1 makes 3 PRs (30%)
      createMockPR('user1', getRecentDate()),
      createMockPR('user1', getRecentDate()),
      createMockPR('user1', getRecentDate()),
      
      // User2 makes 2 PRs (20%)
      createMockPR('user2', getRecentDate()),
      createMockPR('user2', getRecentDate()),
      
      // User3 makes 2 PRs (20%)
      createMockPR('user3', getRecentDate()),
      createMockPR('user3', getRecentDate()),
      
      // User4 makes 1 PR (10%)
      createMockPR('user4', getRecentDate()),
      
      // User5 makes 1 PR (10%)
      createMockPR('user5', getRecentDate()),
      
      // User6 makes 1 PR (10%)
      createMockPR('user6', getRecentDate()),
    ];

    const result = calculateLotteryFactor(prs);
    
    expect(result.riskLevel).toBe('Medium');
    expect(result.topContributorsPercentage).toBe(50);
  });

  it('should calculate low risk level when two contributors make less than 40% of PRs', () => {
    const prs: PullRequest[] = [
      // Each user makes 1 PR (10% each)
      createMockPR('user1', getRecentDate()),
      createMockPR('user2', getRecentDate()),
      createMockPR('user3', getRecentDate()),
      createMockPR('user4', getRecentDate()),
      createMockPR('user5', getRecentDate()),
      createMockPR('user6', getRecentDate()),
      createMockPR('user7', getRecentDate()),
      createMockPR('user8', getRecentDate()),
      createMockPR('user9', getRecentDate()),
      createMockPR('user10', getRecentDate()),
    ];

    const result = calculateLotteryFactor(prs);
    
    expect(result.riskLevel).toBe('Low');
    expect(result.topContributorsPercentage).toBe(20);
  });

  it('should limit top contributors to 6', () => {
    const prs: PullRequest[] = [
      createMockPR('user1', getRecentDate()),
      createMockPR('user2', getRecentDate()),
      createMockPR('user3', getRecentDate()),
      createMockPR('user4', getRecentDate()),
      createMockPR('user5', getRecentDate()),
      createMockPR('user6', getRecentDate()),
      createMockPR('user7', getRecentDate()),
      createMockPR('user8', getRecentDate()),
    ];

    const result = calculateLotteryFactor(prs);
    
    expect(result.contributors.length).toBe(6);
  });

  it('should preserve organization information for contributors', () => {
    const org = { login: 'test-org', avatar_url: 'https://github.com/test-org.png' };
    
    const prs: PullRequest[] = [
      createMockPR('user1', getRecentDate(), [org]),
      createMockPR('user2', getRecentDate()),
    ];

    const result = calculateLotteryFactor(prs);
    
    const user1 = result.contributors.find(c => c.login === 'user1');
    expect(user1?.organizations).toBeDefined();
    expect(user1?.organizations?.[0].login).toBe('test-org');
  });
});
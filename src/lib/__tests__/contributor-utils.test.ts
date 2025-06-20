import { describe, it, expect } from 'vitest';
import { findUserPullRequests, createContributorStats } from '../contributor-utils';
import type { PullRequest } from '@/lib/types';

describe('Contributor Utilities', () => {
  // Sample test data
  const mockPullRequests: PullRequest[] = [
    {
      id: 1,
      number: 101,
      title: "Fix navigation bug",
      state: "closed",
      created_at: "2023-01-01T10:00:00Z",
      updated_at: "2023-01-02T10:00:00Z",
      merged_at: "2023-01-02T10:00:00Z",
      closed_at: "2023-01-02T10:00:00Z",
      additions: 100,
      deletions: 20,
      repository_owner: "testowner",
      repository_name: "testrepo",
      html_url: "https://github.com/testowner/testrepo/pull/101",
      user: {
        id: 1001,
        login: "user1",
        avatar_url: "https://example.com/avatar1.png",
        type: "User"
      },
      organizations: [],
      reviews: [],
      comments: []
    },
    {
      id: 2,
      number: 102,
      title: "Add new feature",
      state: "open",
      created_at: "2023-01-03T10:00:00Z",
      updated_at: "2023-01-03T10:00:00Z",
      merged_at: null,
      closed_at: null,
      additions: 200,
      deletions: 50,
      repository_owner: "testowner",
      repository_name: "testrepo",
      html_url: "https://github.com/testowner/testrepo/pull/102",
      user: {
        id: 1001,
        login: "user1",
        avatar_url: "https://example.com/avatar1.png",
        type: "User"
      },
      organizations: [],
      reviews: [],
      comments: []
    },
    {
      id: 3,
      number: 103,
      title: "Refactor API endpoints",
      state: "closed",
      created_at: "2023-01-04T10:00:00Z",
      updated_at: "2023-01-05T10:00:00Z",
      merged_at: "2023-01-05T10:00:00Z",
      closed_at: "2023-01-05T10:00:00Z",
      additions: 150,
      deletions: 120,
      repository_owner: "testowner",
      repository_name: "testrepo",
      html_url: "https://github.com/testowner/testrepo/pull/103",
      user: {
        id: 1002,
        login: "user2",
        avatar_url: "https://example.com/avatar2.png",
        type: "User"
      },
      organizations: [],
      reviews: [],
      comments: []
    },
    {
      id: 4,
      number: 104,
      title: "Update documentation",
      state: "open",
      created_at: "2023-01-06T10:00:00Z",
      updated_at: "2023-01-06T10:00:00Z",
      merged_at: null,
      closed_at: null,
      additions: 50,
      deletions: 10,
      repository_owner: "testowner",
      repository_name: "testrepo",
      html_url: "https://github.com/testowner/testrepo/pull/104",
      author: {
        login: "user1", // Using author property instead of user
      },
      user: {
        id: 9999, // Different ID but same login in the author field
        login: "different-user",
        avatar_url: "https://example.com/different.png",
        type: "User"
      },
      organizations: [],
      reviews: [],
      comments: []
    },
    {
      id: 5,
      number: 105,
      title: "Fix dependency issues",
      state: "closed",
      created_at: "2023-01-07T10:00:00Z",
      updated_at: "2023-01-08T10:00:00Z",
      merged_at: "2023-01-08T10:00:00Z",
      closed_at: "2023-01-08T10:00:00Z",
      additions: 25,
      deletions: 15,
      repository_owner: "testowner",
      repository_name: "testrepo",
      html_url: "https://github.com/testowner/testrepo/pull/105",
      user: {
        id: 1003,
        login: "dependabot",
        avatar_url: "https://example.com/avatar3.png",
        type: "Bot"
      },
      organizations: [],
      reviews: [],
      comments: []
    }
  ];

  describe('findUserPullRequests', () => {
    it('should find pull requests by username (user.login)', () => {
      const result = findUserPullRequests(mockPullRequests, 'user1');
      expect(result).toHaveLength(3); // Should find 3 PRs (2 with user.login and 1 with author.login)
      expect(result.map(pr => pr.id)).toEqual([1, 2, 4]);
    });

    it('should find pull requests by username (author.login)', () => {
      const result = findUserPullRequests(mockPullRequests, 'user1');
      // Should include PR with id 4 which has author.login = 'user1'
      expect(result.some(pr => pr.id === 4)).toBe(true);
    });

    it('should find pull requests by userId if provided', () => {
      const result = findUserPullRequests(mockPullRequests, 'not-matching', '1001');
      expect(result).toHaveLength(2); // Should find PRs with user.id = 1001
      expect(result.map(pr => pr.id)).toEqual([1, 2]);
    });

    it('should be case-insensitive when matching usernames', () => {
      const result = findUserPullRequests(mockPullRequests, 'USER1');
      expect(result).toHaveLength(3); // Should find same 3 PRs with case-insensitive match
    });

    it('should return empty array if no matches found', () => {
      const result = findUserPullRequests(mockPullRequests, 'nonexistent-user');
      expect(result).toEqual([]);
    });

    it('should return empty array if username is empty', () => {
      const result = findUserPullRequests(mockPullRequests, '');
      expect(result).toEqual([]);
    });

    it('should return empty array if pull requests array is empty', () => {
      const result = findUserPullRequests([], 'user1');
      expect(result).toEqual([]);
    });
  });

  describe('createContributorStats', () => {
    it('should create correct stats for a contributor with multiple PRs', () => {
      const result = createContributorStats(
        mockPullRequests,
        'user1',
        'https://example.com/avatar1.png'
      );
      
      expect(result).toEqual({
        login: 'user1',
        avatar_url: 'https://example.com/avatar1.png',
        pullRequests: 3, // user1 has 3 PRs
        percentage: 60, // 3 out of 5 PRs = 60%
        recentPRs: mockPullRequests.filter(pr => 
          pr.user?.login === 'user1' || 
          (pr.author && pr.author.login === 'user1')
        ).slice(0, 5),
        organizations: []
      });
    });

    it('should create correct stats for a contributor with one PR', () => {
      const result = createContributorStats(
        mockPullRequests, 
        'user2',
        'https://example.com/avatar2.png'
      );
      
      expect(result).toEqual({
        login: 'user2',
        avatar_url: 'https://example.com/avatar2.png',
        pullRequests: 1, // user2 has 1 PR
        percentage: 20, // 1 out of 5 PRs = 20%
        recentPRs: [mockPullRequests[2]], // Only PR with id 3
        organizations: []
      });
    });

    it('should create stats with zero PRs if contributor has none', () => {
      const result = createContributorStats(
        mockPullRequests,
        'nonexistent-user',
        'https://example.com/avatar-none.png'
      );
      
      expect(result).toEqual({
        login: 'nonexistent-user',
        avatar_url: 'https://example.com/avatar-none.png',
        pullRequests: 0,
        percentage: 0,
        recentPRs: [],
        organizations: []
      });
    });

    it('should handle empty pull requests array', () => {
      const result = createContributorStats(
        [],
        'user1',
        'https://example.com/avatar1.png'
      );
      
      expect(result).toEqual({
        login: 'user1',
        avatar_url: 'https://example.com/avatar1.png',
        pullRequests: 0,
        percentage: 0,
        recentPRs: [],
        organizations: []
      });
    });

    it('should find PRs using userId if provided', () => {
      const result = createContributorStats(
        mockPullRequests,
        'different-display-name',
        'https://example.com/avatar1.png',
        '1001' // user ID that matches user1's PRs
      );
      
      expect(result.pullRequests).toBe(2); // Should find 2 PRs with user.id = 1001
      expect(result.percentage).toBe(40); // 2 out of 5 PRs = 40%
    });

    it('should limit recentPRs to maximum of 5', () => {
      // Create a test array with more than 5 PRs for the same user
      const extraPRs = Array(7).fill(0).map((_, i) => {
        // Create a proper PullRequest object by copying the template
        const prCopy = JSON.parse(JSON.stringify(mockPullRequests[0]));
        // Update the necessary fields
        prCopy.id = 100 + i;
        prCopy.number = 200 + i;
        prCopy.title = `Extra PR ${i+1}`;
        return prCopy as PullRequest;
      });
      
      const manyPRs: PullRequest[] = [
        ...mockPullRequests,
        ...extraPRs
      ];
      
      const result = createContributorStats(
        manyPRs,
        'user1',
        'https://example.com/avatar1.png'
      );
      
      expect(result.recentPRs).toHaveLength(5); // Should be limited to 5 even though there are more
    });
  });
});
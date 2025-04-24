import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { PullRequest } from '@/lib/types';

// This is a copy of the formatTimestamp function from use-pr-activity.ts
// Since it's not exported, we recreate it here for testing
function formatTimestamp(date: string): string {
  const now = new Date();
  const timestamp = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - timestamp.getTime()) / 1000);
  
  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  return `${Math.floor(diffInSeconds / 86400)} days ago`;
}

describe('use-pr-activity utilities', () => {
  // Mock the current date to make timestamp formatting predictable
  const mockDate = new Date('2023-04-24T12:00:00Z');
  const originalDate = global.Date;

  beforeEach(() => {
    // Mock Date constructor to always return our fixed date for "now"
    global.Date = class extends originalDate {
      constructor(...args: unknown[]) {
        if (args.length === 0) {
          super();
          return mockDate;
        }
        super(...(args as []));
      }
    } as unknown as typeof Date;
  });

  afterEach(() => {
    // Restore original Date
    global.Date = originalDate;
  });

  describe('formatTimestamp', () => {
    it('should format timestamps correctly based on time difference', () => {
      // Just now (less than 1 minute ago)
      expect(formatTimestamp('2023-04-24T11:59:30Z')).toBe('Just now');
      
      // Minutes ago
      expect(formatTimestamp('2023-04-24T11:30:00Z')).toBe('30 minutes ago');
      
      // Hours ago
      expect(formatTimestamp('2023-04-24T06:00:00Z')).toBe('6 hours ago');
      
      // Days ago
      expect(formatTimestamp('2023-04-20T12:00:00Z')).toBe('4 days ago');
    });
  });

  describe('PR Activity Logic', () => {
    // Test helper functions for activity generation
    it('should correctly identify bot users', () => {
      const botUser = {
        login: 'dependabot[bot]',
        type: 'Bot'
      };
      
      const normalUser = {
        login: 'normal-user',
        type: 'User'
      };
      
      // Bot detection logic from the hook
      const isBotUser1 = botUser.type === 'Bot' || botUser.login.includes('[bot]');
      const isBotUser2 = normalUser.type === 'Bot' || normalUser.login.includes('[bot]');
      
      expect(isBotUser1).toBe(true);
      expect(isBotUser2).toBe(false);
    });
    
    it('should extract repository information from PR URLs', () => {
      const prUrl = 'https://github.com/test-owner/test-repo/pull/101';
      
      // URL parsing logic from the hook
      const repoUrl = prUrl.split('/pull/')[0];
      const owner = repoUrl.split('github.com/')[1].split('/')[0];
      const repo = repoUrl.split('github.com/')[1].split('/')[1];
      
      expect(repoUrl).toBe('https://github.com/test-owner/test-repo');
      expect(owner).toBe('test-owner');
      expect(repo).toBe('test-repo');
    });
    
    it('should correctly sort activities by date', () => {
      const activities = [
        { id: 'activity1', createdAt: new Date('2023-04-20T10:00:00Z') },
        { id: 'activity2', createdAt: new Date('2023-04-23T10:00:00Z') },
        { id: 'activity3', createdAt: new Date('2023-04-21T10:00:00Z') }
      ];
      
      // Sorting logic from the hook
      const sortedActivities = [...activities].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );
      
      expect(sortedActivities[0].id).toBe('activity2'); // Newest first
      expect(sortedActivities[1].id).toBe('activity3');
      expect(sortedActivities[2].id).toBe('activity1'); // Oldest last
    });
  });
  
  describe('PR State Processing', () => {
    it('should correctly process different PR states', () => {
      // Test open PR
      const openPR: Partial<PullRequest> = {
        state: 'open',
        merged_at: null,
        closed_at: null
      };
      
      // Test merged PR
      const mergedPR: Partial<PullRequest> = {
        state: 'closed',
        merged_at: '2023-04-23T10:00:00Z',
        closed_at: '2023-04-23T10:00:00Z'
      };
      
      // Test closed (not merged) PR
      const closedPR: Partial<PullRequest> = {
        state: 'closed',
        merged_at: null,
        closed_at: '2023-04-23T10:00:00Z'
      };
      
      // Logic from hook for determining PR states
      const isOpen = openPR.state === 'open';
      const isMerged = mergedPR.merged_at !== null;
      const isClosedNotMerged = closedPR.state === 'closed' && closedPR.merged_at === null;
      
      expect(isOpen).toBe(true);
      expect(isMerged).toBe(true);
      expect(isClosedNotMerged).toBe(true);
    });
  });
});
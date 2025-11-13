/**
 * Unit tests for CSV export utility
 * Following bulletproof testing guidelines - focused, synchronous, minimal mocking
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { transformContributorsToCSV, exportContributorsToCSV } from '../csv-export';
import type { Contributor } from '@/components/features/workspace/ContributorsList';
import * as papaparse from 'papaparse';

// Mock papaparse
vi.mock('papaparse', () => ({
  unparse: vi.fn((data) => {
    // Simple mock implementation that returns CSV-like string
    if (!data || data.length === 0) return '';
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map((row: Record<string, string | number>) => Object.values(row).join(','));
    return [headers, ...rows].join('\n');
  }),
}));

describe('CSV Export Utility', () => {
  describe('transformContributorsToCSV', () => {
    it('should transform single contributor correctly', () => {
      const contributor: Contributor = {
        id: '1',
        username: 'johndoe',
        name: 'John Doe',
        avatar_url: 'https://example.com/avatar.jpg',
        contributions: {
          pull_requests: 25,
          issues: 10,
          commits: 150,
          reviews: 5,
          comments: 30,
        },
        stats: {
          first_contribution: '2024-01-01',
          last_contribution: '2024-12-01',
          contribution_streak_days: 180,
          contribution_trend: 15,
          repositories_contributed: 3,
          average_commit_frequency_days: 2,
        },
      };

      const result = transformContributorsToCSV([contributor]);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        Username: 'johndoe',
        Name: 'John Doe',
        'Pull Requests': 25,
        Issues: 10,
        Commits: 150,
        'Repositories Contributed': 3,
      });
    });

    it('should use username when name is missing', () => {
      const contributor: Contributor = {
        id: '1',
        username: 'johndoe',
        name: null,
        avatar_url: 'https://example.com/avatar.jpg',
        contributions: {
          pull_requests: 5,
          issues: 2,
          commits: 20,
          reviews: 1,
          comments: 3,
        },
        stats: {
          first_contribution: '2024-01-01',
          last_contribution: '2024-12-01',
          contribution_streak_days: 30,
          contribution_trend: 5,
          repositories_contributed: 1,
          average_commit_frequency_days: 3,
        },
      };

      const result = transformContributorsToCSV([contributor]);

      expect(result[0].Name).toBe('johndoe');
    });

    it('should handle multiple contributors', () => {
      const contributors: Contributor[] = [
        {
          id: '1',
          username: 'alice',
          name: 'Alice Smith',
          avatar_url: 'https://example.com/alice.jpg',
          contributions: {
            pull_requests: 30,
            issues: 15,
            commits: 200,
            reviews: 10,
            comments: 40,
          },
          stats: {
            first_contribution: '2024-01-01',
            last_contribution: '2024-12-01',
            contribution_streak_days: 200,
            contribution_trend: 20,
            repositories_contributed: 5,
            average_commit_frequency_days: 1,
          },
        },
        {
          id: '2',
          username: 'bob',
          name: 'Bob Johnson',
          avatar_url: 'https://example.com/bob.jpg',
          contributions: {
            pull_requests: 10,
            issues: 5,
            commits: 50,
            reviews: 3,
            comments: 15,
          },
          stats: {
            first_contribution: '2024-06-01',
            last_contribution: '2024-12-01',
            contribution_streak_days: 90,
            contribution_trend: 10,
            repositories_contributed: 2,
            average_commit_frequency_days: 4,
          },
        },
      ];

      const result = transformContributorsToCSV(contributors);

      expect(result).toHaveLength(2);
      expect(result[0].Username).toBe('alice');
      expect(result[1].Username).toBe('bob');
    });

    it('should handle zero contributions', () => {
      const contributor: Contributor = {
        id: '1',
        username: 'newbie',
        name: 'New Contributor',
        avatar_url: 'https://example.com/newbie.jpg',
        contributions: {
          pull_requests: 0,
          issues: 0,
          commits: 0,
          reviews: 0,
          comments: 0,
        },
        stats: {
          first_contribution: '2024-12-01',
          last_contribution: '2024-12-01',
          contribution_streak_days: 1,
          contribution_trend: 0,
          repositories_contributed: 0,
          average_commit_frequency_days: 0,
        },
      };

      const result = transformContributorsToCSV([contributor]);

      expect(result[0]).toEqual({
        Username: 'newbie',
        Name: 'New Contributor',
        'Pull Requests': 0,
        Issues: 0,
        Commits: 0,
        'Repositories Contributed': 0,
      });
    });

    it('should handle empty array', () => {
      const result = transformContributorsToCSV([]);

      expect(result).toHaveLength(0);
      expect(result).toEqual([]);
    });

    it('should handle large numbers', () => {
      const contributor: Contributor = {
        id: '1',
        username: 'prolific',
        name: 'Prolific Contributor',
        avatar_url: 'https://example.com/prolific.jpg',
        contributions: {
          pull_requests: 9999,
          issues: 5000,
          commits: 50000,
          reviews: 10000,
          comments: 25000,
        },
        stats: {
          first_contribution: '2020-01-01',
          last_contribution: '2024-12-01',
          contribution_streak_days: 1825,
          contribution_trend: 100,
          repositories_contributed: 250,
          average_commit_frequency_days: 0.1,
        },
      };

      const result = transformContributorsToCSV([contributor]);

      expect(result[0]['Pull Requests']).toBe(9999);
      expect(result[0].Commits).toBe(50000);
      expect(result[0]['Repositories Contributed']).toBe(250);
    });

    it('should maintain data types for numbers', () => {
      const contributor: Contributor = {
        id: '1',
        username: 'test',
        name: 'Test User',
        avatar_url: 'https://example.com/test.jpg',
        contributions: {
          pull_requests: 5,
          issues: 3,
          commits: 10,
          reviews: 2,
          comments: 8,
        },
        stats: {
          first_contribution: '2024-01-01',
          last_contribution: '2024-12-01',
          contribution_streak_days: 100,
          contribution_trend: 5,
          repositories_contributed: 2,
          average_commit_frequency_days: 2,
        },
      };

      const result = transformContributorsToCSV([contributor]);

      // Verify all numeric fields are numbers, not strings
      expect(typeof result[0]['Pull Requests']).toBe('number');
      expect(typeof result[0].Issues).toBe('number');
      expect(typeof result[0].Commits).toBe('number');
      expect(typeof result[0]['Repositories Contributed']).toBe('number');
    });
  });

  describe('exportContributorsToCSV', () => {
    let createElementSpy: ReturnType<typeof vi.spyOn>;
    let mockLink: {
      setAttribute: ReturnType<typeof vi.fn>;
      click: ReturnType<typeof vi.fn>;
      style: { visibility: string };
    };

    beforeEach(() => {
      // Mock document.createElement for link element
      mockLink = {
        setAttribute: vi.fn(),
        click: vi.fn(),
        style: { visibility: 'visible' },
      };

      createElementSpy = vi
        .spyOn(document, 'createElement')
        .mockReturnValue(mockLink as unknown as HTMLElement);

      // Mock document.body methods
      vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as Node);
      vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as Node);

      // Mock URL methods
      global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = vi.fn();

      // Mock Blob
      global.Blob = vi.fn((content, options) => ({
        content,
        options,
      })) as unknown as typeof Blob;
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should create CSV file with correct data', () => {
      const contributors: Contributor[] = [
        {
          id: '1',
          username: 'alice',
          name: 'Alice Smith',
          avatar_url: 'https://example.com/alice.jpg',
          contributions: {
            pull_requests: 10,
            issues: 5,
            commits: 50,
            reviews: 3,
            comments: 15,
          },
          stats: {
            first_contribution: '2024-01-01',
            last_contribution: '2024-12-01',
            contribution_streak_days: 100,
            contribution_trend: 10,
            repositories_contributed: 3,
            average_commit_frequency_days: 2,
          },
        },
      ];

      exportContributorsToCSV(contributors);

      // Verify papaparse.unparse was called
      expect(papaparse.unparse).toHaveBeenCalled();

      // Verify blob was created with CSV type
      expect(Blob).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ type: 'text/csv;charset=utf-8;' })
      );

      // Verify link was created and configured
      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(mockLink.setAttribute).toHaveBeenCalledWith('href', 'blob:mock-url');
      expect(mockLink.setAttribute).toHaveBeenCalledWith('download', 'contributors.csv');
      expect(mockLink.style.visibility).toBe('hidden');

      // Verify link was clicked and cleaned up
      expect(mockLink.click).toHaveBeenCalled();
      expect(document.body.appendChild).toHaveBeenCalled();
      expect(document.body.removeChild).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('should use custom filename when provided', () => {
      const contributors: Contributor[] = [
        {
          id: '1',
          username: 'test',
          name: 'Test User',
          avatar_url: 'https://example.com/test.jpg',
          contributions: {
            pull_requests: 5,
            issues: 2,
            commits: 20,
            reviews: 1,
            comments: 8,
          },
          stats: {
            first_contribution: '2024-01-01',
            last_contribution: '2024-12-01',
            contribution_streak_days: 50,
            contribution_trend: 5,
            repositories_contributed: 2,
            average_commit_frequency_days: 3,
          },
        },
      ];

      exportContributorsToCSV(contributors, 'my-custom-export.csv');

      expect(mockLink.setAttribute).toHaveBeenCalledWith('download', 'my-custom-export.csv');
    });

    it('should handle empty contributors array', () => {
      exportContributorsToCSV([]);

      // Should still create the file structure
      expect(papaparse.unparse).toHaveBeenCalled();
      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(mockLink.click).toHaveBeenCalled();
    });

    it('should clean up resources after export', () => {
      const contributors: Contributor[] = [
        {
          id: '1',
          username: 'cleanup-test',
          name: 'Cleanup Test',
          avatar_url: 'https://example.com/cleanup.jpg',
          contributions: {
            pull_requests: 1,
            issues: 1,
            commits: 1,
            reviews: 0,
            comments: 0,
          },
          stats: {
            first_contribution: '2024-01-01',
            last_contribution: '2024-12-01',
            contribution_streak_days: 1,
            contribution_trend: 0,
            repositories_contributed: 1,
            average_commit_frequency_days: 10,
          },
        },
      ];

      exportContributorsToCSV(contributors);

      // Verify cleanup happens
      expect(document.body.removeChild).toHaveBeenCalledWith(mockLink);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });
  });
});

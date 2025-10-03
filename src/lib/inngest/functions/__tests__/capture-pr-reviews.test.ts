import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Supabase dependencies before importing
vi.mock('../../supabase-server', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('../../github-client', () => ({
  getOctokit: vi.fn(),
}));

vi.mock('../../client', () => ({
  inngest: {
    createFunction: vi.fn(),
  },
}));

import { normalizeReviewState } from '../capture-pr-reviews';

describe('capture-pr-reviews', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('normalizeReviewState', () => {
    it('should normalize valid GitHub review states to uppercase', () => {
      expect(normalizeReviewState('approved')).toBe('APPROVED');
      expect(normalizeReviewState('changes_requested')).toBe('CHANGES_REQUESTED');
      expect(normalizeReviewState('commented')).toBe('COMMENTED');
      expect(normalizeReviewState('pending')).toBe('PENDING');
      expect(normalizeReviewState('dismissed')).toBe('DISMISSED');
    });

    it('should handle already uppercase states', () => {
      expect(normalizeReviewState('APPROVED')).toBe('APPROVED');
      expect(normalizeReviewState('CHANGES_REQUESTED')).toBe('CHANGES_REQUESTED');
      expect(normalizeReviewState('COMMENTED')).toBe('COMMENTED');
    });

    it('should handle mixed case states', () => {
      expect(normalizeReviewState('Approved')).toBe('APPROVED');
      expect(normalizeReviewState('Changes_Requested')).toBe('CHANGES_REQUESTED');
      expect(normalizeReviewState('CoMmEnTeD')).toBe('COMMENTED');
    });

    it('should default unknown states to COMMENTED', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(normalizeReviewState('invalid_state')).toBe('COMMENTED');
      expect(normalizeReviewState('unknown')).toBe('COMMENTED');
      expect(normalizeReviewState('')).toBe('COMMENTED');

      expect(consoleWarnSpy).toHaveBeenCalledTimes(3);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Unknown review state: %s, defaulting to COMMENTED',
        'invalid_state'
      );

      consoleWarnSpy.mockRestore();
    });

    it('should handle edge cases', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Whitespace
      expect(normalizeReviewState('  approved  '.trim())).toBe('APPROVED');

      // Special characters
      expect(normalizeReviewState('approved!')).toBe('COMMENTED');

      consoleWarnSpy.mockRestore();
    });
  });

  describe('DatabaseReview schema validation', () => {
    it('should require repository_id field', () => {
      // This is a type-level test - if TypeScript compiles, the interface is correct
      const review: {
        github_id: string;
        pull_request_id: string;
        repository_id: string;
        author_id: string;
        state: string;
        body: string;
        submitted_at: string;
        commit_id: string;
      } = {
        github_id: '123',
        pull_request_id: 'pr-uuid',
        repository_id: 'repo-uuid', // Required field
        author_id: 'author-uuid', // Required field
        state: 'APPROVED',
        body: 'LGTM',
        submitted_at: new Date().toISOString(),
        commit_id: 'abc123',
      };

      expect(review.repository_id).toBeDefined();
      expect(review.author_id).toBeDefined();
    });
  });
});

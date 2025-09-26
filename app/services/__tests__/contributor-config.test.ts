import { describe, it, expect, vi } from 'vitest';
import { isFeatureEnabled, isUserExcluded } from '../contributor-config';

describe('Contributor Configuration', () => {
  describe('isFeatureEnabled', () => {
    it('should return true when feature is enabled', () => {
      const config = {
        version: 1,
        features: {
          reviewer_suggestions: true,
          similar_issues: true,
          auto_comment: true,
        },
      };

      expect(isFeatureEnabled(config, 'reviewer_suggestions')).toBe(true);
      expect(isFeatureEnabled(config, 'similar_issues')).toBe(true);
      expect(isFeatureEnabled(config, 'auto_comment')).toBe(true);
    });

    it('should return false when feature is disabled', () => {
      const config = {
        version: 1,
        features: {
          reviewer_suggestions: false,
          similar_issues: true,
          auto_comment: false,
        },
      };

      expect(isFeatureEnabled(config, 'reviewer_suggestions')).toBe(false);
      expect(isFeatureEnabled(config, 'auto_comment')).toBe(false);
    });

    it('should return true when features object is missing', () => {
      const config = {
        version: 1,
      };

      expect(isFeatureEnabled(config, 'reviewer_suggestions')).toBe(true);
    });
  });

  describe('isUserExcluded', () => {
    const config = {
      version: 1,
      features: {},
      exclude_authors: ['dependabot[bot]', 'renovate[bot]'],
      exclude_reviewers: ['bot-account', 'test-user'],
    };

    it('should return true for excluded authors', () => {
      expect(isUserExcluded(config, 'dependabot[bot]', 'author')).toBe(true);
      expect(isUserExcluded(config, 'renovate[bot]', 'author')).toBe(true);
    });

    it('should return false for non-excluded authors', () => {
      expect(isUserExcluded(config, 'alice', 'author')).toBe(false);
      expect(isUserExcluded(config, 'bob', 'author')).toBe(false);
    });

    it('should return true for excluded reviewers', () => {
      expect(isUserExcluded(config, 'bot-account', 'reviewer')).toBe(true);
      expect(isUserExcluded(config, 'test-user', 'reviewer')).toBe(true);
    });

    it('should return false for non-excluded reviewers', () => {
      expect(isUserExcluded(config, 'alice', 'reviewer')).toBe(false);
      expect(isUserExcluded(config, 'bob', 'reviewer')).toBe(false);
    });

    it('should handle missing exclude lists', () => {
      const configWithoutExcludes = {
        version: 1,
        features: {},
      };

      expect(isUserExcluded(configWithoutExcludes, 'anyone', 'author')).toBe(false);
      expect(isUserExcluded(configWithoutExcludes, 'anyone', 'reviewer')).toBe(false);
    });
  });
});

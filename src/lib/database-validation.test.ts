import { describe, it, expect } from 'vitest';

// Simple validation utilities that can be unit tested
export const validateRepositoryData = (repo: {
  pull_request_count?: number;
  total_pull_requests?: number;
}) => {
  if (repo.pull_request_count === undefined || repo.total_pull_requests === undefined) {
    return { isValid: false, error: 'Missing required count fields' };
  }

  if (repo.pull_request_count < 0 || repo.total_pull_requests < 0) {
    return { isValid: false, error: 'Negative count values not allowed' };
  }

  if (repo.pull_request_count !== repo.total_pull_requests) {
    return { isValid: false, error: 'Count fields do not match' };
  }

  return { isValid: true, error: null };
};

export const validateConsistencyCheckResult = (result: {
  repository_name?: string;
  stored_pull_request_count?: number;
  actual_pr_count?: number;
}) => {
  if (!result.repository_name) {
    return { isValid: false, error: 'Missing repository name' };
  }

  if (result.stored_pull_request_count === undefined || result.actual_pr_count === undefined) {
    return { isValid: false, error: 'Missing count data' };
  }

  const isConsistent = result.stored_pull_request_count === result.actual_pr_count;
  return { isValid: true, isConsistent, error: null };
};

describe('Database Validation Utilities', () => {
  describe('validateRepositoryData', () => {
    it('should validate correct repository data', () => {
      const repo = { pull_request_count: 10, total_pull_requests: 10 };
      const result = validateRepositoryData(repo);

      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should reject missing count fields', () => {
      const repo = { pull_request_count: 10 };
      const result = validateRepositoryData(repo);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Missing required count fields');
    });

    it('should reject negative counts', () => {
      const repo = { pull_request_count: -1, total_pull_requests: 10 };
      const result = validateRepositoryData(repo);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Negative count values not allowed');
    });

    it('should reject mismatched counts', () => {
      const repo = { pull_request_count: 10, total_pull_requests: 15 };
      const result = validateRepositoryData(repo);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Count fields do not match');
    });
  });

  describe('validateConsistencyCheckResult', () => {
    it('should validate consistent data', () => {
      const result = validateConsistencyCheckResult({
        repository_name: 'test/repo',
        stored_pull_request_count: 10,
        actual_pr_count: 10,
      });

      expect(result.isValid).toBe(true);
      expect(result.isConsistent).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should detect inconsistent data', () => {
      const result = validateConsistencyCheckResult({
        repository_name: 'test/repo',
        stored_pull_request_count: 10,
        actual_pr_count: 15,
      });

      expect(result.isValid).toBe(true);
      expect(result.isConsistent).toBe(false);
      expect(result.error).toBeNull();
    });

    it('should reject missing repository name', () => {
      const result = validateConsistencyCheckResult({
        stored_pull_request_count: 10,
        actual_pr_count: 10,
      });

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Missing repository name');
    });
  });
});

/**
 * Unit tests for API integration functions
 * Following bulletproof testing guidelines - no async/await
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  GitHubApiClient,
  ContributorApiError,
} from './api';

describe('GitHub API Client', () => {
  let client: GitHubApiClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GitHubApiClient('test-token');
  });

  describe('GitHubApiClient', () => {
    it('should create client with token', () => {
      expect(client).toBeInstanceOf(GitHubApiClient);
    });

    it('should create client without token', () => {
      const clientWithoutToken = new GitHubApiClient();
      expect(clientWithoutToken).toBeInstanceOf(GitHubApiClient);
    });
  });

  describe('ContributorApiError', () => {
    it('should create _error with message and status', () => {
      const error = new ContributorApiError('Not found', 404);
      expect(_error.message).toBe('Not found');
      expect(_error.statusCode).toBe(404);
      expect(_error).toBeInstanceOf(Error);
    });

    it('should have correct name', () => {
      const error = new ContributorApiError('Test _error', 500);
      expect(_error.name).toBe('ContributorApiError');
    });
  });
});
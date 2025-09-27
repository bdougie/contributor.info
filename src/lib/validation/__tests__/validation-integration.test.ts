/**
 * Integration tests for validation schemas and utilities
 * Tests the complete validation system to ensure everything works together
 */

import { describe, it, expect } from 'vitest';
import {
  // Database schemas
  contributorCreateSchema,
  repositoryCreateSchema,
  pullRequestCreateSchema,

  // GitHub API schemas
  githubUserSchema,

  // Validation utilities
  validateData,
  validateBulkData,
  sanitizeString,
  sanitizeNumber,
  sanitizeUrl,
  sanitizeEmail,
  isValidGitHubUsername,
  isValidRepositoryFullName,
  createErrorMessage,
  ValidationError,
} from '../index';

describe('Validation Integration Tests', () => {
  describe('Database Schema Validation', () => {
    it('should validate contributor data correctly', () => {
      const validContributor = {
        github_id: 123456,
        username: 'octocat',
        display_name: 'The Octocat',
        avatar_url: 'https://github.com/images/error/octocat_happy.gif',
        profile_url: 'https://github.com/octocat',
        discord_url: null,
        linkedin_url: null,
        email: 'octocat@github.com',
        company: 'GitHub',
        location: 'San Francisco',
        bio: 'How people build software.',
        blog: 'https://github.blog',
        public_repos: 8,
        public_gists: 8,
        followers: 3938,
        following: 9,
        github_created_at: '2011-01-25T18:44:36Z',
        is_bot: false,
        is_active: true,
      };

      const result = validateData(contributorCreateSchema, validContributor);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should reject invalid contributor data', () => {
      const invalidContributor = {
        github_id: -1, // Invalid: negative
        username: '', // Invalid: empty
        email: 'invalid-email', // Invalid: not an email
        public_repos: -5, // Invalid: negative
      };

      const result = validateData(contributorCreateSchema, invalidContributor);
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should validate repository data correctly', () => {
      const validRepository = {
        github_id: 1296269,
        full_name: 'octocat/Hello-World',
        owner: 'octocat',
        name: 'Hello-World',
        description: 'This your first repo!',
        homepage: 'https://github.com',
        language: 'C',
        stargazers_count: 80,
        watchers_count: 9,
        forks_count: 9,
        open_issues_count: 0,
        size: 108,
        default_branch: 'master',
        is_fork: false,
        is_archived: false,
        is_disabled: false,
        is_private: false,
        has_issues: true,
        has_projects: true,
        has_wiki: true,
        has_pages: false,
        has_downloads: true,
        license: 'MIT',
        topics: ['example', 'tutorial'],
        github_created_at: '2011-01-26T19:01:12Z',
        github_updated_at: '2011-01-26T19:14:43Z',
        github_pushed_at: '2011-01-26T19:06:43Z',
        is_active: true,
      };

      const result = validateData(repositoryCreateSchema, validRepository);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should validate pull request data correctly', () => {
      const validPullRequest = {
        github_id: 1,
        number: 1347,
        title: 'new-feature',
        body: 'Please pull these awesome changes',
        state: 'open' as const,
        repository_id: '550e8400-e29b-41d4-a716-446655440000',
        author_id: '550e8400-e29b-41d4-a716-446655440001',
        assignee_id: null,
        base_branch: 'master',
        head_branch: 'new-topic',
        draft: false,
        mergeable: true,
        mergeable_state: 'clean',
        merged: false,
        merged_by_id: null,
        created_at: '2011-01-26T19:01:12Z',
        updated_at: '2011-01-26T19:14:43Z',
        merged_at: null,
        closed_at: null,
        additions: 100,
        deletions: 3,
        changed_files: 5,
        commits: 1,
        html_url: 'https://github.com/octocat/Hello-World/pull/1347',
        diff_url: 'https://github.com/octocat/Hello-World/pull/1347.diff',
        patch_url: 'https://github.com/octocat/Hello-World/pull/1347.patch',
      };

      const result = validateData(pullRequestCreateSchema, validPullRequest);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('GitHub API Schema Validation', () => {
    it('should validate GitHub user data correctly', () => {
      const validGitHubUser = {
        id: 1,
        login: 'octocat',
        avatar_url: 'https://github.com/images/error/octocat_happy.gif',
        gravatar_id: '',
        url: 'https://api.github.com/users/octocat',
        html_url: 'https://github.com/octocat',
        followers_url: 'https://api.github.com/users/octocat/followers',
        following_url: 'https://api.github.com/users/octocat/following{/other_user}',
        gists_url: 'https://api.github.com/users/octocat/gists{/gist_id}',
        starred_url: 'https://api.github.com/users/octocat/starred{/owner}{/repo}',
        subscriptions_url: 'https://api.github.com/users/octocat/subscriptions',
        organizations_url: 'https://api.github.com/users/octocat/orgs',
        repos_url: 'https://api.github.com/users/octocat/repos',
        events_url: 'https://api.github.com/users/octocat/events{/privacy}',
        received_events_url: 'https://api.github.com/users/octocat/received_events',
        type: 'User' as const,
        site_admin: false,
      };

      const result = validateData(githubUserSchema, validGitHubUser);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should reject invalid GitHub user data', () => {
      const invalidGitHubUser = {
        id: 'invalid', // Should be number
        login: '', // Should not be empty
        avatar_url: 'not-a-url', // Should be valid URL
        type: 'InvalidType', // Should be 'User' or 'Bot'
      };

      const result = validateData(githubUserSchema, invalidGitHubUser);
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('Validation Utilities', () => {
    it('should sanitize strings correctly', () => {
      expect(sanitizeString('  hello world  ')).toBe('hello world');
      expect(sanitizeString('')).toBe(null);
      expect(sanitizeString(null)).toBe(null);
      expect(sanitizeString(undefined)).toBe(null);
      expect(sanitizeString(123)).toBe('123');
    });

    it('should sanitize numbers correctly', () => {
      expect(sanitizeNumber('123')).toBe(123);
      expect(sanitizeNumber(123.45)).toBe(123.45);
      expect(sanitizeNumber('invalid')).toBe(null);
      expect(sanitizeNumber(null)).toBe(null);
      expect(sanitizeNumber(50, 0, 100)).toBe(50);
      expect(sanitizeNumber(150, 0, 100)).toBe(null);
      expect(sanitizeNumber(-10, 0, 100)).toBe(null);
    });

    it('should sanitize URLs correctly', () => {
      expect(sanitizeUrl('https://github.com')).toBe('https://github.com');
      expect(sanitizeUrl('not-a-url')).toBe(null);
      expect(sanitizeUrl(null)).toBe(null);
      expect(sanitizeUrl('')).toBe(null);
    });

    it('should sanitize emails correctly', () => {
      expect(sanitizeEmail('test@example.com')).toBe('test@example.com');
      expect(sanitizeEmail('invalid-email')).toBe(null);
      expect(sanitizeEmail(null)).toBe(null);
      expect(sanitizeEmail('')).toBe(null);
    });

    it('should validate GitHub usernames correctly', () => {
      expect(isValidGitHubUsername('octocat')).toBe(true);
      expect(isValidGitHubUsername('octo-cat')).toBe(true);
      expect(isValidGitHubUsername('octo123')).toBe(true);
      expect(isValidGitHubUsername('-octocat')).toBe(false); // Cannot start with hyphen
      expect(isValidGitHubUsername('octocat-')).toBe(false); // Cannot end with hyphen
      expect(isValidGitHubUsername('')).toBe(false); // Cannot be empty
      expect(isValidGitHubUsername('a'.repeat(40))).toBe(false); // Too long
    });

    it('should validate repository full names correctly', () => {
      expect(isValidRepositoryFullName('octocat/Hello-World')).toBe(true);
      expect(isValidRepositoryFullName('octocat/hello.world')).toBe(true);
      expect(isValidRepositoryFullName('octocat')).toBe(false); // Missing repo name
      expect(isValidRepositoryFullName('octocat/hello/world')).toBe(false); // Too many parts
      expect(isValidRepositoryFullName('')).toBe(false); // Empty
    });

    it('should create readable error messages', () => {
      const errors = [
        {
          field: 'username',
          message: 'Username is required',
          code: 'required',
          received: undefined,
        },
        {
          field: 'email',
          message: 'Invalid email format',
          code: 'invalid_string',
          received: 'invalid@',
        },
      ];

      const message = createErrorMessage(errors);
      expect(message).toContain('username');
      expect(message).toContain('email');
    });

    it('should handle bulk validation correctly', () => {
      const contributors = [
        { github_id: 1, username: 'user1' },
        { github_id: 'invalid', username: 'user2' }, // Invalid github_id
        { github_id: 3, username: 'user3' },
      ];

      const result = validateBulkData(
        contributorCreateSchema.pick({ github_id: true, username: true }),
        contributors
      );

      expect(result.totalProcessed).toBe(3);
      expect(result.totalValid).toBe(2);
      expect(result.totalInvalid).toBe(1);
      expect(result.validItems).toHaveLength(2);
      expect(result.invalidItems).toHaveLength(1);
      expect(result.invalidItems[0].index).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle ValidationError correctly', () => {
      const errors = [{ field: 'test', message: 'Test error', code: 'test', received: 'invalid' }];

      const error = new ValidationError('Test validation failed', errors);

      expect(error.message).toBe('Test validation failed');
      expect(error.name).toBe('ValidationError');
      expect(error.validationErrors).toEqual(errors);
    });

    it('should handle missing data gracefully', () => {
      const result = validateData(contributorCreateSchema, null);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle malformed data gracefully', () => {
      const result = validateData(contributorCreateSchema, { invalid: 'data' });
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });
  });
});

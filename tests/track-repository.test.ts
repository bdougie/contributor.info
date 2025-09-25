import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for /api/track-repository endpoint
 *
 * These tests verify the track-repository function works correctly
 * with various inputs and handles errors appropriately.
 */

describe('Track Repository API', () => {
  const baseUrl = process.env.DEPLOY_URL || process.env.URL || 'http://localhost:8888';

  // Mock fetch for GitHub API calls
  const originalFetch = global.fetch;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
  });

  describe('POST /api/track-repository', () => {
    it('should successfully track a valid public repository', async () => {
      const response = await fetch(`${baseUrl}/api/track-repository`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner: 'facebook',
          repo: 'react'
        })
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/json');

      const data = await response.json();
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('message');
      expect(data.message).toContain('facebook/react');
    });

    it('should return 400 for missing parameters', async () => {
      const response = await fetch(`${baseUrl}/api/track-repository`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('success', false);
      expect(data).toHaveProperty('error', 'Missing owner or repo');
    });

    it('should return 400 for invalid repository names', async () => {
      const response = await fetch(`${baseUrl}/api/track-repository`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner: 'invalid/name',
          repo: 'test'
        })
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('success', false);
      expect(data).toHaveProperty('error', 'Invalid repository format');
    });

    it('should return 400 for names that are too long', async () => {
      const response = await fetch(`${baseUrl}/api/track-repository`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner: 'a'.repeat(40), // Max is 39
          repo: 'test'
        })
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('success', false);
      expect(data).toHaveProperty('error', 'Invalid repository name length');
    });

    it('should handle OPTIONS preflight requests', async () => {
      const response = await fetch(`${baseUrl}/api/track-repository`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://localhost:3000',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type'
        }
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('access-control-allow-origin')).toBe('*');
      expect(response.headers.get('access-control-allow-methods')).toContain('POST');
    });

    it('should return 405 for non-POST methods', async () => {
      const response = await fetch(`${baseUrl}/api/track-repository`, {
        method: 'GET'
      });

      expect(response.status).toBe(405);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Method not allowed');
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await fetch(`${baseUrl}/api/track-repository`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'not valid json'
      });

      // Should handle the error and return 400 or continue with empty body
      expect([400, 500].includes(response.status)).toBe(true);
    });

    it('should include CORS headers in all responses', async () => {
      const response = await fetch(`${baseUrl}/api/track-repository`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner: 'test',
          repo: 'test'
        })
      });

      expect(response.headers.get('access-control-allow-origin')).toBe('*');
      expect(response.headers.get('access-control-allow-headers')).toContain('Content-Type');
    });
  });

  describe('Repository validation', () => {
    it('should accept valid repository name formats', async () => {
      const validNames = [
        { owner: 'facebook', repo: 'react' },
        { owner: 'user-123', repo: 'my.project' },
        { owner: 'org_name', repo: 'repo_name' },
        { owner: 'a', repo: 'b' }, // Single char names
      ];

      for (const { owner, repo } of validNames) {
        const response = await fetch(`${baseUrl}/api/track-repository`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ owner, repo })
        });

        // Should either succeed or fail at GitHub check, not validation
        expect([200, 404].includes(response.status)).toBe(true);
      }
    });

    it('should reject repository names with invalid characters', async () => {
      const invalidNames = [
        { owner: 'user/name', repo: 'test' },
        { owner: 'user', repo: 'repo/name' },
        { owner: 'user@host', repo: 'test' },
        { owner: 'user', repo: 'repo name' }, // Space
        { owner: 'user!', repo: 'test' }, // Special char
      ];

      for (const { owner, repo } of invalidNames) {
        const response = await fetch(`${baseUrl}/api/track-repository`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ owner, repo })
        });

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toBe('Invalid repository format');
      }
    });
  });
});
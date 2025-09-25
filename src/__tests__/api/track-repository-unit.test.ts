import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handler } from '../../../netlify/functions/api-track-repository.js';

/**
 * Unit tests for track-repository function handler
 *
 * These tests directly test the function without requiring a running server
 */

describe('track-repository handler unit tests', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock environment variables
    process.env.GITHUB_TOKEN = 'test-token';
    process.env.INNGEST_EVENT_KEY = 'test-key';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.GITHUB_TOKEN;
    delete process.env.INNGEST_EVENT_KEY;
  });

  it('should handle OPTIONS request', async () => {
    const event = {
      httpMethod: 'OPTIONS',
      headers: {},
      body: null
    };

    const result = await handler(event, {});

    expect(result.statusCode).toBe(200);
    expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(result.headers['Access-Control-Allow-Methods']).toContain('POST');
  });

  it('should reject non-POST methods', async () => {
    const event = {
      httpMethod: 'GET',
      headers: {},
      body: null
    };

    const result = await handler(event, {});

    expect(result.statusCode).toBe(405);
    expect(JSON.parse(result.body)).toHaveProperty('error', 'Method not allowed');
  });

  it('should validate missing parameters', async () => {
    const event = {
      httpMethod: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({})
    };

    const result = await handler(event, {});

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('success', false);
    expect(body).toHaveProperty('error', 'Missing owner or repo');
  });

  it('should validate invalid repository format', async () => {
    const event = {
      httpMethod: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        owner: 'invalid/name',
        repo: 'test'
      })
    };

    const result = await handler(event, {});

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('success', false);
    expect(body).toHaveProperty('error', 'Invalid repository format');
  });

  it('should validate name length', async () => {
    const event = {
      httpMethod: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        owner: 'a'.repeat(40), // Max is 39
        repo: 'test'
      })
    };

    const result = await handler(event, {});

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('success', false);
    expect(body).toHaveProperty('error', 'Invalid repository name length');
  });

  it('should handle malformed JSON', async () => {
    const event = {
      httpMethod: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not valid json'
    };

    const result = await handler(event, {});

    // Should handle gracefully and treat as empty body
    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('error', 'Missing owner or repo');
  });

  it('should process valid repository with mocked APIs', async () => {
    // Mock fetch for GitHub and Inngest
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('api.github.com')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            private: false,
            name: 'react',
            owner: { login: 'facebook' }
          })
        });
      }
      if (url.includes('inn.gs')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify({
            status: 'sent',
            ids: ['test-id']
          }))
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    const event = {
      httpMethod: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        owner: 'facebook',
        repo: 'react'
      })
    };

    const result = await handler(event, {});

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('success', true);
    expect(body.message).toContain('facebook/react');
    expect(body).toHaveProperty('eventId');
  });

  it('should reject private repositories', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('api.github.com')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            private: true,
            name: 'private-repo'
          })
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    const event = {
      httpMethod: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        owner: 'user',
        repo: 'private-repo'
      })
    };

    const result = await handler(event, {});

    expect(result.statusCode).toBe(403);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('error', 'Private repository');
  });

  it('should handle GitHub 404', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('api.github.com')) {
        return Promise.resolve({
          ok: false,
          status: 404
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    const event = {
      httpMethod: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        owner: 'nonexistent',
        repo: 'repo'
      })
    };

    const result = await handler(event, {});

    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('error', 'Repository not found');
  });

  it('should handle Inngest failure gracefully', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('api.github.com')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            private: false,
            name: 'react'
          })
        });
      }
      if (url.includes('inn.gs')) {
        return Promise.resolve({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Server error')
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    const event = {
      httpMethod: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        owner: 'facebook',
        repo: 'react'
      })
    };

    const result = await handler(event, {});

    // Should still return success but with warning
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('warning', 'Background processing may be delayed');
  });

  it('should include CORS headers in all responses', async () => {
    const testCases = [
      { httpMethod: 'OPTIONS', body: null },
      { httpMethod: 'GET', body: null },
      { httpMethod: 'POST', body: '{}' },
      { httpMethod: 'POST', body: JSON.stringify({ owner: 'test', repo: 'test' }) }
    ];

    for (const testCase of testCases) {
      const event = {
        httpMethod: testCase.httpMethod,
        headers: { 'content-type': 'application/json' },
        body: testCase.body
      };

      const result = await handler(event, {});

      expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
      expect(result.headers['Access-Control-Allow-Headers']).toContain('Content-Type');
    }
  });
});
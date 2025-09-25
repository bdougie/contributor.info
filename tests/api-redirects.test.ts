import { describe, it, expect, beforeAll } from 'vitest';

/**
 * Integration tests for API redirects
 *
 * These tests verify that all API endpoints defined in netlify.toml
 * are properly configured and return JSON responses, not HTML.
 *
 * This prevents regression of issue #776 where API endpoints were
 * returning HTML instead of JSON due to redirect precedence issues.
 */

// List of all API endpoints defined in netlify.toml
const API_ENDPOINTS = [
  '/api/hello',
  '/api/health',
  '/api/github/callback',
  '/api/github-webhook',
  '/api/github/webhook',
  '/api/inngest',
  '/api/inngest-sync',
  '/api/queue-event',
  '/api/discover-repository',
  '/api/validate-repository',
  '/api/track-repository',
  '/api/repository-status',
  '/api/github-app/installation-status',
  '/api/backfill/trigger',
  '/api/backfill/status/test-id',
  '/api/backfill/cancel/test-id',
  '/api/backfill/events',
  '/api/webhook/backfill-complete',
  '/api/trigger-inngest-sync',
];

describe('API Redirect Configuration', () => {
  // These tests run against the production or preview deployment
  // They should be run as part of the deploy preview process

  const baseUrl = process.env.DEPLOY_URL || process.env.URL || 'https://contributor.info';

  describe('All API endpoints should be properly configured', () => {
    API_ENDPOINTS.forEach((endpoint) => {
      it(
        `${endpoint} should not return HTML`,
        async () => {
          const url = new URL(endpoint, baseUrl);

          // Add query params for endpoints that require them
          if (endpoint === '/api/repository-status') {
            url.searchParams.set('owner', 'test');
            url.searchParams.set('repo', 'test');
          }

          const response = await fetch(url.toString(), {
            method: endpoint.includes('webhook') ? 'POST' : 'GET',
            headers: {
              Accept: 'application/json',
            },
          });

          const contentType = response.headers.get('content-type') || '';
          const text = await response.text();

          // Verify the response is not HTML
          expect(contentType.toLowerCase()).not.toContain('text/html');
          expect(text).not.toMatch(/^<!DOCTYPE/i);
          expect(text).not.toContain('<html');

          // If it's a successful response, verify it's valid JSON
          if (response.ok || response.status === 400 || response.status === 405) {
            expect(() => JSON.parse(text)).not.toThrow();
          }
        },
        { timeout: 10000 }
      );
    });
  });

  describe('SPA routes should return HTML', () => {
    const SPA_ROUTES = ['/', '/about', '/docs', '/facebook/react', '/workspace'];

    SPA_ROUTES.forEach((route) => {
      it(
        `${route} should return HTML`,
        async () => {
          const url = new URL(route, baseUrl);
          const response = await fetch(url.toString());

          const contentType = response.headers.get('content-type') || '';
          const text = await response.text();

          // Verify the response IS HTML
          expect(contentType.toLowerCase()).toContain('text/html');
          expect(text).toMatch(/<!DOCTYPE/i);
          expect(text).toContain('<html');
        },
        { timeout: 10000 }
      );
    });
  });
});

describe('API Endpoint Response Validation', () => {
  const baseUrl = process.env.DEPLOY_URL || process.env.URL || 'https://contributor.info';

  it(
    '/api/repository-status should return proper JSON structure',
    async () => {
      const url = new URL('/api/repository-status', baseUrl);
      url.searchParams.set('owner', 'facebook');
      url.searchParams.set('repo', 'react');

      const response = await fetch(url.toString());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('owner');
      expect(data).toHaveProperty('repo');
      expect(data).toHaveProperty('hasData');
      expect(data).toHaveProperty('message');
    },
    { timeout: 10000 }
  );

  it(
    '/api/repository-status should return 400 for missing params',
    async () => {
      const url = new URL('/api/repository-status', baseUrl);

      const response = await fetch(url.toString());
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('Missing');
    },
    { timeout: 10000 }
  );
});

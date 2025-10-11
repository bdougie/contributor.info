import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HandlerEvent, HandlerContext } from '@netlify/functions';

/**
 * Integration tests for all backfill endpoints
 * Ensures lazy initialization works across all endpoints
 */
describe('Backfill Endpoints Integration', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.resetModules();
    // Mock fetch globally for these tests
    global.fetch = vi.fn();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('Environment variable handling', () => {
    it('all endpoints should return 503 when GH_DATPIPE_KEY is not configured', async () => {
      // Clear environment variables
      delete process.env.GH_DATPIPE_KEY;
      delete process.env.GH_DATPIPE_API_URL;

      // Test each endpoint
      const endpoints = [
        { module: '../backfill-trigger', method: 'POST', path: '/api/backfill/trigger' },
        { module: '../backfill-status', method: 'GET', path: '/api/backfill/status/123' },
        { module: '../backfill-cancel', method: 'POST', path: '/api/backfill/cancel/123' },
        { module: '../backfill-events', method: 'GET', path: '/api/backfill/events' },
      ];

      for (const endpoint of endpoints) {
        const { handler } = await import(endpoint.module);

        const event = {
          httpMethod: endpoint.method,
          body: endpoint.method === 'POST' ? JSON.stringify({ repository: 'owner/repo' }) : null,
          headers: {},
          path: endpoint.path,
        } as unknown as HandlerEvent;

        const response = await handler(event, {} as HandlerContext);

        expect(response.statusCode).toBe(503);
        const body = JSON.parse(response.body);
        expect(body.error).toContain('unavailable');
      }
    });

    it('endpoints should not throw during import when env vars are missing', async () => {
      delete process.env.GH_DATPIPE_KEY;
      delete process.env.GH_DATPIPE_API_URL;

      // This should not throw - the key fix!
      const imports = await Promise.all([
        import('../backfill-trigger'),
        import('../backfill-status'),
        import('../backfill-cancel'),
        import('../backfill-events'),
      ]);

      // All imports should have handler functions
      imports.forEach((module) => {
        expect(module.handler).toBeDefined();
        expect(typeof module.handler).toBe('function');
      });
    });
  });

  describe('Successful flow with configured environment', () => {
    beforeEach(() => {
      process.env.GH_DATPIPE_KEY = 'test-key';
      process.env.GH_DATPIPE_API_URL = 'https://api.datapipe.test';
    });

    it('should successfully trigger a backfill when configured', async () => {
      const { handler } = await import('../backfill-trigger');

      // Mock successful API response
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 202,
        statusText: 'Accepted',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          job_id: 'job-123',
          status: 'queued',
          repository: 'owner/repo',
          created_at: new Date().toISOString(),
        }),
      } as Response);

      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          repository: 'owner/repo',
          days: 90,
        }),
        headers: {},
        path: '/api/backfill/trigger',
      } as unknown as HandlerEvent;

      const response = await handler(event, {} as HandlerContext);

      expect(response.statusCode).toBe(202);
      const body = JSON.parse(response.body);
      expect(body.job_id).toBe('job-123');
      expect(body.status).toBe('queued');

      // Verify the fetch was called correctly
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.datapipe.test/api/backfill/trigger',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-API-Key': 'test-key',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should get job status when configured', async () => {
      const { handler } = await import('../backfill-status');

      // Mock successful API response
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          job_id: 'job-123',
          status: 'completed',
          repository: 'owner/repo',
          progress: 100,
        }),
      } as Response);

      const event = {
        httpMethod: 'GET',
        body: null,
        headers: {},
        path: '/api/backfill/status/job-123',
      } as unknown as HandlerEvent;

      const response = await handler(event, {} as HandlerContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.job_id).toBe('job-123');
      expect(body.status).toBe('completed');
    });

    it('should cancel a job when configured', async () => {
      const { handler } = await import('../backfill-cancel');

      // Mock successful API response
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          job_id: 'job-123',
          status: 'cancelled',
          message: 'Job cancelled successfully',
        }),
      } as Response);

      const event = {
        httpMethod: 'POST',
        body: null,
        headers: {},
        path: '/api/backfill/cancel/job-123',
      } as unknown as HandlerEvent;

      const response = await handler(event, {} as HandlerContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('cancelled');
    });
  });

  describe('Error handling', () => {
    beforeEach(() => {
      process.env.GH_DATPIPE_KEY = 'test-key';
      process.env.GH_DATPIPE_API_URL = 'https://api.datapipe.test';
    });

    it('should handle rate limiting gracefully', async () => {
      const { handler } = await import('../backfill-trigger');

      // Mock rate limit response
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ message: 'Rate limit exceeded' }),
      } as Response);

      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({ repository: 'owner/repo' }),
        headers: {},
        path: '/api/backfill/trigger',
      } as unknown as HandlerEvent;

      const response = await handler(event, {} as HandlerContext);

      // Should handle rate limiting with appropriate error code
      expect(response.statusCode).toBe(429);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('RATE_LIMITED');
    });

    it('should handle network errors', async () => {
      const { handler } = await import('../backfill-trigger');

      // Mock network error
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({ repository: 'owner/repo' }),
        headers: {},
        path: '/api/backfill/trigger',
      } as unknown as HandlerEvent;

      const response = await handler(event, {} as HandlerContext);

      expect(response.statusCode).toBe(502);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('NETWORK_ERROR');
    });
  });
});

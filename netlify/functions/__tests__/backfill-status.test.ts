import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HandlerEvent, HandlerContext } from '@netlify/functions';

describe('backfill-status function', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return 503 when GH_DATPIPE_KEY is not configured', async () => {
    delete process.env.GH_DATPIPE_KEY;
    delete process.env.GH_DATPIPE_API_URL;

    const { handler } = await import('../backfill-status');

    const event = {
      httpMethod: 'GET',
      body: null,
      headers: {},
      path: '/api/backfill/status/job-123',
    } as unknown as HandlerEvent;

    const response = await handler(event, {} as HandlerContext);

    expect(response.statusCode).toBe(503);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Service unavailable');
  });

  it('should return 405 for non-GET requests', async () => {
    process.env.GH_DATPIPE_KEY = 'test-key';
    process.env.GH_DATPIPE_API_URL = 'https://test.example.com';

    const { handler } = await import('../backfill-status');

    const event = {
      httpMethod: 'POST',
      body: null,
      headers: {},
      path: '/api/backfill/status/job-123',
    } as unknown as HandlerEvent;

    const response = await handler(event, {} as HandlerContext);

    expect(response.statusCode).toBe(405);
    expect(response.headers?.Allow).toBe('GET');
  });

  it('should return 400 when job ID is missing', async () => {
    process.env.GH_DATPIPE_KEY = 'test-key';
    process.env.GH_DATPIPE_API_URL = 'https://test.example.com';

    const { handler } = await import('../backfill-status');

    const event = {
      httpMethod: 'GET',
      body: null,
      headers: {},
      path: '/api/backfill/status',
    } as unknown as HandlerEvent;

    const response = await handler(event, {} as HandlerContext);

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.message).toContain('Job ID is required');
  });

  it('should return 404 for non-existent job', async () => {
    process.env.GH_DATPIPE_KEY = 'test-key';
    process.env.GH_DATPIPE_API_URL = 'https://test.example.com';

    const { handler } = await import('../backfill-status');

    // Mock the server client to throw a not found error
    vi.doMock('../../src/lib/manual-backfill/server-client', () => ({
      manualBackfillServerClient: {
        getJobStatus: vi.fn().mockRejectedValue(new Error('Job not found')),
      },
    }));

    const event = {
      httpMethod: 'GET',
      body: null,
      headers: {},
      path: '/api/backfill/status/non-existent-job',
    } as unknown as HandlerEvent;

    const response = await handler(event, {} as HandlerContext);

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Not found');
  });
});

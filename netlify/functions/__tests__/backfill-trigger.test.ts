import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HandlerEvent, HandlerContext } from '@netlify/functions';

describe('backfill-trigger function', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return 503 when GH_DATPIPE_KEY is not configured', async () => {
    // Clear environment variables
    delete process.env.GH_DATPIPE_KEY;
    delete process.env.GH_DATPIPE_API_URL;

    // Import the handler after clearing env vars
    const { handler } = await import('../backfill-trigger');

    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        repository: 'owner/repo',
        days: 30,
      }),
      headers: {},
      path: '/api/backfill/trigger',
    } as unknown as HandlerEvent;

    const context = {} as HandlerContext;

    const response = await handler(event, context);

    expect(response.statusCode).toBe(503);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Service unavailable');
    expect(body.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('should return 405 for non-POST requests', async () => {
    // Set environment variables
    process.env.GH_DATPIPE_KEY = 'test-key';
    process.env.GH_DATPIPE_API_URL = 'https://test.example.com';

    const { handler } = await import('../backfill-trigger');

    const event = {
      httpMethod: 'GET',
      body: null,
      headers: {},
      path: '/api/backfill/trigger',
    } as unknown as HandlerEvent;

    const context = {} as HandlerContext;

    const response = await handler(event, context);

    expect(response.statusCode).toBe(405);
    expect(response.headers?.Allow).toBe('POST');
  });

  it('should return 400 when repository is missing', async () => {
    process.env.GH_DATPIPE_KEY = 'test-key';
    process.env.GH_DATPIPE_API_URL = 'https://test.example.com';

    const { handler } = await import('../backfill-trigger');

    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        days: 30,
      }),
      headers: {},
      path: '/api/backfill/trigger',
    } as unknown as HandlerEvent;

    const context = {} as HandlerContext;

    const response = await handler(event, context);

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Bad request');
    expect(body.message).toContain('Repository is required');
  });

  it('should return 400 for invalid repository format', async () => {
    process.env.GH_DATPIPE_KEY = 'test-key';
    process.env.GH_DATPIPE_API_URL = 'https://test.example.com';

    const { handler } = await import('../backfill-trigger');

    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        repository: 'invalid-format',
        days: 30,
      }),
      headers: {},
      path: '/api/backfill/trigger',
    } as unknown as HandlerEvent;

    const context = {} as HandlerContext;

    const response = await handler(event, context);

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Bad request');
    expect(body.message).toContain('Invalid repository format');
  });

  it('should return 400 for invalid JSON', async () => {
    process.env.GH_DATPIPE_KEY = 'test-key';
    process.env.GH_DATPIPE_API_URL = 'https://test.example.com';

    const { handler } = await import('../backfill-trigger');

    const event = {
      httpMethod: 'POST',
      body: 'not-json',
      headers: {},
      path: '/api/backfill/trigger',
    } as unknown as HandlerEvent;

    const context = {} as HandlerContext;

    const response = await handler(event, context);

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Bad request');
    expect(body.message).toContain('Invalid JSON');
  });
});

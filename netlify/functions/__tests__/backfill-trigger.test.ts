import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HandlerEvent, HandlerContext } from '@netlify/functions';

const { triggerBackfill, isConfigured } = vi.hoisted(() => ({
  triggerBackfill: vi.fn(),
  isConfigured: vi.fn(() => true),
}));

vi.mock('../lib/datapipe-jobs.mts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/datapipe-jobs.mts')>();
  return { ...actual, triggerBackfill, isConfigured };
});

function post(body: unknown, method = 'POST'): HandlerEvent {
  return {
    httpMethod: method,
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: {},
    path: '/api/backfill/trigger',
  } as unknown as HandlerEvent;
}

describe('backfill-trigger function', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.resetModules();
    triggerBackfill.mockReset();
    isConfigured.mockReturnValue(true);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns 503 when the datapipe is not configured', async () => {
    isConfigured.mockReturnValue(false);
    const { handler } = await import('../backfill-trigger.mts');
    const response = await handler(post({ repository: 'owner/repo' }), {} as HandlerContext);
    expect(response.statusCode).toBe(503);
    expect(JSON.parse(response.body).code).toBe('SERVICE_UNAVAILABLE');
  });

  it('returns 405 for non-POST requests', async () => {
    const { handler } = await import('../backfill-trigger.mts');
    const response = await handler(post(null, 'GET'), {} as HandlerContext);
    expect(response.statusCode).toBe(405);
    expect(response.headers?.Allow).toBe('POST');
  });

  it('returns 400 for invalid JSON, missing or malformed repository', async () => {
    const { handler } = await import('../backfill-trigger.mts');
    expect((await handler(post('{not json'), {} as HandlerContext)).statusCode).toBe(400);
    expect((await handler(post({}), {} as HandlerContext)).statusCode).toBe(400);
    expect((await handler(post({ repository: 'nope' }), {} as HandlerContext)).statusCode).toBe(
      400
    );
    expect(triggerBackfill).not.toHaveBeenCalled();
  });

  it('returns 202 with the job when the machine starts', async () => {
    triggerBackfill.mockResolvedValue({
      job_id: 'job-1',
      status: 'queued',
      repository: 'owner/repo',
      days: 30,
      estimated_completion: '2026-10-19T00:10:00Z',
      status_url: '/api/backfill/status/job-1',
      fly_machine_id: 'm1',
    });
    const { handler } = await import('../backfill-trigger.mts');
    const response = await handler(post({ repository: 'owner/repo' }), {} as HandlerContext);
    expect(response.statusCode).toBe(202);
    expect(JSON.parse(response.body)).toMatchObject({ job_id: 'job-1', status: 'queued' });
    expect(triggerBackfill).toHaveBeenCalledWith({
      repository: 'owner/repo',
      days: 30,
      sources: undefined,
      config: undefined,
      reason: 'manual',
    });
  });

  it('maps upstream errors to their status codes', async () => {
    const { FlyMachinesError } = await import('../lib/fly-machines.mts');
    triggerBackfill.mockRejectedValue(new FlyMachinesError('Fly down', 502));
    const { handler } = await import('../backfill-trigger.mts');
    const response = await handler(
      post({ repository: 'owner/repo', days: 7 }),
      {} as HandlerContext
    );
    expect(response.statusCode).toBe(502);
    expect(JSON.parse(response.body).code).toBe('NETWORK_ERROR');
  });
});

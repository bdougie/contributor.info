import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HandlerEvent, HandlerContext } from '@netlify/functions';

const { getJob, getSupabaseAdmin, cancelJob, getUserFromAuthHeader } = vi.hoisted(() => ({
  getJob: vi.fn(),
  getSupabaseAdmin: vi.fn<() => object | null>(() => ({})),
  cancelJob: vi.fn(),
  getUserFromAuthHeader: vi.fn(),
}));

vi.mock('../lib/datapipe-jobs.mts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/datapipe-jobs.mts')>();
  return { ...actual, getJob, getSupabaseAdmin, cancelJob };
});
vi.mock('../lib/request-auth.mts', () => ({ getUserFromAuthHeader }));

const JOB_ID = '11111111-2222-4333-8444-555555555555';
const ctx = {} as HandlerContext;

function event(path: string, method: string): HandlerEvent {
  return {
    httpMethod: method,
    body: null,
    headers: { authorization: 'Bearer token' },
    path,
  } as unknown as HandlerEvent;
}

describe('backfill-status and backfill-cancel functions', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.resetModules();
    getJob.mockReset();
    cancelJob.mockReset();
    getSupabaseAdmin.mockReturnValue({});
    getUserFromAuthHeader.mockResolvedValue({ id: 'user-1', email: null });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('status returns 503 when Supabase is not configured', async () => {
    getSupabaseAdmin.mockReturnValue(null);
    const { handler } = await import('../backfill-status.mts');
    const response = await handler(event(`/api/backfill/status/${JOB_ID}`, 'GET'), ctx);
    expect(response.statusCode).toBe(503);
  });

  it('status and cancel return 401 without a signed-in user', async () => {
    getUserFromAuthHeader.mockResolvedValue(null);
    const status = await import('../backfill-status.mts');
    const cancel = await import('../backfill-cancel.mts');
    const s = await status.handler(event(`/api/backfill/status/${JOB_ID}`, 'GET'), ctx);
    const c = await cancel.handler(event(`/api/backfill/cancel/${JOB_ID}`, 'POST'), ctx);
    expect(s.statusCode).toBe(401);
    expect(c.statusCode).toBe(401);
    expect(getJob).not.toHaveBeenCalled();
    expect(cancelJob).not.toHaveBeenCalled();
  });

  it('status validates method and job id', async () => {
    const { handler } = await import('../backfill-status.mts');
    expect((await handler(event(`/api/backfill/status/${JOB_ID}`, 'POST'), ctx)).statusCode).toBe(
      405
    );
    expect((await handler(event('/api/backfill/status', 'GET'), ctx)).statusCode).toBe(400);
    expect((await handler(event('/api/backfill/status/not-a-uuid', 'GET'), ctx)).statusCode).toBe(
      400
    );
    expect(getJob).not.toHaveBeenCalled();
  });

  it('status returns the job view, or 404 when missing', async () => {
    getJob.mockResolvedValueOnce({
      id: JOB_ID,
      type: 'backfill',
      status: 'running',
      params: { repository: 'owner/repo', days: 30 },
      fly_machine_id: 'm1',
      progress: { step: 'sync_to_supabase' },
      error: null,
      created_at: '2026-10-19T00:00:00Z',
      started_at: '2026-10-19T00:01:00Z',
      completed_at: null,
    });
    const { handler } = await import('../backfill-status.mts');
    const ok = await handler(event(`/api/backfill/status/${JOB_ID}`, 'GET'), ctx);
    expect(ok.statusCode).toBe(200);
    expect(JSON.parse(ok.body)).toMatchObject({
      id: JOB_ID,
      status: 'running',
      progress: 90,
      data: { repository: 'owner/repo', days: 30 },
    });

    getJob.mockResolvedValueOnce(null);
    const missing = await handler(event(`/api/backfill/status/${JOB_ID}`, 'GET'), ctx);
    expect(missing.statusCode).toBe(404);
  });

  it('cancel only lets the requester cancel, and maps 404', async () => {
    const ownJob = { id: JOB_ID, params: { requested_by: 'user-1' }, status: 'running' };
    getJob.mockResolvedValueOnce(ownJob);
    cancelJob.mockResolvedValueOnce({
      job_id: JOB_ID,
      status: 'cancelled',
      message: 'Job cancelled',
    });
    const { handler } = await import('../backfill-cancel.mts');
    const ok = await handler(event(`/api/backfill/cancel/${JOB_ID}`, 'POST'), ctx);
    expect(ok.statusCode).toBe(200);
    expect(cancelJob).toHaveBeenCalledWith(JOB_ID, {});

    getJob.mockResolvedValueOnce({ ...ownJob, params: { requested_by: 'someone-else' } });
    const forbidden = await handler(event(`/api/backfill/cancel/${JOB_ID}`, 'POST'), ctx);
    expect(forbidden.statusCode).toBe(403);
    expect(cancelJob).toHaveBeenCalledTimes(1);

    getJob.mockResolvedValueOnce(null);
    const missing = await handler(event(`/api/backfill/cancel/${JOB_ID}`, 'POST'), ctx);
    expect(missing.statusCode).toBe(404);
    expect((await handler(event(`/api/backfill/cancel/${JOB_ID}`, 'GET'), ctx)).statusCode).toBe(
      405
    );
  });
});

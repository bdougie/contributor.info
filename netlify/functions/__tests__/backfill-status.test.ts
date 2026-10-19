import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HandlerEvent, HandlerContext } from '@netlify/functions';

const { getJob, getSupabaseAdmin, cancelJob } = vi.hoisted(() => ({
  getJob: vi.fn(),
  getSupabaseAdmin: vi.fn<() => object | null>(() => ({})),
  cancelJob: vi.fn(),
}));

vi.mock('../lib/datapipe-jobs.mts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/datapipe-jobs.mts')>();
  return { ...actual, getJob, getSupabaseAdmin, cancelJob };
});

const JOB_ID = '11111111-2222-4333-8444-555555555555';

function event(path: string, method: string): HandlerEvent {
  return { httpMethod: method, body: null, headers: {}, path } as unknown as HandlerEvent;
}

describe('backfill-status and backfill-cancel functions', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.resetModules();
    getJob.mockReset();
    cancelJob.mockReset();
    getSupabaseAdmin.mockReturnValue({});
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('status returns 503 when Supabase is not configured', async () => {
    getSupabaseAdmin.mockReturnValue(null);
    const { handler } = await import('../backfill-status.mts');
    const response = await handler(
      event(`/api/backfill/status/${JOB_ID}`, 'GET'),
      {} as HandlerContext
    );
    expect(response.statusCode).toBe(503);
  });

  it('status validates method and job id', async () => {
    const { handler } = await import('../backfill-status.mts');
    expect(
      (await handler(event(`/api/backfill/status/${JOB_ID}`, 'POST'), {} as HandlerContext))
        .statusCode
    ).toBe(405);
    expect(
      (await handler(event('/api/backfill/status', 'GET'), {} as HandlerContext)).statusCode
    ).toBe(400);
    expect(
      (await handler(event('/api/backfill/status/not-a-uuid', 'GET'), {} as HandlerContext))
        .statusCode
    ).toBe(400);
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
    const ok = await handler(event(`/api/backfill/status/${JOB_ID}`, 'GET'), {} as HandlerContext);
    expect(ok.statusCode).toBe(200);
    expect(JSON.parse(ok.body)).toMatchObject({
      id: JOB_ID,
      status: 'running',
      progress: 90,
      data: { repository: 'owner/repo', days: 30 },
    });

    getJob.mockResolvedValueOnce(null);
    const missing = await handler(
      event(`/api/backfill/status/${JOB_ID}`, 'GET'),
      {} as HandlerContext
    );
    expect(missing.statusCode).toBe(404);
  });

  it('cancel calls cancelJob and maps 404', async () => {
    cancelJob.mockResolvedValueOnce({
      job_id: JOB_ID,
      status: 'cancelled',
      message: 'Job cancelled',
    });
    const { handler } = await import('../backfill-cancel.mts');
    const ok = await handler(event(`/api/backfill/cancel/${JOB_ID}`, 'POST'), {} as HandlerContext);
    expect(ok.statusCode).toBe(200);
    expect(cancelJob).toHaveBeenCalledWith(JOB_ID, {});

    const { DatapipeJobsError } = await import('../lib/datapipe-jobs.mts');
    cancelJob.mockRejectedValueOnce(new DatapipeJobsError('Job not found', 404));
    const missing = await handler(
      event(`/api/backfill/cancel/${JOB_ID}`, 'POST'),
      {} as HandlerContext
    );
    expect(missing.statusCode).toBe(404);
    expect(
      (await handler(event(`/api/backfill/cancel/${JOB_ID}`, 'GET'), {} as HandlerContext))
        .statusCode
    ).toBe(405);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DatapipeJob } from '../datapipe-jobs.mts';

const { createMachine, destroyMachine, flyConfigured } = vi.hoisted(() => ({
  createMachine: vi.fn(),
  destroyMachine: vi.fn(),
  flyConfigured: vi.fn(() => true),
}));

vi.mock('../fly-machines.mts', () => ({
  createMachine,
  destroyMachine,
  isConfigured: flyConfigured,
}));

interface FakeTable {
  rows: Record<string, unknown>[];
  inserted: Record<string, unknown>[];
  updates: { id: string; fields: Record<string, unknown> }[];
}

function fakeSupabase(table: FakeTable) {
  const chain = {
    insert(row: Record<string, unknown>) {
      table.inserted.push(row);
      const created = { id: 'job-1', created_at: '2026-10-19T00:00:00Z', ...row };
      table.rows.push(created);
      return { select: () => ({ single: async () => ({ data: created, error: null }) }) };
    },
    select() {
      return {
        eq: (_col: string, id: string) => ({
          maybeSingle: async () => ({
            data: table.rows.find((r) => r.id === id) ?? null,
            error: null,
          }),
        }),
        order: () => ({ limit: async () => ({ data: table.rows, error: null }) }),
      };
    },
    update(fields: Record<string, unknown>) {
      return {
        eq: async (_col: string, id: string) => {
          table.updates.push({ id, fields });
          const row = table.rows.find((r) => r.id === id);
          if (row) Object.assign(row, fields);
          return { error: null };
        },
      };
    },
  };
  return { from: () => chain } as unknown as import('@supabase/supabase-js').SupabaseClient;
}

function job(overrides: Partial<DatapipeJob> = {}): DatapipeJob {
  return {
    id: 'job-1',
    type: 'backfill',
    status: 'running',
    params: { repository: 'owner/repo', days: 30 },
    fly_machine_id: 'm1',
    progress: null,
    error: null,
    created_at: '2026-10-19T00:00:00Z',
    started_at: '2026-10-19T00:01:00Z',
    completed_at: null,
    ...overrides,
  };
}

describe('datapipe-jobs', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let table: FakeTable;

  beforeEach(() => {
    originalEnv = { ...process.env };
    table = { rows: [], inserted: [], updates: [] };
    createMachine.mockReset();
    destroyMachine.mockReset();
    flyConfigured.mockReturnValue(true);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('builds the backfill command', async () => {
    const { backfillCommand } = await import('../datapipe-jobs.mts');
    expect(
      backfillCommand('j1', {
        repository: 'o/r',
        days: 7,
        sources: ['comments', 'issues_with_authors'],
      })
    ).toEqual([
      'python',
      'scripts/unified_workspace_backfill.py',
      '--config',
      'production',
      '--job-id',
      'j1',
      '--repository',
      'o/r',
      '--days',
      '7',
      '--sources',
      'comments,issues_with_authors',
    ]);
  });

  it('triggerBackfill creates the row then the machine', async () => {
    createMachine.mockResolvedValue({
      id: 'm-new',
      name: 'backfill-job-1',
      state: 'created',
      region: 'iad',
    });
    const { triggerBackfill } = await import('../datapipe-jobs.mts');
    const result = await triggerBackfill(
      { repository: 'owner/repo', days: 14 },
      fakeSupabase(table)
    );

    expect(table.inserted[0]).toMatchObject({ type: 'backfill', status: 'queued' });
    expect(table.inserted[0].params).toMatchObject({ repository: 'owner/repo', days: 14 });
    expect(createMachine).toHaveBeenCalledWith(
      expect.objectContaining({
        env: { JOB_ID: 'job-1' },
        cmd: expect.arrayContaining([
          '--job-id',
          'job-1',
          '--repository',
          'owner/repo',
          '--days',
          '14',
        ]),
      })
    );
    expect(table.updates[0]).toEqual({
      id: 'job-1',
      fields: { fly_machine_id: 'm-new', progress: { step: 'machine_created' } },
    });
    expect(result).toMatchObject({
      job_id: 'job-1',
      status: 'queued',
      repository: 'owner/repo',
      days: 14,
      fly_machine_id: 'm-new',
      status_url: '/api/backfill/status/job-1',
    });
  });

  it('triggerBackfill marks the row failed when Fly refuses the machine', async () => {
    createMachine.mockRejectedValue(new Error('capacity'));
    const { triggerBackfill } = await import('../datapipe-jobs.mts');
    await expect(
      triggerBackfill({ repository: 'owner/repo' }, fakeSupabase(table))
    ).rejects.toThrow('capacity');
    expect(table.updates[0].fields).toMatchObject({
      status: 'failed',
      error: expect.stringContaining('capacity'),
    });
  });

  it('triggerBackfill rejects bad repository names and missing Fly config', async () => {
    const { triggerBackfill } = await import('../datapipe-jobs.mts');
    await expect(
      triggerBackfill({ repository: 'nope' }, fakeSupabase(table))
    ).rejects.toMatchObject({ status: 400 });
    flyConfigured.mockReturnValue(false);
    await expect(triggerBackfill({ repository: 'o/r' }, fakeSupabase(table))).rejects.toMatchObject(
      { status: 503 }
    );
    expect(table.inserted).toHaveLength(0);
  });

  it('cancelJob destroys the machine and marks the row cancelled', async () => {
    table.rows.push(job());
    destroyMachine.mockResolvedValue(undefined);
    const { cancelJob } = await import('../datapipe-jobs.mts');
    const result = await cancelJob('job-1', fakeSupabase(table));
    expect(destroyMachine).toHaveBeenCalledWith('m1');
    expect(result).toEqual({ job_id: 'job-1', status: 'cancelled', message: 'Job cancelled' });
    expect(table.updates[0].fields).toMatchObject({ status: 'cancelled' });
  });

  it('cancelJob leaves terminal jobs alone and 404s unknown ids', async () => {
    table.rows.push(job({ status: 'completed' }));
    const { cancelJob } = await import('../datapipe-jobs.mts');
    expect(await cancelJob('job-1', fakeSupabase(table))).toMatchObject({ status: 'completed' });
    expect(destroyMachine).not.toHaveBeenCalled();
    await expect(cancelJob('missing', fakeSupabase(table))).rejects.toMatchObject({ status: 404 });
  });

  it('toJobStatusView derives progress and message from the row', async () => {
    const { toJobStatusView } = await import('../datapipe-jobs.mts');
    expect(toJobStatusView(job({ status: 'queued', started_at: null }))).toMatchObject({
      progress: 0,
      message: 'Backfill queued',
    });
    expect(
      toJobStatusView(
        job({
          progress: { step: 'extract', source: 'comments', sources_done: 2, sources_total: 4 },
        })
      )
    ).toMatchObject({ progress: 45, message: 'Fetching comments' });
    expect(toJobStatusView(job({ progress: { step: 'sync_to_supabase' } }))).toMatchObject({
      progress: 90,
      message: 'Syncing to Supabase',
    });
    expect(
      toJobStatusView(
        job({ status: 'completed', completed_at: 'x', progress: { total_records: 12 } })
      )
    ).toMatchObject({ progress: 100, message: 'Completed: 12 records synced', completed_at: 'x' });
    expect(toJobStatusView(job({ status: 'failed', error: 'boom' }))).toMatchObject({
      progress: 0,
      message: 'boom',
      error: 'boom',
    });
    expect(toJobStatusView(job()).data).toEqual({ repository: 'owner/repo', days: 30 });
  });
});

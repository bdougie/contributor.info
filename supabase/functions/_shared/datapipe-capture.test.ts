import { assertEquals, assertThrows } from 'https://deno.land/std@0.177.0/testing/asserts.ts';
import {
  backfillCommand,
  CAPTURE_SOURCES,
  daysFromPayload,
  isCaptureEvent,
  resolveRepository,
} from './datapipe-capture.ts';

Deno.test('every capture event maps to at least one source', () => {
  for (const [event, sources] of Object.entries(CAPTURE_SOURCES)) {
    assertEquals(event.startsWith('capture/'), true);
    assertEquals(sources.length > 0, true);
  }
  assertEquals(isCaptureEvent('capture/pr.reviews'), true);
  assertEquals(isCaptureEvent('classify/repository.single'), false);
});

Deno.test('backfillCommand passes job id, repository, days and sources', () => {
  assertEquals(backfillCommand('j1', 'o/r', 7, ['comments', 'issues_with_authors']), [
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

Deno.test('daysFromPayload clamps and defaults', () => {
  assertEquals(daysFromPayload({}), 30);
  assertEquals(daysFromPayload({ daysLimit: 90 }), 90);
  assertEquals(daysFromPayload({ days: 0 }), 1);
  assertEquals(daysFromPayload({ days: 99999 }), 3650);
  assertEquals(daysFromPayload({ days: 'x' as unknown as number }), 30);
});

Deno.test('resolveRepository handles the payload shapes without a lookup', async () => {
  const supabase = {
    from: (_relation: string) => {
      throw new Error('should not query');
    },
  } as unknown as Parameters<typeof resolveRepository>[0];
  assertEquals(await resolveRepository(supabase, { repositoryName: 'a/b' }), 'a/b');
  assertEquals(await resolveRepository(supabase, { repository: 'c/d' }), 'c/d');
  assertEquals(await resolveRepository(supabase, { owner: 'e', repo: 'f' }), 'e/f');
  assertEquals(await resolveRepository(supabase, { owner: 'g', name: 'h' }), 'g/h');
  assertThrows(() => supabase.from('repositories'));
});

Deno.test('resolveRepository looks up by repositoryId', async () => {
  const supabase = {
    from: (_relation: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, _val: string) => ({
          maybeSingle: () => Promise.resolve({ data: { full_name: 'x/y' } }),
        }),
      }),
    }),
  } as unknown as Parameters<typeof resolveRepository>[0];
  assertEquals(await resolveRepository(supabase, { repositoryId: 'uuid' }), 'x/y');
});

import { CaptureError, claimCapture, startCapture } from './datapipe-capture.ts';

type RpcCall = { fn: string; args: Record<string, unknown> };

function claimDb(result: { data: unknown; error: { message: string } | null }, calls: RpcCall[]) {
  return {
    rpc: (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return Promise.resolve(result);
    },
    from: (_relation: string) => {
      throw new Error('should not query tables');
    },
  } as unknown as Parameters<typeof startCapture>[0];
}

Deno.test('claimCapture passes repository, sources, days and params to Postgres', async () => {
  const calls: RpcCall[] = [];
  const db = claimDb(
    { data: [{ job_id: 'j1', reused: false, fly_machine_id: null, days: 30 }], error: null },
    calls,
  );
  const claim = await claimCapture(db, 'o/r', ['pull_requests'], 30, { repository: 'o/r' });
  assertEquals(claim, { job_id: 'j1', reused: false, fly_machine_id: null, days: 30 });
  assertEquals(calls, [
    {
      fn: 'datapipe_claim_capture',
      args: {
        p_repository: 'o/r',
        p_sources: ['pull_requests'],
        p_days: 30,
        p_params: { repository: 'o/r' },
      },
    },
  ]);
});

Deno.test('claimCapture maps capture_capacity_reached to a 429 CaptureError', async () => {
  const db = claimDb(
    {
      data: null,
      error: { message: 'capture_capacity_reached: 2 capture machines are already active' },
    },
    [],
  );
  let caught: unknown;
  try {
    await claimCapture(db, 'o/r', ['pull_requests'], 30, {});
  } catch (err) {
    caught = err;
  }
  assertEquals(caught instanceof CaptureError, true);
  assertEquals((caught as CaptureError).status, 429);
});

Deno.test('claimCapture rejects an empty or malformed claim', async () => {
  const db = claimDb({ data: [], error: null }, []);
  let message = '';
  try {
    await claimCapture(db, 'o/r', ['pull_requests'], 30, {});
  } catch (err) {
    message = err instanceof Error ? err.message : String(err);
  }
  assertEquals(message.includes('returned no job'), true);
});

Deno.test('startCapture reuses an active capture without creating a machine', async () => {
  Deno.env.set('FLY_DATAPIPE_TOKEN', 'test-token');
  Deno.env.set('FLY_DATAPIPE_IMAGE', 'registry.fly.io/test:img');
  try {
    const calls: RpcCall[] = [];
    const db = claimDb(
      { data: [{ job_id: 'active', reused: true, fly_machine_id: 'm1', days: 30 }], error: null },
      calls,
    );
    const result = await startCapture(db, 'capture/repository.sync.graphql', {
      repositoryName: 'o/r',
      days: 7,
    });
    assertEquals(result, {
      datapipe_job_id: 'active',
      fly_machine_id: 'm1',
      repository: 'o/r',
      sources: ['pull_requests'],
      days: 30,
    });
    assertEquals(calls.length, 1);
    assertEquals(calls[0].args.p_days, 7);
    assertEquals(
      (calls[0].args.p_params as Record<string, unknown>).reason,
      'capture/repository.sync.graphql',
    );
  } finally {
    Deno.env.delete('FLY_DATAPIPE_TOKEN');
    Deno.env.delete('FLY_DATAPIPE_IMAGE');
  }
});

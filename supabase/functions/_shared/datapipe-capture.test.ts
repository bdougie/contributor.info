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

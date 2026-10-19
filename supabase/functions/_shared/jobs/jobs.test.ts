import { assert, assertEquals } from 'https://deno.land/std@0.177.0/testing/asserts.ts';
import { needsClassification } from './classify-repositories.ts';
import { contentHash, embeddingInput } from './embeddings.ts';
import { hasHandler, JOB_HANDLERS } from './registry.ts';
import { DEDUPE_POLICIES, dedupeStatuses, isRetiredEvent, RETIRED_EVENTS } from './retired.ts';
import {
  retryDelaySeconds,
  shouldRetry,
  VISIBILITY_TIMEOUT_SECONDS,
  WORKER_BUDGET_MS,
} from './retry.ts';
import { calculateNextScheduledAt, formatAssigneeReport } from './slack-assignee-report.ts';
import { splitRepository } from './sync-router.ts';
import { assertRepositoryName, isNonRetriable, NonRetriableJobError } from './types.ts';
import { CAPTURE_DEDUPE_MINUTES, isValidRepositoryName } from '../datapipe-capture.ts';

Deno.test('retry: exponential backoff from 60 s, capped at one hour', () => {
  assertEquals(retryDelaySeconds(1), 60);
  assertEquals(retryDelaySeconds(2), 120);
  assertEquals(retryDelaySeconds(3), 240);
  assertEquals(retryDelaySeconds(10), 3600);
  assertEquals(retryDelaySeconds(0), 60);
});

Deno.test('retry: max_retries extra deliveries, none for non-retriable errors', () => {
  assertEquals(shouldRetry(1, 3, false), true);
  assertEquals(shouldRetry(3, 3, false), true);
  assertEquals(shouldRetry(4, 3, false), false);
  assertEquals(shouldRetry(1, 0, false), false);
  assertEquals(shouldRetry(1, 3, true), false);
});

Deno.test('retry: visibility timeout outlives one worker invocation', () => {
  assert(VISIBILITY_TIMEOUT_SECONDS * 1000 > WORKER_BUDGET_MS);
  assert(WORKER_BUDGET_MS < 400_000);
});

Deno.test('types: NonRetriableJobError is detected without instanceof', () => {
  assertEquals(isNonRetriable(new NonRetriableJobError('bad payload')), true);
  assertEquals(isNonRetriable(new Error('transient')), false);
  assertEquals(isNonRetriable({ nonRetriable: true }), true);
  assertEquals(isNonRetriable(null), false);
});

Deno.test('registry: retired events never have handlers, dedupe windows always do', () => {
  for (const event of Object.keys(RETIRED_EVENTS)) {
    assertEquals(hasHandler(event), false, `${event} is retired but has a handler`);
    assertEquals(isRetiredEvent(event), true);
  }
  for (const type of Object.keys(DEDUPE_POLICIES)) {
    assert(hasHandler(type), `${type} has a dedupe policy but no handler`);
  }
  assertEquals(isRetiredEvent('classify/repository.single'), false);
});

Deno.test('registry: every former Inngest cron and event type the callers still emit is covered', () => {
  const expected = [
    'classify/repository.single',
    'classify/repository.size',
    'discover/repository.new',
    'embeddings/compute.requested',
    'embedding/issue.generate',
    'embedding/pr.generate',
    'embedding/batch.process',
    'similarity/repository.recalculate',
    'workspace/priorities.sync',
    'cron/refresh-repository-metadata',
    'cron/slack-assignee-report',
    'sync-router/repository.sync.graphql',
  ];
  for (const type of expected) {
    assert(type in JOB_HANDLERS, `missing handler for ${type}`);
  }
});

Deno.test('classify: unclassified, stale, and high-priority rules', () => {
  const now = new Date('2026-10-19T12:00:00Z');
  const days = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();
  assertEquals(
    needsClassification({ priority: 'medium', size: null, size_calculated_at: null }, now),
    true,
  );
  assertEquals(
    needsClassification({ priority: 'medium', size: 'small', size_calculated_at: days(10) }, now),
    false,
  );
  assertEquals(
    needsClassification({ priority: 'medium', size: 'small', size_calculated_at: days(31) }, now),
    true,
  );
  assertEquals(
    needsClassification({ priority: 'high', size: 'large', size_calculated_at: days(8) }, now),
    true,
  );
  assertEquals(
    needsClassification({ priority: 'high', size: 'large', size_calculated_at: days(6) }, now),
    false,
  );
});

Deno.test('embeddings: input is prefixed with the item type and capped at 2000 chars', async () => {
  const text = embeddingInput({ type: 'pull_request', title: 'Fix', body: 'x'.repeat(5000) });
  assert(text.startsWith('[PULL_REQUEST] Fix '));
  assertEquals(text.length, 2000);
  const hash = await contentHash('title', 'body');
  assertEquals(hash.length, 16);
  assertEquals(hash, await contentHash('title', 'body'));
});

Deno.test('slack: next send is 09:00 UTC tomorrow, or next Monday for weekly', () => {
  const wednesday = new Date('2026-10-21T09:03:00Z');
  assertEquals(calculateNextScheduledAt('daily', wednesday), '2026-10-22T09:00:00.000Z');
  assertEquals(calculateNextScheduledAt(null, wednesday), '2026-10-22T09:00:00.000Z');
  assertEquals(calculateNextScheduledAt('weekly', wednesday), '2026-10-26T09:00:00.000Z');
  const monday = new Date('2026-10-19T09:03:00Z');
  assertEquals(calculateNextScheduledAt('weekly', monday), '2026-10-26T09:00:00.000Z');
  const sunday = new Date('2026-10-25T09:03:00Z');
  assertEquals(calculateNextScheduledAt('weekly', sunday), '2026-10-26T09:00:00.000Z');
});

Deno.test('slack: report lists one section per assignee plus header, totals and footer', () => {
  const message = formatAssigneeReport(
    'Acme',
    [
      { login: 'ada', avatar_url: '', issue_count: 1, repository_count: 2 },
      { login: 'bob', avatar_url: '', issue_count: 3, repository_count: 1 },
    ],
    4,
    'ws-1',
  );
  assertEquals(message.text, 'Issue Assignee Report for Acme');
  assertEquals(message.blocks.length, 3 + 2 + 2);
  assert(message.blocks[3].text?.text.includes('1 issue ·'));
  assert(message.blocks[4].text?.text.includes('3 issues ·'));
  assert(message.blocks[6].elements?.[0].text.includes('/workspace/ws-1|'));
});

Deno.test('sync-router: repository can be given joined or split', () => {
  assertEquals(splitRepository({ repository: 'o/r' }), ['o', 'r']);
  assertEquals(splitRepository({ owner: 'o', name: 'r' }), ['o', 'r']);
  assertEquals(splitRepository({ owner: 'o', repo: 'r' }), ['o', 'r']);
  let threw = false;
  try {
    splitRepository({ owner: 'o' });
  } catch (error) {
    threw = isNonRetriable(error);
  }
  assertEquals(threw, true);
});

Deno.test('dedupe: item-level embedding events only merge into queued jobs', () => {
  assertEquals(dedupeStatuses(DEDUPE_POLICIES['embedding/issue.generate']), ['queued']);
  assertEquals(dedupeStatuses(DEDUPE_POLICIES['embeddings/compute.requested']), ['queued']);
  assertEquals(dedupeStatuses(DEDUPE_POLICIES['workspace/priorities.sync']), [
    'queued',
    'processing',
  ]);
  assertEquals(dedupeStatuses(DEDUPE_POLICIES['classify/repository.size']), [
    'queued',
    'processing',
  ]);
});

Deno.test('names: only GitHub-shaped owner/repository pairs are accepted', () => {
  assertEquals(assertRepositoryName('bdougie', 'contributor.info'), [
    'bdougie',
    'contributor.info',
  ]);
  assertEquals(assertRepositoryName('open-source-ready', 'gh_datapipe'), [
    'open-source-ready',
    'gh_datapipe',
  ]);
  for (
    const [owner, name] of [
      ['owner', 'repo name'],
      ['owner', 'repo\n%s'],
      ['../etc', 'passwd'],
      ['', 'repo'],
      [undefined, 'repo'],
      ['owner', 'a'.repeat(101)],
    ]
  ) {
    let rejected = false;
    try {
      assertRepositoryName(owner, name);
    } catch (error) {
      rejected = isNonRetriable(error);
    }
    assertEquals(rejected, true, `${owner}/${name} should be rejected`);
  }
  assertEquals(isValidRepositoryName('bdougie/contributor.info'), true);
  assertEquals(isValidRepositoryName('bdougie'), false);
  assertEquals(isValidRepositoryName('a/b/c'), false);
  assertEquals(isValidRepositoryName('owner/re po'), false);
  assert(CAPTURE_DEDUPE_MINUTES >= 5);
});

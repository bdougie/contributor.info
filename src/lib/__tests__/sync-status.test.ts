import { describe, expect, it } from 'vitest';
import { isSyncStalled, SYNC_STALL_TIMEOUT_MS } from '../sync-status';

const now = Date.parse('2026-09-07T12:00:00Z');

describe('sync freshness', () => {
  it('stops treating the old tapes sync as active', () => {
    expect(isSyncStalled('in_progress', '2026-05-20T15:28:07Z', now)).toBe(true);
  });

  it('allows a recent job, regardless of when the previous sync ran', () => {
    expect(isSyncStalled('in_progress', new Date(now - 60000).toISOString(), now)).toBe(false);
  });

  it('expires at the five-minute boundary', () => {
    const updated = new Date(now - SYNC_STALL_TIMEOUT_MS).toISOString();
    expect(isSyncStalled('in_progress', updated, now)).toBe(true);
  });

  it.each([null, 'invalid', '2027-01-01T00:00:00Z'])(
    'does not keep a job loading with an unusable timestamp: %s',
    (updated) => expect(isSyncStalled('in_progress', updated, now)).toBe(true)
  );

  it.each(['completed', 'failed', 'pending', null])('does not stall a %s job', (status) => {
    expect(isSyncStalled(status, '2026-05-20T15:28:07Z', now)).toBe(false);
  });
});

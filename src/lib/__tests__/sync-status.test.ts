import { describe, expect, it } from 'vitest';
import {
  getSyncRowError,
  isRecentSyncFailure,
  isSyncStalled,
  SYNC_FAILURE_VISIBLE_MS,
  SYNC_STALL_TIMEOUT_MS,
} from '../sync-status';

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

describe('sync failure visibility', () => {
  it('reports a failure that just happened', () => {
    expect(isRecentSyncFailure('failed', new Date(now - 60000).toISOString(), now)).toBe(true);
  });

  it('ignores a failed row left over from a previous year', () => {
    expect(isRecentSyncFailure('failed', '2025-06-20T03:11:26Z', now)).toBe(false);
  });

  it('stops reporting at the visibility boundary', () => {
    const updated = new Date(now - SYNC_FAILURE_VISIBLE_MS).toISOString();
    expect(isRecentSyncFailure('failed', updated, now)).toBe(false);
  });

  it.each([null, 'invalid', '2027-01-01T00:00:00Z'])(
    'does not report a failure with an unusable timestamp: %s',
    (updated) => expect(isRecentSyncFailure('failed', updated, now)).toBe(false)
  );

  it.each(['completed', 'in_progress', 'pending', null])('does not report a %s row', (status) => {
    expect(isRecentSyncFailure(status, new Date(now - 1000).toISOString(), now)).toBe(false);
  });

  it('uses the stored message for a live failure, with a fallback', () => {
    const updated_at = new Date(now - 1000).toISOString();
    expect(
      getSyncRowError({ sync_status: 'failed', error_message: 'Rate limited', updated_at }, now)
    ).toBe('Rate limited');
    expect(getSyncRowError({ sync_status: 'failed', error_message: null, updated_at }, now)).toBe(
      'The latest repository update failed.'
    );
  });

  it('does not surface a stale error message from an old or non-failed row', () => {
    expect(
      getSyncRowError(
        { sync_status: 'failed', error_message: 'Old', updated_at: '2025-06-20T03:11:26Z' },
        now
      )
    ).toBeNull();
    expect(
      getSyncRowError(
        {
          sync_status: 'completed',
          error_message: 'Leftover',
          updated_at: new Date(now).toISOString(),
        },
        now
      )
    ).toBeNull();
  });
});

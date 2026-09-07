import { describe, expect, it } from 'vitest';
import { getConfidenceDisplayState } from '../confidence-display-state';

const now = Date.parse('2026-09-07T12:00:00Z');
const fresh = { score: 25, calculatedAt: '2026-09-07T11:50:00Z' };
const idle = { isTriggering: false, isInProgress: false, isStalled: false, error: null };

describe('confidence display state', () => {
  it('keeps a previous score visible while refreshing', () => {
    expect(getConfidenceDisplayState({ ...fresh, loading: true }, now)).toBe('refreshing');
  });

  it('only shows initial loading when there is no score', () => {
    expect(getConfidenceDisplayState({ score: null, loading: true }, now)).toBe('loading');
  });

  it('does not let stale syncs hide a score, even if loading is still set', () => {
    expect(
      getConfidenceDisplayState(
        { ...fresh, loading: true, syncStatus: { ...idle, isStalled: true } },
        now
      )
    ).toBe('stale');
  });

  it('warns when the last calculation has expired', () => {
    expect(getConfidenceDisplayState({ ...fresh, calculatedAt: '2026-09-07T11:00:00Z' }, now)).toBe(
      'stale'
    );
  });

  it.each([null, NaN, Infinity, -1, 101])(
    'does not interpret a missing or invalid score: %s',
    (score) => {
      expect(getConfidenceDisplayState({ score }, now)).toBe('unavailable');
    }
  );

  it('preserves a valid zero score', () => {
    expect(getConfidenceDisplayState({ ...fresh, score: 0 }, now)).toBe('ready');
  });

  it.each([null, 'invalid', '2027-01-01T00:00:00Z'])(
    'does not claim freshness for timestamp %s',
    (calculatedAt) => {
      expect(getConfidenceDisplayState({ ...fresh, calculatedAt }, now)).toBe('unknown');
    }
  );

  it('surfaces sync errors even with an available score', () => {
    expect(
      getConfidenceDisplayState({ ...fresh, syncStatus: { ...idle, error: 'Failed' } }, now)
    ).toBe('error');
  });
});

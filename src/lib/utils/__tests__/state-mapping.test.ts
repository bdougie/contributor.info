import { describe, it, expect } from 'vitest';
import {
  getPRState,
  getMonitoringEmoji,
  getChangeDirectionColor,
  formatPercentageChange,
} from '../state-mapping';

describe('state-mapping utilities', () => {
  describe('getPRState', () => {
    it('returns "open" for open PRs', () => {
      expect(getPRState({ state: 'open' })).toBe('open');
      expect(getPRState({ state: 'OPEN', merged: false })).toBe('open');
    });

    it('returns "merged" for merged PRs', () => {
      expect(getPRState({ state: 'closed', merged: true })).toBe('merged');
      expect(getPRState({ state: 'CLOSED', merged: true })).toBe('merged');
    });

    it('returns "closed" for closed non-merged PRs', () => {
      expect(getPRState({ state: 'closed' })).toBe('closed');
      expect(getPRState({ state: 'closed', merged: false })).toBe('closed');
    });

    it('handles case variations correctly', () => {
      expect(getPRState({ state: 'Open' })).toBe('open');
      expect(getPRState({ state: 'OPEN' })).toBe('open');
    });

    it('prioritizes merged status over state', () => {
      // This handles cases where state might be inconsistent
      expect(getPRState({ state: 'any_state', merged: true })).toBe('merged');
    });
  });

  describe('getMonitoringEmoji', () => {
    it('returns success emoji for successful metrics', () => {
      expect(getMonitoringEmoji({ success: true, timedOut: false })).toBe('✅');
      expect(getMonitoringEmoji({ success: true, timedOut: true })).toBe('✅'); // success takes precedence
    });

    it('returns timeout emoji for timed out metrics', () => {
      expect(getMonitoringEmoji({ success: false, timedOut: true })).toBe('⏰');
    });

    it('returns error emoji for failed metrics', () => {
      expect(getMonitoringEmoji({ success: false, timedOut: false })).toBe('❌');
    });
  });

  describe('getChangeDirectionColor', () => {
    it('returns green for positive changes', () => {
      expect(getChangeDirectionColor(true, false)).toBe('text-green-600');
    });

    it('returns muted color for neutral changes', () => {
      expect(getChangeDirectionColor(false, true)).toBe('text-muted-foreground');
    });

    it('returns red for negative changes', () => {
      expect(getChangeDirectionColor(false, false)).toBe('text-red-600');
    });

    it('prioritizes positive over neutral', () => {
      expect(getChangeDirectionColor(true, true)).toBe('text-green-600');
    });
  });

  describe('formatPercentageChange', () => {
    it('returns "0%" for neutral changes', () => {
      expect(formatPercentageChange(true, false, '5')).toBe('0%');
      expect(formatPercentageChange(true, true, '10')).toBe('0%');
    });

    it('formats positive changes with plus sign', () => {
      expect(formatPercentageChange(false, true, '15')).toBe('+15');
      expect(formatPercentageChange(false, true, 25)).toBe('+25');
    });

    it('formats negative changes with minus sign', () => {
      expect(formatPercentageChange(false, false, '10')).toBe('-10');
      expect(formatPercentageChange(false, false, 5)).toBe('-5');
    });
  });
});
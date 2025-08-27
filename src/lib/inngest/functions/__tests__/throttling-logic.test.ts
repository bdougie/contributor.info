import { describe, it, expect, vi, beforeEach } from 'vitest';

// Pure functions for throttling logic (extracted for testing)
export const THROTTLE_CONFIG = {
  manual: 0.083, // 5 minutes
  'auto-fix': 0.25, // 15 minutes
  scheduled: 2, // 2 hours
  'pr-activity': 1, // 1 hour
  default: 0.5, // 30 minutes
};

export function getThrottleHours(reason: string): number {
  return THROTTLE_CONFIG[reason as keyof typeof THROTTLE_CONFIG] || THROTTLE_CONFIG.default;
}

export function calculateEffectiveThrottle(
  hasCompleteData: boolean,
  baseThrottleHours: number
): number {
  // If data is incomplete, be more lenient
  return hasCompleteData ? baseThrottleHours : Math.min(baseThrottleHours, 0.083);
}

export function shouldAllowSync(
  hoursSinceSync: number,
  effectiveThrottleHours: number,
  hasCompleteData: boolean
): boolean {
  // Special case: Allow immediate sync if no data and less than 5 minutes
  // This overrides the normal throttle for the first 5 minutes only
  if (!hasCompleteData && hoursSinceSync < 0.083) {
    return true;
  }

  // Otherwise check against effective throttle
  return hoursSinceSync >= effectiveThrottleHours;
}

describe('Throttling Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getThrottleHours', () => {
    it('should return 5 minutes for manual sync', () => {
      expect(getThrottleHours('manual')).toBe(0.083);
    });

    it('should return 15 minutes for auto-fix', () => {
      expect(getThrottleHours('auto-fix')).toBe(0.25);
    });

    it('should return 2 hours for scheduled sync', () => {
      expect(getThrottleHours('scheduled')).toBe(2);
    });

    it('should return default for unknown reason', () => {
      expect(getThrottleHours('unknown')).toBe(0.5);
    });
  });

  describe('calculateEffectiveThrottle', () => {
    it('should use base throttle when data is complete', () => {
      expect(calculateEffectiveThrottle(true, 2)).toBe(2);
    });

    it('should cap at 5 minutes when data is incomplete', () => {
      expect(calculateEffectiveThrottle(false, 2)).toBe(0.083);
    });

    it('should use lower value when incomplete and base is low', () => {
      expect(calculateEffectiveThrottle(false, 0.05)).toBe(0.05);
    });
  });

  describe('shouldAllowSync', () => {
    it('should allow immediate sync with no data', () => {
      expect(shouldAllowSync(0.01, 2, false)).toBe(true);
    });

    it('should block sync with complete data within throttle', () => {
      expect(shouldAllowSync(0.5, 2, true)).toBe(false);
    });

    it('should allow sync after throttle period', () => {
      expect(shouldAllowSync(3, 2, true)).toBe(true);
    });

    it('should allow incomplete data sync after 5 minutes', () => {
      // 0.1 hours = 6 minutes, which is more than 0.083 hours (5 minutes)
      expect(shouldAllowSync(0.1, 0.083, false)).toBe(true);
    });

    it('should allow incomplete data sync within first 5 minutes', () => {
      // Special case: incomplete data gets immediate sync in first 5 minutes
      expect(shouldAllowSync(0.08, 0.083, false)).toBe(true);
      expect(shouldAllowSync(0.01, 0.083, false)).toBe(true);
    });

    it('should block complete data sync within throttle window', () => {
      // Complete data follows normal throttle rules
      expect(shouldAllowSync(0.08, 0.083, true)).toBe(false);
    });
  });
});

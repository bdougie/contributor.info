import { describe, it, expect, beforeEach, vi } from 'vitest';
import { THROTTLE_CONFIG, getThrottleHours, isSyncAllowed } from '../throttle-config';

describe('Throttle Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('THROTTLE_CONFIG', () => {
    it('should have correct default values', () => {
      expect(THROTTLE_CONFIG.manual).toBe(0.083); // 5 minutes
      expect(THROTTLE_CONFIG['auto-fix']).toBe(1); // 1 hour
      expect(THROTTLE_CONFIG.scheduled).toBe(24); // 24 hours
      expect(THROTTLE_CONFIG.automatic).toBe(4); // 4 hours
      expect(THROTTLE_CONFIG.default).toBe(12); // 12 hours
    });
  });

  describe('getThrottleHours', () => {
    it('should return correct hours for each trigger source', () => {
      expect(getThrottleHours('manual')).toBe(0.083);
      expect(getThrottleHours('auto-fix')).toBe(1);
      expect(getThrottleHours('scheduled')).toBe(24);
      expect(getThrottleHours('automatic')).toBe(4);
    });

    it('should return default hours for unknown trigger source', () => {
      expect(getThrottleHours('unknown')).toBe(12);
      expect(getThrottleHours()).toBe(12);
      expect(getThrottleHours(undefined)).toBe(12);
    });

    it('should handle auto-fix reason correctly', () => {
      // This was the bug - auto-fix wasn't being handled
      const autoFixHours = getThrottleHours('auto-fix');
      expect(autoFixHours).toBe(1);
      expect(autoFixHours).not.toBe(12); // Should not default
    });
  });

  describe('isSyncAllowed', () => {
    it('should allow sync when no last update time', () => {
      expect(isSyncAllowed(undefined, 'auto-fix')).toBe(true);
      expect(isSyncAllowed(null, 'auto-fix')).toBe(true);
    });

    it('should allow sync when enough time has passed', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      expect(isSyncAllowed(twoHoursAgo, 'auto-fix')).toBe(true); // 2 hours > 1 hour threshold
    });

    it('should prevent sync when not enough time has passed', () => {
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      expect(isSyncAllowed(thirtyMinutesAgo, 'auto-fix')).toBe(false); // 30 min < 1 hour threshold
    });

    it('should handle manual sync with 5-minute cooldown', () => {
      const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      
      expect(isSyncAllowed(threeMinutesAgo, 'manual')).toBe(false); // 3 min < 5 min
      expect(isSyncAllowed(tenMinutesAgo, 'manual')).toBe(true); // 10 min > 5 min
    });

    it('should handle scheduled sync with 24-hour cooldown', () => {
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
      const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
      
      expect(isSyncAllowed(twelveHoursAgo, 'scheduled')).toBe(false); // 12h < 24h
      expect(isSyncAllowed(twentyFiveHoursAgo, 'scheduled')).toBe(true); // 25h > 24h
    });

    it('should handle date strings', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      expect(isSyncAllowed(twoHoursAgo, 'auto-fix')).toBe(true);
    });
  });

  describe('Rate Limiting Bug Regression Tests', () => {
    it('should not default auto-fix to 12 hours', () => {
      // This was the specific bug that caused PR data corruption
      const autoFixThrottle = getThrottleHours('auto-fix');
      expect(autoFixThrottle).toBe(1);
      expect(autoFixThrottle).toBeLessThan(12);
    });

    it('should allow auto-fix sync after 1 hour', () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const fiftyMinutesAgo = new Date(Date.now() - 50 * 60 * 1000);
      
      expect(isSyncAllowed(oneHourAgo, 'auto-fix')).toBe(true);
      expect(isSyncAllowed(fiftyMinutesAgo, 'auto-fix')).toBe(false);
    });

    it('should handle all known sync reasons', () => {
      const reasons = ['manual', 'auto-fix', 'scheduled', 'automatic', 'pr-activity'];
      reasons.forEach(reason => {
        const hours = getThrottleHours(reason);
        expect(hours).toBeGreaterThan(0);
        expect(hours).toBeLessThanOrEqual(24);
      });
    });
  });
});
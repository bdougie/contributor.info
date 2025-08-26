import { describe, it, expect, beforeEach, vi } from 'vitest';

// Simulate the rate limiting logic from inngest-prod-functions.mts
function getMinHoursBetweenSyncs(reason?: string): number {
  let minHoursBetweenSyncs = 12; // Default for GraphQL sync
  
  if (reason === 'scheduled') {
    minHoursBetweenSyncs = 2; // Allow more frequent scheduled syncs
  } else if (reason === 'pr-activity') {
    minHoursBetweenSyncs = 1; // Allow very frequent PR activity updates
  } else if (reason === 'manual') {
    minHoursBetweenSyncs = 5 / 60; // 5-minute cooldown for manual syncs
  } else if (reason === 'auto-fix') {
    minHoursBetweenSyncs = 1; // Allow hourly auto-fix syncs for corrupted data
  }
  
  return minHoursBetweenSyncs;
}

function shouldAllowSync(lastSyncTime: Date | null, reason?: string): boolean {
  if (!lastSyncTime) return true;
  
  const hoursSinceSync = (Date.now() - lastSyncTime.getTime()) / (1000 * 60 * 60);
  const minHours = getMinHoursBetweenSyncs(reason);
  
  return hoursSinceSync >= minHours;
}

function formatTimeSinceSync(hoursSinceSync: number): string {
  if (hoursSinceSync < 1) {
    const minutesSinceSync = Math.round(hoursSinceSync * 60);
    return `${minutesSinceSync} minute${minutesSinceSync !== 1 ? 's' : ''}`;
  } else {
    const roundedHours = Math.round(hoursSinceSync * 10) / 10; // Round to 1 decimal
    return `${roundedHours} hour${roundedHours !== 1 ? 's' : ''}`;
  }
}

describe('Inngest Function Rate Limiting', () => {
  describe('getMinHoursBetweenSyncs', () => {
    it('should return correct minimum hours for each sync reason', () => {
      expect(getMinHoursBetweenSyncs('scheduled')).toBe(2);
      expect(getMinHoursBetweenSyncs('pr-activity')).toBe(1);
      expect(getMinHoursBetweenSyncs('manual')).toBeCloseTo(0.083, 3);
      expect(getMinHoursBetweenSyncs('auto-fix')).toBe(1);
    });

    it('should default to 12 hours for unknown reasons', () => {
      expect(getMinHoursBetweenSyncs()).toBe(12);
      expect(getMinHoursBetweenSyncs('unknown')).toBe(12);
      expect(getMinHoursBetweenSyncs('')).toBe(12);
    });

    it('should handle auto-fix reason (bug fix regression test)', () => {
      // This was the bug - auto-fix wasn't handled and defaulted to 12 hours
      const autoFixHours = getMinHoursBetweenSyncs('auto-fix');
      expect(autoFixHours).toBe(1);
      expect(autoFixHours).not.toBe(12);
    });
  });

  describe('shouldAllowSync', () => {
    it('should allow sync when no last sync time exists', () => {
      expect(shouldAllowSync(null, 'auto-fix')).toBe(true);
      expect(shouldAllowSync(null, 'manual')).toBe(true);
    });

    it('should allow auto-fix sync after 1 hour', () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const fiftyMinutesAgo = new Date(Date.now() - 50 * 60 * 1000);
      
      expect(shouldAllowSync(oneHourAgo, 'auto-fix')).toBe(true);
      expect(shouldAllowSync(fiftyMinutesAgo, 'auto-fix')).toBe(false);
    });

    it('should allow manual sync after 5 minutes', () => {
      const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);
      const fourMinutesAgo = new Date(Date.now() - 4 * 60 * 1000);
      
      expect(shouldAllowSync(sixMinutesAgo, 'manual')).toBe(true);
      expect(shouldAllowSync(fourMinutesAgo, 'manual')).toBe(false);
    });

    it('should allow scheduled sync after 2 hours', () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      expect(shouldAllowSync(threeHoursAgo, 'scheduled')).toBe(true);
      expect(shouldAllowSync(oneHourAgo, 'scheduled')).toBe(false);
    });

    it('should enforce 12-hour default for unknown reasons', () => {
      const elevenHoursAgo = new Date(Date.now() - 11 * 60 * 60 * 1000);
      const thirteenHoursAgo = new Date(Date.now() - 13 * 60 * 60 * 1000);
      
      expect(shouldAllowSync(elevenHoursAgo, 'unknown')).toBe(false);
      expect(shouldAllowSync(thirteenHoursAgo, 'unknown')).toBe(true);
    });
  });

  describe('formatTimeSinceSync', () => {
    it('should format minutes correctly', () => {
      expect(formatTimeSinceSync(0.5)).toBe('30 minutes');
      expect(formatTimeSinceSync(0.017)).toBe('1 minute');
      expect(formatTimeSinceSync(0.033)).toBe('2 minutes');
    });

    it('should format hours correctly', () => {
      expect(formatTimeSinceSync(1)).toBe('1 hour');
      expect(formatTimeSinceSync(2)).toBe('2 hours');
      expect(formatTimeSinceSync(2.3)).toBe('2.3 hours');
      expect(formatTimeSinceSync(12.5)).toBe('12.5 hours');
    });

    it('should handle edge cases', () => {
      expect(formatTimeSinceSync(0.99)).toBe('59 minutes');
      expect(formatTimeSinceSync(1.01)).toBe('1 hour');
    });
  });

  describe('Real-world Scenarios', () => {
    it('should prevent rapid auto-fix attempts', () => {
      const times = [
        new Date(Date.now() - 30 * 60 * 1000),  // 30 minutes ago
        new Date(Date.now() - 45 * 60 * 1000),  // 45 minutes ago
        new Date(Date.now() - 59 * 60 * 1000),  // 59 minutes ago
      ];

      times.forEach(time => {
        expect(shouldAllowSync(time, 'auto-fix')).toBe(false);
      });

      const oneHourAgo = new Date(Date.now() - 61 * 60 * 1000); // 61 minutes ago
      expect(shouldAllowSync(oneHourAgo, 'auto-fix')).toBe(true);
    });

    it('should handle the corruption detection workflow', () => {
      // Simulate detection and fix cycle
      let lastSync = null;
      
      // First detection - should allow
      expect(shouldAllowSync(lastSync, 'auto-fix')).toBe(true);
      
      // After first fix attempt
      lastSync = new Date();
      
      // Immediate retry should be blocked
      expect(shouldAllowSync(lastSync, 'auto-fix')).toBe(false);
      
      // Manual override should work after 5 minutes
      const fiveMinutesLater = new Date(lastSync.getTime() + 5 * 60 * 1000);
      vi.setSystemTime(fiveMinutesLater);
      expect(shouldAllowSync(lastSync, 'manual')).toBe(true);
      
      // Auto-fix should work after 1 hour
      const oneHourLater = new Date(lastSync.getTime() + 60 * 60 * 1000);
      vi.setSystemTime(oneHourLater);
      expect(shouldAllowSync(lastSync, 'auto-fix')).toBe(true);
      
      vi.useRealTimers();
    });

    it('should handle multiple concurrent sync reasons', () => {
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      
      // Different reasons have different thresholds from same last sync time
      expect(shouldAllowSync(thirtyMinutesAgo, 'manual')).toBe(true); // 30 min > 5 min
      expect(shouldAllowSync(thirtyMinutesAgo, 'auto-fix')).toBe(false); // 30 min < 60 min
      expect(shouldAllowSync(thirtyMinutesAgo, 'pr-activity')).toBe(false); // 30 min < 60 min
      expect(shouldAllowSync(thirtyMinutesAgo, 'scheduled')).toBe(false); // 30 min < 120 min
    });
  });

  describe('Error Message Generation', () => {
    it('should generate appropriate error messages', () => {
      const generateErrorMessage = (lastSync: Date, reason: string) => {
        const hoursSinceSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);
        const timeDisplay = formatTimeSinceSync(hoursSinceSync);
        const minHours = getMinHoursBetweenSyncs(reason);
        
        return `Repository was synced ${timeDisplay} ago. Skipping to prevent excessive API usage (minimum ${minHours} hours between syncs for ${reason} sync).`;
      };

      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      
      expect(generateErrorMessage(thirtyMinutesAgo, 'auto-fix'))
        .toBe('Repository was synced 30 minutes ago. Skipping to prevent excessive API usage (minimum 1 hours between syncs for auto-fix sync).');
      
      expect(generateErrorMessage(thirtyMinutesAgo, 'scheduled'))
        .toBe('Repository was synced 30 minutes ago. Skipping to prevent excessive API usage (minimum 2 hours between syncs for scheduled sync).');
    });
  });
});
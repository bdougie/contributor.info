import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Test the date selection logic used in use-monthly-contributor-rankings
 * This mirrors the logic without the complex React hook machinery
 */

function calculateTargetMonth(currentDate: Date): { targetMonth: number; targetYear: number } {
  const dayOfMonth = currentDate.getUTCDate();
  const isWinnerPhase = dayOfMonth >= 1 && dayOfMonth <= 7;

  let targetMonth: number;
  let targetYear: number;

  if (isWinnerPhase) {
    // Winner announcement phase (1st-7th): request previous month's data
    const previousMonthDate = new Date(
      Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth() - 1, 1)
    );
    targetMonth = previousMonthDate.getUTCMonth() + 1;
    targetYear = previousMonthDate.getUTCFullYear();
  } else {
    // Running leaderboard phase (8th+): request current month's data
    targetMonth = currentDate.getUTCMonth() + 1;
    targetYear = currentDate.getUTCFullYear();
  }

  return { targetMonth, targetYear };
}

describe('Monthly Rankings Date Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Winner Announcement Phase (Days 1-7)', () => {
    it('should select previous month on day 1', () => {
      const currentDate = new Date('2025-03-01T00:00:00Z');
      const { targetMonth, targetYear } = calculateTargetMonth(currentDate);

      expect(targetMonth).toBe(2); // February
      expect(targetYear).toBe(2025);
    });

    it('should select previous month on day 3', () => {
      const currentDate = new Date('2025-01-03T10:00:00Z');
      const { targetMonth, targetYear } = calculateTargetMonth(currentDate);

      expect(targetMonth).toBe(12); // December
      expect(targetYear).toBe(2024);
    });

    it('should select previous month on day 7 (last day of winner phase)', () => {
      const currentDate = new Date('2025-02-07T23:59:00Z');
      const { targetMonth, targetYear } = calculateTargetMonth(currentDate);

      expect(targetMonth).toBe(1); // January
      expect(targetYear).toBe(2025);
    });

    it('should handle January correctly (previous year)', () => {
      const currentDate = new Date('2025-01-01T00:00:00Z');
      const { targetMonth, targetYear } = calculateTargetMonth(currentDate);

      expect(targetMonth).toBe(12); // December
      expect(targetYear).toBe(2024);
    });

    it('should handle mid-day on day 5', () => {
      const currentDate = new Date('2025-06-05T12:30:00Z');
      const { targetMonth, targetYear } = calculateTargetMonth(currentDate);

      expect(targetMonth).toBe(5); // May
      expect(targetYear).toBe(2025);
    });
  });

  describe('Running Leaderboard Phase (Days 8+)', () => {
    it('should select current month on day 8', () => {
      const currentDate = new Date('2025-01-08T00:00:00Z');
      const { targetMonth, targetYear } = calculateTargetMonth(currentDate);

      expect(targetMonth).toBe(1); // January
      expect(targetYear).toBe(2025);
    });

    it('should select current month on day 15', () => {
      const currentDate = new Date('2025-02-15T12:00:00Z');
      const { targetMonth, targetYear } = calculateTargetMonth(currentDate);

      expect(targetMonth).toBe(2); // February
      expect(targetYear).toBe(2025);
    });

    it('should select current month on day 31', () => {
      const currentDate = new Date('2025-12-31T23:59:00Z');
      const { targetMonth, targetYear } = calculateTargetMonth(currentDate);

      expect(targetMonth).toBe(12); // December
      expect(targetYear).toBe(2025);
    });

    it('should select current month on day 28 (February non-leap year)', () => {
      const currentDate = new Date('2025-02-28T12:00:00Z');
      const { targetMonth, targetYear} = calculateTargetMonth(currentDate);

      expect(targetMonth).toBe(2); // February
      expect(targetYear).toBe(2025);
    });

    it('should select current month on day 29 (February leap year)', () => {
      const currentDate = new Date('2024-02-29T12:00:00Z');
      const { targetMonth, targetYear } = calculateTargetMonth(currentDate);

      expect(targetMonth).toBe(2); // February
      expect(targetYear).toBe(2024);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle timezone-independent calculations', () => {
      // Test that UTC date methods work correctly
      const currentDate = new Date('2025-03-07T23:59:59Z'); // End of day 7 UTC

      const { targetMonth, targetYear } = calculateTargetMonth(currentDate);

      expect(targetMonth).toBe(2); // Should select February even at end of day 7
      expect(targetYear).toBe(2025);
    });

    it('should handle start of day 8 correctly', () => {
      const currentDate = new Date('2025-03-08T00:00:00Z');
      const { targetMonth, targetYear } = calculateTargetMonth(currentDate);

      expect(targetMonth).toBe(3); // Should select March (current month)
      expect(targetYear).toBe(2025);
    });

    it('should handle year boundary during winner phase', () => {
      // January 5th should look at previous December
      const currentDate = new Date('2025-01-05T12:00:00Z');
      const { targetMonth, targetYear } = calculateTargetMonth(currentDate);

      expect(targetMonth).toBe(12); // December
      expect(targetYear).toBe(2024); // Previous year
    });

    it('should handle year boundary during leaderboard phase', () => {
      // January 15th should look at current January
      const currentDate = new Date('2025-01-15T12:00:00Z');
      const { targetMonth, targetYear } = calculateTargetMonth(currentDate);

      expect(targetMonth).toBe(1); // January
      expect(targetYear).toBe(2025); // Current year
    });

    it('should handle leap year February during winner phase', () => {
      const currentDate = new Date('2024-03-03T10:00:00Z');
      const { targetMonth, targetYear } = calculateTargetMonth(currentDate);

      expect(targetMonth).toBe(2); // February (leap year)
      expect(targetYear).toBe(2024);
    });

    it('should handle April 1st correctly', () => {
      const currentDate = new Date('2025-04-01T00:00:00Z');
      const { targetMonth, targetYear } = calculateTargetMonth(currentDate);

      expect(targetMonth).toBe(3); // March (previous month)
      expect(targetYear).toBe(2025);
    });
  });

  describe('Date Range Verification', () => {
    it('should produce valid date ranges for January', () => {
      const { targetMonth, targetYear } = { targetMonth: 1, targetYear: 2025 };

      const startDate = new Date(Date.UTC(targetYear, targetMonth - 1, 1, 0, 0, 0, 0));
      const endDate = new Date(Date.UTC(targetYear, targetMonth, 0, 23, 59, 59, 999));

      expect(startDate.toISOString()).toBe('2025-01-01T00:00:00.000Z');
      expect(endDate.toISOString()).toBe('2025-01-31T23:59:59.999Z');
    });

    it('should produce valid date ranges for February (non-leap year)', () => {
      const { targetMonth, targetYear } = { targetMonth: 2, targetYear: 2025 };

      const startDate = new Date(Date.UTC(targetYear, targetMonth - 1, 1, 0, 0, 0, 0));
      const endDate = new Date(Date.UTC(targetYear, targetMonth, 0, 23, 59, 59, 999));

      expect(startDate.toISOString()).toBe('2025-02-01T00:00:00.000Z');
      expect(endDate.toISOString()).toBe('2025-02-28T23:59:59.999Z');
    });

    it('should produce valid date ranges for February (leap year)', () => {
      const { targetMonth, targetYear } = { targetMonth: 2, targetYear: 2024 };

      const startDate = new Date(Date.UTC(targetYear, targetMonth - 1, 1, 0, 0, 0, 0));
      const endDate = new Date(Date.UTC(targetYear, targetMonth, 0, 23, 59, 59, 999));

      expect(startDate.toISOString()).toBe('2024-02-01T00:00:00.000Z');
      expect(endDate.toISOString()).toBe('2024-02-29T23:59:59.999Z');
    });

    it('should produce valid date ranges for December', () => {
      const { targetMonth, targetYear } = { targetMonth: 12, targetYear: 2024 };

      const startDate = new Date(Date.UTC(targetYear, targetMonth - 1, 1, 0, 0, 0, 0));
      const endDate = new Date(Date.UTC(targetYear, targetMonth, 0, 23, 59, 59, 999));

      expect(startDate.toISOString()).toBe('2024-12-01T00:00:00.000Z');
      expect(endDate.toISOString()).toBe('2024-12-31T23:59:59.999Z');
    });
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'https://deno.land/std@0.192.0/testing/bdd.ts';
import { assertEquals } from 'https://deno.land/std@0.192.0/testing/asserts.ts';

/**
 * Test the date selection logic used in the Edge Function
 * This mirrors the logic in calculate-monthly-rankings/index.ts
 */

function calculateTargetMonth(
  month: number | undefined,
  year: number | undefined,
  currentDate: Date
): { targetMonth: number; targetYear: number } {
  let targetMonth: number;
  let targetYear: number;

  if (month !== undefined && year !== undefined) {
    // Explicit month/year provided
    targetMonth = month;
    targetYear = year;
  } else {
    // No explicit month/year - determine based on cycle phase
    const dayOfMonth = currentDate.getUTCDate();
    const isWinnerPhase = dayOfMonth >= 1 && dayOfMonth <= 7;

    if (isWinnerPhase) {
      // Winner announcement phase (1st-7th): show previous month's data
      const previousMonthDate = new Date(
        Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth() - 1, 1)
      );
      targetMonth = previousMonthDate.getUTCMonth() + 1;
      targetYear = previousMonthDate.getUTCFullYear();
    } else {
      // Running leaderboard phase (8th+): show current month's data
      targetMonth = currentDate.getUTCMonth() + 1;
      targetYear = currentDate.getUTCFullYear();
    }
  }

  return { targetMonth, targetYear };
}

describe('Edge Function Date Logic', () => {
  describe('Winner Announcement Phase (Days 1-7)', () => {
    it('should select previous month on day 1', () => {
      const currentDate = new Date('2025-03-01T00:00:00Z');
      const { targetMonth, targetYear } = calculateTargetMonth(undefined, undefined, currentDate);

      assertEquals(targetMonth, 2, 'Should select February (month 2)');
      assertEquals(targetYear, 2025, 'Should select 2025');
    });

    it('should select previous month on day 3', () => {
      const currentDate = new Date('2025-01-03T10:00:00Z');
      const { targetMonth, targetYear } = calculateTargetMonth(undefined, undefined, currentDate);

      assertEquals(targetMonth, 12, 'Should select December (month 12)');
      assertEquals(targetYear, 2024, 'Should select previous year 2024');
    });

    it('should select previous month on day 7 (last day of winner phase)', () => {
      const currentDate = new Date('2025-02-07T23:59:00Z');
      const { targetMonth, targetYear } = calculateTargetMonth(undefined, undefined, currentDate);

      assertEquals(targetMonth, 1, 'Should select January (month 1)');
      assertEquals(targetYear, 2025, 'Should select 2025');
    });

    it('should handle January correctly (previous year)', () => {
      const currentDate = new Date('2025-01-01T00:00:00Z');
      const { targetMonth, targetYear } = calculateTargetMonth(undefined, undefined, currentDate);

      assertEquals(targetMonth, 12, 'Should select December (month 12)');
      assertEquals(targetYear, 2024, 'Should select previous year 2024');
    });

    it('should handle mid-day on day 5', () => {
      const currentDate = new Date('2025-06-05T12:30:00Z');
      const { targetMonth, targetYear } = calculateTargetMonth(undefined, undefined, currentDate);

      assertEquals(targetMonth, 5, 'Should select May (month 5)');
      assertEquals(targetYear, 2025, 'Should select 2025');
    });
  });

  describe('Running Leaderboard Phase (Days 8+)', () => {
    it('should select current month on day 8', () => {
      const currentDate = new Date('2025-01-08T00:00:00Z');
      const { targetMonth, targetYear } = calculateTargetMonth(undefined, undefined, currentDate);

      assertEquals(targetMonth, 1, 'Should select January (month 1)');
      assertEquals(targetYear, 2025, 'Should select 2025');
    });

    it('should select current month on day 15', () => {
      const currentDate = new Date('2025-02-15T12:00:00Z');
      const { targetMonth, targetYear } = calculateTargetMonth(undefined, undefined, currentDate);

      assertEquals(targetMonth, 2, 'Should select February (month 2)');
      assertEquals(targetYear, 2025, 'Should select 2025');
    });

    it('should select current month on day 31', () => {
      const currentDate = new Date('2025-12-31T23:59:00Z');
      const { targetMonth, targetYear } = calculateTargetMonth(undefined, undefined, currentDate);

      assertEquals(targetMonth, 12, 'Should select December (month 12)');
      assertEquals(targetYear, 2025, 'Should select 2025');
    });

    it('should select current month on day 28 (February non-leap year)', () => {
      const currentDate = new Date('2025-02-28T12:00:00Z');
      const { targetMonth, targetYear } = calculateTargetMonth(undefined, undefined, currentDate);

      assertEquals(targetMonth, 2, 'Should select February (month 2)');
      assertEquals(targetYear, 2025, 'Should select 2025');
    });

    it('should select current month on day 29 (February leap year)', () => {
      const currentDate = new Date('2024-02-29T12:00:00Z');
      const { targetMonth, targetYear } = calculateTargetMonth(undefined, undefined, currentDate);

      assertEquals(targetMonth, 2, 'Should select February (month 2)');
      assertEquals(targetYear, 2024, 'Should select 2024');
    });
  });

  describe('Explicit Month/Year Parameters', () => {
    it('should use explicit month and year when provided', () => {
      const currentDate = new Date('2025-03-05T10:00:00Z'); // Winner phase
      const { targetMonth, targetYear } = calculateTargetMonth(1, 2024, currentDate);

      assertEquals(targetMonth, 1, 'Should use explicit January (month 1)');
      assertEquals(targetYear, 2024, 'Should use explicit year 2024');
    });

    it('should ignore current date cycle when explicit params provided', () => {
      const currentDate = new Date('2025-03-15T10:00:00Z'); // Leaderboard phase
      const { targetMonth, targetYear } = calculateTargetMonth(12, 2023, currentDate);

      assertEquals(targetMonth, 12, 'Should use explicit December (month 12)');
      assertEquals(targetYear, 2023, 'Should use explicit year 2023');
    });

    it('should handle month 0 explicitly (edge case)', () => {
      const currentDate = new Date('2025-03-15T10:00:00Z');
      const { targetMonth, targetYear } = calculateTargetMonth(0, 2025, currentDate);

      assertEquals(targetMonth, 0, 'Should use explicit month 0 (edge case)');
      assertEquals(targetYear, 2025, 'Should use explicit year 2025');
    });
  });

  describe('Date Range Calculation', () => {
    it('should calculate correct date range for January 2025', () => {
      const targetMonth = 1;
      const targetYear = 2025;

      const startDate = new Date(Date.UTC(targetYear, targetMonth - 1, 1, 0, 0, 0, 0));
      const endDate = new Date(Date.UTC(targetYear, targetMonth, 0, 23, 59, 59, 999));

      assertEquals(startDate.toISOString(), '2025-01-01T00:00:00.000Z');
      assertEquals(endDate.toISOString(), '2025-01-31T23:59:59.999Z');
    });

    it('should calculate correct date range for February 2025 (non-leap year)', () => {
      const targetMonth = 2;
      const targetYear = 2025;

      const startDate = new Date(Date.UTC(targetYear, targetMonth - 1, 1, 0, 0, 0, 0));
      const endDate = new Date(Date.UTC(targetYear, targetMonth, 0, 23, 59, 59, 999));

      assertEquals(startDate.toISOString(), '2025-02-01T00:00:00.000Z');
      assertEquals(endDate.toISOString(), '2025-02-28T23:59:59.999Z');
    });

    it('should calculate correct date range for February 2024 (leap year)', () => {
      const targetMonth = 2;
      const targetYear = 2024;

      const startDate = new Date(Date.UTC(targetYear, targetMonth - 1, 1, 0, 0, 0, 0));
      const endDate = new Date(Date.UTC(targetYear, targetMonth, 0, 23, 59, 59, 999));

      assertEquals(startDate.toISOString(), '2024-02-01T00:00:00.000Z');
      assertEquals(endDate.toISOString(), '2024-02-29T23:59:59.999Z');
    });

    it('should calculate correct date range for December 2024', () => {
      const targetMonth = 12;
      const targetYear = 2024;

      const startDate = new Date(Date.UTC(targetYear, targetMonth - 1, 1, 0, 0, 0, 0));
      const endDate = new Date(Date.UTC(targetYear, targetMonth, 0, 23, 59, 59, 999));

      assertEquals(startDate.toISOString(), '2024-12-01T00:00:00.000Z');
      assertEquals(endDate.toISOString(), '2024-12-31T23:59:59.999Z');
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle timezone-independent calculations', () => {
      // Test that UTC date methods work correctly regardless of system timezone
      const currentDate = new Date('2025-03-07T23:59:59Z'); // End of day 7 UTC

      const { targetMonth, targetYear } = calculateTargetMonth(undefined, undefined, currentDate);

      assertEquals(targetMonth, 2, 'Should select February even at end of day 7');
      assertEquals(targetYear, 2025, 'Should select 2025');
    });

    it('should handle start of day 8 correctly', () => {
      const currentDate = new Date('2025-03-08T00:00:00Z');
      const { targetMonth, targetYear } = calculateTargetMonth(undefined, undefined, currentDate);

      assertEquals(targetMonth, 3, 'Should select March (current month)');
      assertEquals(targetYear, 2025, 'Should select 2025');
    });

    it('should handle year boundary during winner phase', () => {
      // January 5th should look at previous December
      const currentDate = new Date('2025-01-05T12:00:00Z');
      const { targetMonth, targetYear } = calculateTargetMonth(undefined, undefined, currentDate);

      assertEquals(targetMonth, 12, 'Should select December');
      assertEquals(targetYear, 2024, 'Should select previous year 2024');
    });

    it('should handle year boundary during leaderboard phase', () => {
      // January 15th should look at current January
      const currentDate = new Date('2025-01-15T12:00:00Z');
      const { targetMonth, targetYear } = calculateTargetMonth(undefined, undefined, currentDate);

      assertEquals(targetMonth, 1, 'Should select January');
      assertEquals(targetYear, 2025, 'Should select current year 2025');
    });
  });
});

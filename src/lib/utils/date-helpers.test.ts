/**
 * Unit tests for date utility functions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getCurrentMonthlyCycleState,
  getMonthDateRange,
  getCurrentMonthDateRange,
  getPreviousMonthDateRange,
  isDateInMonth,
  isWinnerAnnouncementPhase,
  isRunningLeaderboardPhase,
  getDaysRemainingInMonth,
  getDaysElapsedInMonth,
  formatMonth,
  getPhaseDescription,
  getTimeUntilNextPhase,
  isSameMonth,
  getCurrentWeekDateRange,
} from './date-helpers';
import { CyclePhase } from '../contributors/types';

describe('Date Helpers', () => {
  beforeEach(() => {
    // Clear any date mocks
    vi.useRealTimers();
  });

  describe('getCurrentMonthlyCycleState', () => {
    it('should return winner announcement phase for early month dates', () => {
      // Mock date to be 5th of January 2024
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 0, 5)); // January 5, 2024

      const state = getCurrentMonthlyCycleState();

      expect(state.phase).toBe(CyclePhase.WINNER_ANNOUNCEMENT);
      expect(state.dayOfMonth).toBe(5);
      expect(state.currentMonth.month).toBe(0); // January
      expect(state.currentMonth.year).toBe(2024);
      expect(state.previousMonth.month).toBe(11); // December
      expect(state.previousMonth.year).toBe(2023);
      expect(state.isTransitioning).toBe(false);

      vi.useRealTimers();
    });

    it('should return running leaderboard phase for late month dates', () => {
      // Mock date to be 15th of June 2024
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 5, 15)); // June 15, 2024

      const state = getCurrentMonthlyCycleState();

      expect(state.phase).toBe(CyclePhase.RUNNING_LEADERBOARD);
      expect(state.dayOfMonth).toBe(15);
      expect(state.currentMonth.month).toBe(5); // June
      expect(state.currentMonth.year).toBe(2024);
      expect(state.previousMonth.month).toBe(4); // May
      expect(state.previousMonth.year).toBe(2024);
      expect(state.isTransitioning).toBe(false);

      vi.useRealTimers();
    });

    it('should mark early days as transitioning', () => {
      // Mock date to be 2nd of March 2024
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 2, 2)); // March 2, 2024

      const state = getCurrentMonthlyCycleState();

      expect(state.isTransitioning).toBe(true);

      vi.useRealTimers();
    });

    it('should handle year transitions correctly', () => {
      // Mock date to be 1st of January 2024
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 0, 1)); // January 1, 2024

      const state = getCurrentMonthlyCycleState();

      expect(state.currentMonth.month).toBe(0); // January
      expect(state.currentMonth.year).toBe(2024);
      expect(state.previousMonth.month).toBe(11); // December
      expect(state.previousMonth.year).toBe(2023);

      vi.useRealTimers();
    });
  });

  describe('getMonthDateRange', () => {
    it('should return correct date range for a month', () => {
      const { startDate, endDate } = getMonthDateRange(5, 2024); // June 2024

      expect(startDate).toEqual(new Date(2024, 5, 1));
      expect(endDate.getFullYear()).toBe(2024);
      expect(endDate.getMonth()).toBe(5);
      expect(endDate.getDate()).toBe(30); // June has 30 days
      expect(endDate.getHours()).toBe(23);
      expect(endDate.getMinutes()).toBe(59);
      expect(endDate.getSeconds()).toBe(59);
    });

    it('should handle February in leap year', () => {
      const { startDate, endDate } = getMonthDateRange(1, 2024); // February 2024 (leap year)

      expect(startDate).toEqual(new Date(2024, 1, 1));
      expect(endDate.getDate()).toBe(29); // February has 29 days in 2024
    });

    it('should handle February in non-leap year', () => {
      const { startDate, endDate } = getMonthDateRange(1, 2023); // February 2023 (non-leap year)

      expect(startDate).toEqual(new Date(2023, 1, 1));
      expect(endDate.getDate()).toBe(28); // February has 28 days in 2023
    });
  });

  describe('getCurrentMonthDateRange', () => {
    it('should return current month date range', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 3, 15)); // April 15, 2024

      const { startDate, endDate } = getCurrentMonthDateRange();

      expect(startDate).toEqual(new Date(2024, 3, 1));
      expect(endDate.getMonth()).toBe(3); // April
      expect(endDate.getDate()).toBe(30); // April has 30 days

      vi.useRealTimers();
    });
  });

  describe('getPreviousMonthDateRange', () => {
    it('should return previous month date range', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 3, 15)); // April 15, 2024

      const { startDate, endDate } = getPreviousMonthDateRange();

      expect(startDate).toEqual(new Date(2024, 2, 1)); // March 1, 2024
      expect(endDate.getMonth()).toBe(2); // March
      expect(endDate.getDate()).toBe(31); // March has 31 days

      vi.useRealTimers();
    });

    it('should handle year boundary', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 0, 15)); // January 15, 2024

      const { startDate, endDate } = getPreviousMonthDateRange();

      expect(startDate).toEqual(new Date(2023, 11, 1)); // December 1, 2023
      expect(endDate.getFullYear()).toBe(2023);
      expect(endDate.getMonth()).toBe(11); // December
      expect(endDate.getDate()).toBe(31); // December has 31 days

      vi.useRealTimers();
    });
  });

  describe('isDateInMonth', () => {
    it('should return true for date in specified month', () => {
      const date = new Date(2024, 5, 15); // June 15, 2024
      expect(isDateInMonth(date, 5, 2024)).toBe(true);
    });

    it('should return false for date in different month', () => {
      const date = new Date(2024, 5, 15); // June 15, 2024
      expect(isDateInMonth(date, 4, 2024)).toBe(false); // May
    });

    it('should return false for date in different year', () => {
      const date = new Date(2024, 5, 15); // June 15, 2024
      expect(isDateInMonth(date, 5, 2023)).toBe(false); // June 2023
    });
  });

  describe('phase detection functions', () => {
    it('isWinnerAnnouncementPhase should return true for days 1-7', () => {
      for (let day = 1; day <= 7; day++) {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2024, 5, day));
        expect(isWinnerAnnouncementPhase()).toBe(true);
        vi.useRealTimers();
      }
    });

    it('isWinnerAnnouncementPhase should return false for days 8+', () => {
      for (let day = 8; day <= 15; day++) {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2024, 5, day));
        expect(isWinnerAnnouncementPhase()).toBe(false);
        vi.useRealTimers();
      }
    });

    it('isRunningLeaderboardPhase should be opposite of isWinnerAnnouncementPhase', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 5, 5));
      expect(isRunningLeaderboardPhase()).toBe(!isWinnerAnnouncementPhase());

      vi.setSystemTime(new Date(2024, 5, 15));
      expect(isRunningLeaderboardPhase()).toBe(!isWinnerAnnouncementPhase());
      vi.useRealTimers();
    });
  });

  describe('day calculation functions', () => {
    it('should calculate days remaining in month correctly', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 5, 15)); // June 15, 2024 (June has 30 days)

      expect(getDaysRemainingInMonth()).toBe(15); // 30 - 15 = 15

      vi.useRealTimers();
    });

    it('should calculate days elapsed in month correctly', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 5, 15)); // June 15, 2024

      expect(getDaysElapsedInMonth()).toBe(15);

      vi.useRealTimers();
    });
  });

  describe('formatMonth', () => {
    it('should format month and year correctly', () => {
      expect(formatMonth(0, 2024)).toBe('January 2024');
      expect(formatMonth(5, 2024)).toBe('June 2024');
      expect(formatMonth(11, 2023)).toBe('December 2023');
    });
  });

  describe('getPhaseDescription', () => {
    it('should return correct descriptions for each phase', () => {
      expect(getPhaseDescription(CyclePhase.WINNER_ANNOUNCEMENT)).toBe(
        'Winner Announcement Period',
      );
      expect(getPhaseDescription(CyclePhase.RUNNING_LEADERBOARD)).toBe('Active Competition Period');
    });
  });

  describe('getTimeUntilNextPhase', () => {
    it('should calculate days until running leaderboard phase', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 5, 5)); // June 5, 2024

      const result = getTimeUntilNextPhase();

      expect(result.phase).toBe(CyclePhase.RUNNING_LEADERBOARD);
      expect(result.days).toBe(3); // Until June 8

      vi.useRealTimers();
    });

    it('should calculate days until next winner announcement phase', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 5, 20)); // June 20, 2024

      const result = getTimeUntilNextPhase();

      expect(result.phase).toBe(CyclePhase.WINNER_ANNOUNCEMENT);
      expect(result.days).toBe(11); // Until July 1 (30 - 20 + 1)

      vi.useRealTimers();
    });
  });

  describe('isSameMonth', () => {
    it('should return true for dates in same month', () => {
      const date1 = new Date(2024, 5, 15);
      const date2 = new Date(2024, 5, 20);
      expect(isSameMonth(date1, date2)).toBe(true);
    });

    it('should return false for dates in different months', () => {
      const date1 = new Date(2024, 5, 15);
      const date2 = new Date(2024, 4, 15);
      expect(isSameMonth(date1, date2)).toBe(false);
    });

    it('should return false for dates in different years', () => {
      const date1 = new Date(2024, 5, 15);
      const date2 = new Date(2023, 5, 15);
      expect(isSameMonth(date1, date2)).toBe(false);
    });
  });

  describe('getCurrentWeekDateRange', () => {
    it('should return correct week range for a Sunday', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 5, 9)); // June 9, 2024 (Sunday)

      const { startDate, endDate } = getCurrentWeekDateRange();

      expect(startDate.getDate()).toBe(9); // Same day (Sunday)
      expect(startDate.getHours()).toBe(0);
      expect(endDate.getDate()).toBe(15); // Following Saturday
      expect(endDate.getHours()).toBe(23);

      vi.useRealTimers();
    });

    it('should return correct week range for a Wednesday', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 5, 12)); // June 12, 2024 (Wednesday)

      const { startDate, endDate } = getCurrentWeekDateRange();

      expect(startDate.getDate()).toBe(9); // Previous Sunday
      expect(endDate.getDate()).toBe(15); // Following Saturday

      vi.useRealTimers();
    });

    it('should handle month boundaries correctly', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 6, 3)); // July 3, 2024 (Wednesday)

      const { startDate, endDate } = getCurrentWeekDateRange();

      expect(startDate.getMonth()).toBe(5); // June
      expect(startDate.getDate()).toBe(30); // June 30 (Sunday)
      expect(endDate.getMonth()).toBe(6); // July
      expect(endDate.getDate()).toBe(6); // July 6 (Saturday)

      vi.useRealTimers();
    });
  });
});

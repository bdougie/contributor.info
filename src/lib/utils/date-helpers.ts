/**
 * Date utility functions for monthly cycle calculations and contributor tracking
 */

import { MonthlyCycleState, CyclePhase } from '../contributors/types';

/**
 * Gets the current monthly cycle state
 */
export function getCurrentMonthlyCycleState(): MonthlyCycleState {
  const now = new Date();
  const dayOfMonth = now.getDate();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Calculate previous month
  const previousDate = new Date(currentYear, currentMonth - 1, 1);
  const previousMonth = previousDate.getMonth();
  const previousYear = previousDate.getFullYear();

  // Determine phase: 1st-7th = winner announcement, 8th+ = running leaderboard
  const phase = dayOfMonth <= 7 ? CyclePhase.WINNER_ANNOUNCEMENT : CyclePhase.RUNNING_LEADERBOARD;

  return {
    phase,
    currentMonth: {
      month: currentMonth,
      year: currentYear,
    },
    previousMonth: {
      month: previousMonth,
      year: previousYear,
    },
    dayOfMonth,
    isTransitioning: dayOfMonth <= 2, // First few days might have transition effects
  };
}

/**
 * Gets the start and end dates for a specific month
 */
export function getMonthDateRange(month: number, year: number): { startDate: Date; endDate: Date } {
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999); // Last day of month, end of day

  return { startDate, endDate };
}

/**
 * Gets the start and end dates for the current month
 */
export function getCurrentMonthDateRange(): { startDate: Date; endDate: Date } {
  const now = new Date();
  return getMonthDateRange(now.getMonth(), now.getFullYear());
}

/**
 * Gets the start and end dates for the previous month
 */
export function getPreviousMonthDateRange(): { startDate: Date; endDate: Date } {
  const now = new Date();
  const previousDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return getMonthDateRange(previousDate.getMonth(), previousDate.getFullYear());
}

/**
 * Checks if a date falls within a specific month and year
 */
export function isDateInMonth(date: Date, month: number, year: number): boolean {
  return date.getMonth() === month && date.getFullYear() === year;
}

/**
 * Checks if the current time is within the winner announcement phase (1st-7th of month)
 */
export function isWinnerAnnouncementPhase(): boolean {
  const now = new Date();
  const dayOfMonth = now.getDate();
  return dayOfMonth <= 7;
}

/**
 * Checks if the current time is within the running leaderboard phase (8th+ of month)
 */
export function isRunningLeaderboardPhase(): boolean {
  return !isWinnerAnnouncementPhase();
}

/**
 * Gets the number of days remaining in the current month
 */
export function getDaysRemainingInMonth(): number {
  const now = new Date();
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return lastDayOfMonth - now.getDate();
}

/**
 * Gets the number of days elapsed in the current month
 */
export function getDaysElapsedInMonth(): number {
  const now = new Date();
  return now.getDate();
}

/**
 * Formats a month and year for display
 */
export function formatMonth(month: number, year: number): string {
  const date = new Date(year, month, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Gets a human-readable phase description
 */
export function getPhaseDescription(phase: CyclePhase): string {
  switch (phase) {
    case CyclePhase.WINNER_ANNOUNCEMENT:
      return 'Winner Announcement Period';
    case CyclePhase.RUNNING_LEADERBOARD:
      return 'Active Competition Period';
    default:
      return 'Unknown Phase';
  }
}

/**
 * Calculates the time until the next phase transition
 */
export function getTimeUntilNextPhase(): { days: number; phase: CyclePhase } {
  const now = new Date();
  const dayOfMonth = now.getDate();

  if (dayOfMonth <= 7) {
    // Currently in winner announcement, next transition is to running leaderboard on 8th
    const nextPhaseDate = new Date(now.getFullYear(), now.getMonth(), 8);
    const timeDiff = nextPhaseDate.getTime() - now.getTime();
    const daysUntil = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

    return {
      days: daysUntil,
      phase: CyclePhase.RUNNING_LEADERBOARD,
    };
  } else {
    // Currently in running leaderboard, next transition is to winner announcement on 1st of next month
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const timeDiff = nextMonth.getTime() - now.getTime();
    const daysUntil = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

    return {
      days: daysUntil,
      phase: CyclePhase.WINNER_ANNOUNCEMENT,
    };
  }
}

/**
 * Checks if two dates are in the same month and year
 */
export function isSameMonth(date1: Date, date2: Date): boolean {
  return date1.getMonth() === date2.getMonth() && date1.getFullYear() === date2.getFullYear();
}

/**
 * Gets the first and last day of the current week
 */
export function getCurrentWeekDateRange(): { startDate: Date; endDate: Date } {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

  // Calculate start of week (Sunday)
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - day);
  startDate.setHours(0, 0, 0, 0);

  // Calculate end of week (Saturday)
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  endDate.setHours(23, 59, 59, 999);

  return { startDate, endDate };
}

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMonthlyContributorRankings } from '../use-monthly-contributor-rankings';

// Mock Supabase
const mockInvoke = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockGetSession = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
    },
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
    from: () => ({
      select: (...args: unknown[]) => mockSelect(...args),
    }),
  },
}));

describe('useMonthlyContributorRankings - Date Filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock returns
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ eq: mockEq, order: mockOrder });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue({ data: null, error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Winner Announcement Phase (Days 1-7)', () => {
    it('should request previous month data on January 3rd', async () => {
      // Mock current date to January 3rd, 2025 at 10:00 UTC
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-03T10:00:00Z'));

      mockInvoke.mockResolvedValue({
        data: {
          rankings: [
            {
              contributor_id: '1',
              username: 'test-user',
              pull_requests_count: 5,
              reviews_count: 3,
              comments_count: 2,
              weighted_score: 61,
              rank: 1,
            },
          ],
        },
        error: null,
      });

      renderHook(() => useMonthlyContributorRankings('owner', 'repo'));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalled();
      });

      // Should request December 2024 (previous month)
      const invokeCall = mockInvoke.mock.calls[0];
      expect(invokeCall[1].body.month).toBe(12); // December
      expect(invokeCall[1].body.year).toBe(2024);
    });

    it('should request previous month data on February 7th (last day of winner phase)', async () => {
      // Mock current date to February 7th, 2025 at 23:59 UTC
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-02-07T23:59:00Z'));

      mockInvoke.mockResolvedValue({
        data: {
          rankings: [],
        },
        error: null,
      });

      renderHook(() => useMonthlyContributorRankings('owner', 'repo'));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalled();
      });

      // Should request January 2025 (previous month)
      const invokeCall = mockInvoke.mock.calls[0];
      expect(invokeCall[1].body.month).toBe(1); // January
      expect(invokeCall[1].body.year).toBe(2025);
    });

    it('should request previous year when in January winner phase', async () => {
      // Mock current date to January 1st, 2025
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));

      mockInvoke.mockResolvedValue({
        data: {
          rankings: [],
        },
        error: null,
      });

      renderHook(() => useMonthlyContributorRankings('owner', 'repo'));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalled();
      });

      // Should request December 2024 (previous month of previous year)
      const invokeCall = mockInvoke.mock.calls[0];
      expect(invokeCall[1].body.month).toBe(12); // December
      expect(invokeCall[1].body.year).toBe(2024);
    });
  });

  describe('Running Leaderboard Phase (Days 8+)', () => {
    it('should request current month data on January 8th', async () => {
      // Mock current date to January 8th, 2025
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-08T00:00:00Z'));

      mockInvoke.mockResolvedValue({
        data: {
          rankings: [
            {
              contributor_id: '1',
              username: 'test-user',
              pull_requests_count: 2,
              reviews_count: 1,
              comments_count: 1,
              weighted_score: 24,
              rank: 1,
            },
          ],
        },
        error: null,
      });

      renderHook(() => useMonthlyContributorRankings('owner', 'repo'));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalled();
      });

      // Should request January 2025 (current month)
      const invokeCall = mockInvoke.mock.calls[0];
      expect(invokeCall[1].body.month).toBe(1); // January
      expect(invokeCall[1].body.year).toBe(2025);
    });

    it('should request current month data on December 31st', async () => {
      // Mock current date to December 31st, 2025
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-12-31T23:59:00Z'));

      mockInvoke.mockResolvedValue({
        data: {
          rankings: [],
        },
        error: null,
      });

      renderHook(() => useMonthlyContributorRankings('owner', 'repo'));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalled();
      });

      // Should request December 2025 (current month)
      const invokeCall = mockInvoke.mock.calls[0];
      expect(invokeCall[1].body.month).toBe(12); // December
      expect(invokeCall[1].body.year).toBe(2025);
    });

    it('should request current month data on February 15th', async () => {
      // Mock current date to February 15th, 2025
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-02-15T12:00:00Z'));

      mockInvoke.mockResolvedValue({
        data: {
          rankings: [],
        },
        error: null,
      });

      renderHook(() => useMonthlyContributorRankings('owner', 'repo'));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalled();
      });

      // Should request February 2025 (current month)
      const invokeCall = mockInvoke.mock.calls[0];
      expect(invokeCall[1].body.month).toBe(2); // February
      expect(invokeCall[1].body.year).toBe(2025);
    });
  });

  describe('Display Labels', () => {
    it('should set correct display month during winner phase', async () => {
      // Mock current date to March 5th, 2025
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-03-05T10:00:00Z'));

      mockInvoke.mockResolvedValue({
        data: {
          rankings: [
            {
              contributor_id: '1',
              username: 'test-user',
              pull_requests_count: 5,
              reviews_count: 3,
              comments_count: 2,
              weighted_score: 61,
              rank: 1,
            },
          ],
        },
        error: null,
      });

      const { result } = renderHook(() => useMonthlyContributorRankings('owner', 'repo'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should display February (previous month)
      expect(result.current.displayMonth).toBe('February');
      expect(result.current.displayYear).toBe(2025);
    });

    it('should set correct display month during leaderboard phase', async () => {
      // Mock current date to March 15th, 2025
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-03-15T10:00:00Z'));

      mockInvoke.mockResolvedValue({
        data: {
          rankings: [
            {
              contributor_id: '1',
              username: 'test-user',
              pull_requests_count: 3,
              reviews_count: 2,
              comments_count: 1,
              weighted_score: 37,
              rank: 1,
            },
          ],
        },
        error: null,
      });

      const { result } = renderHook(() => useMonthlyContributorRankings('owner', 'repo'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should display March (current month)
      expect(result.current.displayMonth).toBe('March');
      expect(result.current.displayYear).toBe(2025);
    });
  });

  describe('Edge Cases', () => {
    it('should handle leap year February correctly during winner phase', async () => {
      // Mock current date to March 3rd, 2024 (leap year)
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-03-03T10:00:00Z'));

      mockInvoke.mockResolvedValue({
        data: { rankings: [] },
        error: null,
      });

      renderHook(() => useMonthlyContributorRankings('owner', 'repo'));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalled();
      });

      // Should request February 2024 (previous month, leap year)
      const invokeCall = mockInvoke.mock.calls[0];
      expect(invokeCall[1].body.month).toBe(2); // February
      expect(invokeCall[1].body.year).toBe(2024);
    });

    it('should handle day 1 of month correctly (winner phase)', async () => {
      // Mock current date to April 1st, 2025
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-04-01T00:00:00Z'));

      mockInvoke.mockResolvedValue({
        data: { rankings: [] },
        error: null,
      });

      renderHook(() => useMonthlyContributorRankings('owner', 'repo'));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalled();
      });

      // Should request March 2025 (previous month)
      const invokeCall = mockInvoke.mock.calls[0];
      expect(invokeCall[1].body.month).toBe(3); // March
      expect(invokeCall[1].body.year).toBe(2025);
    });
  });
});

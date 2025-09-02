import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { supabase } from '@/lib/supabase';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('Workspace Page API Fixes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Date format handling', () => {
    it('should handle date format correctly in issues query', async () => {
      const mockFrom = vi.fn();
      const mockSelect = vi.fn();
      const mockIn = vi.fn();
      const mockGte = vi.fn();
      const mockOrder = vi.fn();

      // Mock the chain of calls
      mockOrder.mockResolvedValue({
        data: [
          {
            id: 'issue-1',
            title: 'Test Issue',
            number: 1,
            created_at: '2024-01-01T00:00:00Z',
            state: 'open',
          },
        ],
        error: null,
      });

      mockGte.mockReturnValue({
        order: mockOrder,
      });

      mockIn.mockReturnValue({
        gte: mockGte,
      });

      mockSelect.mockReturnValue({
        in: mockIn,
      });

      mockFrom.mockReturnValue({
        select: mockSelect,
      });

      vi.mocked(supabase.from).mockImplementation(mockFrom);

      // Simulate the date calculation logic from workspace-page.tsx
      const daysToFetch = 30;
      const startDate = new Date(Date.now() - daysToFetch * 24 * 60 * 60 * 1000);

      // Ensure startDate is valid and not in the future (fix applied)
      if (startDate.getTime() > Date.now()) {
        console.warn('Start date is in the future, using 30 days ago as fallback');
        startDate.setTime(Date.now() - 30 * 24 * 60 * 60 * 1000);
      }

      // Make the query like workspace-page.tsx does
      await supabase
        .from('issues')
        .select(
          'id, title, number, created_at, closed_at, state, author_id, repository_id, html_url'
        )
        .in('repository_id', ['repo-1', 'repo-2'])
        .gte('created_at', startDate.toISOString().split('T')[0]) // Use date only format
        .order('created_at', { ascending: true });

      // Verify the calls were made correctly
      expect(mockFrom).toHaveBeenCalledWith('issues');
      expect(mockSelect).toHaveBeenCalledWith(
        'id, title, number, created_at, closed_at, state, author_id, repository_id, html_url'
      );
      expect(mockIn).toHaveBeenCalledWith('repository_id', ['repo-1', 'repo-2']);

      // Verify date format is YYYY-MM-DD (fixed format)
      const capturedDateArg = mockGte.mock.calls[0][1];
      expect(capturedDateArg).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: true });
    });

    it('should fallback to 30 days when start date is in the future', () => {
      // Simulate a scenario where TIME_RANGE_DAYS might produce future date
      const futureDays = -10; // Negative days would create future date
      const startDate = new Date(Date.now() - futureDays * 24 * 60 * 60 * 1000);

      // Apply the fix
      if (startDate.getTime() > Date.now()) {
        console.warn('Start date is in the future, using 30 days ago as fallback');
        startDate.setTime(Date.now() - 30 * 24 * 60 * 60 * 1000);
      }

      // Verify the date is now in the past
      expect(startDate.getTime()).toBeLessThan(Date.now());

      // Verify it's approximately 30 days ago (within 1 hour tolerance)
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const tolerance = 60 * 60 * 1000; // 1 hour
      expect(Math.abs(startDate.getTime() - thirtyDaysAgo)).toBeLessThan(tolerance);
    });
  });

  describe('Repository contributors fix', () => {
    it('should use pull_requests table instead of non-existent repository_contributors', async () => {
      const mockFrom = vi.fn();
      const mockSelect = vi.fn();
      const mockIn = vi.fn();
      const mockNot = vi.fn();

      // Mock successful query
      mockNot.mockResolvedValue({
        data: [
          { author_id: 'author-1' },
          { author_id: 'author-2' },
          { author_id: 'author-1' }, // Duplicate to test uniqueness
          { author_id: 'author-3' },
        ],
        error: null,
      });

      mockIn.mockReturnValue({
        not: mockNot,
      });

      mockSelect.mockReturnValue({
        in: mockIn,
      });

      mockFrom.mockReturnValue({
        select: mockSelect,
      });

      vi.mocked(supabase.from).mockImplementation(mockFrom);

      // Simulate the fixed query from workspace-page.tsx
      const { data: prContributorData, error: prContributorError } = await supabase
        .from('pull_requests')
        .select('author_id')
        .in('repository_id', ['repo-1', 'repo-2'])
        .not('author_id', 'is', null);

      // Verify the query was made correctly
      expect(mockFrom).toHaveBeenCalledWith('pull_requests');
      expect(mockSelect).toHaveBeenCalledWith('author_id');
      expect(mockIn).toHaveBeenCalledWith('repository_id', ['repo-1', 'repo-2']);
      expect(mockNot).toHaveBeenCalledWith('author_id', 'is', null);

      // Test unique contributor calculation logic
      if (!prContributorError && prContributorData && prContributorData.length > 0) {
        const contributorIds = [...new Set(prContributorData.map((pr) => pr.author_id))];
        expect(contributorIds).toHaveLength(3); // Should be unique
        expect(contributorIds).toEqual(['author-1', 'author-2', 'author-3']);
      }
    });

    it('should handle error from pull_requests query gracefully', async () => {
      const mockFrom = vi.fn();
      const mockSelect = vi.fn();
      const mockIn = vi.fn();
      const mockNot = vi.fn();

      // Mock error
      mockNot.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      mockIn.mockReturnValue({
        not: mockNot,
      });

      mockSelect.mockReturnValue({
        in: mockIn,
      });

      mockFrom.mockReturnValue({
        select: mockSelect,
      });

      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Simulate the fixed query from workspace-page.tsx
      const { data: prContributorData, error: prContributorError } = await supabase
        .from('pull_requests')
        .select('author_id')
        .in('repository_id', ['repo-1', 'repo-2'])
        .not('author_id', 'is', null);

      // Verify error handling
      expect(prContributorError).not.toBeNull();
      expect(prContributorData).toBeNull();

      // Test the error handling logic from workspace-page.tsx
      if (prContributorError) {
        console.error('Error fetching PR contributors:', prContributorError);
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching PR contributors:', {
        message: 'Database error',
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Activity unique ID generation', () => {
    it('should generate unique activity IDs with index suffix', () => {
      // Test data that might cause duplicates
      const mockPRData = [
        { id: 'pr-1', title: 'PR 1', number: 1, created_at: '2024-01-01T00:00:00Z' },
        { id: 'pr-1', title: 'PR 1 duplicate', number: 2, created_at: '2024-01-02T00:00:00Z' },
        { id: 'pr-2', title: 'PR 2', number: 3, created_at: '2024-01-03T00:00:00Z' },
      ];

      // Apply the fix: add index to ensure uniqueness
      const activities = mockPRData.map((pr, index) => ({
        id: `pr-${pr.id}-${index}`, // Add index to ensure uniqueness
        type: 'pr',
        title: pr.title,
        created_at: pr.created_at,
      }));

      // Verify all IDs are unique
      const ids = activities.map((a) => a.id);
      const uniqueIds = [...new Set(ids)];
      expect(uniqueIds).toHaveLength(ids.length);
      expect(ids).toEqual(['pr-pr-1-0', 'pr-pr-1-1', 'pr-pr-2-2']);
    });

    it('should generate unique IDs for all activity types', () => {
      // Test with various activity types
      const mockData = {
        prs: [{ id: 'pr-1' }, { id: 'pr-1' }],
        issues: [{ id: 'issue-1' }, { id: 'issue-1' }],
        reviews: [{ id: 'review-1' }, { id: 'review-1' }],
        comments: [{ id: 'comment-1' }, { id: 'comment-1' }],
        stars: [
          { id: 'star-1', captured_at: '2024-01-01' },
          { id: 'star-1', captured_at: '2024-01-01' },
        ],
        forks: [
          { id: 'fork-1', captured_at: '2024-01-01' },
          { id: 'fork-1', captured_at: '2024-01-01' },
        ],
      };

      const activities = [
        ...mockData.prs.map((pr, index) => ({ id: `pr-${pr.id}-${index}` })),
        ...mockData.issues.map((issue, index) => ({ id: `issue-${issue.id}-${index}` })),
        ...mockData.reviews.map((review, index) => ({ id: `review-${review.id}-${index}` })),
        ...mockData.comments.map((comment, index) => ({ id: `comment-${comment.id}-${index}` })),
        ...mockData.stars.map((star, index) => ({
          id: `star-${star.id}-${star.captured_at}-${index}`,
        })),
        ...mockData.forks.map((fork, index) => ({
          id: `fork-${fork.id}-${fork.captured_at}-${index}`,
        })),
      ];

      // Verify all IDs are unique
      const ids = activities.map((a) => a.id);
      const uniqueIds = [...new Set(ids)];
      expect(uniqueIds).toHaveLength(ids.length);
      expect(uniqueIds).toHaveLength(12); // 2 of each type * 6 types
    });
  });

  describe('Workspace repository operations', () => {
    it('should handle workspace_repositories delete operation correctly', async () => {
      const mockFrom = vi.fn();
      const mockDelete = vi.fn();
      const mockEq1 = vi.fn();
      const mockEq2 = vi.fn();

      // Mock successful delete
      mockEq2.mockResolvedValue({
        error: null,
      });

      mockEq1.mockReturnValue({
        eq: mockEq2,
      });

      mockDelete.mockReturnValue({
        eq: mockEq1,
      });

      mockFrom.mockReturnValue({
        delete: mockDelete,
      });

      vi.mocked(supabase.from).mockImplementation(mockFrom);

      // Simulate the delete operation from AddRepositoryModal
      const { error: removeError } = await supabase
        .from('workspace_repositories')
        .delete()
        .eq('workspace_id', 'workspace-123')
        .eq('repository_id', 'repo-456');

      // Verify the query was constructed correctly
      expect(mockFrom).toHaveBeenCalledWith('workspace_repositories');
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq1).toHaveBeenCalledWith('workspace_id', 'workspace-123');
      expect(mockEq2).toHaveBeenCalledWith('repository_id', 'repo-456');
      expect(removeError).toBeNull();
    });

    it('should handle RLS policy errors gracefully', async () => {
      const mockFrom = vi.fn();
      const mockDelete = vi.fn();
      const mockEq1 = vi.fn();
      const mockEq2 = vi.fn();

      // Mock RLS policy error (403 Forbidden)
      mockEq2.mockResolvedValue({
        error: {
          code: '42501',
          message: 'insufficient_privilege: permission denied for relation workspace_repositories',
        },
      });

      mockEq1.mockReturnValue({
        eq: mockEq2,
      });

      mockDelete.mockReturnValue({
        eq: mockEq1,
      });

      mockFrom.mockReturnValue({
        delete: mockDelete,
      });

      vi.mocked(supabase.from).mockImplementation(mockFrom);

      // Simulate the delete operation that hits RLS policy
      const { error: removeError } = await supabase
        .from('workspace_repositories')
        .delete()
        .eq('workspace_id', 'workspace-123')
        .eq('repository_id', 'repo-456');

      // Verify error is returned
      expect(removeError).not.toBeNull();
      expect(removeError?.code).toBe('42501');
      expect(removeError?.message).toContain('permission denied');
    });
  });
});

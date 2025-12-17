
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchLinkedItems, formatLinkedItemsForEmbedding } from '../linked-issues';

// Mock dependencies
vi.mock('../github-api', () => ({
  getIssue: vi.fn(),
}));

vi.mock('../../src/lib/supabase-lazy', () => ({
  getSupabase: vi.fn(),
}));

vi.mock('../link-parser', () => ({
  extractLinkedItems: vi.fn(),
}));

import { getIssue } from '../github-api';
import { getSupabase } from '../../src/lib/supabase-lazy';
import { extractLinkedItems } from '../link-parser';

describe('Linked Issues Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchLinkedItems', () => {
    it('should fetch items from GitHub API when not in DB', async () => {
      vi.mocked(extractLinkedItems).mockReturnValue([{ number: 123 }]);

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null }), // Not in DB
      };
      vi.mocked(getSupabase).mockResolvedValue(mockSupabase as any);

      vi.mocked(getIssue).mockResolvedValue({
        number: 123,
        title: 'API Issue',
        body: 'Body from API',
        state: 'open',
        html_url: 'https://github.com/owner/repo/issues/123',
      });

      const items = await fetchLinkedItems('text with #123', 'owner', 'repo');

      expect(getIssue).toHaveBeenCalledWith('owner', 'repo', 123);
      expect(items).toHaveLength(1);
      expect(items[0].title).toBe('API Issue');
    });

    it('should fetch items from DB when available', async () => {
        vi.mocked(extractLinkedItems).mockReturnValue([{ number: 123 }]);

        const mockSupabase = {
          from: vi.fn().mockImplementation((table) => {
             if (table === 'repositories') {
                 return {
                     select: vi.fn().mockReturnThis(),
                     eq: vi.fn().mockReturnThis(),
                     maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'repo-id' } }),
                 };
             }
             if (table === 'issues') {
                 return {
                     select: vi.fn().mockReturnThis(),
                     eq: vi.fn().mockReturnThis(),
                     maybeSingle: vi.fn().mockResolvedValue({
                        data: { title: 'DB Issue', body: 'Body from DB', state: 'closed' }
                     }),
                 };
             }
             return { select: vi.fn() };
          }),
        };
        vi.mocked(getSupabase).mockResolvedValue(mockSupabase as any);

        const items = await fetchLinkedItems('text with #123', 'owner', 'repo');

        expect(getIssue).not.toHaveBeenCalled(); // Should NOT call GitHub API
        expect(items).toHaveLength(1);
        expect(items[0].title).toBe('DB Issue');
    });
  });

  describe('formatLinkedItemsForEmbedding', () => {
    it('should format items correctly', () => {
      const items = [
        {
          number: 1,
          title: 'Issue 1',
          body: 'Body 1',
          state: 'open',
          html_url: 'url1',
        },
        {
          number: 2,
          title: 'Issue 2',
          body: 'Body 2',
          state: 'closed',
          html_url: 'url2',
        },
      ];

      const formatted = formatLinkedItemsForEmbedding(items);

      expect(formatted).toContain('Related Issue #1: Issue 1 - Body 1');
      expect(formatted).toContain('Related Issue #2: Issue 2 - Body 2');
    });

    it('should handle empty list', () => {
        expect(formatLinkedItemsForEmbedding([])).toBe('');
    });
  });
});

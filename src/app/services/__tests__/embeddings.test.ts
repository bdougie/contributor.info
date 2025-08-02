import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  generateEmbedding,
  createContentHash,
  prepareTextForEmbedding,
  generateAndStoreEmbeddings,
  needsEmbedding,
  getItemsNeedingEmbeddings
} from '../../../../app/services/embeddings';
import { supabase } from '../../../lib/supabase';

// Mock dependencies
vi.mock('../../../lib/supabase');
vi.mock('@xenova/transformers', () => ({
  pipeline: vi.fn(() => Promise.resolve((text: string, options: any) => ({
    data: new Float32Array(384).fill(0.1),
    tolist: () => [[...new Float32Array(384).fill(0.1)]]
  }))),
  env: {
    allowLocalModels: false,
    useBrowserCache: false
  }
}));

describe('Embeddings Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('generateEmbedding', () => {
    it('should generate 384-dimensional embeddings for text', async () => {
      const text = 'This is a test issue about implementing a new feature';
      const embedding = await generateEmbedding(text);
      
      expect(embedding).toHaveLength(384);
      expect(embedding.every(val => typeof val === 'number')).toBe(true);
    });

    it('should handle long text inputs', async () => {
      const longText = 'Lorem ipsum '.repeat(1000);
      const embedding = await generateEmbedding(longText);
      
      expect(embedding).toHaveLength(384);
    });

    it('should handle special characters and emojis', async () => {
      const text = 'Bug 🐛: Application crashes when using special chars: @#$%^&*()';
      const embedding = await generateEmbedding(text);
      
      expect(embedding).toHaveLength(384);
    });
  });

  describe('createContentHash', () => {
    it('should create consistent hashes', () => {
      const hash1 = createContentHash('Title', 'Body content');
      const hash2 = createContentHash('Title', 'Body content');
      
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex format
    });

    it('should handle undefined and null body', () => {
      const hash1 = createContentHash('Title', undefined);
      const hash2 = createContentHash('Title', null);
      
      expect(hash1).toBe(hash2);
    });

    it('should be sensitive to content changes', () => {
      const hash1 = createContentHash('Title', 'Body 1');
      const hash2 = createContentHash('Title', 'Body 2');
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('prepareTextForEmbedding', () => {
    it('should format issue text correctly', () => {
      const item = {
        id: '1',
        type: 'issue' as const,
        title: 'Test Issue',
        body: 'This is a long body that goes on and on...'.repeat(20)
      };

      const text = prepareTextForEmbedding(item);
      
      expect(text).toContain('Issue: Test Issue');
      expect(text.length).toBeLessThanOrEqual(550); // Title + 500 char preview
    });

    it('should format pull request text correctly', () => {
      const item = {
        id: '1',
        type: 'pull_request' as const,
        title: 'feat: Add new feature',
        body: null
      };

      const text = prepareTextForEmbedding(item);
      
      expect(text).toContain('Pull Request: feat: Add new feature');
      expect(text).not.toContain('null');
    });

    it('should truncate long bodies to 500 characters', () => {
      const longBody = 'A'.repeat(1000);
      const item = {
        id: '1',
        type: 'issue' as const,
        title: 'Title',
        body: longBody
      };

      const text = prepareTextForEmbedding(item);
      const bodyPart = text.split('\n\n')[1];
      
      expect(bodyPart.length).toBe(500);
    });
  });

  describe('generateAndStoreEmbeddings', () => {
    it('should process items in batches', async () => {
      vi.useRealTimers(); // Use real timers for this test
      const items = Array.from({ length: 25 }, (_, i) => ({
        id: `item-${i}`,
        type: 'issue' as const,
        title: `Issue ${i}`,
        body: `Body ${i}`
      }));

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null })
      });
      
      vi.mocked(supabase).from = vi.fn().mockReturnValue({
        update: mockUpdate
      } as any);

      await generateAndStoreEmbeddings(items);

      // Should process in batches of 10
      expect(mockUpdate).toHaveBeenCalledTimes(25);
    });

    it('should handle individual item failures gracefully', async () => {
      const items = [
        { id: '1', type: 'issue' as const, title: 'Issue 1', body: 'Body 1' },
        { id: '2', type: 'issue' as const, title: 'Issue 2', body: 'Body 2' }
      ];

      const mockUpdate = vi.fn()
        .mockReturnValueOnce({
          eq: vi.fn().mockResolvedValue({ 
            error: new Error('Database error') 
          })
        })
        .mockReturnValueOnce({
          eq: vi.fn().mockResolvedValue({ error: null })
        });
      
      vi.mocked(supabase).from = vi.fn().mockReturnValue({
        update: mockUpdate
      } as any);

      // Should not throw, but continue processing
      await generateAndStoreEmbeddings(items);

      expect(mockUpdate).toHaveBeenCalledTimes(2);
    });

    it('should store embeddings for both issues and PRs', async () => {
      const items = [
        { id: '1', type: 'issue' as const, title: 'Issue', body: 'Body' },
        { id: '2', type: 'pull_request' as const, title: 'PR', body: 'Body' }
      ];

      const fromCalls: string[] = [];
      vi.mocked(supabase).from = vi.fn((table) => {
        fromCalls.push(table);
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null })
          })
        } as any;
      });

      await generateAndStoreEmbeddings(items);

      expect(fromCalls).toEqual(['issues', 'pull_requests']);
    });
  });

  describe('needsEmbedding', () => {
    it('should return true for missing embeddings', () => {
      expect(needsEmbedding('hash1', null, null)).toBe(true);
      expect(needsEmbedding('hash1', 'hash2', null)).toBe(true);
    });

    it('should return true for changed content', () => {
      const result = needsEmbedding(
        'new-hash',
        'old-hash',
        new Date().toISOString()
      );
      
      expect(result).toBe(true);
    });

    it('should return true for old embeddings', () => {
      const oldDate = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
      const result = needsEmbedding(
        'same-hash',
        'same-hash',
        oldDate.toISOString()
      );
      
      expect(result).toBe(true);
    });

    it('should return false for recent unchanged embeddings', () => {
      const recentDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      const result = needsEmbedding(
        'same-hash',
        'same-hash',
        recentDate.toISOString()
      );
      
      expect(result).toBe(false);
    });
  });

  describe('getItemsNeedingEmbeddings', () => {
    it('should fetch and filter items needing embeddings', async () => {
      const mockIssues = [
        {
          id: '1',
          title: 'Issue 1',
          body: 'Body 1',
          content_hash: 'old-hash',
          embedding_generated_at: null
        },
        {
          id: '2',
          title: 'Issue 2',
          body: 'Body 2',
          content_hash: createContentHash('Issue 2', 'Body 2'), // Use actual hash
          embedding_generated_at: new Date().toISOString()
        }
      ];

      const mockPRs = [
        {
          id: '3',
          title: 'PR 1',
          body: 'PR Body',
          content_hash: null,
          embedding_generated_at: null
        }
      ];

      vi.mocked(supabase).from = vi.fn()
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: mockIssues })
              })
            })
          })
        } as any)
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: mockPRs })
              })
            })
          })
        } as any);

      const items = await getItemsNeedingEmbeddings('repo-id', 10);

      // Should include issue 1 (no embedding) and PR 1 (no embedding)
      // Should exclude issue 2 (recent embedding with matching hash)
      expect(items).toHaveLength(2);
      expect(items[0]).toMatchObject({
        id: '1',
        type: 'issue',
        title: 'Issue 1'
      });
      expect(items[1]).toMatchObject({
        id: '3',
        type: 'pull_request',
        title: 'PR 1'
      });
    });
  });
});
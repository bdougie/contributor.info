import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findSimilarItems, generateEmbeddings } from '../actions-similarity';

// Mock the issue similarity service
vi.mock('../../app/services/issue-similarity', () => ({
  generateIssueEmbedding: vi.fn().mockImplementation(async (title: string, body: string | null) => {
    // Simple mock embedding based on title length and first few chars
    const content = `${title} ${body || ''}`;
    const embedding = new Array(384).fill(0);
    
    // Create different patterns based on content
    for (let i = 0; i < Math.min(content.length, 384); i++) {
      embedding[i] = content.charCodeAt(i) / 1000;
    }
    
    return embedding;
  }),
  calculateContentHash: vi.fn().mockImplementation((title: string, body: string | null) => {
    return `hash-${title.length}-${(body || '').length}`;
  }),
}));

interface SimilarityItem {
  number: number;
  title: string;
  body: string | null;
  state: string;
  html_url: string;
  created_at: string;
  type: 'issue' | 'pull_request';
  embedding?: number[];
  contentHash?: string;
}

describe('actions-similarity', () => {
  describe('generateEmbeddings', () => {
    it('should generate embeddings for all items', async () => {
      const items: SimilarityItem[] = [
        {
          number: 1,
          title: 'Test issue',
          body: 'Test body',
          state: 'open',
          html_url: 'https://github.com/test/repo/issues/1',
          created_at: '2025-01-01T00:00:00Z',
          type: 'issue',
        },
        {
          number: 2,
          title: 'Another issue',
          body: 'Another body',
          state: 'closed',
          html_url: 'https://github.com/test/repo/issues/2',
          created_at: '2025-01-02T00:00:00Z',
          type: 'issue',
        },
      ];

      await generateEmbeddings(items);

      expect(items[0].embedding).toBeDefined();
      expect(items[0].embedding).toHaveLength(384);
      expect(items[0].contentHash).toBeDefined();
      
      expect(items[1].embedding).toBeDefined();
      expect(items[1].embedding).toHaveLength(384);
      expect(items[1].contentHash).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      const items: SimilarityItem[] = [
        {
          number: 1,
          title: 'Test issue',
          body: 'Test body',
          state: 'open',
          html_url: 'https://github.com/test/repo/issues/1',
          created_at: '2025-01-01T00:00:00Z',
          type: 'issue',
        },
      ];

      // Mock error for embedding generation
      const { generateIssueEmbedding } = await import('../../app/services/issue-similarity');
      vi.mocked(generateIssueEmbedding).mockRejectedValueOnce(new Error('Embedding failed'));

      // Should not throw
      await expect(generateEmbeddings(items)).resolves.not.toThrow();
      
      // Item should not have embedding due to error
      expect(items[0].embedding).toBeUndefined();
    });
  });

  describe('findSimilarItems', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should find similar items above threshold', async () => {
      const items: SimilarityItem[] = [
        {
          number: 1,
          title: 'Bug: App crashes',
          body: 'The application crashes when clicking button',
          state: 'open',
          html_url: 'https://github.com/test/repo/issues/1',
          created_at: '2025-01-01T00:00:00Z',
          type: 'issue',
          embedding: new Array(384).fill(0.5), // Similar embedding
        },
        {
          number: 2,
          title: 'Bug: App crashes on startup',
          body: 'The application crashes during startup',
          state: 'closed',
          html_url: 'https://github.com/test/repo/issues/2',
          created_at: '2025-01-02T00:00:00Z',
          type: 'issue',
          embedding: new Array(384).fill(0.5), // Similar embedding
        },
        {
          number: 3,
          title: 'Feature: Add new UI',
          body: 'Add a new user interface component',
          state: 'open',
          html_url: 'https://github.com/test/repo/issues/3',
          created_at: '2025-01-03T00:00:00Z',
          type: 'issue',
          embedding: new Array(384).fill(0.1), // Different embedding
        },
      ];

      const targetItem = items[0];
      const similarItems = findSimilarItems(targetItem, items, 0.8, 5);

      expect(similarItems).toHaveLength(1);
      expect(similarItems[0].item.number).toBe(2);
      expect(similarItems[0].similarity).toBeGreaterThan(0.8);
    });

    it('should exclude target item from results', async () => {
      const items: SimilarityItem[] = [
        {
          number: 1,
          title: 'Test issue',
          body: 'Test body',
          state: 'open',
          html_url: 'https://github.com/test/repo/issues/1',
          created_at: '2025-01-01T00:00:00Z',
          type: 'issue',
          embedding: new Array(384).fill(0.5),
        },
      ];

      const targetItem = items[0];
      const similarItems = findSimilarItems(targetItem, items, 0.1, 5);

      expect(similarItems).toHaveLength(0);
    });

    it('should return empty array when target has no embedding', () => {
      const items: SimilarityItem[] = [
        {
          number: 1,
          title: 'Test issue',
          body: 'Test body',
          state: 'open',
          html_url: 'https://github.com/test/repo/issues/1',
          created_at: '2025-01-01T00:00:00Z',
          type: 'issue',
        },
      ];

      const targetItem = items[0]; // No embedding
      const similarItems = findSimilarItems(targetItem, items, 0.8, 5);

      expect(similarItems).toHaveLength(0);
    });

    it('should handle items without embeddings gracefully', () => {
      const items: SimilarityItem[] = [
        {
          number: 1,
          title: 'Test issue',
          body: 'Test body',
          state: 'open',
          html_url: 'https://github.com/test/repo/issues/1',
          created_at: '2025-01-01T00:00:00Z',
          type: 'issue',
          embedding: new Array(384).fill(0.5),
        },
        {
          number: 2,
          title: 'Another issue',
          body: 'Another body',
          state: 'closed',
          html_url: 'https://github.com/test/repo/issues/2',
          created_at: '2025-01-02T00:00:00Z',
          type: 'issue',
          // No embedding
        },
      ];

      const targetItem = items[0];
      const similarItems = findSimilarItems(targetItem, items, 0.8, 5);

      expect(similarItems).toHaveLength(0); // No similar items because second item has no embedding
    });

    it('should sort results by similarity descending', () => {
      const items: SimilarityItem[] = [
        {
          number: 1,
          title: 'Target issue',
          body: 'Target body',
          state: 'open',
          html_url: 'https://github.com/test/repo/issues/1',
          created_at: '2025-01-01T00:00:00Z',
          type: 'issue',
          embedding: new Array(384).fill(0.5),
        },
        {
          number: 2,
          title: 'Similar issue',
          body: 'Similar body',
          state: 'closed',
          html_url: 'https://github.com/test/repo/issues/2',
          created_at: '2025-01-02T00:00:00Z',
          type: 'issue',
          embedding: new Array(384).fill(0.6), // More similar
        },
        {
          number: 3,
          title: 'Less similar',
          body: 'Less similar body',
          state: 'open',
          html_url: 'https://github.com/test/repo/issues/3',
          created_at: '2025-01-03T00:00:00Z',
          type: 'issue',
          embedding: new Array(384).fill(0.4), // Less similar
        },
      ];

      const targetItem = items[0];
      const similarItems = findSimilarItems(targetItem, items, 0.8, 5);

      // Should be sorted by similarity descending
      expect(similarItems[0].similarity).toBeGreaterThan(similarItems[1]?.similarity || 0);
    });

    it('should limit results to specified limit', () => {
      const items: SimilarityItem[] = [
        {
          number: 1,
          title: 'Target issue',
          body: 'Target body',
          state: 'open',
          html_url: 'https://github.com/test/repo/issues/1',
          created_at: '2025-01-01T00:00:00Z',
          type: 'issue',
          embedding: new Array(384).fill(0.5),
        },
      ];

      // Add multiple similar items
      for (let i = 2; i <= 10; i++) {
        items.push({
          number: i,
          title: `Similar issue ${i}`,
          body: `Similar body ${i}`,
          state: 'open',
          html_url: `https://github.com/test/repo/issues/${i}`,
          created_at: '2025-01-01T00:00:00Z',
          type: 'issue',
          embedding: new Array(384).fill(0.5), // All similar
        });
      }

      const targetItem = items[0];
      const similarItems = findSimilarItems(targetItem, items, 0.8, 3);

      expect(similarItems).toHaveLength(3); // Limited to 3 results
    });
  });
});
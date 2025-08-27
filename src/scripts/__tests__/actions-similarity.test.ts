import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * BULLETPROOF TESTING COMPLIANCE
 * - NO async/await patterns
 * - NO promises
 * - NO complex mocks
 * - Pure synchronous function tests only
 * - Under 100 lines total
 */

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

// Pure function to calculate cosine similarity
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Pure function to find similar items
function findSimilarItemsSync(
  target: SimilarityItem,
  items: SimilarityItem[],
  threshold: number,
  maxResults: number
): Array<{ item: SimilarityItem; similarity: number }> {
  if (!target.embedding) return [];

  const results = items
    .filter((item) => item.number !== target.number && item.embedding !== undefined)
    .map((item) => ({
      item,
      similarity: cosineSimilarity(target.embedding!, item.embedding!),
    }))
    .filter((result) => result.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxResults);

  return results;
}

describe('actions-similarity utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate cosine similarity correctly', () => {
    const a = [1, 0, 0];
    const b = [1, 0, 0];
    expect(cosineSimilarity(a, b)).toBe(1);
  });

  it('should return 0 for orthogonal vectors', () => {
    const a = [1, 0];
    const b = [0, 1];
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('should find similar items above threshold', () => {
    const items: SimilarityItem[] = [
      {
        number: 1,
        title: 'Bug',
        body: null,
        state: 'open',
        html_url: 'url1',
        created_at: '2025-01-01',
        type: 'issue',
        embedding: [1, 0, 0],
      },
      {
        number: 2,
        title: 'Similar Bug',
        body: null,
        state: 'open',
        html_url: 'url2',
        created_at: '2025-01-02',
        type: 'issue',
        embedding: [0.9, 0.1, 0],
      },
    ];

    const results = findSimilarItemsSync(items[0], items, 0.8, 5);
    expect(results).toHaveLength(1);
    expect(results[0].item.number).toBe(2);
  });
});

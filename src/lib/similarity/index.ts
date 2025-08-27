/**
 * Shared similarity utilities for issues and pull requests
 * Used by both the main app and GitHub Actions scripts
 */

import crypto from 'crypto';

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimension');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * Calculate Jaccard similarity between two text strings
 * Returns a value between 0 and 1 indicating similarity
 */
export function jaccardSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;

  const words1 = text1
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  const words2 = text2
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const set1 = new Set(words1);
  const set2 = new Set(words2);

  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * Calculate content hash for change detection
 * Consistent hashing across all similarity services
 */
export function calculateContentHash(title: string, body: string | null): string {
  const content = JSON.stringify({ title, body: body || '' });
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Extract issue/PR numbers mentioned in text
 * Handles formats: #123, GH-123, fixes #123, closes #123
 */
export function extractMentionedIssues(text: string): number[] {
  const patterns = [/#(\d+)/g, /GH-(\d+)/gi, /(?:fixes|closes|resolves|ref|references)\s+#(\d+)/gi];

  const issues = new Set<number>();

  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const num = parseInt(match[1]);
      if (!isNaN(num)) {
        issues.add(num);
      }
    }
  }

  return Array.from(issues);
}

/**
 * Determine relationship type between a PR and an issue
 */
export type RelationshipType = 'fixes' | 'implements' | 'relates_to' | 'similar';

export function determineRelationship(prText: string, issueNumber: number): RelationshipType {
  const text = prText.toLowerCase();
  const num = issueNumber.toString();

  // Check for fix keywords
  if (
    text.includes(`fixes #${num}`) ||
    text.includes(`closes #${num}`) ||
    text.includes(`resolves #${num}`)
  ) {
    return 'fixes';
  }

  // Check for implementation keywords
  if (text.includes(`implements #${num}`) || text.includes(`addresses #${num}`)) {
    return 'implements';
  }

  // Check if mentioned at all
  if (text.includes(`#${num}`)) {
    return 'relates_to';
  }

  return 'similar';
}

/**
 * Common interface for similarity results
 */
export interface SimilarityResult<T> {
  item: T;
  similarity: number;
  relationship?: RelationshipType;
  reasons?: string[];
}

/**
 * Find similar items using embeddings
 * Generic function that works with any items that have embeddings
 */
export function findSimilarItemsByEmbedding<T extends { embedding?: number[] }>(
  targetEmbedding: number[],
  items: T[],
  options: {
    threshold?: number;
    limit?: number;
    excludeItem?: (item: T) => boolean;
  } = {}
): SimilarityResult<T>[] {
  const { threshold = 0.8, limit = 5, excludeItem } = options;

  const similarities: SimilarityResult<T>[] = [];

  for (const item of items) {
    // Skip if should be excluded
    if (excludeItem && excludeItem(item)) {
      continue;
    }

    // Skip if no embedding
    if (!item.embedding) {
      continue;
    }

    try {
      const similarity = cosineSimilarity(targetEmbedding, item.embedding);

      if (similarity >= threshold) {
        similarities.push({
          item,
          similarity,
        });
      }
    } catch (error) {
      console.error('Error calculating similarity:', error);
    }
  }

  // Sort by similarity descending and return top matches
  return similarities.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
}

/**
 * Find all similar pairs in a collection
 * Optimized O(n²) algorithm that checks each pair only once
 */
export function findAllSimilarPairs<T extends { embedding?: number[] }>(
  items: T[],
  options: {
    threshold?: number;
    maxPairs?: number;
  } = {}
): Array<{ item1: T; item2: T; similarity: number }> {
  const { threshold = 0.85, maxPairs = 100 } = options;
  const pairs: Array<{ item1: T; item2: T; similarity: number }> = [];

  // Iterate through each unique pair only once
  for (let i = 0; i < items.length - 1; i++) {
    const item1 = items[i];

    if (!item1.embedding) continue;

    for (let j = i + 1; j < items.length; j++) {
      const item2 = items[j];

      if (!item2.embedding) continue;

      try {
        const similarity = cosineSimilarity(item1.embedding, item2.embedding);

        if (similarity >= threshold) {
          // Use min-heap approach for efficiency
          if (pairs.length < maxPairs) {
            pairs.push({ item1, item2, similarity });
          } else if (similarity > pairs[pairs.length - 1].similarity) {
            pairs[pairs.length - 1] = { item1, item2, similarity };
          }

          // Keep sorted if at capacity
          if (pairs.length === maxPairs) {
            pairs.sort((a, b) => b.similarity - a.similarity);
          }
        }
      } catch (error) {
        console.error('Error calculating similarity:', error);
      }
    }
  }

  return pairs.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Sleep utility for rate limit handling
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute API call with exponential backoff for rate limits
 */
export async function withRateLimitHandling<T>(
  apiCall: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialBackoff?: number;
    maxBackoff?: number;
  } = {}
): Promise<T> {
  const { maxAttempts = 5, initialBackoff = 1000, maxBackoff = 30000 } = options;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      // Check if it's a rate limit error
      const errorWithStatus = error as {
        status?: number;
        response?: {
          headers?: {
            [key: string]: string;
          };
        };
      };
      if (errorWithStatus.status === 403 || errorWithStatus.status === 429) {
        if (attempt >= maxAttempts) {
          throw new Error(`Rate limit exceeded after ${maxAttempts} attempts`);
        }

        // Calculate backoff time
        const backoffMs = Math.min(initialBackoff * Math.pow(2, attempt - 1), maxBackoff);

        // Check for rate limit reset time
        const resetTime = errorWithStatus.response?.headers?.['x-ratelimit-reset'];
        if (resetTime) {
          const waitTime = Math.max(0, parseInt(resetTime) * 1000 - Date.now());
          console.log(
            'Rate limit hit. Waiting %s seconds until reset...',
            Math.ceil(waitTime / 1000)
          );
          await sleep(waitTime + 1000); // Add 1 second buffer
        } else {
          console.log(
            'Rate limit hit. Waiting %s seconds (attempt %s/%s)...',
            backoffMs / 1000,
            attempt,
            maxAttempts
          );
          await sleep(backoffMs);
        }
      } else {
        // Re-throw non-rate-limit errors
        throw error;
      }
    }
  }

  throw new Error('Failed to complete API call');
}

/**
 * Process items in batches with concurrency control
 */
export async function processBatch<T>(
  items: T[],
  processor: (item: T) => Promise<void>,
  options: {
    batchSize?: number;
    onProgress?: (processed: number, total: number) => void;
  } = {}
): Promise<void> {
  const { batchSize = 5, onProgress } = options;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map(processor));

    const processed = Math.min(i + batchSize, items.length);
    if (onProgress) {
      onProgress(processed, items.length);
    }
  }
}

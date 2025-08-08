/**
 * Standalone similarity utilities for GitHub Actions
 * No external dependencies except Node built-ins
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
 * Calculate Jaccard similarity between two sets of words
 */
export function jaccardSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * Calculate a hash for content to detect exact duplicates
 */
export function calculateContentHash(title: string, body: string | null): string {
  const content = `${title}\n${body || ''}`.trim();
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Find similar items based on embeddings
 */
export function findSimilarItemsByEmbedding<T extends { embedding?: number[] }>(
  targetEmbedding: number[],
  items: T[],
  threshold: number = 0.85
): Array<{ item: T; similarity: number }> {
  const similarities: Array<{ item: T; similarity: number }> = [];
  
  for (const item of items) {
    if (!item.embedding || item.embedding.length === 0) continue;
    
    const similarity = cosineSimilarity(targetEmbedding, item.embedding);
    if (similarity >= threshold) {
      similarities.push({ item, similarity });
    }
  }
  
  return similarities.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Find all similar pairs in a collection (optimized O(n²) algorithm)
 */
export function findAllSimilarPairs<T extends { 
  number: number;
  title: string;
  embedding?: number[];
}>(
  items: T[],
  threshold: number = 0.85
): Array<{
  item1: T;
  item2: T;
  similarity: number;
}> {
  const pairs: Array<{
    item1: T;
    item2: T;
    similarity: number;
  }> = [];
  
  // Use a Set to track unique pairs (using sorted numbers as key)
  const processedPairs = new Set<string>();
  
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const item1 = items[i];
      const item2 = items[j];
      
      // Skip if either item lacks embeddings
      if (!item1.embedding || !item2.embedding) continue;
      
      // Create a unique key for this pair
      const pairKey = [item1.number, item2.number].sort().join('-');
      
      // Skip if we've already processed this pair
      if (processedPairs.has(pairKey)) continue;
      
      const similarity = cosineSimilarity(item1.embedding, item2.embedding);
      
      if (similarity >= threshold) {
        pairs.push({ item1, item2, similarity });
        processedPairs.add(pairKey);
      }
    }
  }
  
  return pairs.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Process items in batches for better memory management
 */
export async function processBatch<T, R>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<R[]>
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await processor(batch);
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * Simple rate limit handler with exponential backoff
 */
export async function withRateLimitHandling<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a rate limit error
      if (error.status === 403 || error.status === 429) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.log(`Rate limited. Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error; // Re-throw non-rate-limit errors
      }
    }
  }
  
  throw lastError;
}
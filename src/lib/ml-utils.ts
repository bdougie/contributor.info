/**
 * Standalone ML utilities for embedding generation
 * No database dependencies - safe for GitHub Actions
 */

import { pipeline, env } from '@xenova/transformers';
import crypto from 'crypto';

// Configure Transformers.js to use local models
env.allowLocalModels = true;
env.useBrowserCache = false;

// Initialize the embedding pipeline (will be loaded on first use)
let embeddingPipeline: Awaited<ReturnType<typeof pipeline>> | null = null;

/**
 * Get or initialize the embedding pipeline
 */
async function getEmbeddingPipeline() {
  if (!embeddingPipeline) {
    console.log('Loading MiniLM embedding model...');
    // Using all-MiniLM-L6-v2 which produces 384-dimensional embeddings
    embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    console.log('MiniLM model loaded successfully');
  }
  return embeddingPipeline;
}

/**
 * Generate embedding for issue content using MiniLM
 */
export async function generateIssueEmbedding(
  title: string,
  body: string | null,
): Promise<number[]> {
  const content = `${title}\n\n${body || ''}`.trim();

  try {
    const embedder = await getEmbeddingPipeline();

    // Generate embeddings - the output is a Tensor
    const output = await embedder(content, {
      pooling: 'mean',
      // @ts-ignore - Transformers.js types are not fully accurate
      normalize: true,
    });

    // Extract data from the tensor
    // @ts-expect-error - Transformers.js types are not fully accurate
    const embeddings = output.data || output.tolist?.()?.[0] || [];

    // Convert to array and return
    return Array.from(embeddings);
  } catch (error) {
    console.error(, error);
    throw error;
  }
}

/**
 * Calculate content hash for change detection
 */
export function calculateContentHash(title: string, body: string | null): string {
  // Use JSON.stringify to safely handle any special characters
  const content = JSON.stringify({ title, body: body || '' });
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

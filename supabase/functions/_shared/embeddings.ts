/**
 * MiniLM Embeddings Utilities for Supabase Edge Functions
 * Uses Xenova/all-MiniLM-L6-v2 for zero-cost, 384-dimensional embeddings
 */

import { pipeline, env } from 'npm:@xenova/transformers@2.17.2';

// Configure Transformers.js for edge runtime
env.allowLocalModels = false;
env.useBrowserCache = false;
env.allowRemoteModels = true;

// Shared embedding pipeline instance (cached across function calls)
let embeddingPipeline: Awaited<ReturnType<typeof pipeline>> | null = null;

export interface EmbeddingItem {
  id: string;
  title: string;
  body?: string | null;
  type: 'issue' | 'pull_request' | 'discussion';
}

/**
 * Type for the embedding pipeline output tensor
 */
interface EmbeddingTensor {
  data?: number[] | Float32Array;
  tolist?: () => number[][];
}

/**
 * Get or initialize the embedding pipeline
 * The model is cached after first load (~100MB, subsequent calls are fast)
 */
async function getEmbeddingPipeline() {
  if (!embeddingPipeline) {
    console.log('[MiniLM] Loading embedding model...');
    const start = Date.now();
    embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    console.log(`[MiniLM] Model loaded in ${Date.now() - start}ms`);
  }
  return embeddingPipeline;
}

/**
 * Generate 384-dimensional embedding for text using MiniLM
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const embedder = await getEmbeddingPipeline();

    // Generate embeddings with mean pooling and normalization
    const output = (await embedder(text, {
      pooling: 'mean',
      normalize: true,
    })) as EmbeddingTensor;

    // Extract data from the tensor
    if (output.data) {
      return Array.from(output.data);
    } else if (output.tolist) {
      const list = output.tolist();
      return list[0] || [];
    }

    throw new Error('Unexpected embedding output format');
  } catch (error) {
    console.error('[MiniLM] Error generating embedding:', error);
    throw error;
  }
}

/**
 * Prepare text for embedding from issue/PR/discussion
 */
export function prepareTextForEmbedding(item: EmbeddingItem): string {
  const typeLabel = item.type === 'issue' ? 'Issue' : item.type === 'pull_request' ? 'Pull Request' : 'Discussion';
  const bodyPreview = item.body ? item.body.substring(0, 500) : '';
  return `${typeLabel}: ${item.title}\n\n${bodyPreview}`.trim();
}

/**
 * Create content hash for change detection
 */
export async function createContentHash(title: string, body?: string | null): Promise<string> {
  const content = JSON.stringify({ title, body: body || '' });
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate embeddings for multiple items in batch
 */
export async function generateBatchEmbeddings(
  items: EmbeddingItem[]
): Promise<Array<{ id: string; embedding: number[]; error?: string }>> {
  const results: Array<{ id: string; embedding: number[]; error?: string }> = [];

  for (const item of items) {
    try {
      const text = prepareTextForEmbedding(item);
      const embedding = await generateEmbedding(text);
      results.push({ id: item.id, embedding });
    } catch (error) {
      console.error(`[MiniLM] Failed to generate embedding for ${item.type} ${item.id}:`, error);
      results.push({
        id: item.id,
        embedding: [],
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}

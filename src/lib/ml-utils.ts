/**
 * Standalone ML utilities for embedding generation
 * No database dependencies - safe for GitHub Actions
 */

import crypto from 'crypto';

// SSR Guard: Detect if we're running in a server/edge environment
// This prevents @xenova/transformers from being imported during SSR
// which would cause errors due to native dependencies (sharp)
const isSSR =
  typeof window === 'undefined' &&
  typeof (globalThis as Record<string, unknown>).Deno === 'undefined';

// Dynamic import type for transformers
type TransformersPipeline = Awaited<ReturnType<typeof import('@xenova/transformers').pipeline>>;

// Shared embedding pipeline - only initialized client-side or in dedicated functions
let embeddingPipeline: TransformersPipeline | null = null;
let transformersModule: typeof import('@xenova/transformers') | null = null;

/**
 * Dynamically load transformers module (only in non-SSR environments)
 */
async function loadTransformers() {
  if (transformersModule) return transformersModule;

  // Don't load transformers during SSR - it has native dependencies
  if (isSSR) {
    throw new Error(
      'ML utilities cannot be used during SSR. Use dedicated Netlify Functions or GitHub Actions instead.'
    );
  }

  // Dynamic import to avoid bundling in SSR
  transformersModule = await import('@xenova/transformers');

  // Configure Transformers.js after loading
  transformersModule.env.allowLocalModels = true;
  transformersModule.env.useBrowserCache = false;

  return transformersModule;
}

/**
 * Get or initialize the embedding pipeline
 * This function will throw during SSR - embeddings should only be generated
 * in dedicated serverless functions or GitHub Actions
 */
async function getEmbeddingPipeline() {
  if (!embeddingPipeline) {
    const { pipeline } = await loadTransformers();
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
  body: string | null
): Promise<number[]> {
  const content = `${title}\n\n${body || ''}`.trim();

  try {
    const embedder = await getEmbeddingPipeline();

    // Generate embeddings - the output is a Tensor
    const output = await embedder(content, {
      pooling: 'mean',
      // @ts-expect-error - Transformers.js types are not fully accurate
      normalize: true,
    });

    // Extract data from the tensor
    // @ts-expect-error - Transformers.js types are not fully accurate
    const embeddings = output.data || output.tolist?.()?.[0] || [];

    // Convert to array and return
    return Array.from(embeddings);
  } catch (error) {
    console.error('Error generating embedding: %s', error);
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

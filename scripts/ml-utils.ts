import { pipeline, env } from '@xenova/transformers';

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
    embeddingPipeline = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2'
    );
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
      normalize: true,
    });
    
    // Extract data from the tensor
    // @ts-expect-error - Transformers.js types are not fully accurate
    const embeddings = output.data || output.tolist?.()?.[0] || [];
    
    // Convert to array and return
    return Array.from(embeddings);
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}
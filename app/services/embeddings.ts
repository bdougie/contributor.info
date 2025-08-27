import { supabase } from '../../src/lib/supabase';
import { pipeline, env } from '@xenova/transformers';
import crypto from 'crypto';

// Configure Transformers.js
env.allowLocalModels = false;
env.useBrowserCache = false;

// Shared embedding pipeline
let embeddingPipeline: Awaited<ReturnType<typeof pipeline>> | null = null;

export interface EmbeddingItem {
  id: string;
  title: string;
  body?: string | null;
  type: 'issue' | 'pull_request';
}

/**
 * Get or initialize the embedding pipeline
 */
async function getEmbeddingPipeline() {
  if (!embeddingPipeline) {
    console.log('Loading MiniLM embedding model...');
    embeddingPipeline = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2'
    );
    console.log('MiniLM model loaded successfully');
  }
  return embeddingPipeline;
}

/**
 * Generate embedding for issue or PR content using MiniLM
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const embedder = await getEmbeddingPipeline();
    
    // Generate embeddings - pass empty options object to satisfy TypeScript
    const output = await embedder(text, {} as any) as any;
    
    // Extract data from the tensor
    const embeddings = output.data || output.tolist?.()?.[0] || [];
    
    // Convert to array and return
    return Array.from(embeddings);
  } catch (error) {
    console.error('Error generating embedding: %s', error);
    throw error;
  }
}

/**
 * Create content hash for change detection
 */
export function createContentHash(title: string, body?: string | null): string {
  // Use JSON.stringify to safely handle any special characters
  const content = JSON.stringify({ title, body: body || '' });
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Prepare text for embedding from issue/PR
 */
export function prepareTextForEmbedding(item: EmbeddingItem): string {
  const bodyPreview = item.body ? item.body.substring(0, 500) : '';
  return `${item.type === 'issue' ? 'Issue' : 'Pull Request'}: ${item.title}\n\n${bodyPreview}`.trim();
}

/**
 * Generate and store embeddings for multiple items
 */
export async function generateAndStoreEmbeddings(items: EmbeddingItem[]): Promise<void> {
  const batchSize = 10; // Process in batches to avoid rate limits
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async (item) => {
      try {
        const text = prepareTextForEmbedding(item);
        const contentHash = createContentHash(item.title, item.body);
        const embedding = await generateEmbedding(text);
        
        const table = item.type === 'issue' ? 'issues' : 'pull_requests';
        
        const { error: updateError } = await supabase
          .from(table)
          .update({
            embedding,
            embedding_generated_at: new Date().toISOString(),
            content_hash: contentHash,
          })
          .eq('id', item.id);
          
        if (updateError) {
          console.error('Failed to store embedding for %s %s: %s', item.type, item.id, updateError);
          throw new Error(`Failed to store embedding: ${updateError.message}`);
        }
          
        console.log("Generated embedding for %s ${item.id}", item.type);
      } catch (error) {
        console.error('Failed to generate embedding for %s %s: %s', item.type, item.id, error);
      }
    }));
    
    // Small delay between batches
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

/**
 * Check if item needs new embedding
 */
export function needsEmbedding(
  contentHash: string | null,
  existingHash: string | null,
  embeddingGeneratedAt: string | null
): boolean {
  if (!embeddingGeneratedAt || !existingHash) {
    return true;
  }
  
  // Re-generate if content changed
  if (contentHash !== existingHash) {
    return true;
  }
  
  // Re-generate if older than 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const generatedAt = new Date(embeddingGeneratedAt);
  
  return generatedAt < thirtyDaysAgo;
}

/**
 * Get items that need embeddings from a repository
 */
export async function getItemsNeedingEmbeddings(
  repositoryId: string,
  limit: number = 50
): Promise<EmbeddingItem[]> {
  const items: EmbeddingItem[] = [];
  
  // Get recent issues
  const { data: issues } = await supabase
    .from('issues')
    .select('id, title, body, content_hash, embedding_generated_at')
    .eq('repository_id', repositoryId)
    .order('created_at', { ascending: false })
    .limit(limit);
    
  if (issues) {
    for (const issue of issues) {
      const contentHash = createContentHash(issue.title, issue.body);
      if (needsEmbedding(contentHash, issue.content_hash, issue.embedding_generated_at)) {
        items.push({
          id: issue.id,
          title: issue.title,
          body: issue.body,
          type: 'issue',
        });
      }
    }
  }
  
  // Get recent PRs
  const { data: prs } = await supabase
    .from('pull_requests')
    .select('id, title, body, content_hash, embedding_generated_at')
    .eq('repository_id', repositoryId)
    .order('created_at', { ascending: false })
    .limit(limit);
    
  if (prs) {
    for (const pr of prs) {
      const contentHash = createContentHash(pr.title, pr.body);
      if (needsEmbedding(contentHash, pr.content_hash, pr.embedding_generated_at)) {
        items.push({
          id: pr.id,
          title: pr.title,
          body: pr.body,
          type: 'pull_request',
        });
      }
    }
  }
  
  return items;
}
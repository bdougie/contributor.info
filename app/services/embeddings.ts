import { supabase } from '../../src/lib/supabase';
import crypto from 'crypto';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

export interface EmbeddingItem {
  id: string;
  title: string;
  body?: string | null;
  type: 'issue' | 'pull_request';
}

/**
 * Generate embedding for issue or PR content
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Create content hash for change detection
 */
export function createContentHash(title: string, body?: string | null): string {
  const content = `${title}\n${body || ''}`;
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
        
        await supabase
          .from(table)
          .update({
            embedding,
            embedding_generated_at: new Date().toISOString(),
            content_hash: contentHash,
          })
          .eq('id', item.id);
          
        console.log(`Generated embedding for ${item.type} ${item.id}`);
      } catch (error) {
        console.error(`Failed to generate embedding for ${item.type} ${item.id}:`, error);
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
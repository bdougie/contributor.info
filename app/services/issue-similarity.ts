import { supabase } from '../../src/lib/supabase';
import { pipeline, env } from '@xenova/transformers';
import crypto from 'crypto';

// Configure Transformers.js to use local models
env.allowLocalModels = false;
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
    // @ts-ignore - Transformers.js types are not fully accurate
    const embeddings = output.data || output.tolist()[0];
    
    // Convert to array and return
    return Array.from(embeddings);
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

/**
 * Calculate content hash for change detection
 */
export function calculateContentHash(title: string, body: string | null): string {
  const content = `${title}|${body || ''}`;
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Store issue embedding in database
 */
export async function storeIssueEmbedding(
  issueId: string,
  embedding: number[],
  contentHash: string
) {
  const { error } = await supabase
    .from('issues')
    .update({
      embedding: embedding,
      embedding_generated_at: new Date().toISOString(),
      content_hash: contentHash,
    })
    .eq('id', issueId);

  if (error) {
    console.error('Error storing issue embedding:', error);
    throw error;
  }
}

/**
 * Find similar issues using vector similarity
 */
export async function findSimilarIssues(
  embedding: number[],
  repositoryId: string,
  excludeIssueId?: string,
  limit: number = 5,
  threshold: number = 0.8
) {
  try {
    // Use Supabase RPC function for vector similarity search
    const { data, error } = await supabase.rpc('find_similar_issues', {
      query_embedding: embedding,
      match_count: limit,
      repo_id: repositoryId,
      similarity_threshold: threshold,
      exclude_issue_id: excludeIssueId,
    });

    if (error) {
      console.error('Error finding similar issues:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in similarity search:', error);
    return [];
  }
}

/**
 * Process new issue for similarity detection
 */
export async function processNewIssue(issue: {
  id: string;
  github_id: number;
  number: number;
  title: string;
  body: string | null;
  repository_id: string;
  html_url?: string;
}) {
  try {
    // Generate embedding
    const embedding = await generateIssueEmbedding(issue.title, issue.body);
    const contentHash = calculateContentHash(issue.title, issue.body);

    // Store embedding
    await storeIssueEmbedding(issue.id, embedding, contentHash);

    // Find similar issues
    const similarIssues = await findSimilarIssues(
      embedding,
      issue.repository_id,
      issue.id,
      5,
      0.85 // 85% similarity threshold
    );

    return similarIssues;
  } catch (error) {
    console.error('Error processing issue for similarity:', error);
    throw error;
  }
}

/**
 * Format similar issues for GitHub comment
 */
export function formatSimilarIssuesComment(
  similarIssues: Array<{
    number: number;
    title: string;
    state: string;
    similarity: number;
    html_url?: string;
  }>
): string {
  if (similarIssues.length === 0) {
    return '';
  }

  let comment = '## 🔍 Similar Issues Found\n\n';
  comment += 'I found the following similar issues that might be related:\n\n';

  for (const issue of similarIssues) {
    const stateEmoji = issue.state === 'open' ? '🟢' : '🔴';
    const similarity = Math.round(issue.similarity * 100);
    
    comment += `- ${stateEmoji} [#${issue.number} - ${issue.title}](${issue.html_url}) `;
    comment += `(${similarity}% similar)\n`;
  }

  comment += '\n';
  comment += '_This helps reduce duplicate issues and connects related discussions. ';
  comment += 'Powered by [contributor.info](https://contributor.info)_ 🤖';

  return comment;
}

/**
 * Calculate discussion worthiness score
 */
export function calculateDiscussionScore(issue: {
  title: string;
  body: string | null;
  labels?: Array<{ name: string }>;
}): number {
  let score = 0;

  // Check for question indicators
  const questionPatterns = [
    /\?$/,
    /^(how|what|why|when|where|should|could|would|can|is)/i,
    /\b(help|advice|thoughts|opinion|recommend|suggest)\b/i,
  ];

  const text = `${issue.title} ${issue.body || ''}`.toLowerCase();
  
  for (const pattern of questionPatterns) {
    if (pattern.test(text)) {
      score += 0.2;
    }
  }

  // Check for discussion labels
  const discussionLabels = ['question', 'discussion', 'rfc', 'proposal', 'feedback'];
  if (issue.labels) {
    for (const label of issue.labels) {
      if (discussionLabels.includes(label.name.toLowerCase())) {
        score += 0.3;
      }
    }
  }

  // Check body length (longer = more discussion-like)
  if (issue.body && issue.body.length > 500) {
    score += 0.2;
  }

  // Check for opinion words
  const opinionWords = ['think', 'believe', 'feel', 'opinion', 'consider', 'perhaps'];
  for (const word of opinionWords) {
    if (text.includes(word)) {
      score += 0.1;
    }
  }

  return Math.min(score, 1.0);
}
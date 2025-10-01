import { supabase } from '../../src/lib/supabase';
import { generateEmbedding, prepareTextForEmbedding } from './embeddings';

interface SimilarItem {
  id: string;
  number: number;
  title: string;
  state: string;
  similarity: number;
  created_at: string;
  html_url?: string;
  merged_at?: string;
}

export interface ContextualItem {
  id: string;
  type: 'issue' | 'pull_request';
  number: number;
  title: string;
  state: string;
  similarity_score: number;
  file_overlap_score: number;
  relationship: 'may_fix' | 'related_work' | 'similar_changes' | 'may_conflict';
  reasons: string[];
  created_at: string;
  html_url?: string;
}

export interface FindContextualIssuesParams {
  pullRequestId: string;
  repositoryId: string;
  changedFiles: string[];
  prTitle: string;
  prBody: string;
}

/**
 * Find contextual issues and PRs based on semantic similarity and file overlap
 */
export async function findContextualIssues(
  params: FindContextualIssuesParams
): Promise<ContextualItem[]> {
  const { pullRequestId, repositoryId, changedFiles, prTitle, prBody } = params;

  // Generate embedding for the current PR
  const prText = prepareTextForEmbedding({
    id: pullRequestId,
    title: prTitle,
    body: prBody,
    type: 'pull_request',
  });

  const prEmbedding = await generateEmbedding(prText);

  // Find similar issues using vector similarity
  const { data: similarIssues, error: issuesError } = await supabase.rpc('find_similar_issues', {
    query_embedding: prEmbedding,
    match_count: 30,
    repo_id: repositoryId,
  });

  if (issuesError) {
    console.error('Error finding similar issues:', issuesError);
    throw new Error(`Failed to find similar issues: ${issuesError.message}`);
  }

  // Find similar PRs using vector similarity
  const { data: similarPRs, error: prsError } = await supabase.rpc('find_similar_pull_requests', {
    query_embedding: prEmbedding,
    match_count: 20,
    repo_id: repositoryId,
    exclude_pr_id: pullRequestId,
  });

  if (prsError) {
    console.error('Error finding similar PRs:', prsError);
    throw new Error(`Failed to find similar PRs: ${prsError.message}`);
  }

  // Process and score all items
  const contextualItems: ContextualItem[] = [];

  // Process issues
  if (similarIssues) {
    for (const issue of similarIssues) {
      const fileOverlap = await calculateFileOverlap(issue.id, 'issue');
      const item = await processContextualItem(issue, fileOverlap, 'issue', prTitle);
      if (item.similarity_score > 0.3) {
        // Threshold for relevance
        contextualItems.push(item);
      }
    }
  }

  // Process PRs
  if (similarPRs) {
    for (const pr of similarPRs) {
      const fileOverlap = await calculateFileOverlap(pr.id, 'pull_request');
      const item = await processContextualItem(pr, fileOverlap, 'pull_request', prTitle);
      if (item.similarity_score > 0.3) {
        contextualItems.push(item);
      }
    }
  }

  // Sort by combined score and limit results
  return contextualItems
    .sort((a, b) => {
      const scoreA = a.similarity_score * 0.6 + a.file_overlap_score * 0.4;
      const scoreB = b.similarity_score * 0.6 + b.file_overlap_score * 0.4;
      return scoreB - scoreA;
    })
    .slice(0, 10);
}

/**
 * Calculate file overlap score
 */
async function calculateFileOverlap(
  itemId: string,
  itemType: 'issue' | 'pull_request'
): Promise<number> {
  if (itemType === 'issue') {
    // For issues, we look at PRs that reference them
    const { data: linkedPRs } = await supabase
      .from('pull_requests')
      .select('id')
      .or(`body.ilike.*#${itemId}*,title.ilike.*#${itemId}*`)
      .limit(5);

    if (!linkedPRs || linkedPRs.length === 0) {
      return 0;
    }

    // Get files from linked PRs (simplified - in production, store PR files)
    return 0.2; // Default score for linked issues
  } else {
    // For PRs, we'd need to store changed files in the database
    // For POC, return a default score
    return 0.3;
  }
}

/**
 * Process a contextual item and determine its relationship
 */
async function processContextualItem(
  item: SimilarItem,
  fileOverlapScore: number,
  type: 'issue' | 'pull_request',
  currentPRTitle: string
): Promise<ContextualItem> {
  const reasons: string[] = [];
  let relationship: ContextualItem['relationship'] = 'similar_changes';

  // Determine relationship based on various factors
  if (type === 'issue' && item.state === 'open') {
    // Check if PR might fix this issue
    const titleLower = currentPRTitle.toLowerCase();
    const issueTitleLower = item.title.toLowerCase();

    if (titleLower.includes('fix') || titleLower.includes('resolve')) {
      relationship = 'may_fix';
      reasons.push('PR title suggests a fix');
    }

    if (item.similarity > 0.7) {
      reasons.push('High semantic similarity');
      if (relationship !== 'may_fix') {
        relationship = 'related_work';
      }
    }
  } else if (type === 'pull_request') {
    if (item.state === 'open') {
      relationship = 'may_conflict';
      reasons.push('Open PR with similar changes');
    } else if (item.merged_at) {
      const mergedDate = new Date(item.merged_at);
      const daysAgo = (Date.now() - mergedDate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysAgo < 7) {
        relationship = 'related_work';
        reasons.push('Recently merged');
      }
    }
  }

  // Add file overlap reason
  if (fileOverlapScore > 0.5) {
    reasons.push('Modifies similar files');
  }

  // Add similarity reason
  if (item.similarity > 0.5) {
    reasons.push(`${Math.round(item.similarity * 100)}% content similarity`);
  }

  return {
    id: item.id,
    type,
    number: item.number,
    title: item.title,
    state: item.state,
    similarity_score: item.similarity || 0,
    file_overlap_score: fileOverlapScore,
    relationship,
    reasons,
    created_at: item.created_at,
    html_url: item.html_url,
  };
}

// Create RPC functions for vector similarity search
// These need to be added to the database as Postgres functions
export const VECTOR_SEARCH_FUNCTIONS = `
-- Function to find similar issues
CREATE OR REPLACE FUNCTION find_similar_issues(
  query_embedding vector(1536),
  match_count int,
  repo_id uuid
)
RETURNS TABLE (
  id uuid,
  number int,
  title text,
  state text,
  similarity float,
  created_at timestamptz,
  html_url text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.number,
    i.title,
    i.state,
    1 - (i.embedding <=> query_embedding) as similarity,
    i.created_at,
    CONCAT('https://github.com/', r.full_name, '/issues/', i.number) as html_url
  FROM issues i
  JOIN repositories r ON i.repository_id = r.id
  WHERE 
    i.repository_id = repo_id
    AND i.embedding IS NOT NULL
  ORDER BY i.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to find similar pull requests
CREATE OR REPLACE FUNCTION find_similar_pull_requests(
  query_embedding vector(1536),
  match_count int,
  repo_id uuid,
  exclude_pr_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  number int,
  title text,
  state text,
  merged_at timestamptz,
  similarity float,
  created_at timestamptz,
  html_url text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pr.id,
    pr.number,
    pr.title,
    pr.state,
    pr.merged_at,
    1 - (pr.embedding <=> query_embedding) as similarity,
    pr.created_at,
    CONCAT('https://github.com/', r.full_name, '/pull/', pr.number) as html_url
  FROM pull_requests pr
  JOIN repositories r ON pr.repository_id = r.id
  WHERE 
    pr.repository_id = repo_id
    AND pr.embedding IS NOT NULL
    AND (exclude_pr_id IS NULL OR pr.id != exclude_pr_id)
  ORDER BY pr.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
`;

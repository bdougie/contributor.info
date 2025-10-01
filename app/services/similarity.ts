import { PullRequest, Repository, Issue, DatabaseIssue } from '../types/github';
import { supabase } from '../../src/lib/supabase';
import { githubAppAuth } from '../lib/auth';
import { embeddingService } from './embedding-service';
import { similarityCache } from './similarity-cache';

export interface SimilarIssue {
  issue: Issue;
  similarityScore: number;
  reasons: string[];
  relationship: 'implements' | 'fixes' | 'relates_to' | 'similar';
}

export interface SimilarityOptions {
  useSemantic?: boolean;
  maxResults?: number;
  minScore?: number;
  batchProcess?: boolean;
  onProgress?: (processed: number, total: number) => void;
}

/**
 * Find issues similar to a pull request with batch processing and caching
 */
export async function findSimilarIssues(
  pullRequest: PullRequest,
  repository: Repository,
  options: SimilarityOptions = {}
): Promise<SimilarIssue[]> {
  const {
    useSemantic = true,
    maxResults = 10,
    minScore = 0.3,
    batchProcess = true,
    onProgress,
  } = options;

  try {
    const similarIssues: SimilarIssue[] = [];
    const startTime = Date.now();

    // 1. Check for explicitly mentioned issues in PR body
    const mentionedIssues = extractMentionedIssues(pullRequest.body || '');

    // 2. Get issues from the database
    const { data: dbIssues } = await supabase
      .from('issues')
      .select('*')
      .eq('repository_id', repository.id)
      .in('state', ['open', 'closed'])
      .order('created_at', { ascending: false })
      .limit(100);

    // 3. If we have app access, fetch issues from GitHub API
    let githubIssues: Issue[] = [];
    if (pullRequest.head.repo) {
      try {
        const octokit = await githubAppAuth.getInstallationOctokit(
          parseInt(process.env.GITHUB_APP_INSTALLATION_ID || '0')
        );

        const { data } = await octokit.issues.listForRepo({
          owner: repository.owner.login,
          repo: repository.name,
          state: 'all',
          per_page: 50,
          sort: 'updated',
        });

        githubIssues = data.filter((issue) => !issue.pull_request);
      } catch (error) {
        console.error('Could not fetch issues from GitHub:', error);
      }
    }

    const allIssues = [...(dbIssues || []), ...githubIssues];
    const totalIssues = allIssues.length;

    // 4. Use semantic similarity if enabled and available
    if (useSemantic && embeddingService.isAvailable() && batchProcess) {
      const batchResults = await processBatchSimilarity(
        pullRequest,
        allIssues,
        repository.id,
        { onProgress, minScore }
      );

      for (const result of batchResults) {
        if (result.score >= minScore) {
          similarIssues.push(result);
        }
      }
    } else {
      // Fall back to text-based similarity
      let processed = 0;
      for (const issue of allIssues) {
        const similarity = await calculateIssueSimilarity(pullRequest, issue, mentionedIssues);

        if (similarity.score >= minScore) {
          similarIssues.push({
            issue: issue as Issue,
            similarityScore: similarity.score,
            reasons: similarity.reasons,
            relationship: similarity.relationship,
          });
        }

        processed++;
        if (onProgress) {
          onProgress(processed, totalIssues);
        }
      }
    }

    // 5. Sort by similarity score and return top matches
    const results = similarIssues
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, maxResults);

    // Log performance metrics
    const processingTime = Date.now() - startTime;
    console.log(`Similarity search completed in ${processingTime}ms`, {
      totalIssues,
      semanticSearch: useSemantic && embeddingService.isAvailable(),
      cacheStats: similarityCache.getStats(),
    });

    return results;
  } catch (error) {
    console.error('Error finding similar issues:', error);
    return [];
  }
}

/**
 * Process similarity in batches using embeddings
 */
async function processBatchSimilarity(
  pullRequest: PullRequest,
  issues: Array<Issue | DatabaseIssue>,
  repositoryId: string,
  options: { onProgress?: (processed: number, total: number) => void; minScore: number }
): Promise<SimilarIssue[]> {
  const results: SimilarIssue[] = [];

  // Prepare PR embedding
  const prEmbedding = await embeddingService.generateEmbedding({
    id: pullRequest.id.toString(),
    title: pullRequest.title,
    body: pullRequest.body,
    type: 'pull_request',
    repositoryId,
  });

  if (!prEmbedding) {
    console.warn('Could not generate PR embedding, falling back to text similarity');
    return [];
  }

  // Prepare issue items for batch processing
  const issueItems = issues.map((issue) => ({
    id: issue.id?.toString() || issue.number?.toString(),
    title: issue.title,
    body: issue.body,
    type: 'issue' as const,
    repositoryId,
  }));

  // Get embeddings in batch
  const batchResults = await embeddingService.generateBatchEmbeddings(issueItems, {
    returnPartial: true,
    onProgress: options.onProgress,
  });

  // Calculate similarities
  for (let i = 0; i < issues.length; i++) {
    const issue = issues[i];
    const embeddingResult = batchResults.find((r) => r.itemId === issueItems[i].id);

    if (embeddingResult?.embedding) {
      const semanticScore = embeddingService.calculateSimilarity(
        prEmbedding,
        embeddingResult.embedding
      );

      // Combine with traditional scoring
      const mentionedIssues = extractMentionedIssues(pullRequest.body || '');
      const traditionalSimilarity = await calculateIssueSimilarity(
        pullRequest,
        issue,
        mentionedIssues
      );

      // Weighted combination: 70% semantic, 30% traditional
      const combinedScore = semanticScore * 0.7 + traditionalSimilarity.score * 0.3;

      if (combinedScore >= options.minScore) {
        results.push({
          issue: issue as Issue,
          similarityScore: combinedScore,
          reasons: [
            ...traditionalSimilarity.reasons,
            semanticScore > 0.7 ? 'High semantic similarity' : undefined,
          ].filter(Boolean) as string[],
          relationship: traditionalSimilarity.relationship,
        });
      }
    }
  }

  return results;
}

/**
 * Calculate similarity between a PR and an issue
 */
async function calculateIssueSimilarity(
  pr: PullRequest,
  issue: Issue | DatabaseIssue,
  mentionedIssues: number[]
): Promise<{
  score: number;
  reasons: string[];
  relationship: 'implements' | 'fixes' | 'relates_to' | 'similar';
}> {
  const reasons: string[] = [];
  let score = 0;
  let relationship: 'implements' | 'fixes' | 'relates_to' | 'similar' = 'similar';

  // 1. Check if explicitly mentioned
  if (mentionedIssues.includes(issue.number)) {
    score += 0.5;
    reasons.push('Mentioned in PR description');

    // Check if it's a fix or implementation
    const prBody = pr.body?.toLowerCase() || '';
    if (prBody.includes(`fixes #${issue.number}`) || prBody.includes(`closes #${issue.number}`)) {
      relationship = 'fixes';
      score += 0.3;
    } else if (prBody.includes(`implements #${issue.number}`)) {
      relationship = 'implements';
      score += 0.3;
    } else {
      relationship = 'relates_to';
    }
  }

  // 2. Title similarity
  const titleSimilarity = calculateTextSimilarity(pr.title, issue.title);
  if (titleSimilarity > 0.5) {
    score += titleSimilarity * 0.3;
    reasons.push('Similar title');
  }

  // 3. Label overlap
  const prLabels = pr.labels.map((l) => l.name);
  const issueLabels = issue.labels?.map((l) => l.name) || [];
  const commonLabels = prLabels.filter((l) => issueLabels.includes(l));

  if (commonLabels.length > 0) {
    score += (commonLabels.length / Math.max(prLabels.length, issueLabels.length)) * 0.2;
    reasons.push(`Common labels: ${commonLabels.join(', ')}`);
  }

  // 4. Same author
  if (pr.user.login === issue.user?.login) {
    score += 0.1;
    reasons.push('Same author');
  }

  // 5. Temporal proximity (issues created/updated recently)
  const prDate = new Date(pr.created_at);
  const issueDate = new Date(issue.updated_at || issue.created_at);
  const daysDiff = Math.abs(prDate.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24);

  if (daysDiff < 7) {
    score += 0.1;
    reasons.push('Recently active');
  }

  // 6. Check for keywords indicating relationship
  const prText = `${pr.title} ${pr.body || ''}`.toLowerCase();
  const issueText = `${issue.title} ${issue.body || ''}`.toLowerCase();

  const fixKeywords = ['bug', 'error', 'fix', 'issue', 'problem'];
  const featureKeywords = ['feature', 'implement', 'add', 'enhance', 'support'];

  const prHasFix = fixKeywords.some((kw) => prText.includes(kw));
  const issueHasBug = fixKeywords.some((kw) => issueText.includes(kw));

  if (prHasFix && issueHasBug && relationship === 'similar') {
    score += 0.15;
    reasons.push('PR may fix this issue');
    relationship = 'fixes';
  }

  return { score: Math.min(score, 1), reasons, relationship };
}

/**
 * Extract issue numbers mentioned in text
 */
function extractMentionedIssues(text: string): number[] {
  const issuePattern = /#(\d+)/g;
  const matches = text.matchAll(issuePattern);
  return Array.from(matches).map((match) => parseInt(match[1]));
}

/**
 * Calculate text similarity using simple algorithm
 * (In production, use proper NLP/embeddings)
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;

  const words1 = text1.toLowerCase().split(/\s+/);
  const words2 = text2.toLowerCase().split(/\s+/);

  const set1 = new Set(words1);
  const set2 = new Set(words2);

  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

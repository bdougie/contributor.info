import { PullRequest, Repository, Issue } from '../types/github';
import { supabase } from '../../src/lib/supabase';
import { githubAppAuth } from '../lib/auth';

export interface SimilarIssue {
  issue: Issue;
  similarityScore: number;
  reasons: string[];
  relationship: 'implements' | 'fixes' | 'relates_to' | 'similar';
}

/**
 * Find issues similar to a pull request
 */
export async function findSimilarIssues(
  pullRequest: PullRequest,
  repository: Repository
): Promise<SimilarIssue[]> {
  try {
    const similarIssues: SimilarIssue[] = [];

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

    // 4. Calculate similarity for each issue
    const allIssues = [...(dbIssues || []), ...githubIssues];

    for (const issue of allIssues) {
      const similarity = await calculateIssueSimilarity(pullRequest, issue, mentionedIssues);

      if (similarity.score > 0.3) {
        // Threshold for relevance
        similarIssues.push({
          issue: issue as Issue,
          similarityScore: similarity.score,
          reasons: similarity.reasons,
          relationship: similarity.relationship,
        });
      }
    }

    // 5. Sort by similarity score and return top matches
    return similarIssues.sort((a, b) => b.similarityScore - a.similarityScore).slice(0, 5);
  } catch (error) {
    console.error('Error finding similar issues:', error);
    return [];
  }
}

/**
 * Calculate similarity between a PR and an issue
 */
async function calculateIssueSimilarity(
  pr: PullRequest,
  issue: any,
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
  const issueLabels = issue.labels?.map((l: any) => l.name) || [];
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

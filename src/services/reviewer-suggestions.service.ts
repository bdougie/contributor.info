import { supabase } from '@/lib/supabase';
import { APIResponse } from '@/lib/api/error-types';

export interface ReviewerSuggestionDTO {
  handle: string;
  reason: string;
  confidence: number;
  signals: string[];
  metadata?: {
    avatarUrl?: string;
    reviewCount?: number;
    lastReviewDate?: string;
    score: number;
  };
}

interface ErrorDetails {
  category: string;
  retryable: boolean;
  requestId?: string;
  suggestions?: string[];
  action?: string;
}

interface DetailedError extends Error {
  details: ErrorDetails;
}

export async function fetchCodeOwners(owner: string, repo: string, forceRefresh = false) {
  const url = forceRefresh
    ? `/api/repos/${owner}/${repo}/codeowners?refresh=true`
    : `/api/repos/${owner}/${repo}/codeowners`;
  const res = await fetch(url);

  if (!res.ok) throw new Error(`Failed to fetch CODEOWNERS: ${res.status}`);

  return res.json() as Promise<{
    exists: boolean;
    content?: string;
    path?: string;
    message?: string;
    helpUrl?: string;
    checkedPaths?: string[];
    repository?: string;
    source?: 'github' | 'database' | 'none';
    suggestions?: Array<{
      pattern: string;
      owners: string[];
      confidence: number;
      reasoning: string;
    }>;
    suggestedContent?: string;
  }>;
}

export async function fetchSuggestedCodeOwners(
  owner: string,
  repo: string,
  opts?: { llm?: boolean }
) {
  const res = await fetch(
    `/api/repos/${owner}/${repo}/suggested-codeowners${opts?.llm ? '?llm=1' : ''}`
  );
  if (!res.ok) throw new Error(`Failed to fetch suggested CODEOWNERS: ${res.status}`);
  return res.json() as Promise<{
    suggestions: Array<{
      pattern: string;
      owners: string[];
      confidence: number;
      reasoning: string;
    }>;
    codeOwnersContent: string;
    cached?: boolean;
  }>;
}

export async function suggestReviewers(
  owner: string,
  repo: string,
  files?: string[],
  prAuthor?: string,
  prUrl?: string
): Promise<{
  suggestions: ReviewerSuggestionDTO[];
  codeOwners: string[];
  repository: string;
  filesAnalyzed: number;
  directoriesAffected: number;
  generatedAt: string;
}> {
  const body = { files, prAuthor, prUrl };

  try {
    const res = await fetch(`/api/repos/${owner}/${repo}/suggest-reviewers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const responseData: APIResponse = await res.json();

    if (!responseData.success || responseData.error) {
      const error = responseData.error!;

      // Create user-friendly error with actionable information
      const userError = new Error(error.userMessage) as DetailedError;
      userError.name = error.code;
      userError.details = {
        category: error.category,
        retryable: error.retryable,
        requestId: error.requestId,
        suggestions:
          error.details?.suggestion && typeof error.details.suggestion === 'string'
            ? [error.details.suggestion]
            : [],
        action:
          error.details?.action && typeof error.details.action === 'string'
            ? error.details.action
            : undefined,
      };

      throw userError;
    }

    return responseData.data as {
      suggestions: ReviewerSuggestionDTO[];
      codeOwners: string[];
      repository: string;
      filesAnalyzed: number;
      directoriesAffected: number;
      generatedAt: string;
    };
  } catch (error) {
    // Enhanced error handling for different scenarios
    if (error instanceof Error && 'details' in error) {
      // This is our structured error - re-throw with context
      throw error;
    }

    // Network or parsing errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      const networkError = new Error(
        'Unable to connect to the service. Please check your internet connection and try again.'
      ) as DetailedError;
      networkError.name = 'NETWORK_ERROR';
      networkError.details = {
        category: 'network',
        retryable: true,
        suggestions: ['Check your internet connection', 'Try refreshing the page'],
      };
      throw networkError;
    }

    // Generic fallback
    const genericError = new Error(
      'An unexpected error occurred while fetching reviewer suggestions.'
    ) as DetailedError;
    genericError.name = 'UNKNOWN_ERROR';
    genericError.details = {
      category: 'unknown',
      retryable: true,
      suggestions: ['Try again in a moment', 'Contact support if the problem persists'],
    };
    throw genericError;
  }
}

export async function fetchFileTree(owner: string, repo: string) {
  const res = await fetch(`/api/repos/${owner}/${repo}/file-tree`);
  if (!res.ok) throw new Error(`Failed to fetch file tree: ${res.status}`);
  return res.json() as Promise<{
    files: string[];
    directories: string[];
    totalSize: number;
    truncated: boolean;
  }>;
}

export type MinimalPR = {
  number: number;
  title: string;
  state: 'open' | 'closed' | 'merged';
  created_at: string;
  author?: { username: string; avatar_url?: string } | null;
};

export async function fetchRecentPullRequests(
  repositoryId: string,
  limit = 25
): Promise<MinimalPR[]> {
  const { data, error } = await supabase
    .from('pull_requests')
    .select(
      `number, title, state, created_at, author:contributors!author_id (username, avatar_url)`
    )
    .eq('repository_id', repositoryId)
    .eq('state', 'open')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as unknown as MinimalPR[];
}

export async function fetchPRsWithoutReviewers(
  repositoryId: string,
  limit = 10
): Promise<MinimalPR[]> {
  // Fetch open PRs with their actual IDs
  const { data: prs, error: prError } = await supabase
    .from('pull_requests')
    .select(
      `id, number, title, state, created_at, author:contributors!author_id (username, avatar_url)`
    )
    .eq('repository_id', repositoryId)
    .eq('state', 'open')
    .order('created_at', { ascending: false })
    .limit(limit * 2); // Fetch more to account for filtering

  if (prError) throw prError;
  if (!prs || prs.length === 0) return [];

  // Get PR IDs (the actual UUID ids from the database)
  const prIds = prs.map((pr) => pr.id);

  // Fetch reviews for these PRs
  const { data: reviews, error: reviewError } = await supabase
    .from('reviews')
    .select('pull_request_id')
    .in('pull_request_id', prIds);

  if (reviewError) throw reviewError;

  // Filter out PRs that have reviews
  const prsWithReviews = new Set((reviews || []).map((r) => r.pull_request_id));
  const prsWithoutReviews = prs
    .filter((pr) => !prsWithReviews.has(pr.id))
    .slice(0, limit)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .map(({ id, ...rest }) => rest); // Omit the internal id field

  return prsWithoutReviews as unknown as MinimalPR[];
}

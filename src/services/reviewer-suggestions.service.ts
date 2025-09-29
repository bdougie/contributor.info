import { supabase } from '@/lib/supabase';

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

export async function fetchCodeOwners(owner: string, repo: string) {
  const res = await fetch(`/api/repos/${owner}/${repo}/codeowners`);
  if (!res.ok) throw new Error(`Failed to fetch CODEOWNERS: ${res.status}`);
  return res.json() as Promise<{
    exists: boolean;
    content?: string;
    path?: string;
    message?: string;
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

export async function fetchSuggestedCodeOwners(owner: string, repo: string, opts?: { llm?: boolean }) {
  const res = await fetch(`/api/repos/${owner}/${repo}/suggested-codeowners${opts?.llm ? '?llm=1' : ''}`);
  if (!res.ok) throw new Error(`Failed to fetch suggested CODEOWNERS: ${res.status}`);
  return res.json() as Promise<{ suggestions: Array<{ pattern: string; owners: string[]; confidence: number; reasoning: string }>; codeOwnersContent: string; cached?: boolean }>;
}

export async function suggestReviewers(
  owner: string,
  repo: string,
  files?: string[],
  prAuthor?: string,
  prUrl?: string
) {
  const body = { files, prAuthor, prUrl };
  console.log('Sending reviewer suggestion request:', body);

  const res = await fetch(`/api/repos/${owner}/${repo}/suggest-reviewers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let errorMessage = `Failed to suggest reviewers (${res.status})`;
    try {
      const errorData = await res.json();
      console.log('Error response from API:', errorData);
      if (errorData.error) errorMessage = errorData.error;
    } catch {
      // If response is not JSON, use status text
      if (res.statusText) errorMessage = `${errorMessage}: ${res.statusText}`;
    }
    throw new Error(errorMessage);
  }
  return res.json() as Promise<{
    suggestions: ReviewerSuggestionDTO[];
    codeOwners: string[];
    repository: string;
    filesAnalyzed: number;
    directoriesAffected: number;
    generatedAt: string;
  }>;
}

export async function fetchFileTree(owner: string, repo: string) {
  const res = await fetch(`/api/repos/${owner}/${repo}/file-tree`);
  if (!res.ok) throw new Error(`Failed to fetch file tree: ${res.status}`);
  return res.json() as Promise<{ files: string[]; directories: string[]; totalSize: number; truncated: boolean }>;
}

export type MinimalPR = {
  number: number;
  title: string;
  state: 'open' | 'closed' | 'merged';
  created_at: string;
  author?: { username: string; avatar_url?: string } | null;
};

export async function fetchRecentPullRequests(repositoryId: string, limit = 25): Promise<MinimalPR[]> {
  const { data, error } = await supabase
    .from('pull_requests')
    .select(
      `number, title, state, created_at, author:contributors!author_id (username, avatar_url)`
    )
    .eq('repository_id', repositoryId)
    .eq('state', 'open')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('Failed to fetch pull requests:', error);
    return [];
  }

  return (data || []).map((row: any) => ({
    number: row.number,
    title: row.title,
    state: row.state,
    created_at: row.created_at,
    author: Array.isArray(row.author) ? row.author[0] : row.author || null,
  }));
}

export async function fetchPRsWithoutReviewers(repositoryId: string, limit = 25): Promise<MinimalPR[]> {
  const { data, error } = await supabase
    .from('pull_requests')
    .select(`
      number,
      title,
      state,
      created_at,
      author:contributors!author_id (username, avatar_url),
      reviews!pull_request_id (id)
    `)
    .eq('repository_id', repositoryId)
    .eq('state', 'open')
    .order('created_at', { ascending: false })
    .limit(limit * 2); // Fetch more to filter out those with reviews

  if (error) {
    console.error('Failed to fetch pull requests without reviewers:', error);
    return [];
  }

  // Filter to only PRs without any reviews
  const prsWithoutReviews = (data || [])
    .filter((row: any) => !row.reviews || row.reviews.length === 0)
    .slice(0, limit)
    .map((row: any) => ({
      number: row.number,
      title: row.title,
      state: row.state,
      created_at: row.created_at,
      author: Array.isArray(row.author) ? row.author[0] : row.author || null,
    }));

  return prsWithoutReviews;
}

// Legacy compatibility helper to convert new format to old format if needed
export function groupSuggestionsByPriority(suggestions: ReviewerSuggestionDTO[]): {
  primary: ReviewerSuggestionDTO[];
  secondary: ReviewerSuggestionDTO[];
  additional: ReviewerSuggestionDTO[];
} {
  const primary = suggestions.filter(s => s.confidence >= 0.8).slice(0, 3);
  const secondary = suggestions.filter(s => s.confidence >= 0.5 && s.confidence < 0.8).slice(0, 3);
  const additional = suggestions.filter(s => s.confidence < 0.5).slice(0, 5);

  return { primary, secondary, additional };
}

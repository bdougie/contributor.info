import type { Repository } from '@/types/github';

export interface ReviewerSuggestionDTO {
  username: string;
  avatarUrl?: string;
  score: number;
  reasoning: string[];
  relevantFiles: string[];
  recentActivity: boolean;
}

export async function fetchCodeOwners(owner: string, repo: string) {
  const res = await fetch(`/api/repos/${owner}/${repo}/codeowners`);
  if (!res.ok) throw new Error(`Failed to fetch CODEOWNERS: ${res.status}`);
  return res.json() as Promise<{ exists: boolean; content?: string; path?: string; message?: string }>;
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
  const res = await fetch(`/api/repos/${owner}/${repo}/suggest-reviewers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files, prAuthor, prUrl }),
  });
  if (!res.ok) throw new Error(`Failed to suggest reviewers: ${res.status}`);
  return res.json() as Promise<{
    suggestions: { primary: ReviewerSuggestionDTO[]; secondary: ReviewerSuggestionDTO[]; additional: ReviewerSuggestionDTO[] };
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

import { fetchAwaitingReplies } from './github-work-replies';

export type GitHubWorkCategory = 'review_requested' | 'authored' | 'assigned' | 'awaiting_reply';

export interface GitHubWorkReply {
  author: string;
  body: string;
  url: string;
  createdAt: string;
  kind: 'conversation' | 'review';
}

export interface GitHubWorkItem {
  id: number;
  number: number;
  title: string;
  repository: string;
  type: 'pr' | 'issue';
  url: string;
  updatedAt: string;
  author: string;
  categories: GitHubWorkCategory[];
  nodeId?: string;
  replies?: GitHubWorkReply[];
}

interface SearchItem {
  id: number;
  node_id?: string;
  number: number;
  title: string;
  repository_url: string;
  updated_at: string;
  state: string;
  user: { login: string } | null;
  pull_request?: { url: string };
}

interface SearchResponse {
  total_count: number;
  incomplete_results: boolean;
  items: SearchItem[];
}

export class GitHubWorkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitHubWorkError';
  }
}

const searches: Record<GitHubWorkCategory, string> = {
  review_requested: 'is:open is:pr review-requested:@me',
  authored: 'is:open is:pr author:@me',
  assigned: 'is:open is:issue assignee:@me',
  awaiting_reply: 'is:open involves:@me',
};

export const workCategoryLabels: Record<GitHubWorkCategory, string> = {
  review_requested: 'Review requests',
  authored: 'Your open PRs',
  assigned: 'Assigned issues',
  awaiting_reply: 'Awaiting your reply',
};

export function buildWorkQueries(repositories: string[], category: GitHubWorkCategory): string[] {
  const queries: string[] = [];
  let query = searches[category];
  for (const repository of [...new Set(repositories)].sort()) {
    if (!/^[a-z\d](?:[a-z\d-]*[a-z\d])?\/[a-z\d_.-]+$/i.test(repository)) {
      throw new GitHubWorkError('A workspace repository name is invalid.');
    }
    const qualifier = ` repo:${repository}`;
    if (searches[category].length + qualifier.length > 256) {
      throw new GitHubWorkError('A workspace repository name exceeds GitHub search limits.');
    }
    if (query.length + qualifier.length > 256) {
      queries.push(query);
      query = searches[category];
    }
    query += qualifier;
  }
  // Never issue an unscoped account-wide search for an empty workspace.
  if (query !== searches[category]) queries.push(query);
  return queries;
}

export async function fetchGitHubWorkCategory({
  token,
  repositories,
  category,
  signal,
}: {
  token: string;
  repositories: string[];
  category: GitHubWorkCategory;
  signal: AbortSignal;
}): Promise<{ items: GitHubWorkItem[]; incomplete: boolean }> {
  if (!token)
    throw new GitHubWorkError('GitHub authorization is missing from the sign-in session.');
  const items: GitHubWorkItem[] = [];
  const allowedRepos = new Set(repositories.map((repo) => repo.toLowerCase()));
  let incomplete = false;
  const queries = buildWorkQueries(repositories, category);
  search: for (const query of queries) {
    for (let page = 1; page <= 10; page++) {
      const params = new URLSearchParams({
        q: query,
        per_page: '100',
        page: String(page),
        sort: 'updated',
        order: 'desc',
      });
      const response = await fetch(`https://api.github.com/search/issues?${params}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
        signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
      });
      if (response.status === 401) {
        throw new GitHubWorkError(
          'GitHub rejected your saved sign-in authorization. Sign in again from the account menu.'
        );
      }
      if (response.status === 403 || response.status === 429) {
        throw new GitHubWorkError(
          'GitHub limited this request or requires repository access. Wait before retrying, or check your GitHub authorization.'
        );
      }
      if (!response.ok)
        throw new GitHubWorkError(`GitHub could not load your work (HTTP ${response.status}).`);
      const data: SearchResponse = await response.json();
      if (!Array.isArray(data.items))
        throw new GitHubWorkError('GitHub returned an invalid work list.');
      incomplete ||= data.incomplete_results || data.total_count > 1000;
      for (const item of data.items) {
        const repository = item.repository_url.replace('https://api.github.com/repos/', '');
        if (!allowedRepos.has(repository.toLowerCase()) || item.state !== 'open') continue;
        const type = item.pull_request ? 'pr' : 'issue';
        items.push({
          id: item.id,
          nodeId: item.node_id,
          number: item.number,
          title: item.title,
          repository,
          type,
          url: `https://github.com/${repository}/${type === 'pr' ? 'pull' : 'issues'}/${item.number}`,
          updatedAt: item.updated_at,
          author: item.user?.login || 'Ghost',
          categories: [category],
        });
      }
      // Bound conversation inspection independently from the fast work categories.
      if (category === 'awaiting_reply' && items.length >= 100) {
        incomplete ||=
          items.length > 100 ||
          data.total_count > page * 100 ||
          query !== queries[queries.length - 1];
        break search;
      }
      if (data.items.length < 100 || page * 100 >= data.total_count) break;
    }
  }
  if (category === 'awaiting_reply') {
    const replies = await fetchAwaitingReplies({ token, items: items.slice(0, 100), signal });
    return { items: replies.items, incomplete: incomplete || replies.incomplete };
  }
  return { items, incomplete };
}

export function mergeGitHubWork(items: GitHubWorkItem[]): GitHubWorkItem[] {
  const unique = new Map<number, GitHubWorkItem>();
  for (const item of items) {
    const existing = unique.get(item.id);
    unique.set(
      item.id,
      existing
        ? {
            ...existing,
            replies: item.replies || existing.replies,
            updatedAt:
              Date.parse(item.updatedAt) > Date.parse(existing.updatedAt)
                ? item.updatedAt
                : existing.updatedAt,
            categories: [...new Set([...existing.categories, ...item.categories])],
          }
        : { ...item }
    );
  }
  return [...unique.values()].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

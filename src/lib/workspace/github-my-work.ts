import { fetchAwaitingReplies } from './github-work-replies';
import { fetchWithTimeout } from '@/lib/utils/abort-signal';

export type GitHubWorkCategory = 'review_requested' | 'authored' | 'assigned' | 'awaiting_reply';

export interface GitHubWorkReply {
  threadId?: string;
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

export interface GitHubWorkResult {
  items: GitHubWorkItem[];
  incomplete: boolean;
  /** Repositories GitHub refused to search for this account, such as private or renamed repos. */
  unavailableRepositories: string[];
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
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'GitHubWorkError';
  }
}

const SEARCH_QUERY_LIMIT = 256;
const SEARCH_TIMEOUT_MS = 15_000;
const REPLY_CANDIDATE_LIMIT = 100;

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

function toQuery(repositories: string[], category: GitHubWorkCategory): string {
  return repositories.reduce(
    (query, repository) => `${query} repo:${repository}`,
    searches[category]
  );
}

/** Group workspace repositories so each search query stays within GitHub's length limit. */
export function groupWorkRepositories(
  repositories: string[],
  category: GitHubWorkCategory
): string[][] {
  const groups: string[][] = [];
  let group: string[] = [];
  let length = searches[category].length;
  for (const repository of [...new Set(repositories)].sort()) {
    if (!/^[a-z\d](?:[a-z\d-]*[a-z\d])?\/[a-z\d_.-]+$/i.test(repository)) {
      throw new GitHubWorkError('A workspace repository name is invalid.');
    }
    const qualifierLength = ` repo:${repository}`.length;
    if (searches[category].length + qualifierLength > SEARCH_QUERY_LIMIT) {
      throw new GitHubWorkError('A workspace repository name exceeds GitHub search limits.');
    }
    if (length + qualifierLength > SEARCH_QUERY_LIMIT) {
      groups.push(group);
      group = [];
      length = searches[category].length;
    }
    group.push(repository);
    length += qualifierLength;
  }
  // Never issue an unscoped account-wide search for an empty workspace.
  if (group.length > 0) groups.push(group);
  return groups;
}

export function buildWorkQueries(repositories: string[], category: GitHubWorkCategory): string[] {
  return groupWorkRepositories(repositories, category).map((group) => toQuery(group, category));
}

async function searchPage(
  query: string,
  page: number,
  token: string,
  signal: AbortSignal
): Promise<SearchResponse> {
  const params = new URLSearchParams({
    q: query,
    per_page: '100',
    page: String(page),
    sort: 'updated',
    order: 'desc',
  });
  const response = await fetchWithTimeout(
    `https://api.github.com/search/issues?${params}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } },
    signal,
    SEARCH_TIMEOUT_MS
  );
  if (response.status === 401) {
    throw new GitHubWorkError(
      'GitHub rejected your saved sign-in authorization. Sign in again from the account menu.',
      401
    );
  }
  if (response.status === 403 || response.status === 429) {
    throw new GitHubWorkError(
      'GitHub limited this request or requires repository access. Wait before retrying, or check your GitHub authorization.',
      response.status
    );
  }
  if (response.status === 422) {
    throw new GitHubWorkError(
      'GitHub cannot search one of the workspace repositories with your authorization.',
      422
    );
  }
  if (!response.ok)
    throw new GitHubWorkError(
      `GitHub could not load your work (HTTP ${response.status}).`,
      response.status
    );
  const data: SearchResponse = await response.json();
  if (!Array.isArray(data.items))
    throw new GitHubWorkError('GitHub returned an invalid work list.');
  return data;
}

interface SearchState {
  items: GitHubWorkItem[];
  incomplete: boolean;
  unavailableRepositories: string[];
  /** Set once the awaiting-reply candidate budget is reached; later scopes are skipped. */
  stopped: boolean;
}

function toWorkItem(item: SearchItem, repository: string, category: GitHubWorkCategory) {
  const type = item.pull_request ? 'pr' : 'issue';
  return {
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
  } satisfies GitHubWorkItem;
}

async function collectScope(
  repositories: string[],
  {
    token,
    category,
    signal,
    state,
    remainingScopes,
  }: {
    token: string;
    category: GitHubWorkCategory;
    signal: AbortSignal;
    state: SearchState;
    remainingScopes: boolean;
  }
): Promise<void> {
  if (state.stopped) return;
  const allowedRepos = new Set(repositories.map((repo) => repo.toLowerCase()));
  const query = toQuery(repositories, category);
  const collected: GitHubWorkItem[] = [];
  let incomplete = false;
  try {
    for (let page = 1; page <= 10; page++) {
      const data = await searchPage(query, page, token, signal);
      incomplete ||= data.incomplete_results || data.total_count > 1000;
      for (const item of data.items) {
        const repository = item.repository_url.replace('https://api.github.com/repos/', '');
        if (!allowedRepos.has(repository.toLowerCase()) || item.state !== 'open') continue;
        collected.push(toWorkItem(item, repository, category));
      }
      // Bound conversation inspection independently from the fast work categories.
      if (
        category === 'awaiting_reply' &&
        state.items.length + collected.length >= REPLY_CANDIDATE_LIMIT
      ) {
        incomplete ||=
          state.items.length + collected.length > REPLY_CANDIDATE_LIMIT ||
          data.total_count > page * 100 ||
          remainingScopes;
        state.stopped = true;
        break;
      }
      if (data.items.length < 100 || page * 100 >= data.total_count) break;
    }
  } catch (error) {
    if (!(error instanceof GitHubWorkError) || error.status !== 422) throw error;
    // GitHub rejects the whole query when any repo: qualifier is unsearchable for
    // this account. Narrow the scope so the readable repositories still load.
    if (repositories.length === 1) {
      state.unavailableRepositories.push(repositories[0]);
      return;
    }
    const middle = Math.ceil(repositories.length / 2);
    const halves = [repositories.slice(0, middle), repositories.slice(middle)];
    for (const [index, half] of halves.entries()) {
      await collectScope(half, {
        token,
        category,
        signal,
        state,
        remainingScopes: remainingScopes || index < halves.length - 1,
      });
    }
    return;
  }
  state.items.push(...collected);
  state.incomplete ||= incomplete;
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
}): Promise<GitHubWorkResult> {
  if (!token)
    throw new GitHubWorkError('GitHub authorization is missing from the sign-in session.');
  const state: SearchState = {
    items: [],
    incomplete: false,
    unavailableRepositories: [],
    stopped: false,
  };
  const scopes = groupWorkRepositories(repositories, category);
  for (const [index, scope] of scopes.entries()) {
    await collectScope(scope, {
      token,
      category,
      signal,
      state,
      remainingScopes: index < scopes.length - 1,
    });
  }
  state.unavailableRepositories.sort();
  if (category === 'awaiting_reply') {
    const replies = await fetchAwaitingReplies({
      token,
      items: state.items.slice(0, REPLY_CANDIDATE_LIMIT),
      signal,
    });
    return {
      items: replies.items,
      incomplete: state.incomplete || replies.incomplete,
      unavailableRepositories: state.unavailableRepositories,
    };
  }
  return {
    items: state.items,
    incomplete: state.incomplete,
    unavailableRepositories: state.unavailableRepositories,
  };
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

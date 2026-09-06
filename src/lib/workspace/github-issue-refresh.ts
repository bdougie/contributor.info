import { getSupabase } from '@/lib/supabase-lazy';
import type { Issue } from '@/components/features/workspace/WorkspaceIssuesTable';

/**
 * Client for the `workspace-issues-refresh` edge function and the pure merge /
 * reporting logic the Issues tab needs around it.
 *
 * The browser never writes issue metadata: RLS reserves that for the service
 * role. The function fetches GitHub server-side (membership checked), stores
 * what it can, and returns the fresh rows so the UI can show them even when the
 * write step failed. This module keeps that contract and reports it truthfully.
 */

export type IssueRefreshStatus = 'refreshed' | 'fetched_not_stored' | 'failed';
export type IssueRefreshStage = 'authorization' | 'github' | 'database';

export interface RefreshedIssueRow {
  /** Database id when the row was stored; null when GitHub was read but the write failed. */
  id: string | null;
  github_id: number;
  repository_id: string;
  number: number;
  title: string;
  state: 'open' | 'closed';
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  comments_count: number;
  labels: Array<{ name: string; color: string }>;
  assignees: Array<{ login: string; avatar_url: string }>;
  author: { username: string; avatar_url: string; is_bot: boolean };
  url: string;
}

export interface IssueRefreshRepositoryResult {
  repositoryId: string;
  /** owner/name, or the raw id when the repository is unknown to the workspace. */
  repository: string;
  status: IssueRefreshStatus;
  stage?: IssueRefreshStage;
  error?: string;
  httpStatus?: number;
  retryAt?: string;
  fetched: number;
  stored: number;
  issues: RefreshedIssueRow[];
}

export interface IssueRefreshResponse {
  success: true;
  refreshedAt: string;
  windowDays: number;
  results: IssueRefreshRepositoryResult[];
}

export interface IssueRefreshRepositoryRef {
  id: string;
  owner: string;
  name: string;
  avatar_url?: string;
}

export class IssueRefreshError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = 'IssueRefreshError';
  }
}

interface FunctionErrorContext {
  status?: number;
  json?: () => Promise<unknown>;
}

interface FunctionInvokeError {
  name?: string;
  message?: string;
  context?: FunctionErrorContext;
}

function isRefreshResponse(value: unknown): value is IssueRefreshResponse {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<IssueRefreshResponse>;
  return candidate.success === true && Array.isArray(candidate.results);
}

async function describeInvokeError(error: FunctionInvokeError): Promise<IssueRefreshError> {
  const status = error.context?.status;
  let serverMessage: string | undefined;
  if (error.context?.json) {
    try {
      const body = (await error.context.json()) as { error?: unknown; message?: unknown };
      if (typeof body.message === 'string') serverMessage = body.message;
      else if (typeof body.error === 'string') serverMessage = body.error;
    } catch {
      // Body was not JSON; fall through to status-based text.
    }
  }
  if (status === 401) {
    return new IssueRefreshError(
      serverMessage || 'Your sign-in session has expired. Sign in again from the account menu.',
      status
    );
  }
  if (status === 403) {
    return new IssueRefreshError(
      serverMessage || 'You are not a member of this workspace.',
      status
    );
  }
  if (status === 429) {
    return new IssueRefreshError(
      serverMessage || 'Too many refresh requests. Wait a few minutes and retry.',
      status
    );
  }
  if (status !== undefined) {
    return new IssueRefreshError(
      serverMessage || `The refresh service returned HTTP ${status}.`,
      status
    );
  }
  return new IssueRefreshError(
    'Could not reach the refresh service. Check your connection and retry.'
  );
}

/**
 * Ask the backend to refresh the workspace's issues. The user's Supabase JWT is
 * sent by the SDK; the GitHub token lets the function read repositories the
 * user can see. Throws `IssueRefreshError` when the request itself failed.
 */
export async function requestWorkspaceIssuesRefresh(options: {
  workspaceId: string;
  repositoryIds: string[];
  githubToken?: string;
}): Promise<IssueRefreshResponse> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.functions.invoke('workspace-issues-refresh', {
    body: {
      workspaceId: options.workspaceId,
      repositoryIds: options.repositoryIds,
      ...(options.githubToken ? { github_token: options.githubToken } : {}),
    },
  });

  if (error) {
    throw await describeInvokeError(error as FunctionInvokeError);
  }
  if (!isRefreshResponse(data)) {
    throw new IssueRefreshError('The refresh service returned an unexpected response.');
  }
  return data;
}

function issueKey(owner: string, name: string, number: number): string {
  return `${owner}/${name}#${number}`.toLowerCase();
}

function toIssue(
  row: RefreshedIssueRow,
  repository: IssueRefreshRepositoryRef,
  cached: Issue | undefined
): Issue {
  return {
    id: row.id ?? cached?.id ?? `github:${row.github_id}`,
    number: row.number,
    title: row.title,
    state: row.state,
    repository: {
      name: repository.name,
      owner: repository.owner,
      avatar_url:
        repository.avatar_url ||
        cached?.repository.avatar_url ||
        `https://avatars.githubusercontent.com/${repository.owner}`,
    },
    author: {
      username: row.author.username,
      avatar_url: row.author.avatar_url,
      isBot: row.author.is_bot,
    },
    created_at: row.created_at,
    updated_at: row.updated_at,
    closed_at: row.closed_at ?? undefined,
    comments_count: row.comments_count,
    labels: row.labels,
    assignees: row.assignees,
    // GitHub's issue endpoint does not carry linked PRs or our response tracking.
    linked_pull_requests: cached?.linked_pull_requests,
    url: row.url,
    responded_by: cached?.responded_by,
    responded_at: cached?.responded_at,
  };
}

/**
 * Overlay fresh GitHub rows on the saved issues. Repositories that failed keep
 * their saved rows untouched. Saved rows that GitHub did not return (older than
 * the refresh window) are kept. Result is sorted by `updated_at` descending.
 */
export function mergeRefreshedIssues(
  cached: Issue[],
  results: IssueRefreshRepositoryResult[],
  repositories: IssueRefreshRepositoryRef[]
): Issue[] {
  const repositoriesById = new Map(repositories.map((repo) => [repo.id, repo]));
  const merged = new Map<string, Issue>();
  for (const issue of cached) {
    merged.set(issueKey(issue.repository.owner, issue.repository.name, issue.number), issue);
  }

  for (const result of results) {
    if (result.status === 'failed') continue;
    const repository = repositoriesById.get(result.repositoryId);
    if (!repository) continue;
    for (const row of result.issues) {
      const key = issueKey(repository.owner, repository.name, row.number);
      merged.set(key, toIssue(row, repository, merged.get(key)));
    }
  }

  return [...merged.values()].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
}

export interface IssueRefreshSummary {
  refreshed: IssueRefreshRepositoryResult[];
  fetchedNotStored: IssueRefreshRepositoryResult[];
  failed: IssueRefreshRepositoryResult[];
  /** Repositories whose displayed issues are current, whether or not they were saved. */
  freshRepositoryIds: string[];
  /** Readable banner for failed repositories, or null when none failed. */
  errorMessage: string | null;
  /** Readable notice for rows shown live but not saved, or null when none. */
  warningMessage: string | null;
}

function joinCauses(results: IssueRefreshRepositoryResult[]): string {
  return results
    .map((result) => {
      const cause = result.error ? ` (${result.error.replace(/\.$/, '')})` : '';
      return `${result.repository}${cause}`;
    })
    .join('; ');
}

/** Turn per-repository outcomes into the two messages the Issues tab shows. */
export function summarizeIssueRefresh(
  results: IssueRefreshRepositoryResult[]
): IssueRefreshSummary {
  const refreshed = results.filter((result) => result.status === 'refreshed');
  const fetchedNotStored = results.filter((result) => result.status === 'fetched_not_stored');
  const failed = results.filter((result) => result.status === 'failed');

  const errorMessage =
    failed.length === 0
      ? null
      : `Could not refresh ${joinCauses(failed)}. Showing saved issues for ${
          failed.length === 1 ? 'it' : 'them'
        }.`;

  const warningMessage =
    fetchedNotStored.length === 0
      ? null
      : `Showing live GitHub issues for ${joinCauses(fetchedNotStored)}; they could not be saved.`;

  return {
    refreshed,
    fetchedNotStored,
    failed,
    freshRepositoryIds: [...refreshed, ...fetchedNotStored].map((result) => result.repositoryId),
    errorMessage,
    warningMessage,
  };
}

// Workspace Issues Refresh
//
// Authenticated, workspace-membership-checked capture path for the Issues tab.
// The browser cannot write issue metadata (RLS reserves that for service role),
// so it asks this function to fetch recent issues from GitHub, store them with
// the service-role client, and return the fresh rows for immediate display.
//
// Contract (all repositories are processed; HTTP 200 carries per-repository truth):
//   status 'refreshed'          GitHub fetched and rows stored
//   status 'fetched_not_stored' GitHub fetched, database write failed; rows still returned
//   status 'failed'             nothing usable; `stage` says where it broke
//
// The function fetches GitHub itself. It never accepts client-supplied issue rows.

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateRequest } from '../_shared/auth.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { isWorkspaceMember } from '../_shared/workspace-membership.ts';
import { getRateLimitInfo } from '../_shared/github.ts';

const MAX_REPOSITORIES = 50;
const MAX_PAGES_PER_REPOSITORY = 5;
const WINDOW_DAYS = 30;
const CONCURRENCY = 4;
const GITHUB_TIMEOUT_MS = 20_000;

type RefreshStage = 'authorization' | 'github' | 'database';
type RefreshStatus = 'refreshed' | 'fetched_not_stored' | 'failed';

interface RefreshRequest {
  workspaceId?: unknown;
  repositoryIds?: unknown;
  github_token?: unknown;
}

interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
  type: string;
}

interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  html_url: string;
  user: GitHubUser | null;
  labels: Array<{ id?: number; name: string; color: string; description?: string | null }>;
  assignees: GitHubUser[];
  milestone: { id: number; number: number; title: string; state: string } | null;
  comments: number;
  pull_request?: { url: string };
}

interface RepositoryRow {
  id: string;
  owner: string;
  name: string;
  full_name: string;
  avatar_url: string | null;
}

/** Issue row returned to the browser; `id` is the database id when stored. */
interface RefreshedIssue {
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

interface RepositoryResult {
  repositoryId: string;
  repository: string;
  status: RefreshStatus;
  stage?: RefreshStage;
  error?: string;
  /** GitHub HTTP status for github-stage failures. */
  httpStatus?: number;
  /** ISO time GitHub's rate limit resets, when that is the failure. */
  retryAt?: string;
  fetched: number;
  stored: number;
  issues: RefreshedIssue[];
}

class GitHubFetchError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
    readonly retryAt?: string,
  ) {
    super(message);
    this.name = 'GitHubFetchError';
  }
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.length > 0);
}

function describeGitHubFailure(response: Response, fullName: string): GitHubFetchError {
  const status = response.status;
  if (status === 401) {
    return new GitHubFetchError(
      'GitHub rejected the sign-in authorization. Sign in with GitHub again.',
      status,
    );
  }
  if (status === 403 || status === 429) {
    const rateLimit = getRateLimitInfo(response);
    if (rateLimit && rateLimit.remaining === 0) {
      const retryAt = new Date(rateLimit.reset * 1000).toISOString();
      return new GitHubFetchError(
        `GitHub rate limit reached; retry after ${retryAt}.`,
        status,
        retryAt,
      );
    }
    const retryAfter = response.headers.get('retry-after');
    if (retryAfter) {
      const retryAt = new Date(Date.now() + Number(retryAfter) * 1000).toISOString();
      return new GitHubFetchError(
        `GitHub asked to slow down; retry after ${retryAt}.`,
        status,
        retryAt,
      );
    }
    return new GitHubFetchError(
      `GitHub denied access to ${fullName} for this account.`,
      status,
    );
  }
  if (status === 404) {
    return new GitHubFetchError(
      `GitHub could not find ${fullName} for this account (private, renamed, or deleted).`,
      status,
    );
  }
  if (status === 410) {
    return new GitHubFetchError(`Issues are disabled for ${fullName}.`, status);
  }
  if (status >= 500) {
    return new GitHubFetchError(`GitHub is unavailable (HTTP ${status}).`, status);
  }
  return new GitHubFetchError(`GitHub returned HTTP ${status} for ${fullName}.`, status);
}

async function fetchRecentIssues(
  repository: RepositoryRow,
  token: string,
  since: string,
): Promise<GitHubIssue[]> {
  const issues: GitHubIssue[] = [];
  for (let page = 1; page <= MAX_PAGES_PER_REPOSITORY; page++) {
    const params = new URLSearchParams({
      state: 'all',
      since,
      per_page: '100',
      page: String(page),
      sort: 'updated',
      direction: 'desc',
    });
    const url =
      `https://api.github.com/repos/${repository.owner}/${repository.name}/issues?${params}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'contributor-info-workspace-issues-refresh',
      },
      signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw describeGitHubFailure(response, repository.full_name);
    }

    const pageItems = (await response.json()) as unknown;
    if (!Array.isArray(pageItems)) {
      throw new GitHubFetchError('GitHub returned an invalid issue list.', response.status);
    }
    for (const item of pageItems as GitHubIssue[]) {
      if (!item.pull_request) issues.push(item);
    }

    const link = response.headers.get('link');
    if (pageItems.length < 100 || !link || !link.includes('rel="next"')) break;
  }
  return issues;
}

function toRefreshedIssue(
  issue: GitHubIssue,
  repository: RepositoryRow,
  storedId: string | null,
): RefreshedIssue {
  return {
    id: storedId,
    github_id: issue.id,
    repository_id: repository.id,
    number: issue.number,
    title: issue.title,
    state: issue.state,
    created_at: issue.created_at,
    updated_at: issue.updated_at,
    closed_at: issue.closed_at,
    comments_count: issue.comments,
    labels: (issue.labels ?? [])
      .filter((label) => typeof label?.name === 'string')
      .map((label) => ({ name: label.name, color: label.color || '000000' })),
    assignees: (issue.assignees ?? []).map((assignee) => ({
      login: assignee.login,
      avatar_url: assignee.avatar_url,
    })),
    author: {
      username: issue.user?.login ?? 'unknown',
      avatar_url: issue.user?.avatar_url ?? '',
      is_bot: issue.user?.type === 'Bot',
    },
    url: issue.html_url || `https://github.com/${repository.full_name}/issues/${issue.number}`,
  };
}

/** Upsert the distinct authors and return github_id -> contributors.id. */
async function storeAuthors(
  admin: SupabaseClient,
  issues: GitHubIssue[],
): Promise<Map<number, string>> {
  const authors = new Map<number, GitHubUser>();
  for (const issue of issues) {
    if (issue.user?.id) authors.set(issue.user.id, issue.user);
  }
  if (authors.size === 0) return new Map();

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from('contributors')
    .upsert(
      [...authors.values()].map((user) => ({
        github_id: user.id,
        username: user.login,
        avatar_url: user.avatar_url,
        profile_url: `https://github.com/${user.login}`,
        is_bot: user.type === 'Bot',
        is_active: true,
        last_updated_at: now,
      })),
      { onConflict: 'github_id', ignoreDuplicates: false },
    )
    .select('id, github_id');

  if (error) {
    throw new Error(`Could not store issue authors: ${error.message}`);
  }
  return new Map((data ?? []).map((row) => [Number(row.github_id), String(row.id)]));
}

/** Upsert issue rows and return github_id -> issues.id. */
async function storeIssues(
  admin: SupabaseClient,
  repository: RepositoryRow,
  issues: GitHubIssue[],
  authorIds: Map<number, string>,
): Promise<Map<number, string>> {
  const now = new Date().toISOString();
  const rows = issues.map((issue) => ({
    github_id: issue.id,
    repository_id: repository.id,
    number: issue.number,
    title: issue.title,
    body: issue.body,
    state: issue.state,
    author_id: issue.user?.id ? (authorIds.get(issue.user.id) ?? null) : null,
    created_at: issue.created_at,
    updated_at: issue.updated_at,
    closed_at: issue.closed_at,
    labels: issue.labels ?? [],
    assignees: (issue.assignees ?? []).map((a) => ({
      id: a.id,
      login: a.login,
      avatar_url: a.avatar_url,
    })),
    milestone: issue.milestone,
    comments_count: issue.comments,
    is_pull_request: false,
    last_synced_at: now,
  }));

  const { data, error } = await admin
    .from('issues')
    .upsert(rows, { onConflict: 'github_id', ignoreDuplicates: false })
    .select('id, github_id');

  if (error) {
    throw new Error(`Could not store issues: ${error.message}`);
  }
  return new Map((data ?? []).map((row) => [Number(row.github_id), String(row.id)]));
}

/** Record the outcome on the workspace's tracked-repository row. Best effort. */
async function recordSyncOutcome(
  admin: SupabaseClient,
  workspaceId: string,
  repositoryId: string,
  outcome: { ok: true; fetched: number } | { ok: false; error: string },
): Promise<void> {
  const { data: tracked } = await admin
    .from('tracked_repositories')
    .select('id')
    .eq('repository_id', repositoryId)
    .maybeSingle();
  if (!tracked) return;

  const now = new Date().toISOString();
  const update = outcome.ok
    ? {
      last_sync_at: now,
      last_sync_status: 'success',
      last_sync_error: null,
      total_issues_fetched: outcome.fetched,
    }
    : { last_sync_at: now, last_sync_status: 'failed', last_sync_error: outcome.error };

  const { error } = await admin
    .from('workspace_tracked_repositories')
    .update(update)
    .eq('workspace_id', workspaceId)
    .eq('tracked_repository_id', tracked.id);
  if (error) {
    console.warn('[workspace-issues-refresh] Could not record sync outcome: %s', error.message);
  }
}

async function refreshRepository(
  admin: SupabaseClient,
  workspaceId: string,
  repository: RepositoryRow,
  token: string,
  since: string,
): Promise<RepositoryResult> {
  const base = { repositoryId: repository.id, repository: repository.full_name };

  let fetched: GitHubIssue[];
  try {
    fetched = await fetchRecentIssues(repository, token, since);
  } catch (error) {
    const message = error instanceof GitHubFetchError
      ? error.message
      : error instanceof Error && error.name === 'TimeoutError'
      ? `GitHub did not respond in time for ${repository.full_name}.`
      : `GitHub request failed for ${repository.full_name}.`;
    console.error(
      '[workspace-issues-refresh] GitHub failure for %s: %s',
      repository.full_name,
      message,
    );
    await recordSyncOutcome(admin, workspaceId, repository.id, { ok: false, error: message });
    return {
      ...base,
      status: 'failed',
      stage: 'github',
      error: message,
      httpStatus: error instanceof GitHubFetchError ? error.httpStatus : undefined,
      retryAt: error instanceof GitHubFetchError ? error.retryAt : undefined,
      fetched: 0,
      stored: 0,
      issues: [],
    };
  }

  if (fetched.length === 0) {
    // A legitimate empty window still counts as a completed refresh.
    await recordSyncOutcome(admin, workspaceId, repository.id, { ok: true, fetched: 0 });
    return { ...base, status: 'refreshed', fetched: 0, stored: 0, issues: [] };
  }

  try {
    const authorIds = await storeAuthors(admin, fetched);
    const storedIds = await storeIssues(admin, repository, fetched, authorIds);
    await recordSyncOutcome(admin, workspaceId, repository.id, {
      ok: true,
      fetched: fetched.length,
    });
    return {
      ...base,
      status: 'refreshed',
      fetched: fetched.length,
      stored: storedIds.size,
      issues: fetched.map((issue) =>
        toRefreshedIssue(issue, repository, storedIds.get(issue.id) ?? null)
      ),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database write failed.';
    console.error(
      '[workspace-issues-refresh] Database failure for %s: %s',
      repository.full_name,
      message,
    );
    await recordSyncOutcome(admin, workspaceId, repository.id, { ok: false, error: message });
    return {
      ...base,
      status: 'fetched_not_stored',
      stage: 'database',
      error: message,
      fetched: fetched.length,
      stored: 0,
      issues: fetched.map((issue) => toRefreshedIssue(issue, repository, null)),
    };
  }
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(lanes);
  return results;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json(405, { success: false, error: 'Method not allowed' });
  }

  const auth = await authenticateRequest(req);
  if (auth instanceof Response) return auth;
  if (!auth.user) {
    return json(401, { success: false, error: 'A signed-in user is required.' });
  }

  let body: RefreshRequest;
  try {
    body = (await req.json()) as RefreshRequest;
  } catch {
    return json(400, { success: false, error: 'Request body must be JSON.' });
  }

  const { workspaceId, repositoryIds, github_token: githubTokenInput } = body;
  if (typeof workspaceId !== 'string' || workspaceId.length === 0) {
    return json(400, { success: false, error: 'workspaceId is required.' });
  }
  if (!isStringArray(repositoryIds) || repositoryIds.length === 0) {
    return json(400, { success: false, error: 'repositoryIds must be a non-empty array.' });
  }
  if (repositoryIds.length > MAX_REPOSITORIES) {
    return json(400, {
      success: false,
      error: `At most ${MAX_REPOSITORIES} repositories per request.`,
    });
  }
  if (githubTokenInput !== undefined && typeof githubTokenInput !== 'string') {
    return json(400, { success: false, error: 'github_token must be a string when provided.' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return json(503, { success: false, error: 'The refresh service is not configured.' });
  }
  const admin = createClient(supabaseUrl, serviceKey);

  // Workspace membership is checked server-side; RLS on the browser is unchanged.
  const membership = await isWorkspaceMember(admin, workspaceId, auth.user.id);
  if (membership.error) {
    console.error('[workspace-issues-refresh] %s', membership.error);
    return json(500, { success: false, error: 'Could not verify workspace membership.' });
  }
  if (!membership.member) {
    return json(403, { success: false, error: 'You are not a member of this workspace.' });
  }

  const uniqueIds = [...new Set(repositoryIds)];
  const { data: workspaceRepos, error: workspaceReposError } = await admin
    .from('workspace_repositories')
    .select('repository_id, repositories!inner(id, owner, name, full_name, avatar_url)')
    .eq('workspace_id', workspaceId)
    .in('repository_id', uniqueIds);
  if (workspaceReposError) {
    console.error(
      '[workspace-issues-refresh] Repository lookup failed: %s',
      workspaceReposError.message,
    );
    return json(500, { success: false, error: 'Could not load workspace repositories.' });
  }

  const repositories: RepositoryRow[] = [];
  for (const row of workspaceRepos ?? []) {
    const repo = Array.isArray(row.repositories) ? row.repositories[0] : row.repositories;
    if (repo) {
      repositories.push({
        id: String(repo.id),
        owner: String(repo.owner),
        name: String(repo.name),
        full_name: String(repo.full_name),
        avatar_url: repo.avatar_url ? String(repo.avatar_url) : null,
      });
    }
  }
  const knownIds = new Set(repositories.map((repo) => repo.id));

  const token = githubTokenInput || Deno.env.get('GITHUB_TOKEN');
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const results: RepositoryResult[] = uniqueIds
    .filter((id) => !knownIds.has(id))
    .map((id) => ({
      repositoryId: id,
      repository: id,
      status: 'failed',
      stage: 'authorization',
      error: 'This repository is not part of the workspace.',
      fetched: 0,
      stored: 0,
      issues: [],
    }));

  if (!token) {
    for (const repository of repositories) {
      results.push({
        repositoryId: repository.id,
        repository: repository.full_name,
        status: 'failed',
        stage: 'authorization',
        error: 'No GitHub authorization is available. Sign in with GitHub again.',
        fetched: 0,
        stored: 0,
        issues: [],
      });
    }
  } else {
    const refreshed = await runWithConcurrency(
      repositories,
      CONCURRENCY,
      (repository) => refreshRepository(admin, workspaceId, repository, token, since),
    );
    results.push(...refreshed);
  }

  return json(200, {
    success: true,
    refreshedAt: new Date().toISOString(),
    windowDays: WINDOW_DAYS,
    results,
  });
});

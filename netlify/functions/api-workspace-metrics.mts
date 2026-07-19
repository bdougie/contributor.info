import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Public, read-only workspace metrics for a single *public* workspace.
//
// This replaces the old `workspace_metrics_cache` table (dropped in migration
// 20260428000007_drop_dead_tables and never populated). Metrics are aggregated
// on demand from the source tables the site already exposes to anonymous
// clients — mirroring the logic in `workspace-aggregation.service.ts` but
// self-contained so it bundles cleanly as a Netlify function.
//
// The desktop tray (and any anon client) calls this instead of hitting Supabase
// REST directly, so the flat shape below matches the tray's `WorkspaceMetrics`
// struct. Private workspaces are rejected (403); serving them needs an
// authenticated caller and is a follow-up.

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
// Prefer a service-role key server-side (bypasses RLS, reliable). Fall back to
// the anon key, which can already read the public source tables this endpoint
// uses — so it also works under `netlify dev` with only VITE_ vars set.
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_TOKEN ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';

let supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables (SUPABASE_URL, SUPABASE key)');
  }
  if (!supabase) {
    supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
  }
  return supabase;
}

const TIME_RANGES = new Set(['7d', '30d', '90d', '1y', 'all']);
type TimeRange = '7d' | '30d' | '90d' | '1y' | 'all';

const PAGE = 1000;
// Serve repeated polls (the tray refreshes every 60s) from memory on warm
// instances, bounding database load. Short enough to stay fresh.
const CACHE_TTL_MS = 120_000;
// Newest open items surfaced as clickable rows in the tray's dropdown.
const RECENT_LIMIT = 5;

// Flat shape consumed by the desktop tray's `WorkspaceMetrics` struct. Trend
// fields are null in v1 — the history table they were derived from was dropped.
interface WorkspaceMetricsFlat {
  time_range: TimeRange;
  total_prs: number;
  merged_prs: number;
  open_prs: number;
  draft_prs: number;
  avg_pr_merge_time_hours: number | null;
  pr_velocity: number | null;
  total_issues: number;
  closed_issues: number;
  open_issues: number;
  issue_closure_rate: number | null;
  total_contributors: number;
  active_contributors: number;
  new_contributors: number;
  total_stars: number;
  stars_trend: number | null;
  prs_trend: number | null;
  contributors_trend: number | null;
  calculated_at: string;
  is_stale: boolean;
  recent_open_prs: RecentItem[];
  recent_open_issues: RecentItem[];
}

// Clickable detail row for the tray dropdown: the newest open PRs/issues,
// deep-linking to GitHub. Not scoped to time_range — an old open PR is still
// actionable.
export interface RecentItem {
  number: number;
  title: string;
  url: string;
  author: string | null;
  repo: string | null;
  created_at: string;
}

interface RecentRow {
  number: number | null;
  title: string | null;
  // Present on pull_requests only; the live issues table has no html_url.
  html_url?: string | null;
  created_at: string | null;
  contributors: { username: string | null } | { username: string | null }[] | null;
  repositories: { full_name: string | null } | { full_name: string | null }[] | null;
}

interface PrRow {
  state: string | null;
  draft: boolean | null;
  created_at: string | null;
  merged_at: string | null;
  author_id: string | null;
}
interface IssueRow {
  state: string | null;
  created_at: string | null;
  closed_at: string | null;
  author_id: string | null;
}

const cache = new Map<string, { at: number; body: WorkspaceMetricsFlat }>();

function periodDays(range: TimeRange, now: number): number {
  switch (range) {
    case '7d':
      return 7;
    case '30d':
      return 30;
    case '90d':
      return 90;
    case '1y':
      return 365;
    case 'all':
      return Math.max(1, Math.round((now - Date.UTC(2008, 0, 1)) / 86_400_000));
  }
}

function periodStart(range: TimeRange, end: Date): Date {
  const start = new Date(end);
  switch (range) {
    case '7d':
      start.setUTCDate(end.getUTCDate() - 7);
      break;
    case '30d':
      start.setUTCDate(end.getUTCDate() - 30);
      break;
    case '90d':
      start.setUTCDate(end.getUTCDate() - 90);
      break;
    case '1y':
      start.setUTCFullYear(end.getUTCFullYear() - 1);
      break;
    case 'all':
      start.setUTCFullYear(2008, 0, 1);
      break;
  }
  return start;
}

// Fetch every row of a range-paginated query, following PostgREST's 1000-row cap.
async function fetchAll<T>(
  build: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

function emptyMetrics(range: TimeRange, calculatedAt: string): WorkspaceMetricsFlat {
  return {
    time_range: range,
    total_prs: 0,
    merged_prs: 0,
    open_prs: 0,
    draft_prs: 0,
    avg_pr_merge_time_hours: null,
    pr_velocity: null,
    total_issues: 0,
    closed_issues: 0,
    open_issues: 0,
    issue_closure_rate: null,
    total_contributors: 0,
    active_contributors: 0,
    new_contributors: 0,
    total_stars: 0,
    stars_trend: null,
    prs_trend: null,
    contributors_trend: null,
    calculated_at: calculatedAt,
    is_stale: false,
    recent_open_prs: [],
    recent_open_issues: [],
  };
}

function firstOf<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function mapRecentRows(rows: RecentRow[], path: 'pull' | 'issues'): RecentItem[] {
  const items: RecentItem[] = [];
  for (const row of rows) {
    const repo = firstOf(row.repositories)?.full_name ?? null;
    const url =
      row.html_url ||
      (repo && row.number != null ? `https://github.com/${repo}/${path}/${row.number}` : null);
    if (row.number == null || !row.title || !url) continue;
    items.push({
      number: row.number,
      title: row.title,
      url,
      author: firstOf(row.contributors)?.username ?? null,
      repo,
      created_at: row.created_at ?? '',
    });
  }
  return items;
}

// Newest open PRs and issues across the workspace's repos, as clickable tray
// rows. Failures degrade to empty arrays so the metrics payload still serves.
export async function fetchRecentItems(
  supabase: SupabaseClient,
  repoIds: string[]
): Promise<{ recent_open_prs: RecentItem[]; recent_open_issues: RecentItem[] }> {
  const empty = { recent_open_prs: [], recent_open_issues: [] };
  if (repoIds.length === 0) return empty;

  const joins = 'contributors:author_id(username), repositories:repository_id(full_name)';
  // The live issues table has no html_url column, so issue URLs are always
  // built from the repo full_name and number.
  const newestOpen = (table: 'pull_requests' | 'issues', columns: string) =>
    supabase
      .from(table)
      .select(columns)
      .in('repository_id', repoIds)
      .eq('state', 'open')
      .order('created_at', { ascending: false })
      .limit(RECENT_LIMIT);

  try {
    const [prs, issues] = await Promise.all([
      newestOpen('pull_requests', `number, title, html_url, created_at, ${joins}`),
      newestOpen('issues', `number, title, created_at, ${joins}`),
    ]);
    if (prs.error) throw new Error(prs.error.message);
    if (issues.error) throw new Error(issues.error.message);
    return {
      recent_open_prs: mapRecentRows((prs.data ?? []) as unknown as RecentRow[], 'pull'),
      recent_open_issues: mapRecentRows((issues.data ?? []) as unknown as RecentRow[], 'issues'),
    };
  } catch (error) {
    console.error('recent items fetch failed: %s', error instanceof Error ? error.message : error);
    return empty;
  }
}

async function aggregate(
  supabase: SupabaseClient,
  workspaceId: string,
  range: TimeRange
): Promise<WorkspaceMetricsFlat> {
  const now = Date.now();
  const end = new Date(now);
  const start = periodStart(range, end);
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const calculatedAt = end.toISOString();

  // Repositories in the workspace.
  const repoLinks = await fetchAll<{ repository_id: string }>((from, to) =>
    supabase
      .from('workspace_repositories')
      .select('repository_id')
      .eq('workspace_id', workspaceId)
      .range(from, to)
  );
  const repoIds = repoLinks.map((r) => r.repository_id).filter(Boolean);
  if (repoIds.length === 0) {
    return emptyMetrics(range, calculatedAt);
  }

  // Stars are an absolute snapshot on the repositories row, not period-scoped.
  const repos = await fetchAll<{ stargazers_count: number | null }>((from, to) =>
    supabase.from('repositories').select('stargazers_count').in('id', repoIds).range(from, to)
  );
  const totalStars = repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);

  // PRs and issues created within the period.
  const prs = await fetchAll<PrRow>((from, to) =>
    supabase
      .from('pull_requests')
      .select('state, draft, created_at, merged_at, author_id')
      .in('repository_id', repoIds)
      .gte('created_at', startIso)
      .lte('created_at', endIso)
      .range(from, to)
  );
  const issues = await fetchAll<IssueRow>((from, to) =>
    supabase
      .from('issues')
      .select('state, created_at, closed_at, author_id')
      .in('repository_id', repoIds)
      .gte('created_at', startIso)
      .lte('created_at', endIso)
      .range(from, to)
  );

  let mergedPrs = 0;
  let openPrs = 0;
  let draftPrs = 0;
  const mergeTimesHours: number[] = [];
  const activeAuthors = new Set<string>();
  for (const pr of prs) {
    if (pr.author_id) activeAuthors.add(pr.author_id);
    if (pr.state === 'merged' && pr.merged_at && pr.created_at) {
      mergedPrs++;
      mergeTimesHours.push(
        (new Date(pr.merged_at).getTime() - new Date(pr.created_at).getTime()) / 3_600_000
      );
    } else if (pr.state === 'open') {
      openPrs++;
      if (pr.draft) draftPrs++;
    }
  }

  let closedIssues = 0;
  let openIssues = 0;
  for (const issue of issues) {
    if (issue.author_id) activeAuthors.add(issue.author_id);
    if (issue.state === 'closed' && issue.closed_at) {
      closedIssues++;
    } else if (issue.state === 'open') {
      openIssues++;
    }
  }

  const totalPrs = prs.length;
  const totalIssues = issues.length;
  const days = periodDays(range, now);
  const avgMergeHours =
    mergeTimesHours.length > 0
      ? mergeTimesHours.reduce((a, b) => a + b, 0) / mergeTimesHours.length
      : null;
  const prVelocity = days > 0 ? mergedPrs / days : null;
  const issueClosureRate = totalIssues > 0 ? (closedIssues / totalIssues) * 100 : null;

  // New contributors = active authors with no contribution before this period.
  // Bounded to the active author set, and stops early once every active author
  // is known to be returning, so it stays cheap on busy workspaces.
  const [newContributors, recentItems] = await Promise.all([
    countNewContributors(supabase, repoIds, activeAuthors, startIso),
    fetchRecentItems(supabase, repoIds),
  ]);

  return {
    time_range: range,
    total_prs: totalPrs,
    merged_prs: mergedPrs,
    open_prs: openPrs,
    draft_prs: draftPrs,
    avg_pr_merge_time_hours: avgMergeHours,
    pr_velocity: prVelocity,
    total_issues: totalIssues,
    closed_issues: closedIssues,
    open_issues: openIssues,
    issue_closure_rate: issueClosureRate,
    // Period-scoped for v1; workspace-wide all-time totals are a follow-up and
    // aren't shown in the tray tiles.
    total_contributors: activeAuthors.size,
    active_contributors: activeAuthors.size,
    new_contributors: newContributors,
    total_stars: totalStars,
    stars_trend: null,
    prs_trend: null,
    contributors_trend: null,
    calculated_at: calculatedAt,
    is_stale: false,
    ...recentItems,
  };
}

async function countNewContributors(
  supabase: SupabaseClient,
  repoIds: string[],
  activeAuthors: Set<string>,
  startIso: string
): Promise<number> {
  if (activeAuthors.size === 0) return 0;
  const authorIds = Array.from(activeAuthors);
  const returning = new Set<string>();

  const scan = async (table: 'pull_requests' | 'issues') => {
    for (let from = 0; ; from += PAGE) {
      if (returning.size === authorIds.length) return; // every active author is returning
      const { data, error } = await supabase
        .from(table)
        .select('author_id')
        .in('repository_id', repoIds)
        .in('author_id', authorIds)
        .lt('created_at', startIso)
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) break;
      for (const row of data as { author_id: string | null }[]) {
        if (row.author_id) returning.add(row.author_id);
      }
      if (data.length < PAGE) break;
    }
  };

  await scan('pull_requests');
  await scan('issues');
  return authorIds.length - returning.size;
}

export const handler: Handler = async (event: HandlerEvent, _context: HandlerContext) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const params = event.queryStringParameters || {};
    const workspaceIdParam = (params.workspace_id || '').trim();
    const slugParam = (params.slug || '').trim();
    const rangeParam = (params.time_range || '7d').trim();
    const range: TimeRange = (TIME_RANGES.has(rangeParam) ? rangeParam : '7d') as TimeRange;

    if (!workspaceIdParam && !slugParam) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Provide workspace_id or slug' }),
      };
    }

    const supabase = getSupabase();

    // Resolve the workspace and enforce that it is public. Service-role reads
    // bypass RLS, so this visibility check is what keeps private workspaces out.
    const workspaceQuery = supabase
      .from('workspaces')
      .select('id, slug, visibility, is_active')
      .eq('is_active', true)
      .limit(1);
    const { data: wsRows, error: wsError } = workspaceIdParam
      ? await workspaceQuery.eq('id', workspaceIdParam)
      : await workspaceQuery.eq('slug', slugParam);
    if (wsError) {
      throw new Error(wsError.message);
    }
    const workspace = wsRows?.[0];
    if (!workspace) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Workspace not found' }) };
    }
    if (workspace.visibility !== 'public') {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Metrics for private workspaces require authentication' }),
      };
    }

    const cacheKey = `${workspace.id}:${range}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return {
        statusCode: 200,
        headers: { ...headers, 'X-Cache': 'hit' },
        body: JSON.stringify(cached.body),
      };
    }

    const metrics = await aggregate(supabase, workspace.id, range);
    cache.set(cacheKey, { at: Date.now(), body: metrics });

    return {
      statusCode: 200,
      headers: { ...headers, 'X-Cache': 'miss' },
      body: JSON.stringify(metrics),
    };
  } catch (error) {
    console.error(
      'api-workspace-metrics failed: %s',
      error instanceof Error ? error.message : error
    );
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to compute workspace metrics' }),
    };
  }
};

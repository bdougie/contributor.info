/**
 * Repository analytics for the chat tools, read straight from Supabase.
 *
 * Replaces the gh-datapipe `/api/v1` DuckDB service (deleted with the Fly
 * scale-to-zero change). The response shapes are kept so
 * `datapipe-normalizer.mts` and the agents did not have to change.
 *
 * Every function returns null (not throws) when the data is unavailable so the
 * tools degrade gracefully.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Response types (unchanged from the old client)
// ---------------------------------------------------------------------------

export interface ContributorActivity {
  prs_opened: number;
  prs_merged: number;
  reviews_given: number;
  issues_opened: number;
}

export interface ContributorAnalytics {
  login: string;
  confidence_score: number | null;
  contribution_quality: number | null;
  activity: ContributorActivity;
}

export interface ContributorsResponse {
  repository: string;
  contributors: ContributorAnalytics[];
  total: number;
}

export interface ContributorRanking {
  login: string;
  weighted_score: number;
  rank: number;
}

export interface LotteryFactor {
  top_contributors: ContributorRanking[];
}

export interface ContributorOfMonth {
  login: string;
  score: number;
  month: string;
}

export interface HealthMetrics {
  trending_score: number;
  freshness_status: 'active' | 'stale' | 'dormant';
  is_significant_change: boolean;
}

export interface InsightsResponse {
  repository: string;
  calculated_at: string | null;
  health: HealthMetrics | null;
  lottery_factor: LotteryFactor | null;
  contributor_of_month: ContributorOfMonth | null;
}

export interface DiscoverRequest {
  language?: string;
  topic?: string;
  min_stars?: number;
  limit?: number;
}

export interface DiscoveredRepository {
  owner: string;
  name: string;
  language: string | null;
  stars: number;
  description: string | null;
}

export interface DiscoverResponse {
  config_id: string;
  repositories: DiscoveredRepository[];
}

export interface DiscoveryStatsResponse {
  config_id: string;
  total: number;
  language_breakdown: Record<string, number>;
  avg_stars: number;
}

export interface DailyActivity {
  date: string;
  prs_opened: number;
  prs_merged: number;
  reviews: number;
  issues_opened: number;
  issues_closed: number;
}

export interface ActivityResponse {
  repository: string;
  activity: DailyActivity[];
  days: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const ACTIVITY_WINDOW_DAYS = 90;
const ROW_LIMIT = 5000;

interface PullRequestRow {
  author_id: string | null;
  created_at: string;
  merged: boolean | null;
  merged_at: string | null;
}

interface ReviewRow {
  reviewer_id: string | null;
  submitted_at: string;
}

interface IssueRow {
  author_id: string | null;
  created_at: string;
  closed_at: string | null;
}

interface ContributorRow {
  id: string;
  username: string;
}

interface RepositoryRow {
  id: string;
  owner: string;
  name: string;
  language: string | null;
  stargazers_count: number | null;
  description: string | null;
}

let _client: SupabaseClient | null | undefined;

function getClient(): SupabaseClient | null {
  if (_client !== undefined) return _client;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;
  _client = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return _client;
}

/** Test hook: reset the cached client so env changes take effect. */
export function resetClient(): void {
  _client = undefined;
}

export function isConfigured(): boolean {
  return getClient() !== null;
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

async function findRepository(
  client: SupabaseClient,
  owner: string,
  repo: string
): Promise<{ id: string } | null> {
  const { data, error } = await client
    .from('repositories')
    .select('id')
    .eq('owner', owner)
    .eq('name', repo)
    .maybeSingle();
  if (error) {
    console.error('[repo-analytics] repository lookup failed: %s', error.message);
    return null;
  }
  return data ? { id: data.id as string } : null;
}

async function loadActivityRows(
  client: SupabaseClient,
  repositoryId: string,
  sinceIso: string
): Promise<{ prs: PullRequestRow[]; reviews: ReviewRow[]; issues: IssueRow[] } | null> {
  const [prs, reviews, issues] = await Promise.all([
    client
      .from('pull_requests')
      .select('author_id, created_at, merged, merged_at')
      .eq('repository_id', repositoryId)
      .gte('created_at', sinceIso)
      .limit(ROW_LIMIT),
    client
      .from('reviews')
      .select('reviewer_id, submitted_at')
      .eq('repository_id', repositoryId)
      .gte('submitted_at', sinceIso)
      .limit(ROW_LIMIT),
    client
      .from('issues')
      .select('author_id, created_at, closed_at')
      .eq('repository_id', repositoryId)
      .eq('is_pull_request', false)
      .gte('created_at', sinceIso)
      .limit(ROW_LIMIT),
  ]);

  const failed = [prs.error, reviews.error, issues.error].find(Boolean);
  if (failed) {
    console.error('[repo-analytics] activity query failed: %s', failed.message);
    return null;
  }

  return {
    prs: (prs.data ?? []) as PullRequestRow[],
    reviews: (reviews.data ?? []) as ReviewRow[],
    issues: (issues.data ?? []) as IssueRow[],
  };
}

async function loadUsernames(
  client: SupabaseClient,
  ids: Iterable<string>
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids)).filter(Boolean);
  const map = new Map<string, string>();
  if (unique.length === 0) return map;

  const { data, error } = await client.from('contributors').select('id, username').in('id', unique);
  if (error) {
    console.error('[repo-analytics] contributors lookup failed: %s', error.message);
    return map;
  }
  for (const row of (data ?? []) as ContributorRow[]) {
    map.set(row.id, row.username);
  }
  return map;
}

interface Tally {
  prs_opened: number;
  prs_merged: number;
  reviews_given: number;
  issues_opened: number;
}

function tallyByContributor(rows: {
  prs: PullRequestRow[];
  reviews: ReviewRow[];
  issues: IssueRow[];
}): Map<string, Tally> {
  const tallies = new Map<string, Tally>();
  const bump = (id: string | null, key: keyof Tally) => {
    if (!id) return;
    const t = tallies.get(id) ?? {
      prs_opened: 0,
      prs_merged: 0,
      reviews_given: 0,
      issues_opened: 0,
    };
    t[key] += 1;
    tallies.set(id, t);
  };
  for (const pr of rows.prs) {
    bump(pr.author_id, 'prs_opened');
    if (pr.merged) bump(pr.author_id, 'prs_merged');
  }
  for (const review of rows.reviews) bump(review.reviewer_id, 'reviews_given');
  for (const issue of rows.issues) bump(issue.author_id, 'issues_opened');
  return tallies;
}

/** Merged PRs count most, then reviews, then opened PRs and issues. */
function weightedScore(t: Tally): number {
  return t.prs_merged * 5 + t.reviews_given * 3 + t.prs_opened * 2 + t.issues_opened;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getContributors(
  owner: string,
  repo: string,
  limit = 20
): Promise<ContributorsResponse | null> {
  const client = getClient();
  if (!client) return null;
  const repository = await findRepository(client, owner, repo);
  if (!repository) return null;

  const rows = await loadActivityRows(client, repository.id, daysAgoIso(ACTIVITY_WINDOW_DAYS));
  if (!rows) return null;

  const tallies = tallyByContributor(rows);
  const usernames = await loadUsernames(client, tallies.keys());
  const maxScore = Math.max(1, ...Array.from(tallies.values()).map(weightedScore));

  const contributors: ContributorAnalytics[] = Array.from(tallies.entries())
    .map(([id, activity]) => ({
      login: usernames.get(id) ?? id,
      // Confidence scoring lived in the retired DuckDB service; not computed here.
      confidence_score: null,
      contribution_quality: Math.round((100 * weightedScore(activity)) / maxScore),
      activity,
    }))
    .sort((a, b) => (b.contribution_quality ?? 0) - (a.contribution_quality ?? 0));

  return {
    repository: `${owner}/${repo}`,
    contributors: contributors.slice(0, Math.min(Math.max(limit, 1), 100)),
    total: contributors.length,
  };
}

export async function getInsights(owner: string, repo: string): Promise<InsightsResponse | null> {
  const client = getClient();
  if (!client) return null;
  const repository = await findRepository(client, owner, repo);
  if (!repository) return null;

  const rows = await loadActivityRows(client, repository.id, daysAgoIso(60));
  if (!rows) return null;

  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  const recentPrs = rows.prs.filter((pr) => now - Date.parse(pr.created_at) <= thirtyDays);
  const previousPrs = rows.prs.length - recentPrs.length;
  const trendingScore =
    previousPrs === 0
      ? recentPrs.length > 0
        ? 1
        : 0
      : Number(((recentPrs.length - previousPrs) / previousPrs).toFixed(2));

  const newestPr = rows.prs.reduce<number>(
    (max, pr) => Math.max(max, Date.parse(pr.created_at)),
    0
  );
  const ageDays = newestPr ? (now - newestPr) / (24 * 60 * 60 * 1000) : Infinity;
  const freshness: HealthMetrics['freshness_status'] =
    ageDays <= 7 ? 'active' : ageDays <= 30 ? 'stale' : 'dormant';

  const merged = recentPrs.filter((pr) => pr.merged && pr.author_id);
  const mergedByAuthor = new Map<string, number>();
  for (const pr of merged) {
    mergedByAuthor.set(
      pr.author_id as string,
      (mergedByAuthor.get(pr.author_id as string) ?? 0) + 1
    );
  }
  const usernames = await loadUsernames(client, mergedByAuthor.keys());
  const totalMerged = Math.max(1, merged.length);
  const topContributors: ContributorRanking[] = Array.from(mergedByAuthor.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, count], index) => ({
      login: usernames.get(id) ?? id,
      weighted_score: Number(((100 * count) / totalMerged).toFixed(1)),
      rank: index + 1,
    }));

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const thisMonth = new Map<string, number>();
  for (const pr of merged) {
    if (Date.parse(pr.merged_at ?? pr.created_at) >= monthStart.getTime()) {
      thisMonth.set(pr.author_id as string, (thisMonth.get(pr.author_id as string) ?? 0) + 1);
    }
  }
  const top = Array.from(thisMonth.entries()).sort((a, b) => b[1] - a[1])[0];

  return {
    repository: `${owner}/${repo}`,
    calculated_at: new Date().toISOString(),
    health: {
      trending_score: trendingScore,
      freshness_status: freshness,
      is_significant_change: Math.abs(trendingScore) >= 0.5,
    },
    lottery_factor: topContributors.length > 0 ? { top_contributors: topContributors } : null,
    contributor_of_month: top
      ? {
          login: usernames.get(top[0]) ?? top[0],
          score: top[1],
          month: monthStart.toISOString().slice(0, 7),
        }
      : null,
  };
}

export async function getActivity(
  owner: string,
  repo: string,
  days = 30
): Promise<ActivityResponse | null> {
  const client = getClient();
  if (!client) return null;
  const repository = await findRepository(client, owner, repo);
  if (!repository) return null;

  const window = Math.min(Math.max(days, 1), 365);
  const rows = await loadActivityRows(client, repository.id, daysAgoIso(window));
  if (!rows) return null;

  const byDay = new Map<string, DailyActivity>();
  const day = (iso: string): DailyActivity => {
    const key = dayKey(iso);
    let entry = byDay.get(key);
    if (!entry) {
      entry = {
        date: key,
        prs_opened: 0,
        prs_merged: 0,
        reviews: 0,
        issues_opened: 0,
        issues_closed: 0,
      };
      byDay.set(key, entry);
    }
    return entry;
  };

  const since = Date.parse(daysAgoIso(window));
  for (const pr of rows.prs) {
    day(pr.created_at).prs_opened += 1;
    if (pr.merged_at && Date.parse(pr.merged_at) >= since) day(pr.merged_at).prs_merged += 1;
  }
  for (const review of rows.reviews) day(review.submitted_at).reviews += 1;
  for (const issue of rows.issues) {
    day(issue.created_at).issues_opened += 1;
    if (issue.closed_at && Date.parse(issue.closed_at) >= since)
      day(issue.closed_at).issues_closed += 1;
  }

  return {
    repository: `${owner}/${repo}`,
    activity: Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date)),
    days: window,
  };
}

function encodeConfig(config: DiscoverRequest): string {
  return Buffer.from(JSON.stringify(config)).toString('base64url');
}

function decodeConfig(configId: string): DiscoverRequest | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(configId, 'base64url').toString('utf8'));
    if (parsed && typeof parsed === 'object') return parsed as DiscoverRequest;
    return null;
  } catch {
    return null;
  }
}

async function queryDiscover(
  client: SupabaseClient,
  config: DiscoverRequest
): Promise<RepositoryRow[] | null> {
  let query = client
    .from('repositories')
    .select('id, owner, name, language, stargazers_count, description')
    .eq('is_active', true)
    .eq('is_private', false)
    .order('stargazers_count', { ascending: false, nullsFirst: false })
    .limit(Math.min(Math.max(config.limit ?? 10, 1), 50));

  if (config.language) query = query.ilike('language', config.language);
  if (typeof config.min_stars === 'number') query = query.gte('stargazers_count', config.min_stars);
  if (config.topic) {
    // Topics is a text[]; fall back to a description match for repos without topics.
    query = query.or(`topics.cs.{${config.topic}},description.ilike.%${config.topic}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[repo-analytics] discover query failed: %s', error.message);
    return null;
  }
  return (data ?? []) as RepositoryRow[];
}

export async function discoverRepos(config: DiscoverRequest): Promise<DiscoverResponse | null> {
  const client = getClient();
  if (!client) return null;
  const rows = await queryDiscover(client, config);
  if (!rows) return null;

  return {
    config_id: encodeConfig(config),
    repositories: rows.map((row) => ({
      owner: row.owner,
      name: row.name,
      language: row.language,
      stars: row.stargazers_count ?? 0,
      description: row.description,
    })),
  };
}

export async function getDiscoveryStats(configId: string): Promise<DiscoveryStatsResponse | null> {
  const client = getClient();
  if (!client) return null;
  const config = decodeConfig(configId);
  if (!config) return null;
  const rows = await queryDiscover(client, { ...config, limit: 50 });
  if (!rows) return null;

  const breakdown: Record<string, number> = {};
  let stars = 0;
  for (const row of rows) {
    const lang = row.language ?? 'unknown';
    breakdown[lang] = (breakdown[lang] ?? 0) + 1;
    stars += row.stargazers_count ?? 0;
  }

  return {
    config_id: configId,
    total: rows.length,
    language_breakdown: breakdown,
    avg_stars: rows.length ? Math.round(stars / rows.length) : 0,
  };
}

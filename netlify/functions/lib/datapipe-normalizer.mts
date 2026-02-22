/**
 * Data Normalization Layer for RAG Pipeline
 *
 * Converts structured JSON from gh-datapipe (contributors, insights, activity, discover)
 * into natural-language text chunks suitable for embedding with MiniLM (384 dims).
 *
 * Each normalizer returns a single DatapipeChunk or null when the input has no useful data.
 */

import type {
  ContributorsResponse,
  InsightsResponse,
  ActivityResponse,
  DiscoverResponse,
} from './gh-datapipe-client.mjs';

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export type DatapipeChunkSource = 'contributors' | 'insights' | 'activity' | 'discover';

export interface DatapipeChunkMetadata {
  repository: string;
  source: DatapipeChunkSource;
  generatedAt: string;
  calculatedAt: string | null;
  daysCovered: number | null;
}

export interface DatapipeChunk {
  text: string;
  metadata: DatapipeChunkMetadata;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildMetadata(
  repository: string,
  source: DatapipeChunkSource,
  opts: { calculatedAt?: string | null; daysCovered?: number | null } = {}
): DatapipeChunkMetadata {
  return {
    repository,
    source,
    generatedAt: new Date().toISOString(),
    calculatedAt: opts.calculatedAt ?? null,
    daysCovered: opts.daysCovered ?? null,
  };
}

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------

export function normalizeContributors(data: ContributorsResponse): DatapipeChunk | null {
  if (!data.contributors || data.contributors.length === 0) return null;

  const top = data.contributors.slice(0, 10);
  const lines: string[] = [`Repository ${data.repository} has ${data.total} contributors.`];

  for (const c of top) {
    const parts: string[] = [c.login];
    if (c.confidence_score !== null) parts.push(`confidence ${c.confidence_score}`);
    if (c.contribution_quality !== null) parts.push(`quality ${c.contribution_quality}`);

    const a = c.activity;
    const activityParts: string[] = [];
    if (a.prs_opened > 0) activityParts.push(`${a.prs_opened} PRs opened`);
    if (a.prs_merged > 0) activityParts.push(`${a.prs_merged} merged`);
    if (a.reviews_given > 0) activityParts.push(`${a.reviews_given} reviews`);
    if (a.issues_opened > 0) activityParts.push(`${a.issues_opened} issues`);

    if (activityParts.length > 0) parts.push(activityParts.join(', '));
    lines.push(parts.join(' - '));
  }

  return {
    text: lines.join('\n'),
    metadata: buildMetadata(data.repository, 'contributors'),
  };
}

export function normalizeInsights(data: InsightsResponse): DatapipeChunk | null {
  if (!data.health && !data.lottery_factor && !data.contributor_of_month) return null;

  const lines: string[] = [`Repository ${data.repository} insights.`];

  if (data.health) {
    lines.push(
      `Health: trending score ${data.health.trending_score}, freshness ${data.health.freshness_status}${data.health.is_significant_change ? ', significant change detected' : ''}.`
    );
  }

  if (data.lottery_factor && data.lottery_factor.top_contributors.length > 0) {
    const top = data.lottery_factor.top_contributors
      .map((c) => `${c.login} (rank ${c.rank}, score ${c.weighted_score})`)
      .join(', ');
    lines.push(`Lottery factor top contributors: ${top}.`);
  }

  if (data.contributor_of_month) {
    const com = data.contributor_of_month;
    lines.push(`Contributor of the month for ${com.month}: ${com.login} with score ${com.score}.`);
  }

  return {
    text: lines.join('\n'),
    metadata: buildMetadata(data.repository, 'insights', {
      calculatedAt: data.calculated_at,
    }),
  };
}

export function normalizeActivity(data: ActivityResponse): DatapipeChunk | null {
  if (!data.activity || data.activity.length === 0) return null;

  let totalPRsOpened = 0;
  let totalPRsMerged = 0;
  let totalReviews = 0;
  let totalIssuesOpened = 0;
  let totalIssuesClosed = 0;

  let mostActiveDay = data.activity[0];
  let leastActiveDay = data.activity[0];
  let mostActiveTotal = 0;
  let leastActiveTotal = Infinity;

  for (const day of data.activity) {
    totalPRsOpened += day.prs_opened;
    totalPRsMerged += day.prs_merged;
    totalReviews += day.reviews;
    totalIssuesOpened += day.issues_opened;
    totalIssuesClosed += day.issues_closed;

    const dayTotal =
      day.prs_opened + day.prs_merged + day.reviews + day.issues_opened + day.issues_closed;
    if (dayTotal > mostActiveTotal) {
      mostActiveTotal = dayTotal;
      mostActiveDay = day;
    }
    if (dayTotal < leastActiveTotal) {
      leastActiveTotal = dayTotal;
      leastActiveDay = day;
    }
  }

  const lines: string[] = [
    `Repository ${data.repository} activity over ${data.days} days.`,
    `Totals: ${totalPRsOpened} PRs opened, ${totalPRsMerged} merged, ${totalReviews} reviews, ${totalIssuesOpened} issues opened, ${totalIssuesClosed} issues closed.`,
    `Most active day: ${mostActiveDay.date} with ${mostActiveTotal} events.`,
    `Least active day: ${leastActiveDay.date} with ${leastActiveTotal} events.`,
  ];

  return {
    text: lines.join('\n'),
    metadata: buildMetadata(data.repository, 'activity', {
      daysCovered: data.days,
    }),
  };
}

export function normalizeDiscover(data: DiscoverResponse): DatapipeChunk | null {
  if (!data.repositories || data.repositories.length === 0) return null;

  const repos = data.repositories.slice(0, 15);
  const lines: string[] = [`Discovered repositories (config ${data.config_id}).`];

  for (const r of repos) {
    const parts: string[] = [`${r.owner}/${r.name}`];
    if (r.language) parts.push(r.language);
    parts.push(`${r.stars} stars`);
    if (r.description) parts.push(r.description);
    lines.push(parts.join(' - '));
  }

  return {
    text: lines.join('\n'),
    metadata: buildMetadata(`discovery/${data.config_id}`, 'discover'),
  };
}

// ---------------------------------------------------------------------------
// Batch normalizer
// ---------------------------------------------------------------------------

interface NormalizeAllInput {
  contributors?: ContributorsResponse | null;
  insights?: InsightsResponse | null;
  activity?: ActivityResponse | null;
  discover?: DiscoverResponse | null;
}

export function normalizeAll(input: NormalizeAllInput): DatapipeChunk[] {
  const chunks: DatapipeChunk[] = [];

  if (input.contributors) {
    const chunk = normalizeContributors(input.contributors);
    if (chunk) chunks.push(chunk);
  }

  if (input.insights) {
    const chunk = normalizeInsights(input.insights);
    if (chunk) chunks.push(chunk);
  }

  if (input.activity) {
    const chunk = normalizeActivity(input.activity);
    if (chunk) chunks.push(chunk);
  }

  if (input.discover) {
    const chunk = normalizeDiscover(input.discover);
    if (chunk) chunks.push(chunk);
  }

  return chunks;
}

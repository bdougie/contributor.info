/**
 * `sync-router/*` jobs: the lightweight GraphQL sync paths the Netlify
 * sync-router function queues. Moved unchanged from process-job/index.ts.
 */

import { GraphQLClient } from '../graphql-client.ts';
import { asNumber, asString, NonRetriableJobError } from './types.ts';
import type { JobContext, JobPayload, JobResult } from './types.ts';

/** Resolve owner/name from either a "owner/name" string or separate fields. */
export function splitRepository(payload: JobPayload): [string, string] {
  const repository = asString(payload.repository);
  const owner = asString(payload.owner);
  const name = asString(payload.name) ?? asString(payload.repo);
  const [repoOwner, repoName] = repository ? repository.split('/') : [owner, name];
  if (!repoOwner || !repoName) {
    throw new NonRetriableJobError('Job payload must include repository or owner and name');
  }
  return [repoOwner, repoName];
}

async function ensureRepositoryId(ctx: JobContext, owner: string, repo: string): Promise<string> {
  const fullName = `${owner}/${repo}`;
  const { data: existing } = await ctx.supabase.from('repositories').select('id').eq(
    'full_name',
    fullName,
  ).maybeSingle();
  if (existing?.id) return existing.id;
  const { data: created, error } = await ctx.supabase
    .from('repositories')
    .insert({ full_name: fullName, owner, name: repo, first_tracked_at: new Date().toISOString() })
    .select('id')
    .maybeSingle();
  if (error || !created) {
    throw new Error(`Failed to create repository ${fullName}: ${error?.message}`);
  }
  return created.id;
}

async function syncRepositoryWithGraphQL(
  ctx: JobContext,
  repositoryId: string,
  owner: string,
  repo: string,
  days: number,
): Promise<JobResult> {
  if (!ctx.githubToken) throw new NonRetriableJobError('GitHub token not configured');
  const client = new GraphQLClient();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const prs = await client.getRecentPRs(owner, repo, since.toISOString(), 100);
  const prRecords = prs.map((pr) => ({
    repository_id: repositoryId,
    pr_number: pr.number,
    github_id: pr.databaseId,
    title: pr.title,
    state: pr.state,
    is_draft: pr.isDraft,
    created_at: pr.createdAt,
    updated_at: pr.updatedAt,
    closed_at: pr.closedAt,
    merged_at: pr.mergedAt,
    author_login: pr.author?.login,
    author_id: pr.author?.databaseId,
    base_branch: pr.baseRefName,
    head_branch: pr.headRefName,
    additions: pr.additions,
    deletions: pr.deletions,
    changed_files: pr.changedFiles,
    commit_count: pr.commits?.totalCount || 0,
  }));

  const { error: prError } = await ctx.supabase.from('pull_requests').upsert(prRecords, {
    onConflict: 'repository_id,pr_number',
    ignoreDuplicates: false,
  });
  if (prError) throw prError;

  await ctx.supabase
    .from('repositories')
    .update({
      last_synced_at: new Date().toISOString(),
      sync_status: 'completed',
      total_pull_requests: prRecords.length,
    })
    .eq('id', repositoryId);

  return { repositoryId, prsProcessed: prRecords.length, metrics: client.getMetrics() };
}

export async function syncRepositoryGraphQLJob(
  ctx: JobContext,
  payload: JobPayload,
): Promise<JobResult> {
  const [owner, repo] = splitRepository(payload);
  const days = asNumber(payload.daysLimit) ?? asNumber(payload.days) ?? 30;
  const repositoryId = await ensureRepositoryId(ctx, owner, repo);
  return syncRepositoryWithGraphQL(ctx, repositoryId, owner, repo, days);
}

export async function syncRepositoryBasicJob(
  ctx: JobContext,
  payload: JobPayload,
): Promise<JobResult> {
  if (!ctx.githubToken) throw new NonRetriableJobError('GitHub token not configured');
  const [owner, repo] = splitRepository(payload);
  const fullSync = payload.fullSync === true;
  const daysLimit = asNumber(payload.daysLimit) ?? 30;
  const repositoryId = await ensureRepositoryId(ctx, owner, repo);

  const client = new GraphQLClient();
  const since = new Date();
  since.setDate(since.getDate() - daysLimit);
  const prs = await client.getRecentPRs(owner, repo, since.toISOString(), fullSync ? 500 : 100);

  if (prs.length > 0) {
    const prRecords = prs.map((pr) => ({
      repository_id: repositoryId,
      pr_number: pr.number,
      title: pr.title,
      state: pr.state,
      created_at: pr.createdAt,
      updated_at: pr.updatedAt,
      author_login: pr.author?.login,
    }));
    await ctx.supabase.from('pull_requests').upsert(prRecords, {
      onConflict: 'repository_id,pr_number',
      ignoreDuplicates: false,
    });
  }

  return {
    repositoryId,
    repository: `${owner}/${repo}`,
    pullRequests: prs.length,
    syncType: fullSync ? 'full' : 'partial',
    daysLimit,
  };
}

export async function prDetailsBatchJob(ctx: JobContext, payload: JobPayload): Promise<JobResult> {
  if (!ctx.githubToken) throw new NonRetriableJobError('GitHub token not configured');
  const [owner, repo] = splitRepository(payload);
  const prNumbers = Array.isArray(payload.prNumbers)
    ? payload.prNumbers.filter((n): n is number => typeof n === 'number')
    : [];
  if (prNumbers.length === 0) {
    throw new NonRetriableJobError('sync-router/pr.details.batch requires prNumbers');
  }

  const client = new GraphQLClient();
  const details = [];
  for (const prNumber of prNumbers) {
    try {
      details.push(await client.getPRDetails(owner, repo, prNumber));
    } catch (error) {
      console.error(
        'Failed to fetch PR #%d: %s',
        prNumber,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
  return { owner, repo, fetched: details.length, total: prNumbers.length, details };
}

/** webhook/* rows belong to process-webhook; acknowledge if one lands here. */
export function webhookFallbackJob(_ctx: JobContext, payload: JobPayload): Promise<JobResult> {
  return Promise.resolve({
    processed: true,
    type: asString(payload.event) ?? 'unknown',
    message: 'Webhook processed (fallback handler)',
  });
}

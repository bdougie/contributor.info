/**
 * `cron/refresh-repository-metadata`: refresh stars/forks/issues/watchers for
 * active public repositories from the GitHub REST API. Ported from
 * src/lib/inngest/functions/refresh-repository-metadata-cron.ts, minus its
 * step 3 (one `capture/repository.events` per repository): the gh-datapipe
 * hourly-sync machine already keeps github_events_cache current, and that
 * fan-out would have started one Fly machine per repository every night.
 */

import { fetchGitHubAPI, GITHUB_API_BASE } from '../github.ts';
import { NonRetriableJobError } from './types.ts';
import type { JobContext, JobPayload, JobResult } from './types.ts';

const MAX_PER_RUN = 300;

interface RepositoryRow {
  id: string;
  owner: string;
  name: string;
}

interface GitHubRepoResponse {
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  watchers_count: number;
}

export async function refreshRepositoryMetadata(
  ctx: JobContext,
  _payload: JobPayload,
): Promise<JobResult> {
  if (!ctx.githubToken) throw new NonRetriableJobError('GitHub token not configured');

  const { data, error } = await ctx.supabase
    .from('repositories')
    .select('id, owner, name')
    .eq('is_private', false)
    .eq('is_active', true)
    .order('stargazers_count', { ascending: false })
    .limit(MAX_PER_RUN);
  if (error) throw new Error(`Failed to fetch repositories: ${error.message}`);

  const repositories = (data ?? []) as RepositoryRow[];
  let refreshed = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (const repo of repositories) {
    if (ctx.remainingMs() < 15_000) {
      skipped = repositories.length - refreshed - failures.length;
      console.warn('[metadata] out of time, %d repositories left for the next run', skipped);
      break;
    }
    try {
      const gh = await fetchGitHubAPI<GitHubRepoResponse>(
        `${GITHUB_API_BASE}/repos/${repo.owner}/${repo.name}`,
        ctx.githubToken,
      );
      const { error: updateError } = await ctx.supabase
        .from('repositories')
        .update({
          stargazers_count: gh.stargazers_count,
          forks_count: gh.forks_count,
          open_issues_count: gh.open_issues_count,
          watchers_count: gh.watchers_count,
          last_updated_at: new Date().toISOString(),
        })
        .eq('id', repo.id);
      if (updateError) throw new Error(updateError.message);
      refreshed++;
    } catch (err) {
      failures.push(
        `${repo.owner}/${repo.name}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  console.log('[metadata] refreshed %d/%d repositories', refreshed, repositories.length);
  return {
    repositories: repositories.length,
    refreshed,
    skipped,
    failed: failures.length,
    failures: failures.slice(0, 20),
  };
}

/**
 * Stats lookups for social cards. Every fetch races a short timeout and
 * degrades to null (rendered as zeros) — the card endpoint must answer
 * inside a crawler's budget even when the database is slow. Renders are
 * rare thanks to durable CDN caching, so a miss here only affects one
 * render, not every share.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { GlobalCardStats, RepoCardStats } from './card-generator.ts';

const DB_TIMEOUT_MS = 1500;

function withTimeout<T>(promise: Promise<T>): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), DB_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function fetchRepoStats(
  supabase: SupabaseClient,
  owner: string,
  repo: string
): Promise<RepoCardStats | null> {
  try {
    return await withTimeout(
      (async (): Promise<RepoCardStats | null> => {
        const { data: repoData, error } = await supabase
          .from('repositories')
          .select('id, contributors(count)')
          .eq('owner', owner)
          .eq('name', repo)
          .eq('is_private', false)
          .maybeSingle();

        if (error || !repoData) return null;

        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const [{ count: weeklyPRs }, { data: activeContribs }] = await Promise.all([
          supabase
            .from('pull_requests')
            .select('*', { count: 'exact', head: true })
            .eq('repository_id', repoData.id)
            .gte('created_at', oneWeekAgo.toISOString()),
          supabase
            .from('pull_requests')
            .select('author_id')
            .eq('repository_id', repoData.id)
            .gte('created_at', thirtyDaysAgo.toISOString()),
        ]);

        const uniqueActiveContributors = new Set(
          (activeContribs ?? []).map((pr: { author_id: string }) => pr.author_id)
        );

        return {
          weeklyPRVolume: weeklyPRs ?? 0,
          activeContributors: uniqueActiveContributors.size,
          totalContributors: repoData.contributors?.[0]?.count ?? 0,
        };
      })()
    );
  } catch {
    return null;
  }
}

export async function fetchGlobalStats(supabase: SupabaseClient): Promise<GlobalCardStats | null> {
  try {
    return await withTimeout(
      (async (): Promise<GlobalCardStats> => {
        const [repoCount, contribCount, prCount] = await Promise.all([
          supabase.from('repositories').select('*', { count: 'exact', head: true }),
          supabase.from('contributors').select('*', { count: 'exact', head: true }),
          supabase.from('pull_requests').select('*', { count: 'exact', head: true }),
        ]);

        return {
          repositories: repoCount.count ?? 0,
          contributors: contribCount.count ?? 0,
          pullRequests: prCount.count ?? 0,
        };
      })()
    );
  } catch {
    return null;
  }
}

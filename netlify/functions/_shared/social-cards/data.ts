/**
 * Stats lookups for social cards. Every fetch races a short timeout and
 * degrades to null (rendered as zeros) — the card endpoint must answer
 * inside a crawler's budget even when the database is slow. Renders are
 * rare thanks to durable CDN caching, so a miss here only affects one
 * render, not every share.
 *
 * Repo stats derive from pull_requests only (direct repository_id FK) —
 * the previous `contributors(count)` embed on repositories has no direct
 * relationship to traverse and failed silently.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { GlobalCardStats, RepoCardStats } from './card-generator.ts';

const DB_TIMEOUT_MS = 1500;

// PostgREST caps row responses (~1000); ordering newest-first keeps the
// recent windows accurate and only undercounts the 6-month contributor
// total on extremely busy repos.
const PR_SAMPLE_LIMIT = 1000;

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
        const { data: repoData, error: repoError } = await supabase
          .from('repositories')
          .select('id')
          .eq('owner', owner)
          .eq('name', repo)
          .not('is_private', 'is', true)
          .maybeSingle();

        if (repoError) {
          console.error('social-cards repo lookup failed: %s', repoError.message);
          return null;
        }
        if (!repoData) return null;

        const now = new Date();
        const oneWeekAgo = new Date(now);
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const sixMonthsAgo = new Date(now);
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const [weekly, recent] = await Promise.all([
          supabase
            .from('pull_requests')
            .select('*', { count: 'exact', head: true })
            .eq('repository_id', repoData.id)
            .gte('created_at', oneWeekAgo.toISOString()),
          supabase
            .from('pull_requests')
            .select('author_id, created_at')
            .eq('repository_id', repoData.id)
            .gte('created_at', sixMonthsAgo.toISOString())
            .order('created_at', { ascending: false })
            .limit(PR_SAMPLE_LIMIT),
        ]);

        if (weekly.error) {
          console.error('social-cards weekly PR count failed: %s', weekly.error.message);
        }
        if (recent.error) {
          console.error('social-cards PR author fetch failed: %s', recent.error.message);
        }

        const rows = (recent.data ?? []) as { author_id: string; created_at: string }[];
        const activeAuthors = new Set<string>();
        const totalAuthors = new Set<string>();
        const activeCutoff = thirtyDaysAgo.toISOString();
        for (const row of rows) {
          totalAuthors.add(row.author_id);
          if (row.created_at >= activeCutoff) activeAuthors.add(row.author_id);
        }

        return {
          weeklyPRVolume: weekly.count ?? 0,
          activeContributors: activeAuthors.size,
          totalContributors: totalAuthors.size,
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
      (async (): Promise<GlobalCardStats | null> => {
        // Estimated counts (pg_class statistics) — instant, and plenty
        // accurate for a "50K+" style social card.
        const [repoCount, contribCount, prCount] = await Promise.all([
          supabase.from('repositories').select('*', { count: 'estimated', head: true }),
          supabase.from('contributors').select('*', { count: 'estimated', head: true }),
          supabase.from('pull_requests').select('*', { count: 'estimated', head: true }),
        ]);

        for (const [name, result] of [
          ['repositories', repoCount],
          ['contributors', contribCount],
          ['pull_requests', prCount],
        ] as const) {
          if (result.error) {
            console.error('social-cards %s count failed: %s', name, result.error.message);
          }
        }
        if (repoCount.error && contribCount.error && prCount.error) return null;

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

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

const DB_TIMEOUT_MS = 2500;
const TOP_CONTRIBUTOR_COUNT = 5;

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

export interface RepoCardData {
  stats: RepoCardStats | null;
  /** Top contributors' avatar URLs, most PRs (6 months) first. */
  avatarUrls: string[];
}

// The contributor embed on pull_requests can come back as an object or a
// one-element array depending on how PostgREST resolves the relationship.
interface EmbeddedContributor {
  username: string;
  avatar_url: string | null;
}

function embeddedContributor(
  value: EmbeddedContributor | EmbeddedContributor[] | null
): EmbeddedContributor | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export async function fetchRepoCardData(
  supabase: SupabaseClient,
  owner: string,
  repo: string
): Promise<RepoCardData> {
  try {
    const result = await withTimeout(
      (async (): Promise<RepoCardData | null> => {
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
        if (!repoData) return { stats: null, avatarUrls: [] };

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
            // Same contributor embed the app's repo pages use — resolved in
            // one query, no separate lookup to fail or time out.
            .select('author_id, created_at, contributors:author_id(username, avatar_url)')
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

        const rows = (recent.data ?? []) as unknown as {
          author_id: string;
          created_at: string;
          contributors: EmbeddedContributor | EmbeddedContributor[] | null;
        }[];
        const activeAuthors = new Set<string>();
        const prCounts = new Map<string, number>();
        const authorContributor = new Map<string, EmbeddedContributor>();
        const activeCutoff = thirtyDaysAgo.toISOString();
        for (const row of rows) {
          prCounts.set(row.author_id, (prCounts.get(row.author_id) ?? 0) + 1);
          if (row.created_at >= activeCutoff) activeAuthors.add(row.author_id);
          const contributor = embeddedContributor(row.contributors);
          if (contributor && !authorContributor.has(row.author_id)) {
            authorContributor.set(row.author_id, contributor);
          }
        }

        // avatar_url is not populated for every contributor; GitHub serves
        // any account's avatar at github.com/{username}.png as a fallback.
        const avatarUrls = [...prCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, TOP_CONTRIBUTOR_COUNT)
          .map(([id]) => authorContributor.get(id))
          .filter((c): c is EmbeddedContributor => c !== undefined)
          .map((c) => c.avatar_url || `https://github.com/${encodeURIComponent(c.username)}.png`);

        return {
          stats: {
            weeklyPRVolume: weekly.count ?? 0,
            activeContributors: activeAuthors.size,
            totalContributors: prCounts.size,
          },
          avatarUrls,
        };
      })()
    );
    return result ?? { stats: null, avatarUrls: [] };
  } catch {
    return { stats: null, avatarUrls: [] };
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

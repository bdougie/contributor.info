import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from './use-current-user';
import { getGitHubSession } from '@/lib/auth/github-session';
import { getSupabase } from '@/lib/supabase-lazy';
import { EPHEMERAL_QUERY_META } from '@/lib/query-client';
import { fetchGitHubWorkCategory } from '@/lib/workspace/github-my-work';
import {
  beginWorkScan,
  getWorkInbox,
  inboxError,
  markWorkRead,
  toWorkSnapshot,
  WorkInboxUnavailableError,
  type WorkInboxCategory,
  type WorkInboxItem,
} from '@/lib/notifications/work-inbox';

const categories: WorkInboxCategory[] = ['awaiting_reply', 'review_requested'];
/** GitHub search shares a 30 requests/minute budget with the workspace Priority tab. */
const SCAN_INTERVAL_MS = 5 * 60_000;

export function useWorkInbox() {
  const { user } = useCurrentUser();
  const client = useQueryClient();
  const identity = [user?.id, user?.last_sign_in_at];
  const inboxKey = ['work-inbox', ...identity];
  const scope = useQuery({
    queryKey: ['work-inbox-scope', ...identity],
    queryFn: beginWorkScan,
    enabled: !!user,
    staleTime: 60_000,
    gcTime: 0,
    meta: EPHEMERAL_QUERY_META,
    retry: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 120_000,
    refetchIntervalInBackground: false,
  });
  const eligible = !!user && (scope.data?.workspace_count || 0) > 0;
  // Scans are keyed by repository membership, not by scan time, so scope refetches
  // reuse the last scan until it is stale instead of restarting GitHub searches.
  const repositoryIds = (scope.data?.repositories || []).map((repo) => repo.id).sort();
  const scans = useQueries({
    queries: categories.map((category) => ({
      queryKey: ['work-inbox-scan', ...identity, repositoryIds, category],
      enabled: eligible && repositoryIds.length > 0,
      gcTime: 0,
      staleTime: SCAN_INTERVAL_MS,
      meta: EPHEMERAL_QUERY_META,
      retry: false,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchInterval: SCAN_INTERVAL_MS,
      refetchIntervalInBackground: false,
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        const session = await getGitHubSession(user?.id);
        if (!session?.provider_token)
          throw new Error('Sign in again from the account menu to check new work.');
        // A fresh server timestamp and repository list order concurrent tabs and
        // reflect workspace membership at scan time, not when the scope was cached.
        const scan = await beginWorkScan();
        if (scan.workspace_count === 0 || scan.repositories.length === 0) return false;
        const result = await fetchGitHubWorkCategory({
          token: session.provider_token,
          repositories: scan.repositories.map((repo) => repo.full_name),
          category,
          signal,
        });
        signal.throwIfAborted();
        // Recheck identity once between the network fetch and the persisted writes.
        await getGitHubSession(user?.id);
        const unavailable = new Set(result.unavailableRepositories.map((n) => n.toLowerCase()));
        const incomplete = new Set(result.incompleteRepositories);
        // An unattributed partial result must not resolve work anywhere.
        const allIncomplete = result.incomplete && incomplete.size === 0;
        const db = await getSupabase();
        const writable = scan.repositories.filter(
          (repo) => !unavailable.has(repo.full_name.toLowerCase())
        );
        const writes = await Promise.allSettled(
          writable.map(async (repo) => {
            const name = repo.full_name.toLowerCase();
            const { error } = await db.rpc('record_workspace_work_snapshot', {
              p_repository_id: repo.id,
              p_category: category,
              p_observed_at: scan.observed_at,
              p_items: toWorkSnapshot(
                result.items.filter((item) => item.repository.toLowerCase() === name),
                category
              ),
              p_complete: !allIncomplete && !incomplete.has(name),
            });
            if (error) throw inboxError(error);
          })
        );
        // Repositories that saved are visible even when a sibling failed.
        await client.invalidateQueries({ queryKey: inboxKey });
        const failures = writes.flatMap((write, index) =>
          write.status === 'rejected'
            ? [{ repository: writable[index].full_name, error: write.reason as Error }]
            : []
        );
        const setup = failures.find(
          (failure) => failure.error instanceof WorkInboxUnavailableError
        );
        if (setup) throw setup.error;
        if (failures.length) {
          const names = failures.map((failure) => failure.repository).join(', ');
          throw new Error(`Could not save work for ${names}: ${failures[0].error.message}`);
        }
        return result.incomplete || unavailable.size > 0;
      },
    })),
  });
  const inbox = useQuery({
    queryKey: inboxKey,
    queryFn: getWorkInbox,
    enabled: eligible,
    staleTime: 30_000,
    gcTime: 0,
    meta: EPHEMERAL_QUERY_META,
    retry: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const errors = [scope.error, inbox.error, ...scans.map((scan) => scan.error)].filter(
    (error): error is Error => !!error
  );
  const items = eligible ? inbox.data?.items || [] : [];
  // The first scan for this repository set is part of loading; later refetches are not.
  const firstScan = !items.length && scans.some((scan) => scan.isLoading);

  return {
    eligible,
    signedIn: !!user,
    items,
    unreadCount: eligible ? inbox.data?.unreadCount || 0 : 0,
    loading: !!user && (scope.isLoading || inbox.isLoading || firstScan),
    refreshing: scope.isFetching || scans.some((scan) => scan.isFetching),
    unavailable: errors.some((error) => error instanceof WorkInboxUnavailableError),
    errors: errors
      .filter((error) => !(error instanceof WorkInboxUnavailableError))
      .map((error) => error.message),
    incomplete: scans.some((scan) => scan.data),
    refresh: () => {
      void scope.refetch();
      if (!eligible) return;
      void inbox.refetch();
      for (const scan of scans) void scan.refetch();
    },
    markAsRead: async (item: WorkInboxItem) => {
      await getGitHubSession(user?.id);
      await markWorkRead(item);
      await client.invalidateQueries({ queryKey: inboxKey });
    },
  };
}

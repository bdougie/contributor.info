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
  const repositories = scope.data?.repositories || [];
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
  const scans = useQueries({
    queries: categories.map((category) => ({
      queryKey: ['work-inbox-scan', ...identity, scope.data?.observed_at, category],
      enabled: eligible && repositories.length > 0 && !scope.isFetching && !scope.isError,
      gcTime: 0,
      staleTime: Infinity,
      meta: EPHEMERAL_QUERY_META,
      retry: false,
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        const session = await getGitHubSession(user?.id);
        if (!session?.provider_token)
          throw new Error('Sign in again from the account menu to check new work.');
        const result = await fetchGitHubWorkCategory({
          token: session.provider_token,
          repositories: repositories.map((repo) => repo.full_name),
          category,
          signal,
        });
        signal.throwIfAborted();
        const db = await getSupabase();
        for (const repo of repositories) {
          if (
            result.unavailableRepositories.some(
              (name) => name.toLowerCase() === repo.full_name.toLowerCase()
            )
          )
            continue;
          signal.throwIfAborted();
          // Recheck identity before persisted writes, not just before the network fetch.
          await getGitHubSession(user?.id);
          const { error } = await db.rpc('record_workspace_work_snapshot', {
            p_repository_id: repo.id,
            p_category: category,
            p_observed_at: scope.data!.observed_at,
            p_items: toWorkSnapshot(
              result.items.filter(
                (item) => item.repository.toLowerCase() === repo.full_name.toLowerCase()
              ),
              category
            ),
            p_complete: !result.incomplete,
          });
          if (error) throw inboxError(error);
        }
        await client.invalidateQueries({ queryKey: inboxKey });
        return result.incomplete || result.unavailableRepositories.length > 0;
      },
    })),
  });

  const errors = [scope.error, inbox.error, ...scans.map((scan) => scan.error)].filter(
    (error): error is Error => !!error
  );

  return {
    eligible,
    signedIn: !!user,
    items: eligible ? inbox.data?.items || [] : [],
    unreadCount: eligible ? inbox.data?.unreadCount || 0 : 0,
    loading: !!user && (scope.isLoading || inbox.isLoading),
    refreshing: scope.isFetching || scans.some((scan) => scan.isFetching),
    unavailable: errors.some((error) => error instanceof WorkInboxUnavailableError),
    errors: errors
      .filter((error) => !(error instanceof WorkInboxUnavailableError))
      .map((error) => error.message),
    incomplete: scans.some((scan) => scan.data),
    refresh: () => {
      void scope.refetch();
      if (eligible) void inbox.refetch();
    },
    markAsRead: async (item: WorkInboxItem) => {
      await getGitHubSession(user?.id);
      await markWorkRead(item);
      await client.invalidateQueries({ queryKey: inboxKey });
    },
  };
}

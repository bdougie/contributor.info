import { useQueries } from '@tanstack/react-query';
import { useCurrentUser } from './use-current-user';
import { getGitHubSession } from '@/lib/auth/github-session';
import { EPHEMERAL_QUERY_META } from '@/lib/query-client';
import {
  fetchGitHubWorkCategory,
  GitHubWorkError,
  mergeGitHubWork,
  workCategoryLabels,
  type GitHubWorkCategory,
} from '@/lib/workspace/github-my-work';

export interface UseGitHubWorkspaceWorkOptions {
  /**
   * Gates the GitHub Search requests. The overview card passes `false` until it is
   * near the viewport or the browser is idle so the four searches stay off the
   * critical path of the workspace's first paint.
   * @default true
   */
  enabled?: boolean;
}

export function useGitHubWorkspaceWork(
  workspaceId: string,
  repositories: string[],
  { enabled = true }: UseGitHubWorkspaceWorkOptions = {}
) {
  const { user, loading: authLoading } = useCurrentUser();
  const scope = [...new Set(repositories)].sort();
  const categories = Object.keys(workCategoryLabels) as GitHubWorkCategory[];
  // The shared client keeps focus and reconnect refetching wired up. The ephemeral
  // meta keeps personal work out of the persisted offline cache, while a gcTime equal
  // to staleTime lets a tab switch and back within a minute reuse the in-memory
  // results instead of hitting GitHub Search again.
  const results = useQueries({
    queries: categories.map((category) => ({
      queryKey: ['github-work', user?.id, user?.last_sign_in_at, workspaceId, scope, category],
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        const session = await getGitHubSession(user?.id);
        if (!session?.provider_token) {
          throw new GitHubWorkError(
            'Your saved sign-in session is missing its GitHub token. Sign in again from the account menu to restore it.'
          );
        }
        return fetchGitHubWorkCategory({
          token: session.provider_token,
          repositories: scope,
          category,
          signal,
        });
      },
      meta: EPHEMERAL_QUERY_META,
      enabled: enabled && !authLoading && !!user && !!workspaceId && scope.length > 0,
      staleTime: 60_000,
      gcTime: 60_000,
      retry: false,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    })),
  });

  const items = user ? mergeGitHubWork(results.flatMap((result) => result.data?.items || [])) : [];
  // A query that is only waiting for the caller's gate still has nothing to show, so
  // it reports as loading rather than as an empty result.
  const waitingForGate = !enabled && !!user && results.some((result) => result.isPending);
  const unavailableRepositories = [
    ...new Set(results.flatMap((result) => result.data?.unavailableRepositories || [])),
  ].sort();
  return {
    items,
    signedIn: !!user,
    loading: authLoading || waitingForGate || results.some((result) => result.isLoading),
    refreshing: results.some((result) => result.isFetching),
    errors: results.flatMap((result, index) =>
      result.error ? [`${workCategoryLabels[categories[index]]}: ${result.error.message}`] : []
    ),
    incomplete: results.some((result) => result.data?.incomplete),
    unavailableRepositories,
    hasCachedResults: results.some((result) => result.data && result.error),
    refresh: () =>
      results.forEach((result) => {
        void result.refetch();
      }),
  };
}

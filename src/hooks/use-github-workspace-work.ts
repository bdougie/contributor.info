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

export function useGitHubWorkspaceWork(workspaceId: string, repositories: string[]) {
  const { user, loading: authLoading } = useCurrentUser();
  const scope = [...new Set(repositories)].sort();
  const categories = Object.keys(workCategoryLabels) as GitHubWorkCategory[];
  // The shared client keeps focus and reconnect refetching wired up; the ephemeral
  // meta and zero gcTime keep personal work out of the persisted offline cache.
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
      enabled: !authLoading && !!user && !!workspaceId && scope.length > 0,
      staleTime: 60_000,
      gcTime: 0,
      retry: false,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    })),
  });

  const items = user ? mergeGitHubWork(results.flatMap((result) => result.data?.items || [])) : [];
  const unavailableRepositories = [
    ...new Set(results.flatMap((result) => result.data?.unavailableRepositories || [])),
  ].sort();
  return {
    items,
    signedIn: !!user,
    loading: authLoading || results.some((result) => result.isLoading),
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

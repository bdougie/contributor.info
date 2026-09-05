import { useEffect, useState } from 'react';
import { QueryClient, useQueries } from '@tanstack/react-query';
import { useCurrentUser } from './use-current-user';
import { getGitHubSession } from '@/lib/auth/github-session';
import {
  fetchGitHubWorkCategory,
  GitHubWorkError,
  mergeGitHubWork,
  workCategoryLabels,
  type GitHubWorkCategory,
} from '@/lib/workspace/github-my-work';

export function useGitHubWorkspaceWork(workspaceId: string, repositories: string[]) {
  const { user, loading: authLoading } = useCurrentUser();
  // Personal work must not enter the application's persisted offline query cache.
  const [client] = useState(() => new QueryClient());
  useEffect(() => () => client.clear(), [client]);
  const scope = [...new Set(repositories)].sort();
  const categories = Object.keys(workCategoryLabels) as GitHubWorkCategory[];
  const results = useQueries(
    {
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
        enabled: !authLoading && !!user && !!workspaceId && scope.length > 0,
        staleTime: 60_000,
        gcTime: 0,
        retry: false,
        refetchOnWindowFocus: true,
      })),
    },
    client
  );

  const items = user ? mergeGitHubWork(results.flatMap((result) => result.data?.items || [])) : [];
  return {
    items,
    signedIn: !!user,
    loading: authLoading || results.some((result) => result.isLoading),
    refreshing: results.some((result) => result.isFetching),
    errors: results.flatMap((result, index) =>
      result.error ? [`${workCategoryLabels[categories[index]]}: ${result.error.message}`] : []
    ),
    incomplete: results.some((result) => result.data?.incomplete),
    hasCachedResults: results.some((result) => result.data && result.error),
    refresh: () =>
      results.forEach((result) => {
        void result.refetch();
      }),
  };
}

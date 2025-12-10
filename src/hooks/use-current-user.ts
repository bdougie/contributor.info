import { useCachedAuth } from '@/hooks/use-cached-auth';

/**
 * Hook to get the current authenticated user
 *
 * This is a thin wrapper around useCachedAuth for backwards compatibility.
 * Uses React Query for automatic request deduplication - multiple components
 * using this hook will share the same cached auth state.
 *
 * @see https://github.com/bdougie/contributor.info/issues/1188
 */
export function useCurrentUser() {
  const { user, isLoading } = useCachedAuth();

  return { user, loading: isLoading };
}

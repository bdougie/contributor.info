import { QueryClient } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

/**
 * Query meta that keeps a query out of the localStorage persister.
 * Use it for personal or per-session data such as live GitHub work.
 */
export const EPHEMERAL_QUERY_META = { persist: false } as const;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes
    },
  },
});

// Create a persister using localStorage
// Only initialize if window is defined (browser environment)
// Deferred to avoid blocking LCP - persistence can happen after initial render
if (typeof window !== 'undefined') {
  const initializePersistence = () => {
    const localStoragePersister = createSyncStoragePersister({
      storage: window.localStorage,
      key: 'REACT_QUERY_OFFLINE_CACHE',
    });

    // Persist the query client
    persistQueryClient({
      queryClient,
      persister: localStoragePersister,
      maxAge: 30 * 60 * 1000, // 30 minutes
      buster: 'v1', // Increment this to bust the cache on version updates
      dehydrateOptions: {
        shouldDehydrateQuery: (query) =>
          query.state.status === 'success' && query.meta?.persist !== false,
      },
    });
  };

  // Defer persistence setup to avoid blocking initial render
  if ('requestIdleCallback' in window) {
    requestIdleCallback(initializePersistence, { timeout: 2000 });
  } else {
    // Fallback for Safari
    setTimeout(initializePersistence, 100);
  }
}

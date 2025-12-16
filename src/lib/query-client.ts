import { QueryClient } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 30 * 60 * 1000,   // 30 minutes
    },
  },
});

// Create a persister using localStorage
// Only initialize if window is defined (browser environment)
if (typeof window !== 'undefined') {
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
  });
}

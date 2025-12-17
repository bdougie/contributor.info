import { QueryClient } from '@tanstack/react-query';

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
// IMPORTANT: Use dynamic imports to prevent SSR bundle from including browser-only code
if (typeof window !== 'undefined') {
  const initializePersistence = async () => {
    try {
      // Dynamic imports to ensure these browser-only modules aren't bundled for SSR
      const [{ persistQueryClient }, { createSyncStoragePersister }] = await Promise.all([
        import('@tanstack/react-query-persist-client'),
        import('@tanstack/query-sync-storage-persister'),
      ]);

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
    } catch (error) {
      // Silently fail - persistence is non-critical
      console.warn('Failed to initialize query persistence:', error);
    }
  };

  // Defer persistence setup to avoid blocking initial render
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => initializePersistence(), { timeout: 2000 });
  } else {
    // Fallback for Safari
    setTimeout(() => initializePersistence(), 100);
  }
}

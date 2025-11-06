import { QueryClient } from '@tanstack/react-query';
import { logger } from '@/lib/logger';

/**
 * Global QueryClient configuration for request deduplication and caching
 * 
 * Key features:
 * - Automatic request deduplication for identical queries
 * - 1 minute stale time to prevent unnecessary refetches
 * - Single retry on failure
 * - Background refetch disabled to reduce redundant requests
 * 
 * @see https://github.com/bdougie/contributor.info/issues/1188
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache data for 1 minute before considering it stale
      staleTime: 60 * 1000,
      
      // Keep unused data in cache for 5 minutes
      gcTime: 5 * 60 * 1000,
      
      // Disable automatic refetching to reduce redundant requests
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      
      // Single retry on failure
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      // Single retry for mutations
      retry: 1,
    },
  },
});

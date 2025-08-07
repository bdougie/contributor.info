/**
 * Deduplication wrapper for supabase-pr-data-smart
 * 
 * This extends the existing fetchPRDataSmart function with request deduplication
 * to prevent concurrent API calls for the same data. Maintains full compatibility
 * with the original function while adding transparent deduplication.
 */

import { fetchPRDataSmart as originalFetchPRDataSmart } from './supabase-pr-data-smart';
import { withRequestDeduplication, RequestDeduplicator } from './utils/request-deduplicator';
import type { PullRequest } from './types';
import type { DataResult } from './errors/repository-errors';

interface FetchOptions {
  timeRange?: string;
  triggerBackgroundSync?: boolean;
  showNotifications?: boolean;
}

/**
 * Enhanced fetchPRDataSmart with request deduplication
 * Drop-in replacement for the original function
 */
export const fetchPRDataSmart = withRequestDeduplication(
  originalFetchPRDataSmart,
  (owner: string, repo: string, options: FetchOptions = {}): string => {
    const { timeRange = '30', triggerBackgroundSync = true, showNotifications = false } = options;
    return RequestDeduplicator.generateKey.repository(
      owner, 
      repo, 
      'pr-data-smart',
      timeRange, 
      triggerBackgroundSync.toString(),
      showNotifications.toString()
    );
  },
  {
    ttl: 5000, // 5 second deduplication window
    abortable: true,
  }
);

/**
 * Direct access to original function if deduplication is not wanted
 */
export { originalFetchPRDataSmart as fetchPRDataSmartOriginal };

/**
 * Typed version of the deduplicated function for better TypeScript support
 */
export async function fetchPRDataSmartDeduped(
  owner: string,
  repo: string,
  options: FetchOptions = {}
): Promise<DataResult<PullRequest[]>> {
  return fetchPRDataSmart(owner, repo, options);
}
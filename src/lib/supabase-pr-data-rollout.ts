/**
 * Gradual rollout configuration for smart fetch strategy
 * This allows us to test the new fetch strategy with a percentage of users
 */

import { fetchPRDataWithFallback } from './supabase-pr-data';
import { fetchPRDataWithSmartStrategy } from './supabase-pr-data-v2';
import type { DataResult } from './errors/repository-errors';
import type { PullRequest } from './types';

// Rollout percentage (0-100)
// Start with 10% and gradually increase
const ROLLOUT_PERCENTAGE = process.env.VITE_SMART_FETCH_ROLLOUT
  ? parseInt(process.env.VITE_SMART_FETCH_ROLLOUT)
  : 10;

// Repositories to always use new strategy (for testing)
const FORCE_NEW_STRATEGY = ['facebook/react', 'vercel/next.js', 'microsoft/typescript'];

// Repositories to never use new strategy (safety)
const FORCE_OLD_STRATEGY: string[] = [];

/**
 * Determine if we should use the new smart fetch strategy
 */
function shouldUseSmartStrategy(owner: string, repo: string): boolean {
  const repoName = `${owner}/${repo}`;

  // Check force lists
  if (FORCE_NEW_STRATEGY.includes(repoName)) return true;
  if (FORCE_OLD_STRATEGY.includes(repoName)) return false;

  // Use hash-based rollout for consistent behavior per repository
  const hash = simpleHash(repoName);
  const threshold = ROLLOUT_PERCENTAGE / 100;

  return hash < threshold;
}

/**
 * Simple hash function for consistent rollout
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Normalize to 0-1 range
  return Math.abs(hash) / 2147483647;
}

/**
 * Unified fetch function with gradual rollout
 * This will be the main export once rollout is complete
 */
export async function fetchPRData(
  owner: string,
  repo: string,
  timeRange: string = '30',
): Promise<DataResult<PullRequest[]>> {
  const useSmartStrategy = shouldUseSmartStrategy(owner, repo);

  if (process.env.NODE_ENV === 'development') {
    console.log(
      '🚀 Fetch strategy for %s/%s: %s',
      owner,
      repo,
      useSmartStrategy ? 'SMART (new)' : 'LEGACY (old)',
    );
  }

  try {
    if (useSmartStrategy) {
      return await fetchPRDataWithSmartStrategy(owner, repo, timeRange);
    } else {
      return await fetchPRDataWithFallback(owner, repo, timeRange);
    }
  } catch (error) {
    // If new strategy fails, fall back to old one
    if (useSmartStrategy) {
      console.error('Smart fetch strategy failed, falling back to legacy:', error);
      return await fetchPRDataWithFallback(owner, repo, timeRange);
    }
    throw error;
  }
}

/**
 * Get current rollout status
 */
export function getRolloutStatus(): {
  percentage: number;
  forcedNew: string[];
  forcedOld: string[];
} {
  return {
    percentage: ROLLOUT_PERCENTAGE,
    forcedNew: FORCE_NEW_STRATEGY,
    forcedOld: FORCE_OLD_STRATEGY,
  };
}

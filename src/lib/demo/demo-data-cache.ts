/**
 * Demo Data Cache
 * Provides persistent caching for expensive demo data calculations
 */

import type { AnalyticsData } from '@/components/features/workspace/AnalyticsDashboard';
import type {
  ActivityDataPoint,
  Repository,
  WorkspaceMetrics,
} from '@/components/features/workspace';
import type { WorkspaceRepositoryWithDetails } from '@/types/workspace';
import {
  generateDemoAnalyticsData,
  generateDemoWorkspaceRepositories,
  generateDemoWorkspaceMetrics,
  generateDemoWorkspaceTrendData,
  generateDemoRepositories,
} from './demo-data-generator';

// Cache interface for type safety
interface DemoDataCache {
  analyticsData: AnalyticsData | null;
  workspaceRepositories: WorkspaceRepositoryWithDetails[] | null;
  repositories: Repository[] | null;
  metricsCache: Map<string, WorkspaceMetrics>;
  trendCache: Map<string, ActivityDataPoint[]>;
  lastGenerated: number;
}

// In-memory cache - persists across component re-renders but not page refreshes
const cache: DemoDataCache = {
  analyticsData: null,
  workspaceRepositories: null,
  repositories: null,
  metricsCache: new Map(),
  trendCache: new Map(),
  lastGenerated: 0,
};

// Cache duration: 5 minutes (300,000ms)
const CACHE_DURATION = 5 * 60 * 1000;

/**
 * Check if cache is valid based on timestamp
 */
function isCacheValid(): boolean {
  return Date.now() - cache.lastGenerated < CACHE_DURATION;
}

/**
 * Generate cache key for metrics based on time range and selected repos
 */
function getMetricsCacheKey(timeRange: string, selectedRepoIds?: string[]): string {
  const repoKey = selectedRepoIds?.sort().join(',') || 'all';
  return `metrics-${timeRange}-${repoKey}`;
}

/**
 * Generate cache key for trend data
 */
function getTrendCacheKey(days: number, selectedRepoIds?: string[]): string {
  const repoKey = selectedRepoIds?.sort().join(',') || 'all';
  return `trend-${days}-${repoKey}`;
}

/**
 * Get cached analytics data or generate if not available
 */
export function getCachedAnalyticsData(): AnalyticsData {
  if (cache.analyticsData && isCacheValid()) {
    return cache.analyticsData;
  }

  console.log('🔄 Generating fresh analytics data for demo workspace');
  cache.analyticsData = generateDemoAnalyticsData();
  cache.lastGenerated = Date.now();

  return cache.analyticsData;
}

/**
 * Get cached workspace repositories or generate if not available
 */
export function getCachedWorkspaceRepositories(
  workspaceId: string = 'demo'
): WorkspaceRepositoryWithDetails[] {
  if (cache.workspaceRepositories && isCacheValid()) {
    return cache.workspaceRepositories;
  }

  console.log('🔄 Generating fresh workspace repositories for demo workspace');
  cache.workspaceRepositories = generateDemoWorkspaceRepositories(workspaceId);
  cache.lastGenerated = Date.now();

  return cache.workspaceRepositories;
}

/**
 * Get cached repositories list or generate if not available
 */
export function getCachedRepositories(): Repository[] {
  if (cache.repositories && isCacheValid()) {
    return cache.repositories;
  }

  console.log('🔄 Generating fresh repositories list for demo workspace');
  cache.repositories = generateDemoRepositories();
  cache.lastGenerated = Date.now();

  return cache.repositories;
}

/**
 * Get cached workspace metrics or generate if not available
 */
export function getCachedWorkspaceMetrics(
  repos: Repository[],
  timeRange: '7d' | '30d' | '90d' | '1y' | 'all',
  selectedRepoIds?: string[]
): WorkspaceMetrics {
  const cacheKey = getMetricsCacheKey(timeRange, selectedRepoIds);

  if (cache.metricsCache.has(cacheKey) && isCacheValid()) {
    return cache.metricsCache.get(cacheKey)!;
  }

  console.log(`🔄 Generating fresh metrics for demo workspace (${timeRange})`);
  const metrics = generateDemoWorkspaceMetrics(repos, timeRange, selectedRepoIds);
  cache.metricsCache.set(cacheKey, metrics);
  cache.lastGenerated = Date.now();

  return metrics;
}

/**
 * Get cached trend data or generate if not available
 */
export function getCachedWorkspaceTrendData(
  days: number,
  repos?: Repository[],
  selectedRepoIds?: string[]
): ActivityDataPoint[] {
  const cacheKey = getTrendCacheKey(days, selectedRepoIds);

  if (cache.trendCache.has(cacheKey) && isCacheValid()) {
    return cache.trendCache.get(cacheKey)!;
  }

  console.log(`🔄 Generating fresh trend data for demo workspace (${days} days)`);
  const trendData = generateDemoWorkspaceTrendData(days, repos, selectedRepoIds);
  cache.trendCache.set(cacheKey, trendData);
  cache.lastGenerated = Date.now();

  return trendData;
}

/**
 * Clear all cached data (useful for testing or manual refresh)
 */
export function clearDemoDataCache(): void {
  console.log('🗑️ Clearing demo data cache');
  cache.analyticsData = null;
  cache.workspaceRepositories = null;
  cache.repositories = null;
  cache.metricsCache.clear();
  cache.trendCache.clear();
  cache.lastGenerated = 0;
}

/**
 * Get cache statistics for debugging
 */
export function getDemoCacheStats() {
  return {
    isValid: isCacheValid(),
    lastGenerated: cache.lastGenerated,
    age: Date.now() - cache.lastGenerated,
    hasAnalyticsData: !!cache.analyticsData,
    hasWorkspaceRepositories: !!cache.workspaceRepositories,
    hasRepositories: !!cache.repositories,
    metricsCacheSize: cache.metricsCache.size,
    trendCacheSize: cache.trendCache.size,
  };
}

/**
 * SSR Hydration Utilities
 *
 * Utilities for detecting and using server-side rendered content.
 * Enables seamless hydration where React takes over SSR content without re-rendering.
 */

import { logger } from './logger';

/**
 * Type-safe SSR data structures for each route
 */
export interface HomePageData {
  totalRepos: number;
  totalContributors: number;
  totalPRs: number;
}

export interface TrendingPageData {
  repos: Array<{
    id: number;
    owner: string;
    name: string;
    full_name: string;
    description: string | null;
    stargazer_count: number;
    fork_count: number;
    language: string | null;
    topics: string[] | null;
    score: number;
  }>;
}

export interface RepoPageData {
  owner: string;
  repo: string;
  repository: {
    id: number;
    owner: string;
    name: string;
    full_name: string;
    description: string | null;
    stargazer_count: number;
    fork_count: number;
    language: string | null;
    topics: string[] | null;
    updated_at: string;
  };
  contributorStats: {
    count: number;
    topContributors: Array<{
      login: string;
      avatar_url: string;
      contributions: number;
    }>;
  };
}

export interface WorkspacesPageData {
  authenticated: boolean;
  workspaces?: Array<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    repository_count: number;
    member_count: number;
    repositories: Array<{
      id: string;
      full_name: string;
      name: string;
      owner: string;
      language: string | null;
      stargazer_count: number;
    }>;
  }>;
  stats?: {
    totalWorkspaces: number;
    totalRepositories: number;
  };
}

export interface WorkspaceDetailPageData {
  workspace: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    tier: string;
    owner_id: string;
    created_at: string;
    visibility: 'public' | 'private';
    repository_count: number;
    member_count: number;
    contributor_count: number;
    repositories: Array<{
      id: string;
      full_name: string;
      name: string;
      owner: string;
      description: string | null;
      language: string | null;
      stargazer_count: number;
    }>;
    owner: {
      id: string;
      github_username: string | null;
      avatar_url: string | null;
    } | null;
  } | null;
}

export interface WorkspaceNewPageData {
  authenticated: boolean;
}

/**
 * SSR Data structure injected by edge functions
 * Using discriminated union for type safety
 */
export type SSRData =
  | { route: 'home'; data: HomePageData; timestamp: number }
  | { route: 'trending'; data: TrendingPageData; timestamp: number }
  | { route: 'workspaces'; data: WorkspacesPageData; timestamp: number }
  | { route: 'workspaces/new'; data: WorkspaceNewPageData; timestamp: number }
  | { route: 'workspace-detail'; data: WorkspaceDetailPageData; timestamp: number }
  | { route: string; data: RepoPageData; timestamp: number };

/**
 * Type guard for SSR data
 */
function isValidSSRData(data: unknown): data is SSRData {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return typeof obj.route === 'string' && typeof obj.timestamp === 'number' && 'data' in obj;
}

/**
 * Get SSR data from window if available
 */
export function getSSRData(): SSRData | null {
  if (typeof window === 'undefined') return null;

  const ssrData = (window as { __SSR_DATA__?: unknown }).__SSR_DATA__;

  if (!ssrData) return null;

  if (!isValidSSRData(ssrData)) {
    logger.warn('[SSR] Invalid SSR data structure detected');
    return null;
  }

  return ssrData;
}

/**
 * Check if the current page was server-side rendered
 */
export function isSSRPage(): boolean {
  return getSSRData() !== null;
}

/**
 * Get SSR data for a specific route
 */
export function getSSRDataForRoute<T = unknown>(route: string): T | null {
  const ssrData = getSSRData();

  if (!ssrData) return null;

  // Normalize routes for comparison
  const normalizedSSRRoute = ssrData.route.replace(/\/$/, '');
  const normalizedRoute = route.replace(/\/$/, '');

  if (normalizedSSRRoute !== normalizedRoute) {
    return null;
  }

  return ssrData.data as T;
}

/**
 * Check if SSR data is stale (older than maxAge in seconds)
 */
export function isSSRDataStale(maxAgeSeconds = 300): boolean {
  const ssrData = getSSRData();

  if (!ssrData) return true;

  const now = Date.now();
  const age = (now - ssrData.timestamp) / 1000;

  return age > maxAgeSeconds;
}

/**
 * Clear SSR data after hydration
 * Call this after React has fully hydrated to prevent memory leaks
 */
export function clearSSRData(): void {
  if (typeof window !== 'undefined') {
    delete (window as { __SSR_DATA__?: unknown }).__SSR_DATA__;
    logger.debug('[SSR] SSR data cleared after hydration');
  }
}

/**
 * Check if we should use hydration vs. create new root
 */
export function shouldHydrate(): boolean {
  // Check if root has content (SSR rendered)
  const root = document.getElementById('root');
  if (!root) return false;

  // Check if there's actual content beyond whitespace
  const hasContent = root.innerHTML.trim().length > 0;

  // Check if SSR data exists
  const hasSSRData = isSSRPage();

  // Check for SSR marker header
  const isSSRRendered = document.querySelector('meta[name="x-ssr-rendered"]') !== null;

  return hasContent && (hasSSRData || isSSRRendered);
}

/**
 * Mark hydration as complete
 * Adds a marker that can be used to track successful hydration
 */
export function markHydrationComplete(): void {
  if (typeof window !== 'undefined') {
    (window as { __SSR_HYDRATED__?: boolean }).__SSR_HYDRATED__ = true;
    logger.debug('[SSR] Hydration complete');
  }
}

/**
 * Check if hydration has completed
 */
export function isHydrationComplete(): boolean {
  if (typeof window === 'undefined') return false;
  return (window as { __SSR_HYDRATED__?: boolean }).__SSR_HYDRATED__ === true;
}

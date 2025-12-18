/**
 * React Hook for consuming SSR Data
 *
 * Provides access to pre-fetched SSR data for seamless hydration.
 * Falls back to client-side data fetching when SSR data is unavailable.
 */

import { useMemo, useRef } from 'react';
import { useLocation } from 'react-router';
import {
  getSSRDataForRoute,
  isSSRDataStale,
  clearSSRData,
  type WorkspacesPageData,
  type WorkspaceDetailPageData,
  type WorkspaceNewPageData,
} from '@/lib/ssr-hydration';
import { logger } from '@/lib/logger';

/**
 * Repository SSR data structure
 */
export interface RepoSSRData {
  repository: {
    id: number;
    github_id: number;
    owner: string;
    name: string;
    full_name: string;
    description: string | null;
    language: string | null;
    stargazer_count: number;
    fork_count: number;
    topics: string[] | null;
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

/**
 * Trending SSR data structure
 */
export interface TrendingSSRData {
  repositories: Array<{
    id: number;
    owner: string;
    name: string;
    description: string | null;
    language: string | null;
    stargazer_count: number;
    fork_count: number;
  }>;
}

/**
 * Home SSR data structure
 */
export interface HomeSSRData {
  stats: {
    totalRepos: number;
    totalContributors: number;
    totalPRs: number;
  };
}

/**
 * Hook to consume SSR data
 *
 * @param maxAgeSeconds - Maximum age of SSR data before considering it stale
 * @returns SSR data for the current route, or null if unavailable
 */
export function useSSRData<T = unknown>(maxAgeSeconds = 300): T | null {
  const location = useLocation();
  const consumedRef = useRef(false);

  const ssrData = useMemo(() => {
    // Only consume SSR data once per component lifecycle
    if (consumedRef.current) return null;

    // Check if SSR data is stale
    if (isSSRDataStale(maxAgeSeconds)) {
      logger.debug('[SSR] SSR data is stale, skipping');
      return null;
    }

    // Get SSR data for current route
    const data = getSSRDataForRoute<T>(location.pathname);

    if (data) {
      logger.debug('[SSR] Using SSR data for %s', location.pathname);
      consumedRef.current = true;

      // Schedule cleanup after next render
      requestAnimationFrame(() => {
        clearSSRData();
      });
    }

    return data;
  }, [location.pathname, maxAgeSeconds]);

  return ssrData;
}

/**
 * Hook for repository page SSR data
 */
export function useRepoSSRData(): RepoSSRData | null {
  return useSSRData<RepoSSRData>();
}

/**
 * Hook for trending page SSR data
 */
export function useTrendingSSRData(): TrendingSSRData | null {
  return useSSRData<TrendingSSRData>();
}

/**
 * Hook for home page SSR data
 */
export function useHomeSSRData(): HomeSSRData | null {
  return useSSRData<HomeSSRData>();
}

/**
 * Hook for workspaces page SSR data
 */
export function useWorkspacesSSRData(): WorkspacesPageData | null {
  return useSSRData<WorkspacesPageData>();
}

/**
 * Hook for workspace detail page SSR data
 */
export function useWorkspaceDetailSSRData(): WorkspaceDetailPageData | null {
  return useSSRData<WorkspaceDetailPageData>();
}

/**
 * Hook for workspace creation page SSR data
 */
export function useWorkspaceNewSSRData(): WorkspaceNewPageData | null {
  return useSSRData<WorkspaceNewPageData>();
}

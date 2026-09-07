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
export function useSSRData<T = unknown>(maxAgeSeconds = 300, routeKey?: string): T | null {
  const location = useLocation();
  const consumedRef = useRef(false);

  // Edge functions write either the concrete pathname (repo, profile) or a
  // fixed key ('home', 'workspaces', 'workspace-detail') as `route`. Callers
  // whose edge function uses a fixed key must pass it, otherwise the lookup
  // compares '/i/<slug>' against 'workspace-detail' and never matches.
  const lookupKey = routeKey ?? location.pathname;

  const ssrData = useMemo(() => {
    // Only consume SSR data once per component lifecycle
    if (consumedRef.current) return null;

    // Check if SSR data is stale
    if (isSSRDataStale(maxAgeSeconds)) {
      logger.debug('[SSR] SSR data is stale, skipping');
      return null;
    }

    // Get SSR data for current route
    const data = getSSRDataForRoute<T>(lookupKey);

    if (data) {
      logger.debug('[SSR] Using SSR data for %s', lookupKey);
      consumedRef.current = true;

      // Schedule cleanup after next render
      requestAnimationFrame(() => {
        clearSSRData();
      });
    }

    return data;
  }, [lookupKey, maxAgeSeconds]);

  return ssrData;
}

/**
 * Hook for repository page SSR data
 */
export function useRepoSSRData(): RepoSSRData | null {
  return useSSRData<RepoSSRData>();
}

/**
 * Hook for home page SSR data
 */
export function useHomeSSRData(): HomeSSRData | null {
  return useSSRData<HomeSSRData>(300, 'home');
}

/**
 * Hook for workspaces page SSR data
 */
export function useWorkspacesSSRData(): WorkspacesPageData | null {
  return useSSRData<WorkspacesPageData>(300, 'workspaces');
}

/**
 * Hook for workspace detail page SSR data
 */
export function useWorkspaceDetailSSRData(): WorkspaceDetailPageData | null {
  // Accept payloads for the edge cache's full stale-while-revalidate window
  // (getSSRHeaders(300, 3600) in ssr-workspace-detail.ts): the page refreshes
  // in place, so a stale header is still better than a skeleton.
  return useSSRData<WorkspaceDetailPageData>(3600, 'workspace-detail');
}

/**
 * Hook for workspace creation page SSR data
 */
export function useWorkspaceNewSSRData(): WorkspaceNewPageData | null {
  return useSSRData<WorkspaceNewPageData>(300, 'workspaces/new');
}

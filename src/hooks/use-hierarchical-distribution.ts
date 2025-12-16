import { useState, useEffect, useRef } from 'react';
import type { PullRequest } from '@/lib/types';
import { ContributionAnalyzer } from '@/lib/contribution-analyzer';

// Chunk size for breaking up long tasks (20 PRs per chunk for better responsiveness)
const CHUNK_SIZE = 20;
// Yield interval for requestIdleCallback timeout
const YIELD_TIMEOUT = 16;
// Detect test environment for synchronous processing
const IS_TEST = typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test';

export interface ContributorNode {
  id: string;
  name: string;
  value: number;
  avatar_url: string;
  login: string;
  prs: PullRequest[];
}

export interface QuadrantNode {
  id: string;
  name: string;
  value: number;
  color: string;
  children?: ContributorNode[];
}

export interface HierarchicalData {
  name: string;
  children: QuadrantNode[];
}

interface UseHierarchicalDistributionReturn {
  hierarchicalData: HierarchicalData | null;
  currentView: 'overview' | 'quadrant';
  selectedQuadrant: string | null;
  drillDown: (quadrantId: string) => void;
  drillUp: () => void;
  loading: boolean;
  isProcessing: boolean;
}

const QUADRANT_INFO = {
  refinement: {
    label: 'Refinement',
    color: '#4ade80',
  },
  new: {
    label: 'New Features',
    color: '#60a5fa',
  },
  refactoring: {
    label: 'Refactoring',
    color: '#f97316',
  },
  maintenance: {
    label: 'Maintenance',
    color: '#a78bfa',
  },
};

/**
 * Yields to the main thread using requestIdleCallback or setTimeout fallback.
 * This breaks up long tasks to reduce Total Blocking Time (TBT).
 */
function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => resolve(), { timeout: YIELD_TIMEOUT });
    } else {
      setTimeout(resolve, 0);
    }
  });
}

/**
 * Transforms quadrant map into hierarchical structure for visualization.
 * This is a fast operation that doesn't need chunking.
 */
function transformToHierarchy(
  quadrantMap: Record<string, Record<string, PullRequest[]>>
): HierarchicalData {
  const children: QuadrantNode[] = Object.entries(quadrantMap).map(([quadrantId, contributors]) => {
    // Sort all contributors by PR count first, then slice
    const sortedContributors = Object.entries(contributors)
      .map(([login, prs]) => ({
        id: `${quadrantId}-${login}`,
        name: login,
        value: prs.length,
        login,
        avatar_url: prs[0]?.user.avatar_url || '',
        prs,
      }))
      .sort((a, b) => b.value - a.value);

    // Take top 20 contributors
    const contributorNodes: ContributorNode[] = sortedContributors.slice(0, 20);

    // Add "Others" node if there are more contributors
    const totalContributors = sortedContributors.length;
    if (totalContributors > 20) {
      const othersCount = sortedContributors.slice(20).reduce((sum, node) => sum + node.value, 0);

      if (othersCount > 0) {
        contributorNodes.push({
          id: `${quadrantId}-others`,
          name: `Others (${totalContributors - 20})`,
          value: othersCount,
          login: 'others',
          avatar_url: '',
          prs: [],
        });
      }
    }

    const info = QUADRANT_INFO[quadrantId as keyof typeof QUADRANT_INFO];
    return {
      id: quadrantId,
      name: info.label,
      value: contributorNodes.reduce((sum, node) => sum + node.value, 0),
      color: info.color,
      children: contributorNodes,
    };
  });

  return {
    name: 'Distribution',
    children,
  };
}

export function useHierarchicalDistribution(
  pullRequests: PullRequest[],
  externalSelectedQuadrant?: string | null
): UseHierarchicalDistributionReturn {
  const [currentView, setCurrentView] = useState<'overview' | 'quadrant'>('overview');
  const [selectedQuadrant, setSelectedQuadrant] = useState<string | null>(null);
  const [hierarchicalData, setHierarchicalData] = useState<HierarchicalData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Track cancellation for async processing
  const cancelledRef = useRef(false);
  // Store array reference to detect when PR array is replaced (not just length)
  const previousPRsRef = useRef<PullRequest[]>([]);

  // Sync with external selection
  useEffect(() => {
    if (externalSelectedQuadrant !== undefined) {
      setSelectedQuadrant(externalSelectedQuadrant);
      setCurrentView(externalSelectedQuadrant ? 'quadrant' : 'overview');
    }
  }, [externalSelectedQuadrant]);

  // Process PRs - synchronously in tests, chunked async in production
  useEffect(() => {
    if (!pullRequests || pullRequests.length === 0) {
      setHierarchicalData(null);
      setIsProcessing(false);
      return;
    }

    // Skip if PRs haven't changed (compare array reference, not just length)
    if (previousPRsRef.current === pullRequests && hierarchicalData) {
      return;
    }

    cancelledRef.current = false;
    previousPRsRef.current = pullRequests;

    /**
     * Process all PRs synchronously - used in test environment
     * to avoid async issues with bulletproof testing guidelines.
     */
    const processSynchronously = () => {
      const quadrantMap: Record<string, Record<string, PullRequest[]>> = {
        refinement: {},
        new: {},
        refactoring: {},
        maintenance: {},
      };

      ContributionAnalyzer.resetCounts();

      for (const pr of pullRequests) {
        try {
          const metrics = ContributionAnalyzer.analyze(pr);
          const quadrant = metrics.quadrant;
          const contributor = pr.user.login;

          if (!quadrantMap[quadrant][contributor]) {
            quadrantMap[quadrant][contributor] = [];
          }
          quadrantMap[quadrant][contributor].push(pr);
        } catch {
          // Silently handle PR analysis errors
        }
      }

      const result = transformToHierarchy(quadrantMap);
      setHierarchicalData(result);
      setIsProcessing(false);
    };

    /**
     * Process PRs in chunks with yielding - used in production
     * to reduce Total Blocking Time (TBT).
     */
    const processInChunks = async () => {
      const quadrantMap: Record<string, Record<string, PullRequest[]>> = {
        refinement: {},
        new: {},
        refactoring: {},
        maintenance: {},
      };

      ContributionAnalyzer.resetCounts();

      for (let i = 0; i < pullRequests.length; i += CHUNK_SIZE) {
        if (cancelledRef.current) return;

        const chunk = pullRequests.slice(i, i + CHUNK_SIZE);

        for (const pr of chunk) {
          try {
            const metrics = ContributionAnalyzer.analyze(pr);
            const quadrant = metrics.quadrant;
            const contributor = pr.user.login;

            if (!quadrantMap[quadrant][contributor]) {
              quadrantMap[quadrant][contributor] = [];
            }
            quadrantMap[quadrant][contributor].push(pr);
          } catch {
            // Silently handle PR analysis errors
          }
        }

        // Yield to main thread between chunks to keep UI responsive
        if (i + CHUNK_SIZE < pullRequests.length) {
          await yieldToMainThread();
        }
      }

      if (cancelledRef.current) return;

      const result = transformToHierarchy(quadrantMap);
      setHierarchicalData(result);
      setIsProcessing(false);
    };

    // Use synchronous processing in tests, async chunked in production
    if (IS_TEST) {
      processSynchronously();
    } else {
      setIsProcessing(true);
      processInChunks();
    }

    return () => {
      cancelledRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hierarchicalData intentionally excluded to prevent infinite loops
  }, [pullRequests]);

  // Compute loading state based on data availability and processing
  const loading = (pullRequests.length > 0 && !hierarchicalData) || isProcessing;

  const drillDown = (quadrantId: string) => {
    setSelectedQuadrant(quadrantId);
    setCurrentView('quadrant');
  };

  const drillUp = () => {
    setSelectedQuadrant(null);
    setCurrentView('overview');
  };

  return {
    hierarchicalData,
    currentView,
    selectedQuadrant,
    drillDown,
    drillUp,
    loading,
    isProcessing,
  };
}

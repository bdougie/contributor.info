import { useState, useEffect } from 'react';
import type { PullRequest, QuadrantDistribution } from '@/lib/types';
import { ContributionAnalyzer } from '@/lib/contribution-analyzer';

// Chunk size for breaking up long tasks
const CHUNK_SIZE = 25;

/**
 * Yields to the main thread using requestIdleCallback or setTimeout fallback.
 */
function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => resolve(), { timeout: 16 });
    } else {
      setTimeout(resolve, 0);
    }
  });
}

/**
 * Interface for quadrant data used in visualizations
 */
export interface QuadrantData {
  id: string;
  label: string;
  value: number;
  percentage: number;
  description: string;
  color: string;
  debugFiles?: Array<{ title: string; number: number; extensions: string[] }>; // Debug info
}

// Quadrant descriptions and colors - defined at module level to avoid recreation on each render
const QUADRANT_INFO = {
  refinement: {
    label: 'Refinement',
    description: 'Improving existing features with careful changes',
    color: '#4ade80', // green
  },
  new: {
    label: 'New Features',
    description: 'Adding new functionality and capabilities',
    color: '#60a5fa', // blue
  },
  refactoring: {
    label: 'Refactoring',
    description: 'Restructuring code without changing behavior',
    color: '#f97316', // orange
  },
  maintenance: {
    label: 'Maintenance',
    description: 'Bug fixes and routine upkeep',
    color: '#a78bfa', // purple
  },
} as const;

/**
 * Hook for analyzing contribution distribution across quadrants
 * @param pullRequests - Array of pull requests to analyze
 */
export function useDistribution(pullRequests: PullRequest[]) {
  const [distribution, setDistribution] = useState<QuadrantDistribution | null>(null);
  const [quadrantCounts, setQuadrantCounts] = useState<Record<string, number>>({
    refinement: 0,
    new: 0,
    refactoring: 0,
    maintenance: 0,
  });

  const [chartData, setChartData] = useState<QuadrantData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  // Debug information storage
  const [debugInfo, setDebugInfo] = useState<
    Record<string, Array<{ title: string; number: number; extensions: string[] }>>
  >({
    refinement: [],
    new: [],
    refactoring: [],
    maintenance: [],
  });

  useEffect(() => {
    // Use local variable for cancellation to avoid race conditions
    // Each effect invocation gets its own closure
    let cancelled = false;
    setLoading(true);

    if (pullRequests.length === 0) {
      setChartData([]);
      setLoading(false);
      return;
    }

    // Process PRs in chunks to avoid blocking the main thread
    const processInChunks = async () => {
      try {
        // Reset analyzer counts to ensure we're starting fresh
        ContributionAnalyzer.resetCounts();

        // Debug tracking for PRs in each quadrant
        const debugQuadrantPRs: Record<
          string,
          Array<{ title: string; number: number; extensions: string[] }>
        > = {
          refinement: [],
          new: [],
          refactoring: [],
          maintenance: [],
        };

        // Process PRs in chunks
        for (let i = 0; i < pullRequests.length; i += CHUNK_SIZE) {
          if (cancelled) return;

          const chunk = pullRequests.slice(i, i + CHUNK_SIZE);

          // Process this chunk
          for (const pr of chunk) {
            // Extract file extensions from PR title and changed_files
            const extensions: string[] = [];

            // Try to infer extensions from PR title
            const titleExtMatch = pr.title.match(/\.([\w]+)/g);
            if (titleExtMatch) {
              for (const ext of titleExtMatch) {
                extensions.push(ext.substring(1));
              }
            }

            // Analyze PR
            const result = ContributionAnalyzer.analyze(pr);

            // Store info for debugging
            debugQuadrantPRs[result.quadrant].push({
              title: pr.title,
              number: pr.number,
              extensions: extensions.filter((v, i, a) => a.indexOf(v) === i),
            });
          }

          // Yield to main thread between chunks
          if (i + CHUNK_SIZE < pullRequests.length) {
            await yieldToMainThread();
          }
        }

        if (cancelled) return;

        // Store debug info
        setDebugInfo(debugQuadrantPRs);

        // Get the distribution and counts from the analyzer
        const newDistribution = ContributionAnalyzer.getDistribution();
        const newCounts = ContributionAnalyzer.getCounts();

        // Update state with counts and distribution
        setDistribution(newDistribution);
        setQuadrantCounts(newCounts);

        // Transform data for chart visualization
        const totalContributions = Object.values(newCounts).reduce((sum, count) => sum + count, 0);

        const data = Object.entries(newCounts).map(([key, value]) => {
          const info = QUADRANT_INFO[key as keyof typeof QUADRANT_INFO];
          return {
            id: key,
            label: info.label,
            value,
            percentage: totalContributions > 0 ? (value / totalContributions) * 100 : 0,
            description: info.description,
            color: info.color,
            debugFiles: debugQuadrantPRs[key],
          };
        });

        setChartData(data);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Failed to analyze distribution'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    processInChunks();

    return () => {
      cancelled = true;
    };
  }, [pullRequests]);

  /**
   * Returns the dominant quadrant (highest percentage)
   */
  const getDominantQuadrant = (): QuadrantData | null => {
    if (chartData.length === 0) return null;
    return chartData.reduce(
      (max, quadrant) => (quadrant.value > max.value ? quadrant : max),
      chartData[0]
    );
  };

  /**
   * Calculate the total number of contributions analyzed
   */
  const getTotalContributions = (): number => {
    return Object.values(quadrantCounts).reduce((sum, count) => sum + count, 0);
  };

  return {
    distribution,
    quadrantCounts,
    chartData,
    loading,
    error,
    debugInfo, // Expose debug info
    getDominantQuadrant,
    getTotalContributions,
  };
}

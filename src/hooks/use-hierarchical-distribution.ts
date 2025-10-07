import { useState, useEffect, useMemo } from 'react';
import type { PullRequest } from '@/lib/types';
import { ContributionAnalyzer } from '@/lib/contribution-analyzer';

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

export function useHierarchicalDistribution(
  pullRequests: PullRequest[],
  externalSelectedQuadrant?: string | null
): UseHierarchicalDistributionReturn {
  const [currentView, setCurrentView] = useState<'overview' | 'quadrant'>('overview');
  const [selectedQuadrant, setSelectedQuadrant] = useState<string | null>(null);

  // Sync with external selection
  useEffect(() => {
    if (externalSelectedQuadrant !== undefined) {
      setSelectedQuadrant(externalSelectedQuadrant);
      setCurrentView(externalSelectedQuadrant ? 'quadrant' : 'overview');
    }
  }, [externalSelectedQuadrant]);

  const hierarchicalData = useMemo(() => {
    if (!pullRequests || pullRequests.length === 0) {
      return null;
    }

    // Group PRs by quadrant and then by contributor
    const quadrantMap: Record<string, Record<string, PullRequest[]>> = {
      refinement: {},
      new: {},
      refactoring: {},
      maintenance: {},
    };

    // Reset analyzer counts
    ContributionAnalyzer.resetCounts();

    // Categorize each PR
    pullRequests.forEach((pr) => {
      try {
        const metrics = ContributionAnalyzer.analyze(pr);
        const quadrant = metrics.quadrant;
        const contributor = pr.user.login;

        if (!quadrantMap[quadrant][contributor]) {
          quadrantMap[quadrant][contributor] = [];
        }
        quadrantMap[quadrant][contributor].push(pr);
      } catch (error) {
        // Silently handle PR analysis errors
      }
    });

    // Transform into hierarchical structure
    const children: QuadrantNode[] = Object.entries(quadrantMap).map(
      ([quadrantId, contributors]) => {
        const contributorNodes: ContributorNode[] = Object.entries(contributors)
          .map(([login, prs]) => ({
            id: `${quadrantId}-${login}`,
            name: login,
            value: prs.length,
            login,
            avatar_url: prs[0]?.user.avatar_url || '',
            prs,
          }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 20); // Limit to top 20 contributors per quadrant

        // Add "Others" node if there are more contributors
        const totalContributors = Object.keys(contributors).length;
        if (totalContributors > 20) {
          const othersCount = Object.entries(contributors)
            .slice(20)
            .reduce((sum, [_, prs]) => sum + prs.length, 0);

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
      }
    );

    return {
      name: 'Distribution',
      children,
    };
  }, [pullRequests]);

  // Compute loading state directly based on data availability
  const loading = pullRequests.length > 0 && !hierarchicalData;

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
  };
}

import { useState, useEffect } from 'react';
import {
  getWorkspaceMetrics,
  getWorkspaceTrendData,
  getWorkspace,
} from '@/lib/workspace/workspace-client';
import type { WorkspaceMetrics, WorkspaceTrendData } from '@/components/features/workspace';
import type { Repository } from '@/components/features/workspace';
import type { TimeRange } from '@/components/features/workspace';

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  owner_id: string;
  tier: 'free' | 'pro' | 'team';
}

export interface UseWorkspaceOptions {
  workspaceId: string;
  timeRange?: TimeRange;
}

export interface UseWorkspaceReturn {
  workspace: Workspace | null;
  metrics: WorkspaceMetrics | null;
  trendData: WorkspaceTrendData | null;
  repositories: Repository[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// Mock data generator for development
const generateMockMetrics = (): WorkspaceMetrics => ({
  totalStars: Math.floor(Math.random() * 100000) + 10000,
  totalPRs: Math.floor(Math.random() * 1000) + 100,
  totalIssues: Math.floor(Math.random() * 800) + 50,
  totalContributors: Math.floor(Math.random() * 500) + 50,
  totalCommits: Math.floor(Math.random() * 50000) + 5000,
  starsTrend: (Math.random() - 0.5) * 50,
  prsTrend: (Math.random() - 0.5) * 30,
  issuesTrend: (Math.random() - 0.5) * 25,
  contributorsTrend: (Math.random() - 0.5) * 20,
  commitsTrend: (Math.random() - 0.5) * 40,
});

const generateMockTrendData = (days: number): WorkspaceTrendData => {
  const labels = [];
  const prs = [];
  const issues = [];
  const commits = [];

  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));

    prs.push(Math.floor(Math.random() * 30) + 10);
    issues.push(Math.floor(Math.random() * 20) + 5);
    commits.push(Math.floor(Math.random() * 60) + 20);
  }

  return {
    labels,
    datasets: [
      {
        label: 'Pull Requests',
        data: prs,
        color: '#10b981',
      },
      {
        label: 'Issues',
        data: issues,
        color: '#f97316',
      },
      {
        label: 'Commits',
        data: commits,
        color: '#8b5cf6',
      },
    ],
  };
};

const generateMockRepositories = (): Repository[] => {
  const repos = [
    { owner: 'facebook', name: 'react', language: 'JavaScript', stars: 215000 },
    { owner: 'vercel', name: 'next.js', language: 'TypeScript', stars: 112000 },
    { owner: 'microsoft', name: 'typescript', language: 'TypeScript', stars: 93000 },
    { owner: 'tailwindlabs', name: 'tailwindcss', language: 'CSS', stars: 72000 },
    { owner: 'openai', name: 'gpt-3', language: 'Python', stars: 45000 },
  ];

  return repos.map((repo, i) => ({
    id: `repo-${i + 1}`,
    full_name: `${repo.owner}/${repo.name}`,
    owner: repo.owner,
    name: repo.name,
    description: `A powerful ${repo.language} project`,
    language: repo.language,
    stars: repo.stars,
    forks: Math.floor(repo.stars * 0.2),
    open_prs: Math.floor(Math.random() * 100) + 10,
    open_issues: Math.floor(Math.random() * 500) + 50,
    contributors: Math.floor(Math.random() * 1000) + 100,
    last_activity: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    is_pinned: i < 2,
    avatar_url: `https://avatars.githubusercontent.com/${repo.owner}`,
    html_url: `https://github.com/${repo.owner}/${repo.name}`,
  }));
};

export function useWorkspace({
  workspaceId,
  timeRange = '30d',
}: UseWorkspaceOptions): UseWorkspaceReturn {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [metrics, setMetrics] = useState<WorkspaceMetrics | null>(null);
  const [trendData, setTrendData] = useState<WorkspaceTrendData | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchWorkspaceData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch workspace details
      const workspaceData = await getWorkspace(workspaceId);
      if (!workspaceData) {
        throw new Error('Workspace not found');
      }

      // Transform workspace data
      const transformedWorkspace: Workspace = {
        id: workspaceData.id,
        name: workspaceData.name,
        description: workspaceData.description || undefined,
        created_at: workspaceData.created_at,
        updated_at: workspaceData.updated_at,
        owner_id: workspaceData.owner_id,
        tier: workspaceData.tier,
      };
      setWorkspace(transformedWorkspace);

      // Fetch metrics with the real API
      const metricsData = await getWorkspaceMetrics(workspaceId, timeRange as TimeRange);
      if (metricsData) {
        // Transform metrics to component format
        const transformedMetrics: WorkspaceMetrics = {
          totalStars: metricsData.metrics.total_stars,
          totalPRs: metricsData.metrics.total_prs,
          totalIssues: metricsData.metrics.total_issues || 0,
          totalContributors: metricsData.metrics.total_contributors,
          totalCommits: metricsData.metrics.total_commits,
          starsTrend: metricsData.metrics.stars_trend || 0,
          prsTrend: metricsData.metrics.prs_trend || 0,
          issuesTrend: metricsData.metrics.issues_trend || 0,
          contributorsTrend: metricsData.metrics.contributors_trend || 0,
          commitsTrend: metricsData.metrics.commits_trend || 0,
        };
        setMetrics(transformedMetrics);

        // Get trend data
        const trend = await getWorkspaceTrendData(workspaceId, timeRange as TimeRange);
        setTrendData(trend);
      } else {
        // If no metrics, trigger aggregation and show loading state
        console.log('No metrics found, aggregation triggered in background');
        setMetrics(null);
        setTrendData(null);
      }

      // Fetch repositories (using mock for now until repository endpoint is ready)
      // TODO: Replace with real repository API call
      setRepositories(generateMockRepositories());
    } catch (err) {
      console.error('Error fetching workspace data:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch workspace data'));

      // Fallback to mock data in development
      if (process.env.NODE_ENV === 'development') {
        console.warn('Using mock data as fallback');
        const mockWorkspace: Workspace = {
          id: workspaceId,
          name: 'My Workspace',
          description: 'A collection of my favorite open source projects',
          created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
          owner_id: 'user-1',
          tier: 'free',
        };
        setWorkspace(mockWorkspace);
        setMetrics(generateMockMetrics());
        setTrendData(generateMockTrendData(30));
        setRepositories(generateMockRepositories());
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaceData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, timeRange]);

  return {
    workspace,
    metrics,
    trendData,
    repositories,
    loading,
    error,
    refetch: fetchWorkspaceData,
  };
}

// Hook for fetching just workspace metrics
export function useWorkspaceMetrics(workspaceId: string, timeRange: TimeRange = '30d') {
  const [metrics, setMetrics] = useState<WorkspaceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        setError(null);

        const metricsData = await getWorkspaceMetrics(workspaceId, timeRange as TimeRange);
        if (metricsData) {
          const transformedMetrics: WorkspaceMetrics = {
            totalStars: metricsData.metrics.total_stars,
            totalPRs: metricsData.metrics.total_prs,
            totalIssues: metricsData.metrics.total_issues || 0,
            totalContributors: metricsData.metrics.total_contributors,
            totalCommits: metricsData.metrics.total_commits,
            starsTrend: metricsData.metrics.stars_trend || 0,
            prsTrend: metricsData.metrics.prs_trend || 0,
            issuesTrend: metricsData.metrics.issues_trend || 0,
            contributorsTrend: metricsData.metrics.contributors_trend || 0,
            commitsTrend: metricsData.metrics.commits_trend || 0,
          };
          setMetrics(transformedMetrics);
        } else {
          // Fallback to mock in development
          if (process.env.NODE_ENV === 'development') {
            setMetrics(generateMockMetrics());
          } else {
            setMetrics(null);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch metrics'));
        // Fallback to mock in development
        if (process.env.NODE_ENV === 'development') {
          setMetrics(generateMockMetrics());
        }
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [workspaceId, timeRange]);

  return { metrics, loading, error };
}

// Hook for fetching workspace repositories
export function useWorkspaceRepositories(workspaceId: string) {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchRepositories = async () => {
      try {
        setLoading(true);
        setError(null);

        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 700));

        setRepositories(generateMockRepositories());
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch repositories'));
      } finally {
        setLoading(false);
      }
    };

    fetchRepositories();
  }, [workspaceId]);

  return { repositories, loading, error };
}

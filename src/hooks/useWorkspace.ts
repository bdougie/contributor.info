import { useState, useEffect } from 'react';
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
  tier: 'free' | 'pro' | 'enterprise';
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
  totalContributors: Math.floor(Math.random() * 500) + 50,
  totalCommits: Math.floor(Math.random() * 50000) + 5000,
  starsTrend: (Math.random() - 0.5) * 50,
  prsTrend: (Math.random() - 0.5) * 30,
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
    avatar_url: `https://github.com/${repo.owner}.png`,
    html_url: `https://github.com/${repo.owner}/${repo.name}`,
  }));
};

export function useWorkspace({ workspaceId, timeRange = '30d' }: UseWorkspaceOptions): UseWorkspaceReturn {
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

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // For now, return mock data
      // TODO: Replace with actual API calls to Supabase
      const mockWorkspace: Workspace = {
        id: workspaceId,
        name: 'My Workspace',
        description: 'A collection of my favorite open source projects',
        created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
        owner_id: 'user-1',
        tier: 'free',
      };

      const daysMap: Record<TimeRange, number> = {
        '7d': 7,
        '30d': 30,
        '90d': 90,
        '1y': 365,
        'all': 365 * 2,
      };

      setWorkspace(mockWorkspace);
      setMetrics(generateMockMetrics());
      setTrendData(generateMockTrendData(daysMap[timeRange]));
      setRepositories(generateMockRepositories());
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch workspace data'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaceData();
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
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        setMetrics(generateMockMetrics());
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch metrics'));
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
        await new Promise(resolve => setTimeout(resolve, 700));
        
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
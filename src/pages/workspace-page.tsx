import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { WorkspaceDashboard, WorkspaceDashboardSkeleton } from '@/components/features/workspace';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import type { WorkspaceMetrics, WorkspaceTrendData, Repository, ActivityDataPoint } from '@/components/features/workspace';

interface WorkspaceData {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
  visibility: string;
  settings: any;
}

interface WorkspaceRepository {
  id: string;
  is_pinned: boolean;
  repositories: {
    id: string;
    full_name: string;
    name: string;
    owner: string;
    description: string | null;
    language: string | null;
    stargazers_count: number;
    forks_count: number;
    open_issues_count: number;
  };
}

interface MergedPR {
  merged_at: string;
  additions: number;
  deletions: number;
  changed_files: number;
  commits: number;
}

// Generate mock metrics for now
const generateMockMetrics = (repos: Repository[]): WorkspaceMetrics => {
  const totalStars = repos.reduce((sum, repo) => sum + (repo.stars || 0), 0);
  const totalContributors = repos.reduce((sum, repo) => sum + (repo.contributors || 0), 0);
  
  return {
    totalStars,
    totalPRs: Math.floor(Math.random() * 500) + 100,
    totalContributors,
    totalCommits: Math.floor(Math.random() * 10000) + 1000,
    starsTrend: (Math.random() - 0.5) * 20,
    prsTrend: (Math.random() - 0.5) * 15,
    contributorsTrend: (Math.random() - 0.5) * 10,
    commitsTrend: (Math.random() - 0.5) * 25,
  };
};

// Generate mock trend data for now
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

// Generate activity data from merged PRs
const generateActivityDataFromPRs = (mergedPRs: MergedPR[]): ActivityDataPoint[] => {
  // Group PRs by date
  const prsByDate = new Map<string, MergedPR[]>();
  
  mergedPRs.forEach(pr => {
    const date = new Date(pr.merged_at).toISOString().split('T')[0];
    if (!prsByDate.has(date)) {
      prsByDate.set(date, []);
    }
    prsByDate.get(date)!.push(pr);
  });
  
  // Calculate daily statistics for candlestick chart
  const activityData: ActivityDataPoint[] = [];
  
  prsByDate.forEach((prs, date) => {
    const totalAdditions = prs.reduce((sum, pr) => sum + pr.additions, 0);
    const totalDeletions = prs.reduce((sum, pr) => sum + pr.deletions, 0);
    const totalCommits = prs.reduce((sum, pr) => sum + pr.commits, 0);
    const totalFilesChanged = prs.reduce((sum, pr) => sum + pr.changed_files, 0);
    
    activityData.push({
      date,
      additions: totalAdditions,
      deletions: totalDeletions,
      commits: totalCommits,
      files_changed: totalFilesChanged,
    });
  });
  
  // Sort by date
  activityData.sort((a, b) => a.date.localeCompare(b.date));
  
  // If no real data, generate mock data for last 30 days
  if (activityData.length === 0) {
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      activityData.push({
        date: date.toISOString().split('T')[0],
        additions: Math.floor(Math.random() * 500) + 50,
        deletions: Math.floor(Math.random() * 300) + 30,
        commits: Math.floor(Math.random() * 20) + 1,
        files_changed: Math.floor(Math.random() * 30) + 1,
      });
    }
  }
  
  return activityData;
};

export default function WorkspacePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [metrics, setMetrics] = useState<WorkspaceMetrics | null>(null);
  const [trendData, setTrendData] = useState<WorkspaceTrendData | null>(null);
  const [activityData, setActivityData] = useState<ActivityDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchWorkspace() {
      if (!workspaceId) {
        setError('No workspace ID provided');
        setLoading(false);
        return;
      }

      try {
        // Fetch workspace details
        const { data: workspaceData, error: wsError } = await supabase
          .from('workspaces')
          .select('*')
          .eq('id', workspaceId)
          .eq('is_active', true)
          .single();

        if (wsError || !workspaceData) {
          setError('Workspace not found');
          setLoading(false);
          return;
        }

        // Fetch repositories with their details
        const { data: repoData, error: repoError } = await supabase
          .from('workspace_repositories')
          .select(`
            *,
            repositories (
              id,
              full_name,
              name,
              owner,
              description,
              language,
              stargazers_count,
              forks_count,
              open_issues_count
            )
          `)
          .eq('workspace_id', workspaceId);

        if (repoError) {
          console.error('Error fetching repositories:', repoError);
        }

        // Transform repository data to match the Repository interface
        const transformedRepos: Repository[] = (repoData || [])
          .filter(r => r.repositories)
          .map((r: WorkspaceRepository) => ({
            id: r.repositories.id,
            full_name: r.repositories.full_name,
            owner: r.repositories.owner,
            name: r.repositories.name,
            description: r.repositories.description,
            language: r.repositories.language,
            stars: r.repositories.stargazers_count,
            forks: r.repositories.forks_count,
            open_prs: Math.floor(Math.random() * 50) + 5, // Mock for now
            open_issues: r.repositories.open_issues_count,
            contributors: Math.floor(Math.random() * 100) + 10, // Mock for now
            last_activity: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
            is_pinned: r.is_pinned,
            avatar_url: `https://github.com/${r.repositories.owner}.png`,
            html_url: `https://github.com/${r.repositories.full_name}`,
          }));

        // Fetch merged PRs for activity data
        let mergedPRs: MergedPR[] = [];
        if (transformedRepos.length > 0) {
          const repoIds = transformedRepos.map(r => r.id);
          const { data: prData } = await supabase
            .from('pull_requests')
            .select('merged_at, additions, deletions, changed_files, commits')
            .in('repository_id', repoIds)
            .eq('merged', true)
            .not('merged_at', 'is', null)
            .gte('merged_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
          
          if (prData) {
            mergedPRs = prData as MergedPR[];
          }
        }

        setWorkspace(workspaceData);
        setRepositories(transformedRepos);
        
        // Generate metrics, trend data, and activity data
        const mockMetrics = generateMockMetrics(transformedRepos);
        const mockTrendData = generateMockTrendData(30);
        const activityDataPoints = generateActivityDataFromPRs(mergedPRs);
        
        setMetrics(mockMetrics);
        setTrendData(mockTrendData);
        setActivityData(activityDataPoints);
      } catch (err) {
        setError('Failed to load workspace');
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchWorkspace();
  }, [workspaceId]);

  if (loading) {
    return (
      <div className="container max-w-7xl mx-auto p-6">
        <WorkspaceDashboardSkeleton />
      </div>
    );
  }

  if (error || !workspace || !metrics || !trendData) {
    return (
      <div className="container max-w-7xl mx-auto p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error || 'Workspace not found'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleAddRepository = () => {
    toast.info('Add repository feature coming soon!');
  };

  const handleRepositoryClick = (repo: Repository) => {
    navigate(`/${repo.full_name}`);
  };

  const handleSettingsClick = () => {
    toast.info('Workspace settings coming soon!');
  };

  const handleUpgradeClick = () => {
    toast.info('Upgrade to Pro coming soon!');
  };

  return (
    <div className="container max-w-7xl mx-auto p-6">
      <WorkspaceDashboard
        workspaceId={workspace.id}
        workspaceName={workspace.name}
        metrics={metrics}
        trendData={trendData}
        activityData={activityData}
        repositories={repositories}
        tier="free"
        onAddRepository={handleAddRepository}
        onRepositoryClick={handleRepositoryClick}
        onSettingsClick={handleSettingsClick}
        onUpgradeClick={handleUpgradeClick}
      />
    </div>
  );
}
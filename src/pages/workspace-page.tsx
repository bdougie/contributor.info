import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useWorkspaceContributors } from '@/hooks/useWorkspaceContributors';
import { WorkspaceDashboard, WorkspaceDashboardSkeleton } from '@/components/features/workspace';
import { WorkspacePullRequestsTable, type PullRequest } from '@/components/features/workspace/WorkspacePullRequestsTable';
import { WorkspaceIssuesTable, type Issue } from '@/components/features/workspace/WorkspaceIssuesTable';
import { RepositoryFilter } from '@/components/features/workspace/RepositoryFilter';
import { ContributorsList, type Contributor } from '@/components/features/workspace/ContributorsList';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { GitPullRequest, AlertCircle, Users, Layout, Plus, Settings, TrendingUp, Activity } from '@/components/ui/icon';
import { TimeRangeSelector, type TimeRange } from '@/components/features/workspace/TimeRangeSelector';
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

// Pull Requests tab component
function WorkspacePRs({ repositories, selectedRepositories }: { repositories: Repository[], selectedRepositories: string[] }) {
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchPullRequests() {
      if (repositories.length === 0) {
        setPullRequests([]);
        setLoading(false);
        return;
      }

      try {
        // Filter repositories if specific ones are selected
        const filteredRepos = selectedRepositories.length > 0 
          ? repositories.filter(r => selectedRepositories.includes(r.id))
          : repositories;
        
        const repoIds = filteredRepos.map(r => r.id);
        const { data, error } = await supabase
          .from('pull_requests')
          .select(`
            id,
            github_id,
            number,
            title,
            state,
            created_at,
            updated_at,
            closed_at,
            merged_at,
            additions,
            deletions,
            changed_files,
            commits,
            html_url,
            repository_id,
            repositories!inner(
              id,
              name,
              owner,
              full_name
            ),
            contributors:author_id(
              username,
              avatar_url
            )
          `)
          .in('repository_id', repoIds)
          .order('updated_at', { ascending: false })
          .limit(100);

        if (error) {
          console.error('Error fetching pull requests:', error);
          setPullRequests([]);
        } else {
          // Transform data to match PullRequest interface
          const transformedPRs: PullRequest[] = (data || []).map(pr => ({
            id: pr.id,
            number: pr.number,
            title: pr.title,
            state: pr.merged_at ? 'merged' : pr.state === 'closed' ? 'closed' : 'open',
            repository: {
              name: (pr.repositories as any)?.name || 'unknown',
              owner: (pr.repositories as any)?.owner || 'unknown',
              avatar_url: `https://github.com/${(pr.repositories as any)?.owner || 'unknown'}.png`,
            },
            author: {
              username: (pr.contributors as any)?.username || 'unknown',
              avatar_url: (pr.contributors as any)?.avatar_url || '',
            },
            created_at: pr.created_at,
            updated_at: pr.updated_at,
            closed_at: pr.closed_at,
            merged_at: pr.merged_at,
            comments_count: 0, // We don't have this data yet
            commits_count: pr.commits || 0,
            additions: pr.additions || 0,
            deletions: pr.deletions || 0,
            changed_files: pr.changed_files || 0,
            labels: [], // We don't have this data yet
            reviewers: [], // We don't have this data yet
            url: pr.html_url,
          }));
          setPullRequests(transformedPRs);
        }
      } catch (err) {
        console.error('Error:', err);
        setPullRequests([]);
      } finally {
        setLoading(false);
      }
    }

    fetchPullRequests();
  }, [repositories, selectedRepositories]);

  const handlePullRequestClick = (pr: PullRequest) => {
    window.open(pr.url, '_blank');
  };

  const handleRepositoryClick = (owner: string, name: string) => {
    navigate(`/${owner}/${name}`);
  };

  return (
    <WorkspacePullRequestsTable
      pullRequests={pullRequests}
      loading={loading}
      onPullRequestClick={handlePullRequestClick}
      onRepositoryClick={handleRepositoryClick}
    />
  );
}

// Issues tab component
function WorkspaceIssues({ repositories, selectedRepositories }: { repositories: Repository[], selectedRepositories: string[] }) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchIssues() {
      if (repositories.length === 0) {
        setIssues([]);
        setLoading(false);
        return;
      }

      try {
        // Filter repositories if specific ones are selected
        const filteredRepos = selectedRepositories.length > 0 
          ? repositories.filter(r => selectedRepositories.includes(r.id))
          : repositories;
        
        const repoIds = filteredRepos.map(r => r.id);
        const { data, error } = await supabase
          .from('issues')
          .select(`
            id,
            github_id,
            number,
            title,
            state,
            created_at,
            updated_at,
            closed_at,
            html_url,
            repository_id,
            repositories!inner(
              id,
              name,
              owner,
              full_name
            ),
            contributors:author_id(
              username,
              avatar_url
            )
          `)
          .in('repository_id', repoIds)
          .order('updated_at', { ascending: false })
          .limit(100);

        if (error) {
          console.error('Error fetching issues:', error);
          setIssues([]);
        } else {
          // Transform data to match Issue interface
          const transformedIssues: Issue[] = (data || []).map(issue => ({
            id: issue.id,
            number: issue.number,
            title: issue.title,
            state: issue.state as 'open' | 'closed',
            repository: {
              name: (issue.repositories as any)?.name || 'unknown',
              owner: (issue.repositories as any)?.owner || 'unknown',
              avatar_url: `https://github.com/${(issue.repositories as any)?.owner || 'unknown'}.png`,
            },
            author: {
              username: (issue.contributors as any)?.username || 'unknown',
              avatar_url: (issue.contributors as any)?.avatar_url || '',
            },
            created_at: issue.created_at,
            updated_at: issue.updated_at,
            closed_at: issue.closed_at,
            comments_count: 0, // We don't have this data yet
            labels: [], // We don't have this data yet
            url: issue.html_url,
          }));
          setIssues(transformedIssues);
        }
      } catch (err) {
        console.error('Error:', err);
        setIssues([]);
      } finally {
        setLoading(false);
      }
    }

    fetchIssues();
  }, [repositories, selectedRepositories]);

  const handleIssueClick = (issue: Issue) => {
    window.open(issue.url, '_blank');
  };

  const handleRepositoryClick = (owner: string, name: string) => {
    navigate(`/${owner}/${name}`);
  };

  return (
    <WorkspaceIssuesTable
      issues={issues}
      loading={loading}
      onIssueClick={handleIssueClick}
      onRepositoryClick={handleRepositoryClick}
    />
  );
}

function WorkspaceContributors({ repositories, selectedRepositories }: { repositories: Repository[]; selectedRepositories: string[] }) {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const [showAddContributors, setShowAddContributors] = useState(false);
  const [selectedContributorsToAdd, setSelectedContributorsToAdd] = useState<string[]>([]);

  const {
    contributors,
    allAvailableContributors,
    workspaceContributorIds,
    loading,
    error,
    addContributorsToWorkspace,
    removeContributorFromWorkspace,
  } = useWorkspaceContributors({
    workspaceId: workspaceId!,
    repositories,
    selectedRepositories,
  });

  const handleContributorClick = (contributor: Contributor) => {
    navigate(`/${contributor.username}`);
  };

  const handleTrackContributor = (contributorId: string) => {
    if (showAddContributors) {
      // In add mode, toggle selection
      setSelectedContributorsToAdd(prev => 
        prev.includes(contributorId) 
          ? prev.filter(id => id !== contributorId)
          : [...prev, contributorId]
      );
    }
  };

  const handleUntrackContributor = async (contributorId: string) => {
    await removeContributorFromWorkspace(contributorId);
  };

  const handleAddContributor = () => {
    setShowAddContributors(true);
    setSelectedContributorsToAdd([]);
  };

  const handleSubmitContributors = async () => {
    if (selectedContributorsToAdd.length > 0) {
      await addContributorsToWorkspace(selectedContributorsToAdd);
      setShowAddContributors(false);
      setSelectedContributorsToAdd([]);
    } else {
      toast.warning('Please select at least one contributor to add');
    }
  };

  const handleCancelAdd = () => {
    setShowAddContributors(false);
    setSelectedContributorsToAdd([]);
  };

  // Show error state if there's an error
  if (error) {
    return (
      <div className="container max-w-7xl mx-auto">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Contributors</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto">
      {showAddContributors ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Add Contributors to Workspace</CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {selectedContributorsToAdd.length} selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelAdd}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmitContributors}
                  disabled={selectedContributorsToAdd.length === 0}
                >
                  Add Selected
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ContributorsList
              contributors={allAvailableContributors}
              trackedContributors={selectedContributorsToAdd}
              onTrackContributor={handleTrackContributor}
              onUntrackContributor={(id) => {
                setSelectedContributorsToAdd(prev => prev.filter(cId => cId !== id));
              }}
              onContributorClick={handleContributorClick}
              loading={loading}
              view="list"
            />
          </CardContent>
        </Card>
      ) : (
        <ContributorsList
          contributors={contributors}
          trackedContributors={workspaceContributorIds}
          onTrackContributor={handleTrackContributor}
          onUntrackContributor={handleUntrackContributor}
          onContributorClick={handleContributorClick}
          onAddContributor={handleAddContributor}
          loading={loading}
          view="grid"
        />
      )}
    </div>
  );
}

function WorkspaceActivity({ repositories }: { repositories: Repository[] }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Activity timeline coming soon...</p>
          <p className="text-sm text-muted-foreground mt-2">
            This will show a detailed timeline of all activity across {repositories.length} repositories in this workspace,
            including commits, pull requests, issues, and releases.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function WorkspaceSettings({ workspace }: { workspace: WorkspaceData }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Workspace Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Workspace settings coming soon...</p>
          <p className="text-sm text-muted-foreground mt-2">
            Manage workspace "{workspace.name}" settings, members, repositories, and permissions here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function WorkspacePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [metrics, setMetrics] = useState<WorkspaceMetrics | null>(null);
  const [trendData, setTrendData] = useState<WorkspaceTrendData | null>(null);
  const [activityData, setActivityData] = useState<ActivityDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [selectedRepositories, setSelectedRepositories] = useState<string[]>([]);

  // Determine active tab from URL
  const pathSegments = location.pathname.split('/');
  const activeTab = pathSegments[3] || 'overview';

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
            description: r.repositories.description ?? undefined,
            language: r.repositories.language ?? undefined,
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
        const timeRangeDays = {
          '7d': 7,
          '30d': 30,
          '90d': 90,
          '1y': 365,
          'all': 730
        };
        const mockMetrics = generateMockMetrics(transformedRepos);
        const mockTrendData = generateMockTrendData(timeRangeDays[timeRange]);
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
  }, [workspaceId, timeRange]);

  const handleTabChange = (value: string) => {
    if (value === 'overview') {
      navigate(`/i/${workspaceId}`);
    } else {
      navigate(`/i/${workspaceId}/${value}`);
    }
  };

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
    <div className="min-h-screen">
      {/* Workspace Header */}
      <div className="container max-w-7xl mx-auto p-6 pb-0">
        <div className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {workspace.name}
              </h1>
              {workspace.description && (
                <p className="text-muted-foreground mt-1">
                  {workspace.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <TimeRangeSelector
                value={timeRange}
                onChange={setTimeRange}
                tier="free"
                onUpgradeClick={handleUpgradeClick}
                variant="select"
              />
              <RepositoryFilter
                repositories={repositories.map(repo => ({
                  id: repo.id,
                  name: repo.name,
                  owner: repo.owner,
                  full_name: repo.full_name,
                  avatar_url: repo.avatar_url,
                  language: repo.language,
                  last_activity: repo.last_activity,
                }))}
                selectedRepositories={selectedRepositories}
                onSelectionChange={setSelectedRepositories}
                className="w-[200px]"
              />
              <Button
                onClick={handleAddRepository}
                size="sm"
                variant="outline"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Repository
              </Button>
              <Button
                onClick={handleSettingsClick}
                size="sm"
                variant="outline"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="px-6">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <div className="container max-w-7xl mx-auto">
            <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Layout className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="prs" className="flex items-center gap-2">
            <GitPullRequest className="h-4 w-4" />
            <span className="hidden sm:inline">PRs</span>
          </TabsTrigger>
          <TabsTrigger value="issues" className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Issues</span>
          </TabsTrigger>
          <TabsTrigger value="contributors" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Contributors</span>
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2" disabled>
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Activity</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2" disabled>
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Settings</span>
          </TabsTrigger>
        </TabsList>
          </div>

        <TabsContent value="overview" className="mt-6 space-y-4">
          <div className="container max-w-7xl mx-auto">
          <WorkspaceDashboard
            workspaceId={workspace.id}
            workspaceName=""
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
        </TabsContent>

        <TabsContent value="prs" className="mt-6">
          <WorkspacePRs repositories={repositories} selectedRepositories={selectedRepositories} />
        </TabsContent>

        <TabsContent value="issues" className="mt-6">
          <WorkspaceIssues repositories={repositories} selectedRepositories={selectedRepositories} />
        </TabsContent>

        <TabsContent value="contributors" className="mt-6">
          <WorkspaceContributors repositories={repositories} selectedRepositories={selectedRepositories} />
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <div className="container max-w-7xl mx-auto">
            <WorkspaceActivity repositories={repositories} />
          </div>
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <div className="container max-w-7xl mx-auto">
            <WorkspaceSettings workspace={workspace} />
          </div>
        </TabsContent>
      </Tabs>
      </div>

      {/* Upgrade Prompt for Free Tier */}
      <div className="container max-w-7xl mx-auto px-6 pb-6 mt-6">
        <div className="rounded-lg border bg-muted/50 p-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">Unlock Advanced Analytics</h3>
            <div className="rounded-full bg-primary/10 p-1">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Upgrade to Pro to access historical data beyond 30 days, advanced metrics, and priority support.
          </p>
          <Button 
            onClick={handleUpgradeClick} 
            variant="default" 
            size="sm"
            className="mt-3"
          >
            Upgrade to Pro
          </Button>
        </div>
      </div>
      </div>
    </div>
  );
}
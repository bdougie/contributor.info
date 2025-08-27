import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { useWorkspaceContributors } from '@/hooks/useWorkspaceContributors';
import { WorkspaceDashboard, WorkspaceDashboardSkeleton } from '@/components/features/workspace';
import {
  WorkspacePullRequestsTable,
  type PullRequest,
} from '@/components/features/workspace/WorkspacePullRequestsTable';
import {
  WorkspaceIssuesTable,
  type Issue,
} from '@/components/features/workspace/WorkspaceIssuesTable';
import { RepositoryFilter } from '@/components/features/workspace/RepositoryFilter';
import {
  ContributorsList,
  type Contributor,
} from '@/components/features/workspace/ContributorsList';
import { AddRepositoryModal } from '@/components/features/workspace/AddRepositoryModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  GitPullRequest,
  AlertCircle,
  Users,
  Layout,
  Plus,
  Settings,
  TrendingUp,
  TrendingDown,
  Activity,
  Search,
  Menu,
  Package,
} from '@/components/ui/icon';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import {
  TimeRangeSelector,
  type TimeRange,
} from '@/components/features/workspace/TimeRangeSelector';
import type {
  WorkspaceMetrics,
  WorkspaceTrendData,
  Repository,
  ActivityDataPoint,
} from '@/components/features/workspace';
import type { Workspace } from '@/types/workspace';
import { WorkspaceService } from '@/services/workspace.service';

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

// Time range mappings - shared across the component
const TIME_RANGE_DAYS = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
  all: 730, // 2 years for "all" to limit data size
} as const;

/**
 * Utility function to filter repositories based on selection
 * @param repos - All available repositories
 * @param selectedRepoIds - Array of selected repository IDs (empty array means show all)
 * @returns Filtered array of repositories
 */
const filterRepositoriesBySelection = <T extends { id: string }>(
  repos: T[],
  selectedRepoIds?: string[]
): T[] => {
  // If no selection provided or empty selection, return all repositories
  if (!selectedRepoIds || selectedRepoIds.length === 0) {
    return repos;
  }
  // Filter repositories by selected IDs
  return repos.filter((repo) => selectedRepoIds.includes(repo.id));
};

// Generate mock metrics for now
const generateMockMetrics = (
  repos: Repository[],
  timeRange: TimeRange,
  selectedRepoIds?: string[]
): WorkspaceMetrics => {
  // Use utility function to filter repositories
  const filteredRepos = filterRepositoriesBySelection(repos, selectedRepoIds);

  const totalStars = filteredRepos.reduce((sum, repo) => sum + (repo.stars || 0), 0);
  const totalContributors = filteredRepos.reduce((sum, repo) => sum + (repo.contributors || 0), 0);

  // Generate time-range aware trend percentages
  // Shorter time ranges typically show more volatile changes
  const getTimeRangeMultiplier = (range: TimeRange): number => {
    switch (range) {
      case '7d':
        return 1.0; // More volatile for 7 days
      case '30d':
        return 0.7; // Moderate for 30 days
      case '90d':
        return 0.5; // Less volatile for 90 days
      case '1y':
        return 0.3; // Even less for 1 year
      case 'all':
        return 0.2; // Least volatile for all time
      default:
        return 0.7;
    }
  };

  const multiplier = getTimeRangeMultiplier(timeRange);

  return {
    totalStars,
    totalPRs: Math.floor(Math.random() * 500) + 100,
    totalContributors,
    totalCommits: Math.floor(Math.random() * 10000) + 1000,
    starsTrend: (Math.random() - 0.5) * 20 * multiplier,
    prsTrend: (Math.random() - 0.5) * 15 * multiplier,
    contributorsTrend: (Math.random() - 0.5) * 10 * multiplier,
    commitsTrend: (Math.random() - 0.5) * 25 * multiplier,
  };
};

// Generate mock trend data for now
const generateMockTrendData = (
  days: number,
  repos?: Repository[],
  selectedRepoIds?: string[]
): WorkspaceTrendData => {
  // Use utility function to filter repositories (for future use with real data)
  const filteredRepos = repos ? filterRepositoriesBySelection(repos, selectedRepoIds) : [];

  // Currently using mock data, but scale based on filtered repo count
  const repoMultiplier =
    filteredRepos.length > 0 && repos && repos.length > 0
      ? Math.max(0.1, filteredRepos.length / repos.length)
      : 1;
  const labels = [];
  const prs = [];
  const issues = [];
  const commits = [];

  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));

    prs.push(Math.floor((Math.random() * 30 + 10) * repoMultiplier));
    issues.push(Math.floor((Math.random() * 20 + 5) * repoMultiplier));
    commits.push(Math.floor((Math.random() * 60 + 20) * repoMultiplier));
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

// Generate activity data from merged PRs with better aggregation
// Note: repos and selectedRepoIds params reserved for future filtering implementation
const generateActivityDataFromPRs = (
  mergedPRs: MergedPR[],
  timeRange: TimeRange,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _repos?: Repository[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _selectedRepoIds?: string[]
): ActivityDataPoint[] => {
  // If no data at all, return empty array (let the chart handle empty state)
  if (!mergedPRs || mergedPRs.length === 0) {
    return [];
  }

  // Group PRs by date
  const prsByDate = new Map<string, MergedPR[]>();

  mergedPRs.forEach((pr) => {
    const date = new Date(pr.merged_at).toISOString().split('T')[0];
    if (!prsByDate.has(date)) {
      prsByDate.set(date, []);
    }
    prsByDate.get(date)!.push(pr);
  });

  // Calculate daily statistics for candlestick chart
  const activityData: ActivityDataPoint[] = [];

  prsByDate.forEach((prs, date) => {
    const totalAdditions = prs.reduce((sum, pr) => sum + (pr.additions || 0), 0);
    const totalDeletions = prs.reduce((sum, pr) => sum + (pr.deletions || 0), 0);
    const totalCommits = prs.reduce((sum, pr) => sum + (pr.commits || 0), 0);
    const totalFilesChanged = prs.reduce((sum, pr) => sum + (pr.changed_files || 0), 0);

    // Only add data points that have actual activity
    if (totalAdditions > 0 || totalDeletions > 0 || totalCommits > 0) {
      activityData.push({
        date,
        additions: totalAdditions,
        deletions: totalDeletions,
        commits: totalCommits,
        files_changed: totalFilesChanged,
      });
    }
  });

  // Sort by date
  activityData.sort((a, b) => a.date.localeCompare(b.date));

  // Fill in gaps for continuous chart display (optional, only for recent dates)
  if (activityData.length > 0 && timeRange !== 'all') {
    const filledData: ActivityDataPoint[] = [];
    const startDate = new Date(activityData[0].date);
    const endDate = new Date(activityData[activityData.length - 1].date);
    const dataMap = new Map(activityData.map((d) => [d.date, d]));

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      filledData.push(
        dataMap.get(dateStr) || {
          date: dateStr,
          additions: 0,
          deletions: 0,
          commits: 0,
          files_changed: 0,
        }
      );
    }

    return filledData;
  }

  return activityData;
};

// Pull Requests tab component
function WorkspacePRs({
  repositories,
  selectedRepositories,
}: {
  repositories: Repository[];
  selectedRepositories: string[];
}) {
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
        // Use utility function to filter repositories
        const filteredRepos = filterRepositoriesBySelection(repositories, selectedRepositories);

        const repoIds = filteredRepos.map((r) => r.id);
        const { data, error } = await supabase
          .from('pull_requests')
          .select(
            `
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
          `
          )
          .in('repository_id', repoIds)
          .order('updated_at', { ascending: false })
          .limit(100);

        if (error) {
          console.error('Error fetching pull requests:', error);
          setPullRequests([]);
        } else {
          // Transform data to match PullRequest interface
          // Note: Supabase returns single objects for relationships when using !inner
          type PRData = {
            id: string;
            github_id: number;
            number: number;
            title: string;
            state: string;
            created_at: string;
            updated_at: string;
            closed_at: string | null;
            merged_at: string | null;
            additions: number | null;
            deletions: number | null;
            changed_files: number | null;
            commits: number | null;
            html_url: string;
            repository_id: string;
            repositories?: {
              id: string;
              name: string;
              owner: string;
              full_name: string;
            };
            contributors?: {
              username: string;
              avatar_url: string;
            };
          };

          const transformedPRs: PullRequest[] = ((data || []) as unknown as PRData[]).map((pr) => ({
            id: pr.id,
            number: pr.number,
            title: pr.title,
            state: (() => {
              if (pr.merged_at) return 'merged';
              if (pr.state === 'closed') return 'closed';
              return 'open';
            })(),
            repository: {
              name: pr.repositories?.name || 'unknown',
              owner: pr.repositories?.owner || 'unknown',
              avatar_url: `https://avatars.githubusercontent.com/${pr.repositories?.owner || 'unknown'}`,
            },
            author: {
              username: pr.contributors?.username || 'unknown',
              avatar_url: pr.contributors?.avatar_url || '',
            },
            created_at: pr.created_at,
            updated_at: pr.updated_at,
            closed_at: pr.closed_at || undefined,
            merged_at: pr.merged_at || undefined,
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

// Type definitions for Issue labels
interface IssueLabel {
  name: string;
  color: string;
  id?: number;
}

// Issues tab component
function WorkspaceIssues({
  repositories,
  selectedRepositories,
}: {
  repositories: Repository[];
  selectedRepositories: string[];
}) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchIssues() {
      if (repositories.length === 0) {
        setIssues([]);
        setLoading(false);
        return;
      }

      try {
        // Use utility function to filter repositories
        const filteredRepos = filterRepositoriesBySelection(repositories, selectedRepositories);

        const repoIds = filteredRepos.map((r) => r.id);

        // Fetch issues with pagination support
        // Note: Using .limit() instead of .range() to avoid HTTP 206 partial responses
        const { data, error } = await supabase
          .from('issues')
          .select(
            `
            id,
            github_id,
            number,
            title,
            body,
            state,
            created_at,
            updated_at,
            closed_at,
            labels,
            comments_count,
            repository_id,
            repositories(
              id,
              name,
              owner,
              full_name
            ),
            contributors:author_id(
              username,
              avatar_url
            )
          `
          )
          .in('repository_id', repoIds)
          .order('updated_at', { ascending: false })
          .limit(100); // Using limit instead of range to get full 200 response

        if (error) {
          console.error('Failed to fetch workspace issues:', {
            message: error.message,
            code: error.code,
            details: error.details,
          });
          // Improved error handling with user-friendly message
          setError('Failed to load issues. Please try again later.');
          setIssues([]);
        } else {
          // Transform data to match Issue interface
          interface IssueQueryResult {
            id: string;
            github_id: number;
            number: number;
            title: string;
            body: string | null;
            state: string;
            created_at: string;
            updated_at: string;
            closed_at: string | null;
            labels: IssueLabel[] | null;
            comments_count: number | null;
            repository_id: string;
            repositories?: {
              id: string;
              name: string;
              owner: string;
              full_name: string;
            };
            contributors?: {
              username: string;
              avatar_url: string;
            };
          }

          const transformedIssues: Issue[] = ((data || []) as unknown as IssueQueryResult[]).map(
            (issue) => ({
              id: issue.id,
              number: issue.number,
              title: issue.title,
              state: issue.state as 'open' | 'closed',
              repository: {
                name: issue.repositories?.name || 'unknown',
                owner: issue.repositories?.owner || 'unknown',
                avatar_url: `https://avatars.githubusercontent.com/${issue.repositories?.owner || 'unknown'}`,
              },
              author: {
                username: issue.contributors?.username || 'unknown',
                avatar_url: issue.contributors?.avatar_url || '',
              },
              created_at: issue.created_at,
              updated_at: issue.updated_at,
              closed_at: issue.closed_at || undefined,
              comments_count: issue.comments_count || 0,
              labels: Array.isArray(issue.labels)
                ? (issue.labels as IssueLabel[])
                    .map((label) => ({
                      name: label.name,
                      color: label.color || '000000',
                    }))
                    .filter((l) => l.name) // Filter out labels without names
                : [],
              // Improved URL construction with validation
              url:
                issue.repositories?.full_name && issue.number
                  ? `https://github.com/${issue.repositories.full_name}/issues/${issue.number}`
                  : '', // Empty string when repository data is missing to prevent broken links
            })
          );
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
    // Only open if URL exists
    if (issue.url) {
      window.open(issue.url, '_blank');
    }
  };

  const handleRepositoryClick = (owner: string, name: string) => {
    navigate(`/${owner}/${name}`);
  };

  // Display error message if there's an error
  if (error) {
    return (
      <div className="container max-w-7xl mx-auto p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <WorkspaceIssuesTable
      issues={issues}
      loading={loading}
      onIssueClick={handleIssueClick}
      onRepositoryClick={handleRepositoryClick}
    />
  );
}

function WorkspaceContributors({
  repositories,
  selectedRepositories,
  workspaceId,
}: {
  repositories: Repository[];
  selectedRepositories: string[];
  workspaceId: string;
}) {
  const navigate = useNavigate();
  const [showAddContributors, setShowAddContributors] = useState(false);
  const [selectedContributorsToAdd, setSelectedContributorsToAdd] = useState<string[]>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const {
    contributors,
    allAvailableContributors,
    workspaceContributorIds,
    loading,
    error,
    addContributorsToWorkspace,
    removeContributorFromWorkspace,
  } = useWorkspaceContributors({
    workspaceId: workspaceId,
    repositories,
    selectedRepositories,
  });

  const handleContributorClick = (contributor: Contributor) => {
    navigate(`/contributor/${contributor.username}`);
  };

  const handleTrackContributor = (contributorId: string) => {
    if (showAddContributors) {
      // In add mode, toggle selection
      setSelectedContributorsToAdd((prev) =>
        prev.includes(contributorId)
          ? prev.filter((id) => id !== contributorId)
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

  // Define columns for the add contributors table
  const addColumns: ColumnDef<Contributor>[] = [
    {
      id: 'select',
      size: 40,
      header: ({ table }) => (
        <div className="ml-2">
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="ml-2">
          <Checkbox
            checked={selectedContributorsToAdd.includes(row.original.id)}
            onCheckedChange={(value) => {
              if (value) {
                setSelectedContributorsToAdd((prev) => [...prev, row.original.id]);
              } else {
                setSelectedContributorsToAdd((prev) => prev.filter((id) => id !== row.original.id));
              }
            }}
            aria-label="Select row"
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'username',
      header: 'Contributor',
      size: 350,
      cell: ({ row }) => {
        const contributor = row.original;
        return (
          <div className="flex items-center gap-3">
            <img
              src={contributor.avatar_url}
              alt={contributor.username}
              className="h-8 w-8 rounded-full"
            />
            <div>
              <p className="font-medium">{contributor.name || contributor.username}</p>
              <p className="text-sm text-muted-foreground">@{contributor.username}</p>
            </div>
          </div>
        );
      },
    },
    {
      id: 'stats',
      header: () => <div className="text-right">Data</div>,
      size: 450,
      cell: ({ row }) => {
        const stats = row.original.contributions;
        const trend = row.original.stats.contribution_trend;
        let trendColor: string;
        if (trend > 0) {
          trendColor = 'text-green-600';
        } else if (trend < 0) {
          trendColor = 'text-red-600';
        } else {
          trendColor = 'text-muted-foreground';
        }
        const TrendIcon = trend > 0 ? TrendingUp : TrendingDown;

        // Get repository data from the contributor
        const repoCount = row.original.stats.repositories_contributed;

        // For now, we'll use empty array since repositories aren't directly attached to contributors
        const repoOwners: string[] = [];

        // Show up to 4 repos, or however many are available
        const maxDisplay = 4;
        const displayOwners = repoOwners.slice(0, maxDisplay);
        const remainingCount = Math.max(0, repoCount - maxDisplay);

        return (
          <div className="flex items-center justify-end gap-6 text-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <GitPullRequest className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{stats.pull_requests}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{stats.issues}</span>
              </div>
            </div>
            {displayOwners.length > 0 ? (
              <div className="flex items-center gap-1.5">
                <div className="flex -space-x-1.5">
                  {displayOwners.map((owner, i) => (
                    <img
                      key={`${owner}_${i}`}
                      src={`https://avatars.githubusercontent.com/${owner}?size=40`}
                      alt={`${owner} organization`}
                      className="h-5 w-5 rounded-sm border border-border object-cover"
                      loading="lazy"
                      onError={(e) => {
                        // Hide on error instead of showing fallback
                        const target = e.currentTarget as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  ))}
                </div>
                {remainingCount > 0 && (
                  <span className="text-xs text-muted-foreground font-medium">
                    +{remainingCount}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">
                {repoCount} {repoCount === 1 ? 'repo' : 'repos'}
              </span>
            )}
            <div className="flex items-center gap-1.5 min-w-[70px] justify-end">
              <TrendIcon className={`h-4 w-4 ${trendColor}`} />
              <span className={`font-medium ${trendColor}`}>
                {trend > 0 ? '+' : ''}
                {trend}%
              </span>
            </div>
          </div>
        );
      },
    },
  ];

  // Define columns for the view list (without checkbox)
  const viewColumns: ColumnDef<Contributor>[] = [
    {
      accessorKey: 'username',
      header: 'Contributor',
      size: 400,
      cell: ({ row }) => {
        const contributor = row.original;
        return (
          <div className="flex items-center gap-3">
            <img
              src={contributor.avatar_url}
              alt={contributor.username}
              className="h-8 w-8 rounded-full"
            />
            <div>
              <p className="font-medium">{contributor.name || contributor.username}</p>
              <p className="text-sm text-muted-foreground">@{contributor.username}</p>
            </div>
          </div>
        );
      },
    },
    {
      id: 'stats',
      header: () => <div className="text-right">Data</div>,
      size: 500,
      cell: ({ row }) => {
        const stats = row.original.contributions;
        const trend = row.original.stats.contribution_trend;
        let trendColor: string;
        if (trend > 0) {
          trendColor = 'text-green-600';
        } else if (trend < 0) {
          trendColor = 'text-red-600';
        } else {
          trendColor = 'text-muted-foreground';
        }
        const TrendIcon = trend > 0 ? TrendingUp : TrendingDown;

        // Get repository data from the contributor
        const repoCount = row.original.stats.repositories_contributed;

        // For now, we'll use empty array since repositories aren't directly attached to contributors
        const repoOwners: string[] = [];

        // Show up to 4 repos, or however many are available
        const maxDisplay = 4;
        const displayOwners = repoOwners.slice(0, maxDisplay);
        const remainingCount = Math.max(0, repoCount - maxDisplay);

        return (
          <div className="flex items-center justify-end gap-6 text-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <GitPullRequest className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{stats.pull_requests}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{stats.issues}</span>
              </div>
            </div>
            {displayOwners.length > 0 ? (
              <div className="flex items-center gap-1.5">
                <div className="flex -space-x-1.5">
                  {displayOwners.map((owner, i) => (
                    <img
                      key={`${owner}_${i}`}
                      src={`https://avatars.githubusercontent.com/${owner}?size=40`}
                      alt={`${owner} organization`}
                      className="h-5 w-5 rounded-sm border border-border object-cover"
                      loading="lazy"
                      onError={(e) => {
                        // Hide on error instead of showing fallback
                        const target = e.currentTarget as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  ))}
                </div>
                {remainingCount > 0 && (
                  <span className="text-xs text-muted-foreground font-medium">
                    +{remainingCount}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">
                {repoCount} {repoCount === 1 ? 'repo' : 'repos'}
              </span>
            )}
            <div className="flex items-center gap-1.5 min-w-[70px] justify-end">
              <TrendIcon className={`h-4 w-4 ${trendColor}`} />
              <span className={`font-medium ${trendColor}`}>
                {trend > 0 ? '+' : ''}
                {trend}%
              </span>
            </div>
          </div>
        );
      },
    },
  ];

  const addTable = useReactTable({
    data: allAvailableContributors,
    columns: addColumns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  const viewTable = useReactTable({
    data: contributors,
    columns: viewColumns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

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
                <Button variant="outline" size="sm" onClick={handleCancelAdd}>
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
            {/* Search Input */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search contributors..."
                  value={globalFilter ?? ''}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Table */}
            <div className="rounded-md border">
              <table className="w-full">
                <thead>
                  {addTable.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id} className="border-b">
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          className="px-4 py-3 text-left font-medium text-sm"
                          style={{
                            width: header.column.columnDef.size,
                            minWidth: header.column.columnDef.size,
                          }}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {addTable.getRowModel().rows.length > 0 ? (
                    addTable.getRowModel().rows.map((row) => (
                      <tr key={row.id} className="border-b hover:bg-muted/50 transition-colors">
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            className="px-4 py-3"
                            style={{
                              width: cell.column.columnDef.size,
                              minWidth: cell.column.columnDef.size,
                            }}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={addColumns.length}
                        className="px-4 py-8 text-center text-muted-foreground"
                      >
                        No contributors found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {addTable.getState().pagination.pageIndex * 10 + 1} to{' '}
                {Math.min(
                  (addTable.getState().pagination.pageIndex + 1) * 10,
                  allAvailableContributors.length
                )}{' '}
                of {allAvailableContributors.length} contributors
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addTable.previousPage()}
                  disabled={!addTable.getCanPreviousPage()}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addTable.nextPage()}
                  disabled={!addTable.getCanNextPage()}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* View Toggle */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Contributors</h2>
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-lg border bg-muted/50 p-1">
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="px-3"
                  title="Grid view"
                >
                  <Package className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="px-3"
                  title="List view"
                >
                  <Menu className="h-4 w-4" />
                </Button>
              </div>
              <Button onClick={handleAddContributor} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Contributors
              </Button>
            </div>
          </div>

          {viewMode === 'grid' ? (
            <ContributorsList
              contributors={contributors}
              trackedContributors={workspaceContributorIds}
              onTrackContributor={handleTrackContributor}
              onUntrackContributor={handleUntrackContributor}
              onContributorClick={handleContributorClick}
              loading={loading}
              view="grid"
            />
          ) : (
            <Card>
              <CardContent className="p-6">
                {/* Search Input for List View */}
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search contributors..."
                      value={globalFilter ?? ''}
                      onChange={(e) => setGlobalFilter(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Table */}
                <div className="rounded-md border">
                  <table className="w-full">
                    <thead>
                      {viewTable.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id} className="border-b">
                          {headerGroup.headers.map((header) => (
                            <th
                              key={header.id}
                              className="px-4 py-3 text-left font-medium text-sm"
                              style={{
                                width: header.column.columnDef.size,
                                minWidth: header.column.columnDef.size,
                              }}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                            </th>
                          ))}
                        </tr>
                      ))}
                    </thead>
                    <tbody>
                      {viewTable.getRowModel().rows.length > 0 ? (
                        viewTable.getRowModel().rows.map((row) => (
                          <tr
                            key={row.id}
                            className="border-b hover:bg-muted/50 transition-colors cursor-pointer"
                            onClick={() => handleContributorClick(row.original)}
                          >
                            {row.getVisibleCells().map((cell) => (
                              <td
                                key={cell.id}
                                className="px-4 py-3"
                                style={{
                                  width: cell.column.columnDef.size,
                                  minWidth: cell.column.columnDef.size,
                                }}
                              >
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </td>
                            ))}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={viewColumns.length}
                            className="px-4 py-8 text-center text-muted-foreground"
                          >
                            No contributors found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {viewTable.getState().pagination.pageIndex * 10 + 1} to{' '}
                    {Math.min(
                      (viewTable.getState().pagination.pageIndex + 1) * 10,
                      contributors.length
                    )}{' '}
                    of {contributors.length} contributors
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => viewTable.previousPage()}
                      disabled={!viewTable.getCanPreviousPage()}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => viewTable.nextPage()}
                      disabled={!viewTable.getCanNextPage()}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
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
            This will show a detailed timeline of all activity across {repositories.length}{' '}
            repositories in this workspace, including commits, pull requests, issues, and releases.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function WorkspaceSettings({ workspace }: { workspace: Workspace }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Workspace Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Workspace settings coming soon...</p>
          <p className="text-sm text-muted-foreground mt-2">
            Manage workspace "{workspace.name}" settings, members, repositories, and permissions
            here.
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
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [metrics, setMetrics] = useState<WorkspaceMetrics | null>(null);
  const [trendData, setTrendData] = useState<WorkspaceTrendData | null>(null);
  const [activityData, setActivityData] = useState<ActivityDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [selectedRepositories, setSelectedRepositories] = useState<string[]>([]);
  const [addRepositoryModalOpen, setAddRepositoryModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isWorkspaceOwner, setIsWorkspaceOwner] = useState(false);

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
        // Get current user
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setCurrentUser(user);

        // Check if workspaceId is a UUID or a slug
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          workspaceId
        );

        // Fetch workspace details using either id or slug
        const { data: workspaceData, error: wsError } = isUUID
          ? await supabase
              .from('workspaces')
              .select('*')
              .eq('is_active', true)
              .eq('id', workspaceId)
              .maybeSingle()
          : await supabase
              .from('workspaces')
              .select('*')
              .eq('is_active', true)
              .eq('slug', workspaceId)
              .maybeSingle();

        if (wsError || !workspaceData) {
          setError('Workspace not found');
          setLoading(false);
          return;
        }

        // Check if current user is the workspace owner
        if (user && workspaceData.owner_id === user.id) {
          setIsWorkspaceOwner(true);
        } else {
          setIsWorkspaceOwner(false);
        }

        // Fetch repositories with their details (use the actual workspace ID)
        const { data: repoData, error: repoError } = await supabase
          .from('workspace_repositories')
          .select(
            `
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
          `
          )
          .eq('workspace_id', workspaceData.id);

        if (repoError) {
          console.error('Error fetching repositories:', repoError);
        }

        // Transform repository data to match the Repository interface
        const transformedRepos: Repository[] = (repoData || [])
          .filter((r) => r.repositories)
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
            last_activity: new Date(
              Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000
            ).toISOString(),
            is_pinned: r.is_pinned,
            avatar_url: `https://avatars.githubusercontent.com/${r.repositories.owner}`,
            html_url: `https://github.com/${r.repositories.full_name}`,
          }));

        // Fetch merged PRs for activity data - respect time range
        let mergedPRs: MergedPR[] = [];
        if (transformedRepos.length > 0) {
          // Use utility function to filter repositories
          const filteredRepos = filterRepositoriesBySelection(
            transformedRepos,
            selectedRepositories
          );
          const repoIds = filteredRepos.map((r) => r.id);

          // Calculate date range based on selected time range
          const daysToFetch = TIME_RANGE_DAYS[timeRange];
          const startDate = new Date(Date.now() - daysToFetch * 24 * 60 * 60 * 1000);

          // Fetch both merged PRs and all PR activity for better coverage
          const { data: prData, error: prError } = await supabase
            .from('pull_requests')
            .select(
              'merged_at, created_at, updated_at, additions, deletions, changed_files, commits, state'
            )
            .in('repository_id', repoIds)
            .or(
              `created_at.gte.${startDate.toISOString()},merged_at.gte.${startDate.toISOString()}`
            )
            .order('created_at', { ascending: true });

          if (prError) {
            console.error('Error fetching PR data for activity chart:', prError);
          }

          if (prData) {
            // Filter for merged PRs but handle null fields gracefully
            mergedPRs = prData
              .filter((pr) => pr.merged_at !== null)
              .map((pr) => ({
                merged_at: pr.merged_at,
                additions: pr.additions || 0,
                deletions: pr.deletions || 0,
                changed_files: pr.changed_files || 0,
                commits: pr.commits || 0,
              }));
          }

          // If no merged PRs found, try to get any open PRs for activity indication
          if (mergedPRs.length === 0 && prData) {
            console.log(
              `No merged PRs found for workspace in last ${daysToFetch} days, checking for any PR activity...`
            );
            // Use created_at for open PRs to show some activity
            const openPRActivity = prData
              .filter((pr) => pr.state === 'open' && pr.created_at)
              .map((pr) => ({
                merged_at: pr.created_at, // Use created_at as proxy for activity date
                additions: pr.additions || 0,
                deletions: pr.deletions || 0,
                changed_files: pr.changed_files || 0,
                commits: pr.commits || 0,
              }));

            if (openPRActivity.length > 0) {
              console.log(`Found ${openPRActivity.length} open PRs to show activity`);
              mergedPRs = openPRActivity;
            }
          }
        }

        setWorkspace(workspaceData);
        setRepositories(transformedRepos);

        // Generate metrics, trend data, and activity data
        const mockMetrics = generateMockMetrics(transformedRepos, timeRange, selectedRepositories);
        const mockTrendData = generateMockTrendData(
          TIME_RANGE_DAYS[timeRange],
          transformedRepos,
          selectedRepositories
        );
        const activityDataPoints = generateActivityDataFromPRs(
          mergedPRs,
          timeRange,
          transformedRepos,
          selectedRepositories
        );

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
  }, [workspaceId, timeRange, selectedRepositories]);

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

  const handleAddRepository = async () => {
    // Check if user is logged in first
    if (!currentUser) {
      // Trigger GitHub OAuth flow
      const redirectTo = window.location.origin + window.location.pathname;
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: redirectTo,
          scopes: 'read:user user:email public_repo',
        },
      });

      if (signInError) {
        toast.error('Failed to initiate sign in');
        console.error('Auth error:', signInError);
      }
      return;
    }
    setAddRepositoryModalOpen(true);
  };

  const handleAddRepositorySuccess = async () => {
    // Refresh the repositories list after adding
    if (!workspace) return;

    try {
      // Fetch repositories with their details
      const { data: repoData, error: repoError } = await supabase
        .from('workspace_repositories')
        .select(
          `
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
        `
        )
        .eq('workspace_id', workspace.id);

      if (!repoError && repoData) {
        const formattedRepos: Repository[] = repoData
          .filter((item: WorkspaceRepository) => item.repositories)
          .map((item: WorkspaceRepository) => ({
            id: item.repositories.id,
            full_name: item.repositories.full_name,
            name: item.repositories.name,
            owner: item.repositories.owner,
            description: item.repositories.description || '',
            language: item.repositories.language || '',
            stars: item.repositories.stargazers_count || 0,
            forks: item.repositories.forks_count || 0,
            open_prs: 0, // Mock for now
            open_issues: item.repositories.open_issues_count || 0,
            contributors: Math.floor(Math.random() * 50) + 10, // Mock for now
            avatar_url: `https://avatars.githubusercontent.com/${item.repositories.owner}`,
            last_activity: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split('T')[0],
            is_pinned: item.is_pinned || false,
            html_url: `https://github.com/${item.repositories.full_name}`,
          }));

        setRepositories(formattedRepos);
        setSelectedRepositories(formattedRepos.map((r) => r.id));

        // Update metrics with new repository data
        const newMetrics = generateMockMetrics(formattedRepos, timeRange, formattedRepos.map((r) => r.id));
        setMetrics(newMetrics);
      }
    } catch (error) {
      console.error('Error refreshing repositories:', error);
      toast.error('Failed to refresh repositories');
    }
  };

  const handleRemoveRepository = async (repo: Repository) => {
    if (!workspace || !currentUser) return;

    try {
      const result = await WorkspaceService.removeRepositoryFromWorkspace(
        workspace.id,
        currentUser.id,
        repo.id
      );

      if (result.success) {
        // Remove the repository from the local state immediately
        setRepositories((prev) => prev.filter((r) => r.id !== repo.id));

        // Also remove from selected repositories if it was selected
        setSelectedRepositories((prev) => prev.filter((id) => id !== repo.id));

        // Update metrics after removing repository
        const updatedRepos = repositories.filter((r) => r.id !== repo.id);
        const newMetrics = generateMockMetrics(updatedRepos, timeRange, selectedRepositories);
        setMetrics(newMetrics);

        toast.success('Repository removed from workspace');
      } else {
        toast.error(result.error || 'Failed to remove repository');
      }
    } catch (error) {
      console.error('Error removing repository:', error);
      toast.error('Failed to remove repository from workspace');
    }
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
              <h1 className="text-2xl font-bold tracking-tight">{workspace.name}</h1>
              {workspace.description && (
                <p className="text-muted-foreground mt-1">{workspace.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <TimeRangeSelector
                value={timeRange}
                onChange={setTimeRange}
                tier={workspace.tier as 'free' | 'pro' | 'enterprise'}
                onUpgradeClick={handleUpgradeClick}
                variant="select"
              />
              <RepositoryFilter
                repositories={repositories.map((repo) => ({
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
              <Button onClick={handleSettingsClick} size="sm" variant="outline">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="px-6 mt-6">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <div className="container max-w-7xl mx-auto">
            <TabsList className="grid w-full grid-cols-6 mb-6">
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
                tier={workspace.tier as 'free' | 'pro' | 'enterprise'}
                timeRange={timeRange}
                onAddRepository={isWorkspaceOwner ? handleAddRepository : undefined}
                onRemoveRepository={isWorkspaceOwner ? handleRemoveRepository : undefined}
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
            <WorkspaceIssues
              repositories={repositories}
              selectedRepositories={selectedRepositories}
            />
          </TabsContent>

          <TabsContent value="contributors" className="mt-6">
            <WorkspaceContributors
              repositories={repositories}
              selectedRepositories={selectedRepositories}
              workspaceId={workspace.id}
            />
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
      {workspace.tier === 'free' && (
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
                Upgrade to Pro to access historical data beyond 30 days, advanced metrics, and
                priority support. Pro users can track up to 10 repositories per workspace.
              </p>
              <Button onClick={handleUpgradeClick} variant="default" size="sm" className="mt-3">
                Upgrade to Pro
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Repository Modal */}
      {workspace && (
        <AddRepositoryModal
          open={addRepositoryModalOpen}
          onOpenChange={setAddRepositoryModalOpen}
          workspaceId={workspace.id}
          onSuccess={handleAddRepositorySuccess}
        />
      )}
    </div>
  );
}

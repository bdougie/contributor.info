import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
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
  Copy,
  Check,
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
// Analytics imports disabled - will be implemented in issue #598
// import { AnalyticsDashboard } from '@/components/features/workspace/AnalyticsDashboard';
import { ActivityTable } from '@/components/features/workspace/ActivityTable';
import { TrendChart } from '@/components/features/workspace/TrendChart';
import { ContributorLeaderboard } from '@/components/features/workspace/ContributorLeaderboard';
// import { WorkspaceExportService } from '@/services/workspace-export.service';
// import type {
//   AnalyticsData,
//   ActivityItem,
//   ContributorStat,
//   RepositoryMetric,
//   TrendDataset,
// } from '@/components/features/workspace/AnalyticsDashboard';

// Temporary type definition for ActivityItem until analytics is properly implemented in issue #598
interface ActivityItem {
  id: string;
  type: 'pr' | 'issue' | 'commit' | 'review';
  title: string;
  author: {
    username: string;
    avatar_url: string;
  };
  repository: string;
  created_at: string;
  status: 'open' | 'merged' | 'closed' | 'approved';
  url: string;
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
  selectedRepoIds?: string[],
  demoRandom: ReturnType<typeof createDemoRandomGenerator>
): WorkspaceMetrics => {
  // Use deterministic random for demo data generation passed as parameter

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
    totalPRs: Math.floor(demoRandom() * 500) + 100,
    totalContributors,
    totalCommits: Math.floor(demoRandom() * 10000) + 1000,
    starsTrend: (demoRandom() - 0.5) * 20 * multiplier,
    prsTrend: (demoRandom() - 0.5) * 15 * multiplier,
    contributorsTrend: (demoRandom() - 0.5) * 10 * multiplier,
    commitsTrend: (demoRandom() - 0.5) * 25 * multiplier,
  };
};

// Generate mock trend data for now
const generateMockTrendData = (
  days: number,
  repos?: Repository[],
  selectedRepoIds?: string[],
  demoRandom?: ReturnType<typeof createDemoRandomGenerator>
): WorkspaceTrendData => {
  // Use deterministic random for demo data generation
  const random = demoRandom || createDemoRandomGenerator();

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

    prs.push(Math.floor((random() * 30 + 10) * repoMultiplier));
    issues.push(Math.floor((random() * 20 + 5) * repoMultiplier));
    commits.push(Math.floor((random() * 60 + 20) * repoMultiplier));
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
        <div className="space-y-6">
          {/* Contributor Leaderboard */}
          <ContributorLeaderboard
            contributors={contributors.map((contributor) => ({
              id: contributor.id,
              username: contributor.username,
              avatar_url: contributor.avatar_url,
              contributions: contributor.stats.total_contributions,
              pull_requests: contributor.contributions.pull_requests,
              issues: contributor.contributions.issues,
              reviews: contributor.contributions.reviews,
              commits: contributor.contributions.commits,
              trend: contributor.stats.contribution_trend,
            }))}
            loading={loading}
            timeRange="30d"
            maxDisplay={10}
          />

          {/* View Toggle */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">All Contributors</h2>
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

/**
 * Simple deterministic pseudo-random number generator for demo data
 * This is NOT for cryptographic use, only for generating consistent demo data
 */
function createDemoRandomGenerator(seed: number = 42) {
  let currentSeed = seed;
  return () => {
    currentSeed = (currentSeed * 1103515245 + 12345) % 2147483648;
    return currentSeed / 2147483648;
  };
}

function WorkspaceActivity({ repositories }: { repositories: Repository[] }) {
  // Generate activity data for the feed
  const activities: ActivityItem[] = [];
  const now = new Date();

  // Use deterministic random for demo data generation
  const demoRandom = useMemo(() => createDemoRandomGenerator(), []);

  // Generate sample activities based on repositories
  repositories.forEach((repo, repoIndex) => {
    // Generate 20 activities per repo for demonstration
    for (let i = 0; i < 20; i++) {
      const createdAt = new Date(now.getTime() - demoRandom() * 30 * 24 * 60 * 60 * 1000);
      const activityTypes = ['pr', 'issue', 'commit', 'review'] as const;
      const statuses = ['open', 'merged', 'closed', 'approved'] as const;
      const activityType = activityTypes[Math.floor(demoRandom() * activityTypes.length)];
      const status = statuses[Math.floor(demoRandom() * statuses.length)];

      activities.push({
        id: `activity-${repoIndex}-${i}`,
        type: activityType,
        title: (() => {
          const titles = [
            'Fix critical bug in authentication',
            'Add new feature for user profiles',
            'Update dependencies to latest versions',
            'Refactor database queries for performance',
            'Improve error handling in API',
            'Add unit tests for new components',
            'Update documentation for API endpoints',
            'Fix typo in README',
            'Optimize image loading performance',
            'Add dark mode support',
          ];
          return titles[Math.floor(demoRandom() * titles.length)];
        })(),
        author: {
          username: `contributor${Math.floor(demoRandom() * 10)}`,
          avatar_url: `https://github.com/contributor${Math.floor(demoRandom() * 10)}.png`,
        },
        repository: repo.full_name,
        created_at: createdAt.toISOString(),
        status,
        url: `https://github.com/${repo.full_name}/${(() => {
          if (activityType === 'pr') return 'pull';
          if (activityType === 'issue') return 'issues';
          return 'commit';
        })()}/${Math.floor(demoRandom() * 1000)}`,
      });
    }
  });

  // Sort by date, most recent first
  activities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Generate trend data for the chart
  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    return date.toISOString().split('T')[0];
  });

  const activityByDay = last30Days.map((date) => {
    const dayActivities = activities.filter((a) => a.created_at.split('T')[0] === date);
    return {
      date,
      total: dayActivities.length,
      prs: dayActivities.filter((a) => a.type === 'pr').length,
      issues: dayActivities.filter((a) => a.type === 'issue').length,
      commits: dayActivities.filter((a) => a.type === 'commit').length,
      reviews: dayActivities.filter((a) => a.type === 'review').length,
    };
  });

  // Calculate stats
  const totalActivities = activities.length;
  const uniqueContributors = new Set(activities.map((a) => a.author.username)).size;
  const activeRepos = new Set(activities.map((a) => a.repository)).size;
  const activityScore = Math.round(
    (totalActivities + uniqueContributors * 2 + activeRepos * 3) / 3
  );

  return (
    <div className="space-y-4">
      {/* Activity Trend Chart */}
      <TrendChart
        title="Activity Trend"
        description="Daily activity across all workspace repositories"
        data={{
          labels: activityByDay.map((d) => {
            const date = new Date(d.date);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          }),
          datasets: [
            {
              label: 'Pull Requests',
              data: activityByDay.map((d) => d.prs),
              color: '#10b981',
            },
            {
              label: 'Issues',
              data: activityByDay.map((d) => d.issues),
              color: '#f97316',
            },
            {
              label: 'Commits',
              data: activityByDay.map((d) => d.commits),
              color: '#3b82f6',
            },
            {
              label: 'Reviews',
              data: activityByDay.map((d) => d.reviews),
              color: '#8b5cf6',
            },
          ],
        }}
        height={350}
        showLegend={true}
        showGrid={true}
      />

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalActivities}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Contributors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueContributors}</div>
            <p className="text-xs text-muted-foreground">Unique authors</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Repositories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeRepos}</div>
            <p className="text-xs text-muted-foreground">With activity</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Activity Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activityScore}</div>
            <p className="text-xs text-muted-foreground">Composite metric</p>
          </CardContent>
        </Card>
      </div>

      {/* Activity Feed Table */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Feed</CardTitle>
          <p className="text-sm text-muted-foreground">
            Real-time feed of all activities across your workspace repositories
          </p>
        </CardHeader>
        <CardContent>
          <ActivityTable activities={activities} loading={false} pageSize={20} />
        </CardContent>
      </Card>
    </div>
  );
}

function WorkspaceSettings({ workspace }: { workspace: Workspace }) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingSlug, setIsEditingSlug] = useState(false);
  const [workspaceName, setWorkspaceName] = useState(workspace.name);
  const [workspaceSlug, setWorkspaceSlug] = useState(workspace.slug);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);

  const formatSlug = (value: string) => {
    // Convert to lowercase, replace spaces with hyphens, remove special characters
    return value
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const checkSlugUniqueness = async (slug: string) => {
    if (!slug) return false;

    const { data, error } = await supabase
      .from('workspaces')
      .select('id')
      .eq('slug', slug)
      .neq('id', workspace.id)
      .maybeSingle();

    return !data && !error;
  };

  const handleSaveName = async () => {
    if (!workspaceName.trim()) {
      toast.error('Workspace name cannot be empty');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('workspaces')
        .update({ name: workspaceName.trim() })
        .eq('id', workspace.id);

      if (error) throw error;

      toast.success('Workspace name updated successfully');
      setIsEditingName(false);
      // Reload the page to reflect the changes
      window.location.reload();
    } catch (error) {
      console.error('Failed to update workspace name:', error);
      toast.error('Failed to update workspace name');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSlug = async () => {
    const formattedSlug = formatSlug(workspaceSlug);

    if (!formattedSlug) {
      toast.error('Slug cannot be empty');
      return;
    }

    // Check if slug has actually changed
    if (formattedSlug === workspace.slug) {
      // No change, just exit edit mode
      setIsEditingSlug(false);
      return;
    }

    // Show warning about breaking links only if slug is different
    const confirmed = window.confirm(
      '⚠️ WARNING: Changing your workspace slug will break all existing external links!\n\n' +
        `Current URL: /i/${workspace.slug}\n` +
        `New URL: /i/${formattedSlug}\n\n` +
        'All bookmarks, shared links, and external references will stop working.\n\n' +
        'Are you sure you want to continue?'
    );

    if (!confirmed) {
      setWorkspaceSlug(workspace.slug);
      setIsEditingSlug(false);
      return;
    }

    setIsSaving(true);
    setSlugError(null);

    try {
      // Check if slug is unique
      const isUnique = await checkSlugUniqueness(formattedSlug);

      if (!isUnique) {
        setSlugError('This slug is already taken. Please choose another.');
        setIsSaving(false);
        return;
      }

      const { error } = await supabase
        .from('workspaces')
        .update({ slug: formattedSlug })
        .eq('id', workspace.id);

      if (error) {
        if (error.code === '23505') {
          // Unique constraint violation
          setSlugError('This slug is already taken. Please choose another.');
        } else {
          throw error;
        }
        return;
      }

      toast.success('Workspace slug updated successfully. Redirecting to new URL...');
      setIsEditingSlug(false);

      // Redirect to the new slug URL
      setTimeout(() => {
        window.location.href = `/i/${formattedSlug}/settings`;
      }, 1500);
    } catch (error) {
      console.error('Failed to update workspace slug:', error);
      toast.error('Failed to update workspace slug');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelName = () => {
    setWorkspaceName(workspace.name);
    setIsEditingName(false);
  };

  const handleCancelSlug = () => {
    setWorkspaceSlug(workspace.slug);
    setIsEditingSlug(false);
    setSlugError(null);
  };

  const handleCopy = async (value: string, field: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      toast.success(`${field} copied to clipboard`);

      // Reset the copied state after 2 seconds
      setTimeout(() => {
        setCopiedField(null);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('Failed to copy to clipboard');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Workspace Name</label>
            <div className="mt-2 flex items-center gap-2">
              {isEditingName ? (
                <>
                  <input
                    type="text"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter workspace name"
                    disabled={isSaving}
                  />
                  <Button onClick={handleSaveName} size="sm" disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save'}
                  </Button>
                  <Button
                    onClick={handleCancelName}
                    size="sm"
                    variant="outline"
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <div
                  className="flex-1 flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1 transition-colors"
                  onClick={() => setIsEditingName(true)}
                  title="Click to edit"
                >
                  <p className="text-sm">{workspace.name}</p>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-muted-foreground"
                  >
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Workspace Slug</label>
            {isEditingSlug && (
              <p className="text-xs text-muted-foreground mt-1">
                ⚠️ Changing the slug will break all existing external links to this workspace
              </p>
            )}
            <div className="mt-2 flex items-center gap-2">
              {isEditingSlug ? (
                <>
                  <input
                    type="text"
                    value={workspaceSlug}
                    onChange={(e) => {
                      setWorkspaceSlug(e.target.value);
                      setSlugError(null);
                    }}
                    className="flex-1 px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                    placeholder="workspace-slug"
                    disabled={isSaving}
                  />
                  <Button onClick={handleSaveSlug} size="sm" disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save'}
                  </Button>
                  <Button
                    onClick={handleCancelSlug}
                    size="sm"
                    variant="outline"
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <div className="flex-1 flex items-center gap-2">
                  <div
                    className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1 transition-colors flex-1"
                    onClick={() => setIsEditingSlug(true)}
                    title="Click to edit"
                  >
                    <p className="text-sm font-mono">{workspace.slug}</p>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-muted-foreground"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
            {slugError && <p className="text-xs text-red-500 mt-2">{slugError}</p>}
            {isEditingSlug && (
              <p className="text-xs text-muted-foreground mt-2">
                Preview: /i/{formatSlug(workspaceSlug) || 'workspace-slug'}
              </p>
            )}
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              More settings coming soon: member management, repository settings, permissions, and
              integrations.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workspace Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Workspace ID</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono">{workspace.id}</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={() => handleCopy(workspace.id, 'Workspace ID')}
              >
                {copiedField === 'Workspace ID' ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Workspace Slug</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono">{workspace.slug}</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={() => handleCopy(workspace.slug, 'Workspace Slug')}
              >
                {copiedField === 'Workspace Slug' ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Tier</span>
            <span className="text-sm capitalize">{workspace.tier}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Created</span>
            <span className="text-sm">{new Date(workspace.created_at).toLocaleDateString()}</span>
          </div>
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

  // Use deterministic random for demo data generation
  const demoRandom = useMemo(() => createDemoRandomGenerator(), []);

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
            open_prs: Math.floor(demoRandom() * 50) + 5, // Mock for now
            open_issues: r.repositories.open_issues_count,
            contributors: Math.floor(demoRandom() * 100) + 10, // Mock for now
            last_activity: new Date(
              Date.now() - demoRandom() * 30 * 24 * 60 * 60 * 1000
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
              console.log('Found %d open PRs to show activity', openPRActivity.length);
              mergedPRs = openPRActivity;
            }
          }
        }

        setWorkspace(workspaceData);
        setRepositories(transformedRepos);

        // Generate metrics, trend data, and activity data
        const mockMetrics = generateMockMetrics(
          transformedRepos,
          timeRange,
          selectedRepositories,
          demoRandom
        );
        const mockTrendData = generateMockTrendData(
          TIME_RANGE_DAYS[timeRange],
          transformedRepos,
          selectedRepositories,
          demoRandom
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
  }, [workspaceId, timeRange, selectedRepositories, demoRandom]);

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
            contributors: Math.floor(demoRandom() * 50) + 10, // Mock for now
            avatar_url: `https://avatars.githubusercontent.com/${item.repositories.owner}`,
            last_activity: new Date(Date.now() - demoRandom() * 30 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split('T')[0],
            is_pinned: item.is_pinned || false,
            html_url: `https://github.com/${item.repositories.full_name}`,
          }));

        setRepositories(formattedRepos);
        setSelectedRepositories(formattedRepos.map((r) => r.id));

        // Update metrics with new repository data
        const newMetrics = generateMockMetrics(
          formattedRepos,
          timeRange,
          formattedRepos.map((r) => r.id),
          demoRandom
        );
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
        const newMetrics = generateMockMetrics(
          updatedRepos,
          timeRange,
          selectedRepositories,
          demoRandom
        );
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

  // Analytics functions disabled - will be implemented in issue #598
  /*
  // Generate analytics data from existing workspace data
  const generateAnalyticsData = (): AnalyticsData => {
    // Get current pull requests and issues from the workspace tabs
    const activities: ActivityItem[] = [];
    const contributorMap = new Map<string, ContributorStat>();
    const repositoryMetrics: RepositoryMetric[] = [];

    // Generate activities from recent data (mock for now, should be fetched from DB)
    const now = new Date();
    const activityTypes = ['pr', 'issue', 'commit', 'review'] as const;
    const statuses = ['open', 'merged', 'closed', 'approved'] as const;

    // Create sample activities based on repositories
    repositories.forEach((repo, repoIndex) => {
      // Add repository metrics
      repositoryMetrics.push({
        id: repo.id,
        name: repo.name,
        owner: repo.owner,
        stars: repo.stars,
        forks: repo.forks,
        pull_requests: repo.open_prs,
        issues: repo.open_issues,
        contributors: repo.contributors,
        activity_score: Math.floor(demoRandom() * 100),
        trend: Math.floor(demoRandom() * 30) - 15,
      });

      // Generate activities for each repo
      for (let i = 0; i < 10; i++) {
        const createdAt = new Date(now.getTime() - demoRandom() * 30 * 24 * 60 * 60 * 1000);
        const activityType = activityTypes[Math.floor(demoRandom() * activityTypes.length)];
        const status = statuses[Math.floor(demoRandom() * statuses.length)];
        const contributorName = `contributor${Math.floor(demoRandom() * 10)}`;

        activities.push({
          id: `activity-${repoIndex}-${i}`,
          type: activityType,
          title:
            (() => {
              if (activityType === 'pr') return 'Pull Request';
              if (activityType === 'issue') return 'Issue';
              return 'Activity';
            })() + ` #${Math.floor(demoRandom() * 1000)}`,
          author: {
            username: contributorName,
            avatar_url: `https://github.com/${contributorName}.png`,
          },
          repository: repo.full_name,
          created_at: createdAt.toISOString(),
          status,
          url: `https://github.com/${repo.full_name}/${(() => {
            if (activityType === 'pr') return 'pull';
            if (activityType === 'issue') return 'issues';
            return 'commit';
          })()}/${Math.floor(demoRandom() * 1000)}`,
        });

        // Update contributor stats
        if (!contributorMap.has(contributorName)) {
          contributorMap.set(contributorName, {
            id: contributorName,
            username: contributorName,
            avatar_url: `https://github.com/${contributorName}.png`,
            contributions: 0,
            pull_requests: 0,
            issues: 0,
            reviews: 0,
            commits: 0,
            trend: Math.floor(demoRandom() * 40) - 20,
          });
        }

        const contributor = contributorMap.get(contributorName)!;
        contributor.contributions++;
        if (activityType === 'pr') contributor.pull_requests++;
        if (activityType === 'issue') contributor.issues++;
        if (activityType === 'review') contributor.reviews++;
        if (activityType === 'commit') contributor.commits++;
      }
    });

    // Generate trend data
    const trends: TrendDataset[] = [];
    const dates = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      dates.push(date.toISOString().split('T')[0]);
    }

    trends.push({
      label: 'Pull Requests',
      data: dates.map((date) => ({
        date,
        value: Math.floor(demoRandom() * 50) + 10,
      })),
      color: '#10b981',
    });

    trends.push({
      label: 'Active Contributors',
      data: dates.map((date) => ({
        date,
        value: Math.floor(demoRandom() * 30) + 5,
      })),
      color: '#3b82f6',
    });

    return {
      activities: activities.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
      contributors: Array.from(contributorMap.values()).sort(
        (a, b) => b.contributions - a.contributions
      ),
      repositories: repositoryMetrics,
      trends,
    };
  };

  // Handle analytics export
  const handleAnalyticsExport = async (format: 'csv' | 'json' | 'pdf') => {
    try {
      const analyticsData = generateAnalyticsData();
      await WorkspaceExportService.export(analyticsData, format, {
        workspaceName: workspace.name,
        dateRange:
          timeRange !== 'all'
            ? {
                start: new Date(Date.now() - TIME_RANGE_DAYS[timeRange] * 24 * 60 * 60 * 1000),
                end: new Date(),
              }
            : undefined,
      });
      toast.success(`Analytics exported as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error(`Failed to export analytics: ${error}`);
    }
  };
  */

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
            <TabsList className="grid w-full grid-cols-7 mb-6">
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
              {/* Analytics tab disabled - will be implemented in issue #598
              <TabsTrigger value="analytics" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                <span className="hidden sm:inline">Analytics</span>
              </TabsTrigger> */}
              <TabsTrigger value="activity" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                <span className="hidden sm:inline">Activity</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
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

          {/* Analytics tab content disabled - will be implemented in issue #598
          <TabsContent value="analytics" className="mt-6">
            <div className="container max-w-7xl mx-auto">
              <AnalyticsDashboard
                data={generateAnalyticsData()}
                repositories={repositories.map((repo) => ({
                  id: `wr-${repo.id}`,
                  workspace_id: workspace.id,
                  repository_id: repo.id,
                  added_by: workspace.owner_id,
                  added_at: new Date().toISOString(),
                  notes: null,
                  tags: [],
                  is_pinned: false,
                  repository: {
                    id: repo.id,
                    full_name: repo.full_name,
                    owner: repo.owner,
                    name: repo.name,
                    description: repo.description || '',
                    language: repo.language || null,
                    stargazers_count: repo.stars,
                    forks_count: repo.forks,
                    open_issues_count: repo.open_issues,
                    topics: [],
                    is_private: false,
                    is_archived: false,
                  },
                  added_by_user: {
                    id: workspace.owner_id,
                    email: '',
                    display_name: '',
                  },
                }))}
                loading={loading}
                tier={workspace.tier as 'free' | 'pro' | 'enterprise'}
                onExport={handleAnalyticsExport}
              />
            </div>
          </TabsContent> */}

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

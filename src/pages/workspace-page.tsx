import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, lazy, Suspense, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { getFallbackAvatar } from '@/lib/utils/avatar';
import { useWorkspaceContributors } from '@/hooks/useWorkspaceContributors';
import { useContributorGroups } from '@/hooks/useContributorGroups';
import { useWorkspaceEvents } from '@/hooks/use-workspace-events';
import { TIME_PERIODS, timeHelpers } from '@/lib/constants/time-constants';
import { WorkspaceDashboard, WorkspaceDashboardSkeleton } from '@/components/features/workspace';
import { WorkspaceErrorBoundary } from '@/components/error-boundaries/workspace-error-boundary';
import { WorkspaceAutoSync } from '@/components/features/workspace/WorkspaceAutoSync';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import {
  WorkspacePullRequestsTable,
  type PullRequest,
} from '@/components/features/workspace/WorkspacePullRequestsTable';
import {
  WorkspaceIssuesTable,
  type Issue,
} from '@/components/features/workspace/WorkspaceIssuesTable';
import { WorkspaceDiscussionsTable } from '@/components/features/workspace/WorkspaceDiscussionsTable';
import { RepositoryFilter } from '@/components/features/workspace/RepositoryFilter';
import { WorkspaceMetricsAndTrends } from '@/components/features/workspace/WorkspaceMetricsAndTrends';
import { WorkspaceSwitcher } from '@/components/navigation/WorkspaceSwitcher';
import { WorkspaceIssueMetricsAndTrends } from '@/components/features/workspace/WorkspaceIssueMetricsAndTrends';
import {
  ContributorsList,
  type Contributor,
} from '@/components/features/workspace/ContributorsList';
import { ContributorsTable } from '@/components/features/workspace/ContributorsTable';
import { ContributorGroupManager } from '@/components/features/workspace/ContributorGroupManager';
import { ContributorNotesDialog } from '@/components/features/workspace/ContributorNotesDialog';
import { ContributorProfileModal } from '@/components/features/workspace/ContributorProfileModal';
import { AddRepositoryModal } from '@/components/features/workspace/AddRepositoryModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ReviewerSuggestionsModal } from '@/components/features/workspace/reviewer-suggestions/ReviewerSuggestionsModal';
import { GitHubAppInstallModal } from '@/components/features/github-app/github-app-install-modal';
import { useWorkspaceGitHubAppStatus } from '@/hooks/use-workspace-github-app-status';
import { Badge } from '@/components/ui/badge';
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
  Sparkles,
  MessageSquare,
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
import type { Workspace, WorkspaceMemberWithUser } from '@/types/workspace';
import { WorkspaceService } from '@/services/workspace.service';
import { WorkspaceSettings as WorkspaceSettingsComponent } from '@/components/features/workspace/settings/WorkspaceSettings';
import { useWorkspacePRs } from '@/hooks/useWorkspacePRs';
// Analytics imports disabled - will be implemented in issue #598
// import { AnalyticsDashboard } from '@/components/features/workspace/AnalyticsDashboard';
import { ActivityTable } from '@/components/features/workspace/ActivityTable';
import { TrendChart } from '@/components/features/workspace/TrendChart';
import { WorkspaceActivitySkeleton } from '@/components/features/workspace/skeletons/WorkspaceActivitySkeleton';
// Lazy load heavy components
const ContributorLeaderboard = lazy(() =>
  import('@/components/features/workspace/ContributorLeaderboard').then((m) => ({
    default: m.ContributorLeaderboard,
  }))
);

// Lazy load distribution charts
import { LazyAssigneeDistributionChart } from '@/components/features/workspace/charts/AssigneeDistributionChart-lazy';
import { LazyReviewerDistributionChart } from '@/components/features/workspace/charts/ReviewerDistributionChart-lazy';
import { PRAuthorStatusChart as LazyPRAuthorStatusChart } from '@/components/features/workspace/charts/PRAuthorStatusChart-lazy';
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
  type: 'pr' | 'issue' | 'commit' | 'review' | 'comment' | 'star' | 'fork';
  title: string;
  author: {
    username: string;
    avatar_url: string;
  };
  repository: string;
  created_at: string;
  // Status is only relevant for PRs, issues, and reviews
  status?: 'open' | 'merged' | 'closed' | 'approved' | 'changes_requested';
  url: string;
  metadata?: {
    additions?: number;
    deletions?: number;
    change_amount?: number;
    current_value?: number;
  };
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

// Calculate real metrics from repository data and fetched stats
const calculateRealMetrics = (
  repos: Repository[],
  prCount: number = 0,
  contributorCount: number = 0,
  commitCount: number = 0,
  issueCount: number = 0,
  previousMetrics?: {
    prCount: number;
    contributorCount: number;
    starCount: number;
    commitCount: number;
  }
): WorkspaceMetrics => {
  const totalStars = repos.reduce((sum, repo) => sum + (repo.stars || 0), 0);
  const totalOpenPRs = repos.reduce((sum, repo) => sum + (repo.open_prs || 0), 0);
  const totalOpenIssues = repos.reduce((sum, repo) => sum + (repo.open_issues || 0), 0);

  // Calculate trends if we have previous metrics
  let starsTrend = 0;
  let prsTrend = 0;
  let contributorsTrend = 0;
  let commitsTrend = 0;

  if (previousMetrics) {
    // Calculate percentage changes
    starsTrend =
      previousMetrics.starCount > 0
        ? ((totalStars - previousMetrics.starCount) / previousMetrics.starCount) * 100
        : 0;
    prsTrend =
      previousMetrics.prCount > 0
        ? ((totalOpenPRs - previousMetrics.prCount) / previousMetrics.prCount) * 100
        : 0;
    contributorsTrend =
      previousMetrics.contributorCount > 0
        ? ((contributorCount - previousMetrics.contributorCount) /
            previousMetrics.contributorCount) *
          100
        : 0;
    commitsTrend =
      previousMetrics.commitCount > 0
        ? ((commitCount - previousMetrics.commitCount) / previousMetrics.commitCount) * 100
        : 0;
  }

  // Calculate issue trend
  let issuesTrend = 0;
  if (previousMetrics && 'issueCount' in previousMetrics) {
    const prevIssues = (previousMetrics as { issueCount?: number }).issueCount || 0;
    issuesTrend = prevIssues > 0 ? ((totalOpenIssues - prevIssues) / prevIssues) * 100 : 0;
  }

  return {
    totalStars,
    totalPRs: totalOpenPRs || prCount, // Use aggregated open PRs or fallback to passed count
    totalIssues: totalOpenIssues || issueCount || 0, // Open issues count
    totalContributors: contributorCount,
    totalCommits: commitCount, // Keep commits for interface compatibility
    starsTrend,
    prsTrend,
    issuesTrend,
    contributorsTrend,
    commitsTrend,
  };
};

// Calculate real trend data from historical PR, issue, and commit data
const calculateRealTrendData = (
  days: number,
  prData: Array<{ created_at: string; state: string; commits?: number }> = [],
  issueData: Array<{ created_at: string; state: string }> = []
): WorkspaceTrendData => {
  const labels = [];
  const prCounts = [];
  const issueCounts = [];
  const commitCounts = [];
  const today = new Date();

  // Create date buckets
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));

    // Count PRs and aggregate commits for this day
    const dayPRs = prData.filter((pr) => pr.created_at.split('T')[0] === dateStr);
    prCounts.push(dayPRs.length);

    // Sum up commits from PRs for this day
    const dayCommits = dayPRs.reduce((sum, pr) => sum + (pr.commits || 0), 0);
    commitCounts.push(dayCommits);

    // Count issues for this day
    const dayIssues = issueData.filter(
      (issue) => issue.created_at.split('T')[0] === dateStr
    ).length;
    issueCounts.push(dayIssues);
  }

  return {
    labels,
    datasets: [
      {
        label: 'Pull Requests',
        data: prCounts,
        color: '#10b981',
      },
      {
        label: 'Issues',
        data: issueCounts,
        color: '#f97316',
      },
      {
        label: 'Commits',
        data: commitCounts,
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
  timeRange,
  workspaceId,
  workspace,
  setReviewerModalOpen,
  onGitHubAppModalOpen,
  currentUser,
  currentMember,
}: {
  repositories: Repository[];
  selectedRepositories: string[];
  timeRange: TimeRange;
  workspaceId: string;
  workspace?: Workspace;
  setReviewerModalOpen: (open: boolean) => void;
  onGitHubAppModalOpen: (repo: Repository) => void;
  currentUser: User | null;
  currentMember: WorkspaceMemberWithUser | null;
}) {
  const navigate = useNavigate();

  // Use the new hook for automatic PR syncing and caching
  const { pullRequests, loading, error, lastSynced, isStale, refresh } = useWorkspacePRs({
    repositories,
    selectedRepositories,
    workspaceId,
    refreshInterval: 60, // Hourly refresh interval
    maxStaleMinutes: 60, // Consider data stale after 60 minutes
    autoSyncOnMount: true, // Auto-sync enabled with hourly refresh
  });

  // Log sync status for debugging
  useEffect(() => {
    if (lastSynced) {
      const minutesAgo = ((Date.now() - lastSynced.getTime()) / (1000 * 60)).toFixed(1);
      console.log(
        `PR data last synced ${minutesAgo} minutes ago${isStale ? ' (stale)' : ' (fresh)'}`
      );
    }
  }, [lastSynced, isStale]);

  // Show error toast if sync fails
  useEffect(() => {
    if (error) {
      toast.error('Failed to fetch pull requests', {
        description: error,
        action: {
          label: 'Retry',
          onClick: () => refresh(),
        },
      });
    }
  }, [error, refresh]);

  const handlePullRequestClick = (pr: PullRequest) => {
    window.open(pr.url, '_blank');
  };

  const handleRepositoryClick = (owner: string, name: string) => {
    navigate(`/${owner}/${name}`);
  };

  const [selectedReviewer, setSelectedReviewer] = useState<string | null>(null);

  const handleReviewerClick = (reviewer: string) => {
    setSelectedReviewer(selectedReviewer === reviewer ? null : reviewer);
  };

  // Filter PRs by selected reviewer
  const filteredPullRequests = useMemo(() => {
    if (!selectedReviewer) return pullRequests;

    if (selectedReviewer === '__unreviewed__') {
      return pullRequests.filter((pr) => !pr.reviewers || pr.reviewers.length === 0);
    }

    return pullRequests.filter((pr) => pr.reviewers?.some((r) => r.username === selectedReviewer));
  }, [pullRequests, selectedReviewer]);

  // Check if there are any PRs with reviewers
  const hasReviewers = pullRequests.some((pr) => pr.reviewers && pr.reviewers.length > 0);

  const ctaRepo = repositories[0]; // Use first repo for modal context

  return (
    <div className="space-y-6">
      {/* Auto-sync indicator at top of tab */}
      <div className="flex items-center justify-between px-1">
        <WorkspaceAutoSync
          workspaceId={workspaceId}
          workspaceSlug={workspace?.slug || 'workspace'}
          repositoryIds={repositories.map((r) => r.id).filter(Boolean)}
          onSyncComplete={refresh}
          syncIntervalMinutes={60}
          className="text-sm text-muted-foreground"
        />
        <div className="flex items-center gap-2">
          <Button onClick={() => setReviewerModalOpen(true)} size="sm" variant="outline">
            CODEOWNERS
          </Button>
          {ctaRepo && (
            <Button
              onClick={() => onGitHubAppModalOpen(ctaRepo)}
              size="sm"
              variant="outline"
              className="gap-2"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              Similarity
            </Button>
          )}
        </div>
      </div>

      {/* Metrics and Trends - first, always full width */}
      <WorkspaceMetricsAndTrends
        repositories={repositories}
        selectedRepositories={selectedRepositories}
        timeRange={timeRange}
        userRole={currentMember?.role}
        isLoggedIn={!!currentUser}
      />

      {/* Review Charts - PR Status and Distribution side by side */}
      {hasReviewers && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* PR Author Status Chart - shows PRs grouped by author and their status */}
          <LazyPRAuthorStatusChart
            pullRequests={pullRequests}
            onAuthorClick={handleReviewerClick}
            title="Pull Request Author Status"
            maxVisible={8}
          />

          {/* Reviewer Distribution Chart */}
          <LazyReviewerDistributionChart
            pullRequests={pullRequests}
            onReviewerClick={handleReviewerClick}
            maxVisible={8}
          />
        </div>
      )}

      {/* PR Table */}
      <WorkspacePullRequestsTable
        pullRequests={filteredPullRequests}
        loading={loading}
        onPullRequestClick={handlePullRequestClick}
        onRepositoryClick={handleRepositoryClick}
      />
    </div>
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
  timeRange,
  onGitHubAppModalOpen,
  currentUser,
  currentMember,
}: {
  repositories: Repository[];
  selectedRepositories: string[];
  timeRange: TimeRange;
  onGitHubAppModalOpen: (repo: Repository) => void;
  currentUser: User | null;
  currentMember: WorkspaceMemberWithUser | null;
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
            assignees,
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
            assignees: Array<{
              login?: string;
              username?: string;
              avatar_url?: string;
            }> | null;
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
                avatar_url: issue.repositories?.owner
                  ? `https://avatars.githubusercontent.com/${issue.repositories.owner}`
                  : getFallbackAvatar(),
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
              assignees: Array.isArray(issue.assignees)
                ? issue.assignees.map((assignee) => ({
                    login: assignee.login || assignee.username || 'unknown',
                    avatar_url: assignee.avatar_url || '',
                  }))
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

  const [selectedAssignee, setSelectedAssignee] = useState<string | null>(null);

  const handleIssueClick = (issue: Issue) => {
    // Only open if URL exists
    if (issue.url) {
      window.open(issue.url, '_blank');
    }
  };

  const handleRepositoryClick = (owner: string, name: string) => {
    navigate(`/${owner}/${name}`);
  };

  const handleAssigneeClick = (assignee: string) => {
    setSelectedAssignee(selectedAssignee === assignee ? null : assignee);
  };

  // Filter issues by selected assignee
  const filteredIssues = useMemo(() => {
    if (!selectedAssignee) return issues;

    if (selectedAssignee === '__unassigned__') {
      return issues.filter((issue) => !issue.assignees || issue.assignees.length === 0);
    }

    return issues.filter((issue) => issue.assignees?.some((a) => a.login === selectedAssignee));
  }, [issues, selectedAssignee]);

  // Check if there are any issues with assignees
  const hasAssignees = issues.some((issue) => issue.assignees && issue.assignees.length > 0);

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

  const ctaRepo = repositories[0]; // Use first repo for context

  return (
    <div className="space-y-6">
      {/* Action buttons at top */}
      {ctaRepo && (
        <div className="flex items-center justify-end px-1">
          <div className="flex items-center gap-2">
            <Button
              onClick={() => onGitHubAppModalOpen(ctaRepo)}
              size="sm"
              variant="outline"
              className="gap-2"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              Similarity
            </Button>
          </div>
        </div>
      )}

      {/* Conditionally render side-by-side or full width based on assignee data */}
      {hasAssignees ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Issue Metrics and Trends */}
          <WorkspaceIssueMetricsAndTrends
            repositories={repositories}
            selectedRepositories={selectedRepositories}
            timeRange={timeRange}
            userRole={currentMember?.role}
            isLoggedIn={!!currentUser}
          />

          {/* Assignee Distribution Chart */}
          <LazyAssigneeDistributionChart
            issues={issues}
            onAssigneeClick={handleAssigneeClick}
            maxVisible={8}
          />
        </div>
      ) : (
        /* Full width Metrics and Trends when no assignees */
        <WorkspaceIssueMetricsAndTrends
          repositories={repositories}
          selectedRepositories={selectedRepositories}
          timeRange={timeRange}
          userRole={currentMember?.role}
          isLoggedIn={!!currentUser}
        />
      )}

      {/* Issues Table */}
      <WorkspaceIssuesTable
        issues={filteredIssues}
        loading={loading}
        onIssueClick={handleIssueClick}
        onRepositoryClick={handleRepositoryClick}
      />
    </div>
  );
}

function WorkspaceContributors({
  repositories,
  selectedRepositories,
  workspaceId,
  userRole,
  workspaceTier,
  isLoggedIn,
  currentUser,
  activities = [],
}: {
  repositories: Repository[];
  selectedRepositories: string[];
  workspaceId: string;
  userRole?: import('@/types/workspace').WorkspaceRole;
  workspaceTier?: import('@/types/workspace').WorkspaceTier;
  isLoggedIn?: boolean;
  currentUser?: User | null;
  activities?: ActivityItem[];
}) {
  // Navigate removed - no longer needed as profile modal handles internally
  const [showAddContributors, setShowAddContributors] = useState(false);
  const [selectedContributorsToAdd, setSelectedContributorsToAdd] = useState<string[]>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  // CRM State
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedContributor, setSelectedContributor] = useState<Contributor | null>(null);

  // Unified selection state for table and modals
  const [selectedContributorsForGroups, setSelectedContributorsForGroups] = useState<Set<string>>(
    new Set()
  );

  // Group filtering state
  const [selectedFilterGroup, setSelectedFilterGroup] = useState<string | null>(null);

  // Use the contributor groups hook for real database operations
  const {
    groups,
    groupMembers,
    notes,
    createGroup,
    updateGroup,
    deleteGroup,
    addContributorToGroup,
    removeContributorFromGroup,
    upsertNote,
    updateNoteById,
    deleteNoteById,
  } = useContributorGroups(workspaceId);

  // Get the contributor groups map for filtering
  // Build the map directly from groupMembers to ensure reactivity
  const contributorGroupsByUsername = useMemo(() => {
    const map = new Map<string, string[]>();
    groupMembers.forEach((member) => {
      const current = map.get(member.contributor_username) || [];
      current.push(member.group_id);
      map.set(member.contributor_username, current);
    });
    return map;
  }, [groupMembers]);

  // Transform notes to match ContributorNotesDialog interface
  // Filter by selected contributor's username to prevent cross-user data leak
  const transformedNotes = useMemo(() => {
    const contributorUsername = selectedContributor?.username;
    if (!contributorUsername) return [];

    return notes
      .filter((note) => note.contributor_username === contributorUsername)
      .map((note) => {
        const createdBy = note.created_by as
          | {
              auth_user_id: string;
              email: string;
              display_name: string;
            }
          | string
          | null;
        const isObject = typeof createdBy === 'object' && createdBy !== null;

        return {
          ...note,
          created_by: {
            id: isObject ? createdBy.auth_user_id : createdBy || 'unknown',
            email: isObject ? createdBy.email : 'unknown@example.com',
            display_name: isObject
              ? createdBy.display_name || createdBy.email?.split('@')[0]
              : 'Unknown User',
            avatar_url: undefined,
          },
        };
      });
  }, [notes, selectedContributor?.username]);

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

  // Create a Map indexed by contributor ID for the UI components
  const contributorGroups = useMemo(() => {
    const map = new Map<string, string[]>();

    // Build a username to ID lookup
    const usernameToId = new Map<string, string>();
    contributors.forEach((contributor) => {
      usernameToId.set(contributor.username, contributor.id);
    });

    // Transform the username-indexed map to ID-indexed map
    contributorGroupsByUsername.forEach((groupIds, username) => {
      const contributorId = usernameToId.get(username);
      if (contributorId) {
        map.set(contributorId, groupIds);
      }
    });

    return map;
  }, [contributorGroupsByUsername, contributors]);

  const handleContributorClick = (contributor: Contributor) => {
    setSelectedContributor(contributor);
    setShowProfileModal(true);
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

  // CRM Handlers
  const handleAddToGroup = (contributorId: string) => {
    const contributor = contributors.find((c) => c.id === contributorId);
    if (contributor) {
      setSelectedContributor(contributor);
      // Ensure this contributor is in the selection
      if (!selectedContributorsForGroups.has(contributorId)) {
        setSelectedContributorsForGroups(
          new Set([...selectedContributorsForGroups, contributorId])
        );
      }
      setShowGroupManager(true);
    }
  };

  const handleAddNote = (contributorId: string) => {
    const contributor = contributors.find((c) => c.id === contributorId);
    if (contributor) {
      setSelectedContributor(contributor);
      setShowNotesDialog(true);
    }
  };

  const handleRemoveContributor = async (contributorId: string) => {
    await removeContributorFromWorkspace(contributorId);
  };

  // CRM handler functions using the database hook
  const handleCreateGroup = async (name: string, description: string) => {
    try {
      await createGroup(name, description);
    } catch (error) {
      console.error('Error creating group:', error);
      toast.error('Failed to create group');
    }
  };

  const handleUpdateGroup = async (groupId: string, name: string, description: string) => {
    try {
      await updateGroup(groupId, name, description);
    } catch (error) {
      console.error('Error updating group:', error);
      toast.error('Failed to update group');
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    try {
      await deleteGroup(groupId);
    } catch (error) {
      console.error('Error deleting group:', error);
      toast.error('Failed to delete group');
    }
  };

  const handleAddContributorToGroup = async (contributorId: string, groupId: string) => {
    // Find the contributor by ID to get their username
    const contributor = contributors.find((c) => c.id === contributorId);
    if (!contributor) {
      toast.error('Contributor not found');
      return;
    }

    try {
      await addContributorToGroup(contributor.username, groupId);
    } catch (error) {
      console.error('Error adding contributor to group:', error);
      toast.error('Failed to add contributor to group');
    }
  };

  const handleBulkAddContributorsToGroups = async (
    contributorIds: string[],
    groupIds: string[]
  ) => {
    if (contributorIds.length === 0 || groupIds.length === 0) {
      toast.error('Please select contributors and groups');
      return;
    }

    // Find contributors by IDs to get their usernames
    const selectedContributors = contributors.filter((c) => contributorIds.includes(c.id));
    if (selectedContributors.length !== contributorIds.length) {
      toast.error('Some contributors not found');
      return;
    }

    // Find the "new contributors" group (topinos) to remove from
    const newContributorsGroup = groups.find(
      (g) => g.name.toLowerCase().includes('new') || g.name.toLowerCase().includes('topinos')
    );

    try {
      const promises = [];

      for (const contributor of selectedContributors) {
        // Add to selected groups
        for (const groupId of groupIds) {
          promises.push(addContributorToGroup(contributor.username, groupId));
        }

        // Remove from "new contributors" group if they're being added to other groups and currently in it
        if (newContributorsGroup) {
          const contributorGroupsList = contributorGroups.get(contributor.id) || [];
          const isInNewGroup = contributorGroupsList.includes(newContributorsGroup.id);

          if (isInNewGroup) {
            promises.push(
              removeContributorFromGroup(contributor.username, newContributorsGroup.id)
            );
          }
        }
      }

      await Promise.all(promises);

      const groupNames = groupIds
        .map((id) => groups.find((g) => g.id === id)?.name)
        .filter(Boolean);
      let message = `Added ${selectedContributors.length} contributor${selectedContributors.length === 1 ? '' : 's'} to ${groupNames.length} group${groupNames.length === 1 ? '' : 's'}`;

      if (newContributorsGroup) {
        message += ` and removed from ${newContributorsGroup.name}`;
      }

      toast.success(message);
    } catch (error) {
      console.error('Error adding contributors to groups:', error);
      toast.error('Failed to add contributors to groups');
    }
  };

  const handleRemoveContributorFromGroup = async (contributorId: string, groupId: string) => {
    // Find the contributor by ID to get their username
    const contributor = contributors.find((c) => c.id === contributorId);
    if (!contributor) {
      toast.error('Contributor not found');
      return;
    }

    try {
      await removeContributorFromGroup(contributor.username, groupId);
    } catch (error) {
      console.error('Error removing contributor from group:', error);
      toast.error('Failed to remove contributor from group');
    }
  };

  const handleAddNoteToContributor = async (contributorId: string, note: string) => {
    // Find the contributor by ID to get their username
    const contributor = contributors.find((c) => c.id === contributorId);
    if (!contributor) {
      toast.error('Contributor not found');
      return;
    }

    try {
      await upsertNote(contributor.username, note);
    } catch (error) {
      console.error('Error saving note:', error);
      toast.error('Failed to save note');
    }
  };

  const handleUpdateNote = async (noteId: string, note: string) => {
    try {
      await updateNoteById(noteId, note);
    } catch (error) {
      console.error('Error updating note:', error);
      toast.error('Failed to update note');
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await deleteNoteById(noteId);
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Failed to delete note');
    }
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

  // View columns and table are no longer needed - replaced by ContributorsTable component
  /*
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
  */

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

  // Filter contributors by selected group
  const filteredContributors = useMemo(() => {
    if (!selectedFilterGroup) {
      return contributors;
    }

    // Get all contributor usernames in the selected group
    const usernamesInGroup = new Set(
      groupMembers
        .filter((member) => member.group_id === selectedFilterGroup)
        .map((member) => member.contributor_username)
    );

    // Filter contributors whose usernames are in the group
    return contributors.filter((contributor) => usernamesInGroup.has(contributor.username));
  }, [contributors, selectedFilterGroup, groupMembers]);

  // viewTable removed - functionality moved to ContributorsTable component

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
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle>Add Contributors to Workspace</CardTitle>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-sm text-muted-foreground">
                  {selectedContributorsToAdd.length} selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelAdd}
                  className="min-h-[44px]"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmitContributors}
                  disabled={selectedContributorsToAdd.length === 0}
                  className="min-h-[44px]"
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
                  className="pl-10 min-h-[44px]"
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
            <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-4">
              <div className="text-sm text-muted-foreground order-2 sm:order-1">
                Showing {addTable.getState().pagination.pageIndex * 10 + 1} to{' '}
                {Math.min(
                  (addTable.getState().pagination.pageIndex + 1) * 10,
                  allAvailableContributors.length
                )}{' '}
                of {allAvailableContributors.length} contributors
              </div>
              <div className="flex items-center gap-2 order-1 sm:order-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addTable.previousPage()}
                  disabled={!addTable.getCanPreviousPage()}
                  className="min-h-[44px] px-3"
                >
                  <span className="hidden sm:inline">Previous</span>
                  <span className="sm:hidden">‹</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addTable.nextPage()}
                  disabled={!addTable.getCanNextPage()}
                  className="min-h-[44px] px-3"
                >
                  <span className="hidden sm:inline">Next</span>
                  <span className="sm:hidden">›</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Contributor Leaderboard - only show if more than 3 contributors */}
          {filteredContributors.length > 3 && (
            <Suspense
              fallback={
                <Card>
                  <CardHeader>
                    <CardTitle>Top Contributors</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-muted animate-pulse rounded-full" />
                            <div className="space-y-1">
                              <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                              <div className="h-3 w-32 bg-muted animate-pulse rounded" />
                            </div>
                          </div>
                          <div className="h-5 w-12 bg-muted animate-pulse rounded" />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              }
            >
              <ContributorLeaderboard
                contributors={filteredContributors.map((contributor) => ({
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
                onContributorClick={(contributorStat) => {
                  // Find the full contributor object by id
                  const fullContributor = filteredContributors.find(
                    (c) => c.id === contributorStat.id
                  );
                  if (fullContributor) {
                    handleContributorClick(fullContributor);
                  }
                }}
              />
            </Suspense>
          )}

          {/* Group Filter - outside the card */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Groups:</span>
            {groups.map((group) => {
              const count = groupMembers.filter((m) => m.group_id === group.id).length;
              const isSelected = selectedFilterGroup === group.id;

              return (
                <Button
                  key={group.id}
                  variant={isSelected ? 'default' : 'secondary'}
                  size="sm"
                  onClick={() => setSelectedFilterGroup(isSelected ? null : group.id)}
                  className="h-7"
                >
                  {group.name}
                  <Badge variant="outline" className="ml-1.5 px-1 h-4 text-xs">
                    {count}
                  </Badge>
                </Button>
              );
            })}
            {selectedFilterGroup && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedFilterGroup(null)}
                className="h-7 text-xs"
              >
                Clear filter
              </Button>
            )}
          </div>

          {/* Contributors Card with integrated controls */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>
                    {selectedFilterGroup
                      ? `${groups.find((g) => g.id === selectedFilterGroup)?.name || 'Group'} Contributors`
                      : 'All Contributors'}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {filteredContributors.length} {selectedFilterGroup ? 'filtered ' : ''}
                    {filteredContributors.length === 1 ? 'contributor' : 'contributors'}
                    {selectedFilterGroup && ` • ${contributors.length} total`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-lg border bg-muted/50 p-1">
                    <Button
                      variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('grid')}
                      className="px-3 min-h-[36px] min-w-[36px]"
                      title="Grid view"
                    >
                      <Package className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('list')}
                      className="px-3 min-h-[36px] min-w-[36px]"
                      title="Table view"
                    >
                      <Menu className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    onClick={() => setShowGroupManager(true)}
                    size="sm"
                    variant="outline"
                    className="min-h-[36px] px-3"
                  >
                    <Users className="h-4 w-4 mr-1.5" />
                    <span className="hidden sm:inline">Manage Groups</span>
                    <span className="sm:hidden">Groups</span>
                  </Button>
                  <Button onClick={handleAddContributor} size="sm" className="min-h-[36px] px-3">
                    <Plus className="h-4 w-4 mr-1.5" />
                    <span className="hidden sm:inline">Add Contributors</span>
                    <span className="sm:hidden">Add</span>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {viewMode === 'grid' ? (
                <ContributorsList
                  contributors={filteredContributors}
                  trackedContributors={workspaceContributorIds}
                  onTrackContributor={handleTrackContributor}
                  onUntrackContributor={handleUntrackContributor}
                  onContributorClick={handleContributorClick}
                  onAddToGroup={handleAddToGroup}
                  loading={loading}
                  view="grid"
                  showHeader={false} // We'll add this prop to hide the built-in header
                />
              ) : (
                <ContributorsTable
                  contributors={filteredContributors}
                  groups={groups}
                  contributorGroups={contributorGroups}
                  loading={loading}
                  onContributorClick={handleContributorClick}
                  onAddToGroup={handleAddToGroup}
                  onBulkAddToGroups={handleBulkAddContributorsToGroups}
                  onAddNote={handleAddNote}
                  onRemoveContributor={handleRemoveContributor}
                  showHeader={false} // We'll add this prop to hide the built-in header
                  selectedContributors={selectedContributorsForGroups}
                  onSelectedContributorsChange={setSelectedContributorsForGroups}
                  userRole={userRole}
                  workspaceTier={workspaceTier}
                  isLoggedIn={isLoggedIn}
                  activities={activities}
                />
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* CRM Modals */}
      <ContributorGroupManager
        open={showGroupManager}
        onOpenChange={(open) => {
          setShowGroupManager(open);
          // Clear selection when closing modal
          if (!open) {
            setSelectedContributorsForGroups(new Set());
          }
        }}
        groups={groups}
        contributors={contributors}
        contributorGroups={contributorGroups}
        selectedContributorId={selectedContributor?.id}
        selectedContributorIds={selectedContributorsForGroups}
        onCreateGroup={handleCreateGroup}
        onUpdateGroup={handleUpdateGroup}
        onDeleteGroup={handleDeleteGroup}
        onAddContributorToGroup={handleAddContributorToGroup}
        onRemoveContributorFromGroup={handleRemoveContributorFromGroup}
        userRole={userRole}
        workspaceTier={workspaceTier}
        isLoggedIn={isLoggedIn}
      />

      <ContributorNotesDialog
        open={showNotesDialog}
        onOpenChange={setShowNotesDialog}
        contributor={selectedContributor}
        notes={transformedNotes}
        loading={false}
        currentUserId={currentUser?.id}
        onAddNote={handleAddNoteToContributor}
        onUpdateNote={handleUpdateNote}
        onDeleteNote={handleDeleteNote}
      />

      <ContributorProfileModal
        open={showProfileModal}
        onOpenChange={setShowProfileModal}
        contributor={selectedContributor}
        groups={groups}
        contributorGroups={contributorGroups.get(selectedContributor?.id || '') || []}
        notes={transformedNotes}
        workspaceId={workspaceId}
        onManageGroups={() => {
          setShowProfileModal(false);
          // Pre-select the current contributor when opening group manager
          if (selectedContributor) {
            setSelectedContributorsForGroups(new Set([selectedContributor.id]));
          }
          setShowGroupManager(true);
        }}
        onAddNote={() => {
          setShowProfileModal(false);
          setShowNotesDialog(true);
        }}
        userRole={userRole}
        workspaceTier={workspaceTier}
        isLoggedIn={isLoggedIn}
      />
    </div>
  );
}

interface WorkspaceActivityProps {
  workspace?: Workspace | null;
  prData: Array<{
    id: string;
    title: string;
    number: number;
    state: string;
    created_at: string;
    merged_at: string | null;
    author_id: string;
    author_login?: string;
    repository_id: string;
    repository_name?: string;
    html_url?: string;
    additions?: number;
    deletions?: number;
    commits?: number;
  }>;
  issueData: Array<{
    id: string;
    title: string;
    number: number;
    state: string;
    created_at: string;
    closed_at: string | null;
    author_id: string;
    author_login?: string;
    repository_id: string;
    repository_name?: string;
    html_url?: string;
  }>;
  reviewData: Array<{
    id: string;
    pull_request_id: string;
    reviewer_id: string;
    reviewer_login?: string;
    state: string;
    body?: string;
    submitted_at: string;
    pr_title?: string;
    pr_number?: number;
    repository_id?: string;
    repository_name?: string;
  }>;
  commentData: Array<{
    id: string;
    pull_request_id: string;
    commenter_id: string;
    commenter_login?: string;
    body: string;
    created_at: string;
    comment_type: string;
    pr_title?: string;
    pr_number?: number;
    repository_id?: string;
    repository_name?: string;
  }>;
  starData: Array<{
    id: string;
    event_type: 'star';
    actor_login: string;
    actor_avatar?: string;
    repository_name?: string;
    captured_at: string;
  }>;
  forkData: Array<{
    id: string;
    event_type: 'fork';
    actor_login: string;
    actor_avatar?: string;
    repository_name?: string;
    captured_at: string;
  }>;
  repositories: Repository[];
  loading?: boolean;
  error?: string | null;
  onSyncComplete?: () => void;
}

function WorkspaceActivity({
  workspace = null,
  prData = [],
  issueData = [],
  reviewData = [],
  commentData = [],
  starData = [],
  forkData = [],
  repositories = [],
  loading = false,
  error = null,
  onSyncComplete,
}: WorkspaceActivityProps) {
  // Memoize the repository lookup map for better performance
  const repositoryMap = useMemo(() => {
    const map = new Map<string, Repository>();
    repositories.forEach((repo) => {
      if (repo?.id) {
        map.set(repo.id, repo);
      }
    });
    return map;
  }, [repositories]);

  // Memoize activities transformation for performance
  const activities: ActivityItem[] = useMemo(() => {
    // Helper function defined inside useMemo to avoid dependency issues
    const getRepoName = (repoId: string | undefined): string => {
      if (!repoId) return 'Unknown Repository';
      const repo = repositoryMap.get(repoId);
      return repo?.full_name || 'Unknown Repository';
    };
    try {
      // Validate input data
      const validPRData = Array.isArray(prData) ? prData : [];
      const validIssueData = Array.isArray(issueData) ? issueData : [];
      const validReviewData = Array.isArray(reviewData) ? reviewData : [];
      const validCommentData = Array.isArray(commentData) ? commentData : [];
      const validStarData = Array.isArray(starData) ? starData : [];
      const validForkData = Array.isArray(forkData) ? forkData : [];

      return [
        // Convert PRs to activities with better error handling
        ...validPRData.map((pr, index): ActivityItem => {
          return {
            id: `pr-${pr.id}-${index}`, // Add index to ensure uniqueness
            type: 'pr',
            title: pr.title || `PR #${pr.number}`,
            created_at: pr.created_at,
            author: {
              username: pr.author_login || 'Unknown',
              avatar_url: pr.author_login
                ? `https://avatars.githubusercontent.com/${pr.author_login}`
                : '',
            },
            repository: getRepoName(pr.repository_id),
            status: (() => {
              // Handle all PR states including draft
              if (pr.merged_at) return 'merged';
              if (pr.state === 'open') return 'open';
              if (pr.state === 'draft') return 'open'; // Treat draft as open with different styling later
              return 'closed';
            })() as ActivityItem['status'],
            url: pr.html_url || '#',
            metadata: {
              additions: pr.additions || 0,
              deletions: pr.deletions || 0,
            },
          };
        }),
        // Convert issues to activities with validation
        ...validIssueData.map((issue, index): ActivityItem => {
          return {
            id: `issue-${issue.id}-${index}`, // Add index to ensure uniqueness
            type: 'issue',
            title: issue.title || `Issue #${issue.number}`,
            created_at: issue.created_at,
            author: {
              username: issue.author_login || 'Unknown',
              avatar_url: issue.author_login
                ? `https://avatars.githubusercontent.com/${issue.author_login}`
                : '',
            },
            repository: getRepoName(issue.repository_id),
            status: issue.closed_at ? 'closed' : 'open',
            url:
              issue.repository_name && issue.number
                ? `https://github.com/${issue.repository_name}/issues/${issue.number}`
                : '#',
            metadata: {},
          };
        }),
        // Convert reviews to activities with validation
        ...validReviewData.map(
          (review, index): ActivityItem => ({
            id: `review-${review.id}-${index}`, // Add index to ensure uniqueness
            type: 'review',
            title: review.pr_title ? `Review on: ${review.pr_title}` : `Review on PR`,
            created_at: review.submitted_at,
            author: {
              username: review.reviewer_login || 'Unknown',
              avatar_url: review.reviewer_login
                ? `https://avatars.githubusercontent.com/${review.reviewer_login}`
                : '',
            },
            repository: review.repository_name || 'Unknown Repository',
            status: review.state.toLowerCase() as ActivityItem['status'],
            url: '#',
            metadata: {},
          })
        ),
        // Convert comments to activities with validation
        ...validCommentData.map(
          (comment, index): ActivityItem => ({
            id: `comment-${comment.id}-${index}`, // Add index to ensure uniqueness
            type: 'comment',
            title: comment.pr_title ? `Comment on: ${comment.pr_title}` : `Comment on PR`,
            created_at: comment.created_at,
            author: {
              username: comment.commenter_login || 'Unknown',
              avatar_url: comment.commenter_login
                ? `https://avatars.githubusercontent.com/${comment.commenter_login}`
                : '',
            },
            repository: comment.repository_name || 'Unknown Repository',
            status: 'open',
            url: '#',
            metadata: {},
          })
        ),
        // Convert star events to activities - now individual events
        ...validStarData.map((star, index): ActivityItem => {
          return {
            id: star.id || `star-${index}`,
            type: 'star',
            title: `starred the repository`,
            created_at: star.captured_at,
            author: {
              username: star.actor_login || 'Unknown',
              avatar_url: star.actor_avatar || `https://github.com/${star.actor_login}.png`,
            },
            repository: star.repository_name || 'Unknown Repository',
            // No status for star events
            url: star.repository_name ? `https://github.com/${star.repository_name}` : '#',
            metadata: {},
          };
        }),
        // Convert fork events to activities - now individual events
        ...validForkData.map((fork, index): ActivityItem => {
          return {
            id: fork.id || `fork-${index}`,
            type: 'fork',
            title: `forked the repository`,
            created_at: fork.captured_at,
            author: {
              username: fork.actor_login || 'Unknown',
              avatar_url: fork.actor_avatar || `https://github.com/${fork.actor_login}.png`,
            },
            repository: fork.repository_name || 'Unknown Repository',
            // No status for fork events
            url: fork.repository_name ? `https://github.com/${fork.repository_name}` : '#',
            metadata: {},
          };
        }),
      ];
    } catch (error) {
      console.error('Error transforming activity data:', error);
      return [];
    }
  }, [prData, issueData, reviewData, commentData, starData, forkData, repositoryMap]);

  // Memoize sorted activities to avoid unnecessary re-sorts
  const sortedActivities = useMemo(() => {
    return [...activities].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [activities]);

  // Memoize trend data calculation for performance
  const activityByDay = useMemo(() => {
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return date.toISOString().split('T')[0];
    });

    return last30Days.map((date) => {
      const dayActivities = sortedActivities.filter((a) => a.created_at.split('T')[0] === date);
      return {
        date,
        total: dayActivities.length,
        prs: dayActivities.filter((a) => a.type === 'pr').length,
        issues: dayActivities.filter((a) => a.type === 'issue').length,
        reviews: dayActivities.filter((a) => a.type === 'review').length,
        comments: dayActivities.filter((a) => a.type === 'comment').length,
        stars: dayActivities.filter((a) => a.type === 'star').length,
        forks: dayActivities.filter((a) => a.type === 'fork').length,
      };
    });
  }, [sortedActivities]);

  // Memoize stats calculations for performance
  const { totalActivities, uniqueContributors, activeRepos, activityScore } = useMemo(() => {
    const total = activities.length;
    const contributors = new Set(activities.map((a) => a.author.username)).size;
    const repos = new Set(activities.map((a) => a.repository)).size;
    const score = Math.round((total + contributors * 2 + repos * 3) / 3);

    return {
      totalActivities: total,
      uniqueContributors: contributors,
      activeRepos: repos,
      activityScore: score,
    };
  }, [activities]);

  // Show loading skeleton while data is being fetched
  if (loading) {
    return <WorkspaceActivitySkeleton />;
  }

  // Show error state if there's an error
  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
          <div>
            <h3 className="font-semibold">Failed to load activity data</h3>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Show empty state if no activities
  if (activities.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <Activity className="h-12 w-12 text-muted-foreground mx-auto" />
          <div>
            <h3 className="font-semibold">No activity yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Activity will appear here once repositories have pull requests, issues, or other
              interactions.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Auto-sync indicator at top of tab */}
      {workspace && (
        <div className="flex items-center justify-between px-1">
          <WorkspaceAutoSync
            workspaceId={workspace.id}
            workspaceSlug={workspace.slug}
            repositoryIds={repositories.map((r) => r.id).filter(Boolean)}
            onSyncComplete={onSyncComplete}
            syncIntervalMinutes={60}
            className="text-sm text-muted-foreground"
          />
        </div>
      )}

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
              label: 'Reviews',
              data: activityByDay.map((d) => d.reviews),
              color: '#8b5cf6',
            },
            {
              label: 'Comments',
              data: activityByDay.map((d) => d.comments),
              color: '#06b6d4',
            },
            {
              label: 'Stars',
              data: activityByDay.map((d) => d.stars),
              color: '#fbbf24',
            },
            {
              label: 'Forks',
              data: activityByDay.map((d) => d.forks),
              color: '#ffffff',
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
            <CardTitle className="text-sm font-medium">Active Actors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueContributors}</div>
            <p className="text-xs text-muted-foreground">Unique actors</p>
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
          <div>
            <CardTitle>Activity Feed</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time feed of all activities across your workspace repositories
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-center py-8 text-red-500">
              <p>Error loading activity data: {error}</p>
              <p className="text-sm text-muted-foreground mt-2">Please try refreshing the page.</p>
            </div>
          ) : (
            <ActivityTable activities={sortedActivities} loading={loading} pageSize={20} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function WorkspacePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { syncWithUrl } = useWorkspaceContext();

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [metrics, setMetrics] = useState<WorkspaceMetrics | null>(null);
  const [trendData, setTrendData] = useState<WorkspaceTrendData | null>(null);
  const [activityData, setActivityData] = useState<ActivityDataPoint[]>([]);
  const [fullPRData, setFullPRData] = useState<WorkspaceActivityProps['prData']>([]);
  const [fullIssueData, setFullIssueData] = useState<WorkspaceActivityProps['issueData']>([]);
  const [fullReviewData, setFullReviewData] = useState<WorkspaceActivityProps['reviewData']>([]);
  const [fullCommentData, setFullCommentData] = useState<WorkspaceActivityProps['commentData']>([]);
  const [fullStarData, setFullStarData] = useState<WorkspaceActivityProps['starData']>([]);
  const [fullForkData, setFullForkData] = useState<WorkspaceActivityProps['forkData']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [selectedRepositories, setSelectedRepositories] = useState<string[]>([]);
  const [addRepositoryModalOpen, setAddRepositoryModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentMember, setCurrentMember] = useState<WorkspaceMemberWithUser | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [isWorkspaceOwner, setIsWorkspaceOwner] = useState(false);
  const [reviewerModalOpen, setReviewerModalOpen] = useState(false);
  const [githubAppModalOpen, setGithubAppModalOpen] = useState(false);
  const [selectedRepoForModal, setSelectedRepoForModal] = useState<Repository | null>(null);

  // Fetch event-based metrics for accurate star trends
  // Use workspace?.id (UUID) instead of workspaceId (which could be a slug)
  const { metrics: eventMetrics } = useWorkspaceEvents({
    workspaceId: workspace?.id,
    timeRange,
    enabled: !!workspace?.id,
  });

  // Check GitHub App installation status across all workspace repos
  const repositoryIds = useMemo(
    () => repositories.map((r) => r.id).filter(Boolean),
    [repositories]
  );

  // Memoize repository lookup map
  const repositoryMap = useMemo(() => {
    const map = new Map<string, Repository>();
    repositories.forEach((repo) => {
      if (repo?.id) {
        map.set(repo.id, repo);
      }
    });
    return map;
  }, [repositories]);

  // Build activities from workspace data for hover cards
  const activities: ActivityItem[] = useMemo(() => {
    const getRepoName = (repoId: string | undefined): string => {
      if (!repoId) return 'Unknown Repository';
      const repo = repositoryMap.get(repoId);
      return repo?.full_name || 'Unknown Repository';
    };

    const allActivities: ActivityItem[] = [];

    // Convert PRs to activities
    fullPRData.forEach((pr, index) => {
      allActivities.push({
        id: `pr-${pr.id}-${index}`,
        type: 'pr',
        title: pr.title || `PR #${pr.number}`,
        created_at: pr.created_at,
        author: {
          username: pr.author_login || 'Unknown',
          avatar_url: pr.author_login
            ? `https://avatars.githubusercontent.com/${pr.author_login}`
            : '',
        },
        repository: getRepoName(pr.repository_id),
        status: (() => {
          if (pr.merged_at) return 'merged';
          if (pr.state === 'open') return 'open';
          return 'closed';
        })(),
        url: pr.html_url || '#',
        metadata: {
          additions: pr.additions || 0,
          deletions: pr.deletions || 0,
        },
      });
    });

    // Convert issues to activities
    fullIssueData.forEach((issue, index) => {
      allActivities.push({
        id: `issue-${issue.id}-${index}`,
        type: 'issue',
        title: issue.title || `Issue #${issue.number}`,
        created_at: issue.created_at,
        author: {
          username: issue.author_login || 'Unknown',
          avatar_url: issue.author_login
            ? `https://avatars.githubusercontent.com/${issue.author_login}`
            : '',
        },
        repository: getRepoName(issue.repository_id),
        status: issue.closed_at ? 'closed' : 'open',
        url: issue.html_url || '#',
        metadata: {},
      });
    });

    // Convert reviews to activities
    fullReviewData.forEach((review, index) => {
      allActivities.push({
        id: `review-${review.id}-${index}`,
        type: 'review',
        title: review.pr_title ? `Review on: ${review.pr_title}` : 'Review on PR',
        created_at: review.submitted_at,
        author: {
          username: review.reviewer_login || 'Unknown',
          avatar_url: review.reviewer_login
            ? `https://avatars.githubusercontent.com/${review.reviewer_login}`
            : '',
        },
        repository: review.repository_name || 'Unknown Repository',
        status: review.state.toLowerCase() as ActivityItem['status'],
        url: '#',
        metadata: {},
      });
    });

    // Convert comments to activities
    fullCommentData.forEach((comment, index) => {
      allActivities.push({
        id: `comment-${comment.id}-${index}`,
        type: 'comment',
        title: comment.pr_title ? `Comment on: ${comment.pr_title}` : 'Comment on PR',
        created_at: comment.created_at,
        author: {
          username: comment.commenter_login || 'Unknown',
          avatar_url: comment.commenter_login
            ? `https://avatars.githubusercontent.com/${comment.commenter_login}`
            : '',
        },
        repository: comment.repository_name || 'Unknown Repository',
        status: undefined,
        url: '#',
        metadata: {},
      });
    });

    return allActivities;
  }, [fullPRData, fullIssueData, fullReviewData, fullCommentData, repositoryMap]);

  const appStatus = useWorkspaceGitHubAppStatus(repositoryIds);

  // Determine active tab from URL
  const pathSegments = location.pathname.split('/');
  const activeTab = pathSegments[3] || 'overview';

  // Development environment check - log helpful message about Netlify dev server
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log(
        '%c🚀 Workspace Page - Development Mode',
        'background: #2563eb; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;',
        '\n\n' +
          '📋 API endpoints require Netlify Dev server to be running.\n' +
          '   Run: npm start\n\n' +
          '   This starts:\n' +
          '   • Vite dev server (port 5174)\n' +
          '   • Netlify Functions (port 8888)\n' +
          '   • Inngest dev server\n\n' +
          '❌ If you see 500 errors, make sure all services are running.\n'
      );
    }
  }, []);

  // Extract fetchWorkspace as a reusable function
  const fetchWorkspace = useCallback(async () => {
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

      if (wsError) {
        console.error('Error fetching workspace:', wsError);
        setError(`Failed to load workspace: ${wsError.message}`);
        setLoading(false);
        return;
      }

      if (!workspaceData) {
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

      // Fetch current member info and member count
      if (user) {
        const { data: memberData } = await supabase
          .from('workspace_members')
          .select('*')
          .eq('workspace_id', workspaceData.id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (memberData) {
          // Fetch user details for the current member
          const { data: userData } = await supabase
            .from('app_users')
            .select('auth_user_id, email, display_name, avatar_url')
            .eq('auth_user_id', user.id)
            .maybeSingle();

          const memberWithUser: WorkspaceMemberWithUser = {
            ...memberData,
            user: userData
              ? {
                  id: userData.auth_user_id,
                  email: userData.email,
                  display_name: userData.display_name || userData.email?.split('@')[0],
                  avatar_url: userData.avatar_url,
                }
              : {
                  id: user.id,
                  email: user.email || '',
                  display_name: user.email?.split('@')[0] || 'User',
                  avatar_url: null,
                },
          };
          setCurrentMember(memberWithUser);
        }

        const { count } = await supabase
          .from('workspace_members')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspaceData.id);

        setMemberCount(count || 0);
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
      console.log('Fetched workspace repositories:', repoData?.length, repoData);
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
          open_prs: 0, // Will be populated from real data
          open_issues: r.repositories.open_issues_count,
          contributors: 0, // Will be populated from real data
          last_activity: new Date().toISOString(),
          is_pinned: r.is_pinned,
          avatar_url: r.repositories?.owner
            ? `https://avatars.githubusercontent.com/${r.repositories.owner}`
            : getFallbackAvatar(),
          html_url: `https://github.com/${r.repositories.full_name}`,
        }));
      console.log('Transformed repositories:', transformedRepos.length, transformedRepos);

      // Fetch real data for metrics and trends
      let mergedPRs: MergedPR[] = [];
      let prDataForTrends: Array<{ created_at: string; state: string; commits?: number }> = [];
      let issueDataForTrends: Array<{ created_at: string; state: string }> = [];
      let totalPRCount = 0;
      let totalCommitCount = 0;
      let uniqueContributorCount = 0;

      if (transformedRepos.length > 0) {
        // Use utility function to filter repositories
        const filteredRepos = filterRepositoriesBySelection(transformedRepos, selectedRepositories);
        const repoIds = filteredRepos.map((r) => r.id);

        // Calculate date range based on selected time range
        // Fetch 2x the time range to calculate trends (current + previous period)
        const daysToFetch = TIME_RANGE_DAYS[timeRange] * 2;
        const startDate = new Date(Date.now() - daysToFetch * 24 * 60 * 60 * 1000);

        // Ensure startDate is valid and not in the future
        if (startDate.getTime() > Date.now()) {
          console.warn('Start date is in the future, using 30 days ago as fallback');
          startDate.setTime(Date.now() - timeHelpers.daysToMs(TIME_PERIODS.DEFAULT_METRICS_DAYS));
        }

        // Fetch PRs for activity data and metrics with more fields for activity tab
        const { data: prData, error: prError } = await supabase
          .from('pull_requests')
          .select(
            `id, title, number, merged_at, created_at, updated_at, additions, deletions, 
               changed_files, commits, state, author_id, repository_id, html_url,
               contributors!pull_requests_contributor_id_fkey(username, avatar_url)`
          )
          .in('repository_id', repoIds)
          .or(`created_at.gte.${startDate.toISOString()},merged_at.gte.${startDate.toISOString()}`)
          .order('created_at', { ascending: true });

        if (prError) {
          console.error('Error fetching PR data:', prError);
        }

        if (prData) {
          // Format PR data for activity tab
          const formattedPRs = prData.map((pr) => ({
            ...pr,
            author_login: (() => {
              const contrib = pr.contributors as
                | { username?: string; avatar_url?: string }
                | { username?: string; avatar_url?: string }[]
                | undefined;
              if (Array.isArray(contrib)) {
                return contrib[0]?.username || 'Unknown';
              }
              return contrib?.username || 'Unknown';
            })(), // Use actual GitHub username
            repository_name: transformedRepos.find((r) => r.id === pr.repository_id)?.full_name,
          }));
          setFullPRData(formattedPRs);

          // Store for trend calculation with commits
          prDataForTrends = prData.map((pr) => ({
            created_at: pr.created_at,
            state: pr.state,
            commits: pr.commits || 0,
          }));

          // Count total PRs and aggregate commits for current period only
          const currentPeriodStart = new Date();
          currentPeriodStart.setDate(currentPeriodStart.getDate() - TIME_RANGE_DAYS[timeRange]);

          const currentPeriodPRs = prData.filter((pr) => {
            const prDate = new Date(pr.created_at);
            return prDate >= currentPeriodStart;
          });

          totalPRCount = currentPeriodPRs.length;
          totalCommitCount = currentPeriodPRs.reduce((sum, pr) => sum + (pr.commits || 0), 0);

          // Get unique contributors from PRs
          const prContributors = new Set(prData.map((pr) => pr.author_id).filter(Boolean));

          // Filter for merged PRs for activity chart
          mergedPRs = prData
            .filter((pr) => pr.merged_at !== null)
            .map((pr) => ({
              merged_at: pr.merged_at,
              additions: pr.additions || 0,
              deletions: pr.deletions || 0,
              changed_files: pr.changed_files || 0,
              commits: pr.commits || 0,
            }));

          // If no merged PRs found, use open PRs for activity
          if (mergedPRs.length === 0) {
            const openPRActivity = prData
              .filter((pr) => pr.state === 'open' && pr.created_at)
              .map((pr) => ({
                merged_at: pr.created_at,
                additions: pr.additions || 0,
                deletions: pr.deletions || 0,
                changed_files: pr.changed_files || 0,
                commits: pr.commits || 0,
              }));

            if (openPRActivity.length > 0) {
              mergedPRs = openPRActivity;
            }
          }

          // Fetch issues for metrics and trends with more fields for activity tab
          const { data: issueData, error: issueError } = await supabase
            .from('issues')
            .select(
              `id, title, number, created_at, closed_at, state, author_id, repository_id,
                       contributors!issues_author_id_fkey(username, avatar_url)`
            )
            .in('repository_id', repoIds)
            .gte('created_at', startDate.toISOString().split('T')[0]) // Use date only format (YYYY-MM-DD)
            .order('created_at', { ascending: true });

          if (issueError) {
            console.error('Error fetching issue data:', issueError);
          }

          if (issueData) {
            // Format issue data for activity tab
            const formattedIssues = issueData.map((issue) => ({
              ...issue,
              author_login: (() => {
                const contrib = issue.contributors as
                  | { username?: string; avatar_url?: string }
                  | { username?: string; avatar_url?: string }[]
                  | undefined;
                if (Array.isArray(contrib)) {
                  return contrib[0]?.username || 'Unknown';
                }
                return contrib?.username || 'Unknown';
              })(), // Use actual GitHub username
              repository_name: transformedRepos.find((r) => r.id === issue.repository_id)
                ?.full_name,
            }));
            setFullIssueData(formattedIssues);

            // Store for trend calculation
            issueDataForTrends = issueData.map((issue) => ({
              created_at: issue.created_at,
              state: issue.state,
            }));

            // Add issue contributors to the set
            const issueContributors = new Set(
              issueData.map((issue) => issue.author_id).filter(Boolean)
            );

            // Merge contributor sets
            const allContributors = new Set([...prContributors, ...issueContributors]);
            uniqueContributorCount = allContributors.size;
          }

          // Fetch reviews for activity tab
          const { data: reviewData, error: reviewError } = await supabase
            .from('reviews')
            .select(
              `id, pull_request_id, author_id, state, body, submitted_at,
                 pull_requests!inner(title, number, repository_id),
                 contributors!reviews_author_id_fkey(username, avatar_url)`
            )
            .in('pull_requests.repository_id', repoIds)
            .gte('submitted_at', startDate.toISOString())
            .order('submitted_at', { ascending: false });

          if (reviewError) {
            console.error('Error fetching review data:', reviewError);
          }

          if (reviewData && Array.isArray(reviewData)) {
            // Define types for better type safety
            type ContributorData = { username?: string; avatar_url?: string };
            type ReviewData = {
              id: string;
              pull_request_id: string;
              author_id: string;
              state: string;
              body?: string;
              submitted_at: string;
              contributors?: ContributorData | ContributorData[];
              pull_requests?:
                | {
                    title: string;
                    number: number;
                    repository_id: string;
                  }
                | Array<{
                    title: string;
                    number: number;
                    repository_id: string;
                  }>;
            };

            // Type guard for review data validation
            const isValidReview = (review: unknown): review is ReviewData => {
              return (
                typeof review === 'object' &&
                review !== null &&
                'id' in review &&
                'pull_request_id' in review &&
                'author_id' in review &&
                'state' in review &&
                'submitted_at' in review
              );
            };

            // Create a Map for O(1) repository lookups instead of O(n) find operations
            const repoMap = new Map(transformedRepos.map((repo) => [repo.id, repo.full_name]));

            const formattedReviews = reviewData.filter(isValidReview).map((r) => {
              // Handle both single object and array cases
              const pr = Array.isArray(r.pull_requests) ? r.pull_requests[0] : r.pull_requests;

              // Extract username from contributors join with type assertion
              let reviewerUsername = 'Unknown';
              if (r.contributors) {
                const contribData = r.contributors as ContributorData | ContributorData[];
                if (Array.isArray(contribData)) {
                  reviewerUsername = contribData[0]?.username || 'Unknown';
                } else {
                  reviewerUsername = contribData.username || 'Unknown';
                }
              }

              return {
                id: r.id,
                pull_request_id: r.pull_request_id,
                reviewer_id: r.author_id, // Map author_id to reviewer_id for backwards compatibility
                state: r.state,
                body: r.body,
                submitted_at: r.submitted_at,
                reviewer_login: reviewerUsername,
                pr_title: pr?.title,
                pr_number: pr?.number,
                repository_id: pr?.repository_id,
                repository_name: pr?.repository_id ? repoMap.get(pr.repository_id) : undefined,
              };
            });
            setFullReviewData(formattedReviews);
          }

          // Fetch comments for activity tab
          const { data: commentData, error: commentError } = await supabase
            .from('comments')
            .select(
              `id, pull_request_id, commenter_id, body, created_at, comment_type,
                 pull_requests!inner(title, number, repository_id),
                 contributors!fk_comments_commenter(username, avatar_url)`
            )
            .in('pull_requests.repository_id', repoIds)
            .gte('created_at', startDate.toISOString())
            .order('created_at', { ascending: false });

          if (commentError) {
            console.error('Error fetching comment data:', commentError);
          }

          if (commentData && Array.isArray(commentData)) {
            // Type guard for comment data validation
            const isValidComment = (
              comment: unknown
            ): comment is {
              id: string;
              pull_request_id: string;
              commenter_id: string;
              body: string;
              created_at: string;
              comment_type: string;
              pull_requests?:
                | {
                    title: string;
                    number: number;
                    repository_id: string;
                  }
                | Array<{
                    title: string;
                    number: number;
                    repository_id: string;
                  }>;
            } => {
              return (
                typeof comment === 'object' &&
                comment !== null &&
                'id' in comment &&
                'pull_request_id' in comment &&
                'commenter_id' in comment &&
                'created_at' in comment
              );
            };

            // Create a Map for O(1) repository lookups instead of O(n) find operations
            const repoMap = new Map(transformedRepos.map((repo) => [repo.id, repo.full_name]));

            const formattedComments = commentData.filter(isValidComment).map((c) => {
              // Handle both single object and array cases
              const pr = Array.isArray(c.pull_requests) ? c.pull_requests[0] : c.pull_requests;
              return {
                id: c.id,
                pull_request_id: c.pull_request_id,
                commenter_id: c.commenter_id,
                body: c.body,
                created_at: c.created_at,
                comment_type: c.comment_type,
                commenter_login: (() => {
                  const contrib = c.contributors as
                    | { username?: string; avatar_url?: string }
                    | { username?: string; avatar_url?: string }[]
                    | undefined;
                  if (Array.isArray(contrib)) {
                    return contrib[0]?.username || 'Unknown';
                  }
                  return contrib?.username || 'Unknown';
                })(), // Use actual GitHub username
                pr_title: pr?.title,
                pr_number: pr?.number,
                repository_id: pr?.repository_id,
                repository_name: pr?.repository_id ? repoMap.get(pr.repository_id) : undefined,
              };
            });
            setFullCommentData(formattedComments);
          }

          // Fetch individual star and fork events from github_events_cache
          // For each repository, fetch its events
          interface GitHubEvent {
            event_id: string;
            event_type: string;
            actor_login: string;
            repository_owner: string;
            repository_name: string;
            created_at: string;
            payload: unknown;
          }
          const allStarEvents: GitHubEvent[] = [];
          const allForkEvents: GitHubEvent[] = [];

          for (const repo of transformedRepos) {
            const [owner, name] = repo.full_name.split('/');

            // Fetch star events for this specific repository
            // Note: Removing date filter temporarily as events might have incorrect timestamps
            const { data: starEvents, error: starError } = await supabase
              .from('github_events_cache')
              .select('*')
              .eq('event_type', 'WatchEvent')
              .eq('repository_owner', owner)
              .eq('repository_name', name)
              // .gte('created_at', startDate.toISOString()) // Commented out for debugging
              .order('created_at', { ascending: false })
              .limit(50); // Limit per repository

            if (!starError && starEvents) {
              allStarEvents.push(...starEvents);
            }

            // Fetch fork events for this specific repository
            const { data: forkEvents, error: forkError } = await supabase
              .from('github_events_cache')
              .select('*')
              .eq('event_type', 'ForkEvent')
              .eq('repository_owner', owner)
              .eq('repository_name', name)
              // .gte('created_at', startDate.toISOString()) // Commented out for debugging
              .order('created_at', { ascending: false })
              .limit(50); // Limit per repository

            if (!forkError && forkEvents) {
              allForkEvents.push(...forkEvents);
            }
          }

          // Format star events
          const formattedStars = allStarEvents.map((event) => {
            const payload = event.payload as { actor?: { login: string; avatar_url: string } };
            return {
              id: event.event_id,
              event_type: 'star' as const,
              actor_login: event.actor_login,
              actor_avatar:
                payload?.actor?.avatar_url ||
                (event.actor_login
                  ? `https://avatars.githubusercontent.com/${event.actor_login}`
                  : getFallbackAvatar()),
              repository_name: `${event.repository_owner}/${event.repository_name}`,
              captured_at: event.created_at,
            };
          });
          setFullStarData(formattedStars);

          // Format fork events
          const formattedForks = allForkEvents.map((event) => {
            const payload = event.payload as { actor?: { login: string; avatar_url: string } };
            return {
              id: event.event_id,
              event_type: 'fork' as const,
              actor_login: event.actor_login,
              actor_avatar:
                payload?.actor?.avatar_url ||
                (event.actor_login
                  ? `https://avatars.githubusercontent.com/${event.actor_login}`
                  : getFallbackAvatar()),
              repository_name: `${event.repository_owner}/${event.repository_name}`,
              captured_at: event.created_at,
            };
          });
          setFullForkData(formattedForks);
        }
      }

      // Batch query to get open PR and issue counts for all repos at once
      if (transformedRepos.length > 0) {
        const repoIds = transformedRepos.map((r) => r.id);

        // Get all open PRs for these repositories in a single query
        const { data: openPRData } = await supabase
          .from('pull_requests')
          .select('repository_id')
          .in('repository_id', repoIds)
          .eq('state', 'open');

        // Count PRs per repository
        const prCountMap = new Map<string, number>();
        if (openPRData) {
          openPRData.forEach((pr) => {
            const count = prCountMap.get(pr.repository_id) || 0;
            prCountMap.set(pr.repository_id, count + 1);
          });
        }

        // Get all open issues for these repositories in a single query
        const { data: openIssueData } = await supabase
          .from('issues')
          .select('repository_id')
          .in('repository_id', repoIds)
          .eq('state', 'open');

        // Count issues per repository
        const issueCountMap = new Map<string, number>();
        if (openIssueData) {
          openIssueData.forEach((issue) => {
            const count = issueCountMap.get(issue.repository_id) || 0;
            issueCountMap.set(issue.repository_id, count + 1);
          });
        }

        // Update repositories with their PR and issue counts
        transformedRepos.forEach((repo) => {
          repo.open_prs = prCountMap.get(repo.id) || 0;
          repo.open_issues = issueCountMap.get(repo.id) || 0;
        });
      }

      // Fetch contributor count from pull_requests table (repository_contributors table doesn't exist)
      if (transformedRepos.length > 0) {
        const repoIds = transformedRepos.map((r) => r.id);

        // Get unique contributors from pull requests
        const { data: prContributorData, error: prContributorError } = await supabase
          .from('pull_requests')
          .select('author_id')
          .in('repository_id', repoIds)
          .not('author_id', 'is', null);

        if (prContributorError) {
          console.error('Error fetching PR contributors:', prContributorError);
        } else if (prContributorData && prContributorData.length > 0) {
          // Get unique contributor IDs
          const contributorIds = [...new Set(prContributorData.map((pr) => pr.author_id))];
          uniqueContributorCount = Math.max(uniqueContributorCount, contributorIds.length);
        }
      }

      setWorkspace(workspaceData);
      setRepositories(transformedRepos);

      // Also ensure the workspace context is synced with the fetched data
      if (workspaceData) {
        syncWithUrl(workspaceData.slug || workspaceData.id);
      }

      // Count total issues from the current period only
      const currentPeriodStart = new Date();
      currentPeriodStart.setDate(currentPeriodStart.getDate() - TIME_RANGE_DAYS[timeRange]);

      const currentPeriodIssues =
        issueDataForTrends?.filter((issue) => {
          const issueDate = new Date(issue.created_at);
          return issueDate >= currentPeriodStart;
        }) || [];

      const totalIssueCount = currentPeriodIssues.length;

      // Calculate metrics for the previous period for trend comparison
      const daysInRange = TIME_RANGE_DAYS[timeRange];
      const today = new Date();
      const periodStart = new Date(today);
      periodStart.setDate(today.getDate() - daysInRange);
      const previousPeriodStart = new Date(periodStart);
      previousPeriodStart.setDate(previousPeriodStart.getDate() - daysInRange);

      // Filter data for previous period
      const previousPRs =
        prDataForTrends?.filter((pr) => {
          const prDate = new Date(pr.created_at);
          return prDate >= previousPeriodStart && prDate < periodStart;
        }) || [];

      const previousIssues =
        issueDataForTrends?.filter((issue) => {
          const issueDate = new Date(issue.created_at);
          return issueDate >= previousPeriodStart && issueDate < periodStart;
        }) || [];

      // Calculate previous period metrics
      const previousMetrics = {
        starCount: transformedRepos.reduce((sum, repo) => sum + (repo.stars || 0), 0), // Stars don't change much, use current
        prCount: previousPRs.length,
        issueCount: previousIssues.length,
        contributorCount: uniqueContributorCount, // Contributors are cumulative, trend will be 0
        commitCount: previousPRs.reduce((sum, pr) => sum + (pr.commits || 0), 0),
      };

      // Generate metrics with real counts including commits and issues
      const realMetrics = calculateRealMetrics(
        transformedRepos,
        totalPRCount,
        uniqueContributorCount,
        totalCommitCount,
        totalIssueCount,
        previousMetrics
      );

      // Generate trend data with real PR/issue data
      const realTrendData = calculateRealTrendData(
        TIME_RANGE_DAYS[timeRange],
        prDataForTrends,
        issueDataForTrends
      );

      // Generate activity data from PRs
      const activityDataPoints = generateActivityDataFromPRs(
        mergedPRs,
        timeRange,
        transformedRepos,
        selectedRepositories
      );

      setMetrics(realMetrics);
      setTrendData(realTrendData);
      setActivityData(activityDataPoints);
    } catch (err) {
      setError('Failed to load workspace');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, timeRange, selectedRepositories, syncWithUrl]);

  // Separate useEffect to update metrics with event data without refetching
  useEffect(() => {
    if (eventMetrics?.stars) {
      setMetrics((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          starsTrend: eventMetrics.stars.percentChange,
          totalStars: eventMetrics.stars.velocity,
        };
      });
    }
  }, [eventMetrics]);

  useEffect(() => {
    // Sync the workspace dropdown with the current URL
    if (workspaceId) {
      syncWithUrl(workspaceId);
    }
    fetchWorkspace();
  }, [fetchWorkspace, workspaceId, syncWithUrl]);

  const handleTabChange = (value: string) => {
    if (value === 'overview') {
      navigate(`/i/${workspace?.slug || workspaceId}`);
    } else {
      navigate(`/i/${workspace?.slug || workspaceId}/${value}`);
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
            contributors: 0, // Will be populated from real data
            avatar_url: item.repositories?.owner
              ? `https://avatars.githubusercontent.com/${item.repositories.owner}`
              : getFallbackAvatar(),
            last_activity: new Date().toISOString().split('T')[0],
            is_pinned: item.is_pinned || false,
            html_url: `https://github.com/${item.repositories.full_name}`,
          }));

        setRepositories(formattedRepos);
        setSelectedRepositories(formattedRepos.map((r) => r.id));

        // Update metrics with new repository data
        const newMetrics = calculateRealMetrics(formattedRepos);
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
        const newMetrics = calculateRealMetrics(updatedRepos);
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

  const handleGitHubAppModalOpen = (repo: Repository) => {
    setSelectedRepoForModal(repo);
    setGithubAppModalOpen(true);
  };

  const handleSettingsClick = () => {
    toast.info('Workspace settings coming soon!');
  };

  const handleUpgradeClick = () => {
    navigate('/billing');
  };

  const handleWorkspaceUpdate = (updates: Partial<Workspace>) => {
    if (workspace) {
      setWorkspace((prev) => (prev ? { ...prev, ...updates } : prev));
    }
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
        activity_score: 50, // Placeholder
        trend: 0, // Placeholder
      });

      // TODO: Generate real activities from repository data
      // Mock generation removed - will be implemented with real data fetching
    });

    // TODO: Generate real trend data
    const trends: TrendDataset[] = [];

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
            <div className="flex flex-wrap items-center gap-2">
              <WorkspaceSwitcher
                className="min-w-[150px]"
                onOpenCommandPalette={() => {
                  // Command palette can be opened from here if needed
                  console.log('Open command palette from workspace page');
                }}
              />
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
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="container max-w-7xl mx-auto px-6 mt-6">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-4 grid-rows-2 sm:flex sm:w-full sm:justify-between sm:grid-rows-1 mb-6 min-h-[88px] sm:min-h-[44px]">
            <TabsTrigger value="overview" className="flex items-center gap-2 sm:pl-4">
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
            <TabsTrigger value="discussions" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Discussions</span>
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
            <TabsTrigger value="settings" className="flex items-center gap-2 sm:pr-4">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          {/* Reviewer Suggestions Modal - Available on all tabs */}
          {repositories.length > 0 && (
            <ReviewerSuggestionsModal
              open={reviewerModalOpen}
              onOpenChange={setReviewerModalOpen}
              repositories={repositories.map((r) => ({
                id: r.id,
                name: r.name,
                owner: r.owner,
                full_name: r.full_name,
              }))}
            />
          )}

          {/* GitHub App Install Modal - Available on all tabs */}
          {selectedRepoForModal && (
            <GitHubAppInstallModal
              open={githubAppModalOpen}
              onOpenChange={setGithubAppModalOpen}
              repository={{
                id: selectedRepoForModal.id,
                full_name: selectedRepoForModal.full_name,
                owner: selectedRepoForModal.owner,
                name: selectedRepoForModal.name,
              }}
              isInstalled={
                appStatus.repoStatuses?.get(selectedRepoForModal.id)?.isInstalled ?? false
              }
            />
          )}

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
                onGitHubAppModalOpen={handleGitHubAppModalOpen}
                onSettingsClick={handleSettingsClick}
                onUpgradeClick={handleUpgradeClick}
                repoStatuses={appStatus.repoStatuses}
              />
            </div>
          </TabsContent>

          <TabsContent value="prs" className="mt-6">
            <div className="container max-w-7xl mx-auto">
              <WorkspacePRs
                repositories={repositories}
                selectedRepositories={selectedRepositories}
                timeRange={timeRange}
                workspaceId={workspace.id}
                workspace={workspace}
                setReviewerModalOpen={setReviewerModalOpen}
                onGitHubAppModalOpen={handleGitHubAppModalOpen}
                currentUser={currentUser}
                currentMember={currentMember}
              />
            </div>
          </TabsContent>

          <TabsContent value="issues" className="mt-6">
            <div className="container max-w-7xl mx-auto">
              <WorkspaceIssues
                repositories={repositories}
                selectedRepositories={selectedRepositories}
                timeRange={timeRange}
                onGitHubAppModalOpen={handleGitHubAppModalOpen}
                currentUser={currentUser}
                currentMember={currentMember}
              />
            </div>
          </TabsContent>

          <TabsContent value="discussions" className="mt-6">
            <div className="container max-w-7xl mx-auto">
              <WorkspaceDiscussionsTable
                repositories={repositories.map((r) => ({
                  id: r.id,
                  name: r.name,
                  owner: r.owner,
                  full_name: r.full_name,
                }))}
                selectedRepositories={selectedRepositories}
                timeRange={timeRange}
                userRole={currentMember?.role}
                isLoggedIn={!!currentUser}
              />
            </div>
          </TabsContent>

          <TabsContent value="contributors" className="mt-6">
            <div className="container max-w-7xl mx-auto">
              <WorkspaceContributors
                repositories={repositories}
                selectedRepositories={selectedRepositories}
                workspaceId={workspace.id}
                userRole={currentMember?.role}
                workspaceTier={workspace.tier}
                isLoggedIn={!!currentUser}
                currentUser={currentUser}
                activities={activities}
              />
            </div>
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
              <WorkspaceActivity
                workspace={workspace}
                prData={fullPRData}
                issueData={fullIssueData}
                reviewData={fullReviewData}
                commentData={fullCommentData}
                starData={fullStarData}
                forkData={fullForkData}
                repositories={repositories}
                loading={loading}
                error={error}
                onSyncComplete={fetchWorkspace}
              />
            </div>
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <div className="container max-w-7xl mx-auto">
              <WorkspaceSettingsComponent
                workspace={workspace}
                currentMember={
                  currentMember || {
                    id: '',
                    workspace_id: workspace.id,
                    user_id: currentUser?.id || '',
                    role: isWorkspaceOwner ? 'owner' : 'contributor',
                    accepted_at: null,
                    invited_at: null,
                    invited_by: null,
                    notifications_enabled: true,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    last_active_at: new Date().toISOString(),
                  }
                }
                memberCount={memberCount}
                repositories={repositories.map((repo) => ({
                  id: repo.id,
                  owner: repo.owner,
                  name: repo.name,
                  full_name: repo.full_name,
                  stargazers_count: repo.stars,
                  forks_count: repo.forks,
                }))}
                onWorkspaceUpdate={handleWorkspaceUpdate}
              />
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

// Export wrapper with error boundary
function WorkspacePageWithErrorBoundary() {
  return (
    <WorkspaceErrorBoundary>
      <WorkspacePage />
    </WorkspaceErrorBoundary>
  );
}

export default WorkspacePageWithErrorBoundary;

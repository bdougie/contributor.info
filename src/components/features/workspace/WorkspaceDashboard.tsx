import { useState } from 'react';
import { MetricCard } from './MetricCard';
import { MyWorkCard, type MyWorkItem, type MyWorkStats } from './MyWorkCard';
import { RepositoryList, type Repository } from './RepositoryList';
import { TimeRange } from './TimeRangeSelector';
import { Star, GitPullRequest, Users, AlertCircle, UserPlus } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { LearnMoreLink } from '@/components/ui/learn-more-link';

export interface WorkspaceMetrics {
  totalStars: number;
  totalPRs: number;
  totalIssues: number;
  totalContributors: number;
  totalCommits: number;
  starsTrend: number;
  prsTrend: number;
  issuesTrend: number;
  contributorsTrend: number;
  commitsTrend: number;
  // Contributor Confidence metrics
  contributorConfidence?: number; // 0-50 scale
  confidenceTrend?: number; // percentage change
  confidenceTrendDirection?: 'improving' | 'declining' | 'stable';
}

export interface WorkspaceTrendData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: (number | null)[];
    color?: string;
  }>;
}

export interface WorkspaceDashboardProps {
  workspaceId: string;
  workspaceName: string;
  metrics: WorkspaceMetrics;
  trendData: WorkspaceTrendData;
  activityData?: unknown; // Made generic since we removed the import
  repositories: Repository[];
  myWorkItems?: MyWorkItem[];
  myWorkContent?: React.ReactNode;
  myWorkStats?: MyWorkStats;
  myWorkTotalCount?: number;
  myWorkTabCounts?: { needsResponse: number; followUps: number; replies: number };
  myWorkCurrentPage?: number;
  myWorkItemsPerPage?: number;
  myWorkLoading?: boolean;
  myWorkSelectedTypes?: Array<'pr' | 'issue' | 'discussion'>;
  myWorkActiveTab?: 'needs_response' | 'follow_ups' | 'replies';
  onMyWorkPageChange?: (page: number) => void;
  onMyWorkTypesChange?: (types: Array<'pr' | 'issue' | 'discussion'>) => void;
  onMyWorkTabChange?: (tab: 'needs_response' | 'follow_ups' | 'replies') => void;
  loading?: boolean;
  tier?: 'free' | 'pro' | 'enterprise';
  timeRange?: TimeRange;
  onAddRepository?: () => void;
  onRemoveRepository?: (repo: Repository) => void;
  onRepositoryClick?: (repo: Repository) => void;
  onGitHubAppModalOpen?: (repo: Repository) => void;
  onSettingsClick?: () => void;
  onUpgradeClick?: () => void;
  onMyWorkItemClick?: (item: MyWorkItem) => void;
  onMyWorkItemRespond?: (item: MyWorkItem) => void;
  onMyWorkItemMarkAsResponded?: (item: MyWorkItem) => void;
  onSyncComments?: () => Promise<void>;
  isSyncingComments?: boolean;
  commentSyncStatus?: {
    isStale: boolean;
    lastSyncedAt: Date | null;
  };
  className?: string;
  children?: React.ReactNode; // Allow passing additional content like Rising Stars chart
  repoStatuses?: Map<
    string,
    {
      isInstalled: boolean;
      installationId?: string;
    }
  >;
}

const timeRangeLabels: Record<TimeRange, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  '1y': 'Last year',
  all: 'All time',
};

export function WorkspaceDashboard({
  metrics,
  repositories,
  myWorkItems = [],
  myWorkContent,
  myWorkStats,
  myWorkTotalCount = 0,
  myWorkTabCounts,
  myWorkCurrentPage = 1,
  myWorkItemsPerPage = 10,
  myWorkLoading = false,
  myWorkSelectedTypes = ['pr', 'issue', 'discussion'],
  myWorkActiveTab = 'needs_response',
  onMyWorkPageChange,
  onMyWorkTypesChange,
  onMyWorkTabChange,
  loading = false,
  timeRange = '30d',
  onAddRepository,
  onRemoveRepository,
  onRepositoryClick,
  onGitHubAppModalOpen,
  onMyWorkItemClick,
  onMyWorkItemRespond,
  onMyWorkItemMarkAsResponded,
  onSyncComments,
  isSyncingComments,
  commentSyncStatus,
  className,
  children,
  repoStatuses,
}: WorkspaceDashboardProps) {
  const [pinnedRepos, setPinnedRepos] = useState<Set<string>>(
    new Set(repositories.filter((r) => r.is_pinned).map((r) => r.id))
  );

  const trendLabel = 'vs previous period';

  const handlePinToggle = (repo: Repository) => {
    setPinnedRepos((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(repo.id)) {
        newSet.delete(repo.id);
      } else {
        newSet.add(repo.id);
      }
      return newSet;
    });
  };

  const repositoriesWithPinState = repositories.map((repo) => ({
    ...repo,
    is_pinned: pinnedRepos.has(repo.id),
  }));

  // Avoid ternary - Rollup 4.45.0 bug (see docs/architecture/state-machine-patterns.md)
  let emptyMessage;
  if (repositories.length === 0) {
    emptyMessage =
      'No repositories in this workspace yet. Add your first repository to start tracking activity.';
  } else {
    emptyMessage = 'No repositories match your search criteria.';
  }

  return (
    <div className={cn('space-y-6', className)} data-testid="workspace-dashboard">
      <section aria-label="Workspace metrics" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-sm font-semibold">At a glance</h2>
            <p className="text-xs text-muted-foreground">{timeRangeLabels[timeRange]}</p>
          </div>
          <LearnMoreLink
            href="https://docs.contributor.info/workspaces/overview"
            feature="workspaces"
            source="workspace_dashboard"
          />
        </div>
        {/* Metrics Grid */}
        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Star Velocity"
            subtitle="stars / day"
            value={
              // Show placeholder if velocity is not valid (0, undefined, or too large)
              metrics.totalStars > 0 && metrics.totalStars < 1000 ? metrics.totalStars : '—'
            }
            description="Daily star growth rate"
            icon={<Star className="h-4 w-4" />}
            trend={{
              value: metrics.starsTrend,
              label: trendLabel,
            }}
            format={(val) => {
              if (typeof val === 'string') return val;
              // Avoid ternary - Rollup 4.45.0 bug (see docs/architecture/state-machine-patterns.md)
              if (val < 1) {
                return val.toFixed(3);
              }
              return val.toFixed(1);
            }}
            color="yellow"
            loading={loading}
          />

          <MetricCard
            title="Open PRs"
            subtitle="pull requests"
            value={metrics.totalPRs}
            description="Active development and contributions"
            icon={<GitPullRequest className="h-4 w-4" />}
            trend={{
              value: metrics.prsTrend,
              label: trendLabel,
            }}
            format="number"
            color="green"
            loading={loading}
          />

          <MetricCard
            title="Open Issues"
            subtitle="issues"
            value={metrics.totalIssues || 0}
            description="Tasks and feature requests"
            icon={<AlertCircle className="h-4 w-4" />}
            trend={{
              value: metrics.issuesTrend || 0,
              label: trendLabel,
            }}
            format="number"
            color="orange"
            loading={loading}
          />

          <MetricCard
            title="Contributors"
            subtitle="unique people"
            value={metrics.totalContributors}
            description="Community engagement level"
            icon={<Users className="h-4 w-4" />}
            trend={{
              value: metrics.contributorsTrend,
              label: trendLabel,
            }}
            format="number"
            color="blue"
            loading={loading}
          />

          <MetricCard
            title="Contributor Confidence"
            subtitle={
              metrics.contributorConfidence == null
                ? 'No confidence data available yet'
                : 'How approachable your projects are · Workspace average'
            }
            layout="inline"
            className="col-span-full"
            value={metrics.contributorConfidence ?? '—'}
            description="How approachable your projects are"
            icon={<UserPlus className="h-4 w-4" />}
            trend={
              metrics.confidenceTrend !== undefined
                ? {
                    value: metrics.confidenceTrend,
                    label: trendLabel,
                  }
                : undefined
            }
            format={(val) => {
              if (typeof val === 'string') return val;
              return `${val}%`;
            }}
            color={(() => {
              if (metrics.confidenceTrendDirection === 'improving') return 'green';
              if (metrics.confidenceTrendDirection === 'declining') return 'orange';
              return 'blue';
            })()}
            loading={loading}
          />
        </div>
      </section>

      {/* My Work Section - Always show to display loading/empty states */}
      {myWorkContent ?? (
        <MyWorkCard
          items={myWorkItems || []}
          stats={myWorkStats}
          totalCount={myWorkTotalCount}
          tabCounts={myWorkTabCounts}
          currentPage={myWorkCurrentPage}
          itemsPerPage={myWorkItemsPerPage}
          loading={myWorkLoading}
          selectedTypes={myWorkSelectedTypes}
          activeTab={myWorkActiveTab}
          onPageChange={onMyWorkPageChange}
          onTypesChange={onMyWorkTypesChange}
          onTabChange={onMyWorkTabChange}
          onItemClick={onMyWorkItemClick}
          onRespond={onMyWorkItemRespond}
          onMarkAsResponded={onMyWorkItemMarkAsResponded}
          onSyncComments={onSyncComments}
          isSyncingComments={isSyncingComments}
          commentSyncStatus={commentSyncStatus}
        />
      )}

      {/* Additional Content (e.g., Rising Stars Chart) */}
      {children}

      {/* Repository List */}
      <RepositoryList
        repositories={repositoriesWithPinState}
        loading={loading}
        onRepositoryClick={onRepositoryClick}
        onPinToggle={handlePinToggle}
        onRemove={onRemoveRepository}
        onAddRepository={onAddRepository}
        onGitHubAppModalOpen={onGitHubAppModalOpen}
        repoStatuses={repoStatuses}
        emptyMessage={emptyMessage}
      />
    </div>
  );
}

// Loading skeleton component
export function WorkspaceDashboardSkeleton({ className }: { className?: string }) {
  return (
    <WorkspaceDashboard
      workspaceId=""
      workspaceName="Loading..."
      metrics={{
        totalStars: 0,
        totalPRs: 0,
        totalIssues: 0,
        totalContributors: 0,
        totalCommits: 0,
        starsTrend: 0,
        prsTrend: 0,
        issuesTrend: 0,
        contributorsTrend: 0,
        commitsTrend: 0,
      }}
      trendData={{ labels: [], datasets: [] }}
      repositories={[]}
      loading={true}
      myWorkLoading={true}
      className={className}
    />
  );
}

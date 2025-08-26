import { useState } from 'react';
import { MetricCard } from './MetricCard';
import { TrendChart } from './TrendChart';
import { ActivityChart, type ActivityDataPoint } from './ActivityChart';
import { RepositoryList, type Repository } from './RepositoryList';
import { TimeRange } from './TimeRangeSelector';
import { Star, GitPullRequest, Users, GitCommit } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

export interface WorkspaceMetrics {
  totalStars: number;
  totalPRs: number;
  totalContributors: number;
  totalCommits: number;
  starsTrend: number;
  prsTrend: number;
  contributorsTrend: number;
  commitsTrend: number;
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
  activityData?: ActivityDataPoint[];
  repositories: Repository[];
  loading?: boolean;
  tier?: 'free' | 'pro' | 'enterprise';
  timeRange?: TimeRange;
  onAddRepository?: () => void;
  onRepositoryClick?: (repo: Repository) => void;
  onSettingsClick?: () => void;
  onUpgradeClick?: () => void;
  className?: string;
}

// Time range labels for trend comparison
const timeRangeComparisonLabels: Record<TimeRange, string> = {
  '7d': 'vs previous 7 days',
  '30d': 'vs previous 30 days',
  '90d': 'vs previous 90 days',
  '1y': 'vs previous year',
  all: 'vs previous period',
};

export function WorkspaceDashboard({
  workspaceId: _workspaceId,
  workspaceName: _workspaceName,
  metrics,
  trendData,
  activityData = [],
  repositories,
  loading = false,
  tier: _tier = 'free',
  timeRange = '30d',
  onAddRepository,
  onRepositoryClick,
  onSettingsClick: _onSettingsClick,
  onUpgradeClick: _onUpgradeClick,
  className,
}: WorkspaceDashboardProps) {
  const [pinnedRepos, setPinnedRepos] = useState<Set<string>>(
    new Set(repositories.filter((r) => r.is_pinned).map((r) => r.id)),
  );
  const [expandedChart, setExpandedChart] = useState<'trends' | 'activity' | null>(null);

  // Get the trend comparison label based on selected time range
  const trendLabel = timeRangeComparisonLabels[timeRange];

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

  return (
    <div className={cn('space-y-6', className)}>
      {/* Metrics Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Stars"
          subtitle="Across all repositories"
          value={metrics.totalStars}
          description="Community interest and popularity"
          icon={<Star className="h-4 w-4" />}
          trend={{
            value: metrics.starsTrend,
            label: trendLabel,
          }}
          format="compact"
          color="gray"
          loading={loading}
        />

        <MetricCard
          title="Pull Requests"
          subtitle="Currently open"
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
          title="Contributors"
          subtitle="Unique contributors"
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
          title="Commits"
          subtitle="Total commits"
          value={metrics.totalCommits}
          description="Development velocity indicator"
          icon={<GitCommit className="h-4 w-4" />}
          trend={{
            value: metrics.commitsTrend,
            label: trendLabel,
          }}
          format="compact"
          color="purple"
          loading={loading}
        />
      </div>

      {/* Charts Row */}
      <div
        className={cn(
          'grid gap-4 transition-all duration-500 ease-in-out',
          expandedChart ? 'grid-cols-1' : 'lg:grid-cols-2',
        )}
      >
        <div
          className={cn(
            'transition-all duration-500 ease-in-out transform-gpu',
            expandedChart === 'activity'
              ? 'opacity-0 scale-95 h-0 overflow-hidden'
              : 'opacity-100 scale-100',
            expandedChart === 'trends' ? 'col-span-full' : '',
          )}
        >
          {(!expandedChart || expandedChart === 'trends') && (
            <TrendChart
              title="Activity Trends"
              description="Repository activity over time"
              data={trendData}
              loading={loading}
              height={expandedChart === 'trends' ? 400 : 300}
              showLegend={true}
              isExpanded={expandedChart === 'trends'}
              onExpandToggle={() => setExpandedChart(expandedChart === 'trends' ? null : 'trends')}
            />
          )}
        </div>

        <div
          className={cn(
            'transition-all duration-500 ease-in-out transform-gpu',
            expandedChart === 'trends'
              ? 'opacity-0 scale-95 h-0 overflow-hidden'
              : 'opacity-100 scale-100',
            expandedChart === 'activity' ? 'col-span-full' : '',
          )}
        >
          {(!expandedChart || expandedChart === 'activity') && (
            <ActivityChart
              title="Code Activity"
              description="Daily code changes showing additions (green) vs deletions (red)"
              data={activityData}
              loading={loading}
              height={expandedChart === 'activity' ? 400 : 300}
              isExpanded={expandedChart === 'activity'}
              onExpandToggle={() =>
                setExpandedChart(expandedChart === 'activity' ? null : 'activity')
              }
            />
          )}
        </div>
      </div>

      {/* Repository List */}
      <RepositoryList
        repositories={repositoriesWithPinState}
        loading={loading}
        onRepositoryClick={onRepositoryClick}
        onPinToggle={handlePinToggle}
        onAddRepository={onAddRepository}
        emptyMessage={
          repositories.length === 0
            ? 'No repositories in this workspace yet. Add your first repository to start tracking activity.'
            : 'No repositories match your search criteria.'
        }
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
        totalContributors: 0,
        totalCommits: 0,
        starsTrend: 0,
        prsTrend: 0,
        contributorsTrend: 0,
        commitsTrend: 0,
      }}
      trendData={{ labels: [], datasets: [] }}
      repositories={[]}
      loading={true}
      className={className}
    />
  );
}

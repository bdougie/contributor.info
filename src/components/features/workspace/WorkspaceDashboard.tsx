import { useState } from 'react';
import { MetricCard } from './MetricCard';
import { RepositoryList, type Repository } from './RepositoryList';
import { TimeRange } from './TimeRangeSelector';
import { Star, GitPullRequest, Users, AlertCircle } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

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
  loading?: boolean;
  tier?: 'free' | 'pro' | 'enterprise';
  timeRange?: TimeRange;
  onAddRepository?: () => void;
  onRemoveRepository?: (repo: Repository) => void;
  onRepositoryClick?: (repo: Repository) => void;
  onGitHubAppModalOpen?: (repo: Repository) => void;
  onSettingsClick?: () => void;
  onUpgradeClick?: () => void;
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

// Time range labels for trend comparison
const timeRangeComparisonLabels: Record<TimeRange, string> = {
  '7d': 'vs previous',
  '30d': 'vs previous',
  '90d': 'vs previous',
  '1y': 'vs previous',
  all: 'vs previous',
};

export function WorkspaceDashboard({
  metrics,
  repositories,
  loading = false,
  timeRange = '30d',
  onAddRepository,
  onRemoveRepository,
  onRepositoryClick,
  onGitHubAppModalOpen,
  className,
  children,
  repoStatuses,
}: WorkspaceDashboardProps) {
  const [pinnedRepos, setPinnedRepos] = useState<Set<string>>(
    new Set(repositories.filter((r) => r.is_pinned).map((r) => r.id))
  );

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
    <div className={cn('space-y-6', className)} data-testid="workspace-dashboard">
      {/* Metrics Grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
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
          color="yellow"
          loading={loading}
        />

        <MetricCard
          title="Open PRs"
          subtitle="Last 30 days"
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
          subtitle="Last 30 days"
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
      </div>

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
      className={className}
    />
  );
}

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TrendingUp,
  TrendingDown,
  GitPullRequest,
  Clock,
  GitBranch,
  Users,
} from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import type { Repository } from './RepositoryList';

interface WorkspacePRMetricsProps {
  repositories: Repository[];
  selectedRepositories: string[];
  timeRange: string;
}

interface PRMetrics {
  totalPRs: number;
  openPRs: number;
  mergedPRs: number;
  closedPRs: number;
  avgTimeToMerge: number; // in days
  avgTimeToClose: number; // in days
  uniqueContributors: number;
  avgCommitsPerPR: number;
  avgFilesChanged: number;
  totalAdditions: number;
  totalDeletions: number;
}

interface PRTrends {
  prCountTrend: number;
  mergeRateTrend: number;
  timeToMergeTrend: number;
  contributorsTrend: number;
}

interface MetricCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  trend?: number;
  trendLabel?: string;
  icon?: React.ReactNode;
  format?: 'number' | 'days' | 'percentage' | 'compact';
  loading?: boolean;
  color?: 'blue' | 'green' | 'orange' | 'purple' | 'gray';
}

function MetricCard({
  title,
  value,
  subtitle,
  trend,
  trendLabel = 'vs previous period',
  icon,
  format = 'number',
  loading = false,
  color = 'blue',
}: MetricCardProps) {
  const colorMap = {
    blue: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950',
    green: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950',
    orange: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950',
    purple: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950',
    gray: 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-950',
  };

  const formatValue = (val: number | string): string => {
    if (typeof val === 'string') return val;

    switch (format) {
      case 'days':
        return `${val.toFixed(1)}d`;
      case 'percentage':
        return `${val.toFixed(1)}%`;
      case 'compact':
        if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
        if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
        return val.toString();
      default:
        return val.toLocaleString();
    }
  };

  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend > 0) return <TrendingUp className="h-4 w-4" />;
    if (trend < 0) return <TrendingDown className="h-4 w-4" />;
    return null;
  };

  const getTrendColor = () => {
    if (!trend) return '';
    if (trend > 0) return 'text-green-600 dark:text-green-400';
    if (trend < 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-20" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          {icon && <div className={cn('p-2 rounded', colorMap[color])}>{icon}</div>}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold">{formatValue(value)}</div>
            {trend !== undefined && (
              <div className={cn('flex items-center gap-1', getTrendColor())}>
                {getTrendIcon()}
                <span className="text-sm font-medium">
                  {Math.abs(trend) < 1
                    ? `${Math.abs(trend).toFixed(2)}%`
                    : `${Math.round(Math.abs(trend))}%`}
                </span>
                {trendLabel && (
                  <span className="text-xs text-muted-foreground hidden lg:inline">
                    {trendLabel}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function WorkspacePRMetrics({
  repositories,
  selectedRepositories,
  timeRange,
}: WorkspacePRMetricsProps) {
  const [metrics, setMetrics] = useState<PRMetrics | null>(null);
  const [trends, setTrends] = useState<PRTrends | null>(null);
  const [loading, setLoading] = useState(true);

  const calculateMetrics = useCallback(async () => {
    setLoading(true);
    try {
      // Filter repositories based on selection
      const filteredRepos =
        selectedRepositories.length > 0
          ? repositories.filter((r) => selectedRepositories.includes(r.id))
          : repositories;

      if (filteredRepos.length === 0) {
        setMetrics(null);
        setTrends(null);
        return;
      }

      const repoIds = filteredRepos.map((r) => r.id);

      // Calculate date range based on timeRange
      const daysMap: Record<string, number> = {
        '7d': 7,
        '30d': 30,
        '90d': 90,
        '1y': 365,
        all: 730,
      };

      const days = daysMap[timeRange] || 30;
      const currentDate = new Date();
      const startDate = new Date(currentDate.getTime() - days * 24 * 60 * 60 * 1000);
      const previousStartDate = new Date(startDate.getTime() - days * 24 * 60 * 60 * 1000);

      // Fetch PRs for current and previous periods
      const [currentPRs, previousPRs] = await Promise.all([
        supabase
          .from('pull_requests')
          .select('*')
          .in('repository_id', repoIds)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', currentDate.toISOString()),
        supabase
          .from('pull_requests')
          .select('*')
          .in('repository_id', repoIds)
          .gte('created_at', previousStartDate.toISOString())
          .lt('created_at', startDate.toISOString()),
      ]);

      if (currentPRs.error) throw currentPRs.error;
      if (previousPRs.error) throw previousPRs.error;

      const currentData = currentPRs.data || [];
      const previousData = previousPRs.data || [];

      // Calculate current period metrics
      const openPRs = currentData.filter((pr) => pr.state === 'open').length;
      const mergedPRs = currentData.filter((pr) => pr.merged_at).length;
      const closedPRs = currentData.filter((pr) => pr.state === 'closed' && !pr.merged_at).length;

      // Calculate time metrics for merged PRs
      const mergedPRTimes = currentData
        .filter((pr) => pr.merged_at)
        .map((pr) => {
          const created = new Date(pr.created_at);
          const merged = new Date(pr.merged_at);
          return (merged.getTime() - created.getTime()) / (1000 * 60 * 60 * 24); // days
        });

      const closedPRTimes = currentData
        .filter((pr) => pr.closed_at && !pr.merged_at)
        .map((pr) => {
          const created = new Date(pr.created_at);
          const closed = new Date(pr.closed_at);
          return (closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24); // days
        });

      const avgTimeToMerge =
        mergedPRTimes.length > 0
          ? mergedPRTimes.reduce((a, b) => a + b, 0) / mergedPRTimes.length
          : 0;

      const avgTimeToClose =
        closedPRTimes.length > 0
          ? closedPRTimes.reduce((a, b) => a + b, 0) / closedPRTimes.length
          : 0;

      // Calculate contributor metrics
      const uniqueContributors = new Set(currentData.map((pr) => pr.author_id).filter(Boolean))
        .size;

      // Calculate code metrics
      const avgCommitsPerPR =
        currentData.length > 0
          ? currentData.reduce((sum, pr) => sum + (pr.commits || 0), 0) / currentData.length
          : 0;

      const avgFilesChanged =
        currentData.length > 0
          ? currentData.reduce((sum, pr) => sum + (pr.changed_files || 0), 0) / currentData.length
          : 0;

      const totalAdditions = currentData.reduce((sum, pr) => sum + (pr.additions || 0), 0);
      const totalDeletions = currentData.reduce((sum, pr) => sum + (pr.deletions || 0), 0);

      // Calculate previous period metrics for trends
      const prevMergedPRs = previousData.filter((pr) => pr.merged_at).length;
      const prevUniqueContributors = new Set(previousData.map((pr) => pr.author_id).filter(Boolean))
        .size;

      const prevMergedPRTimes = previousData
        .filter((pr) => pr.merged_at)
        .map((pr) => {
          const created = new Date(pr.created_at);
          const merged = new Date(pr.merged_at);
          return (merged.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
        });

      const prevAvgTimeToMerge =
        prevMergedPRTimes.length > 0
          ? prevMergedPRTimes.reduce((a, b) => a + b, 0) / prevMergedPRTimes.length
          : 0;

      // Calculate trends
      const prCountTrend =
        previousData.length > 0
          ? ((currentData.length - previousData.length) / previousData.length) * 100
          : 0;

      const mergeRate = currentData.length > 0 ? (mergedPRs / currentData.length) * 100 : 0;
      const prevMergeRate =
        previousData.length > 0 ? (prevMergedPRs / previousData.length) * 100 : 0;
      const mergeRateTrend =
        prevMergeRate > 0 ? ((mergeRate - prevMergeRate) / prevMergeRate) * 100 : 0;

      const timeToMergeTrend =
        prevAvgTimeToMerge > 0
          ? ((avgTimeToMerge - prevAvgTimeToMerge) / prevAvgTimeToMerge) * 100
          : 0;

      const contributorsTrend =
        prevUniqueContributors > 0
          ? ((uniqueContributors - prevUniqueContributors) / prevUniqueContributors) * 100
          : 0;

      setMetrics({
        totalPRs: currentData.length,
        openPRs,
        mergedPRs,
        closedPRs,
        avgTimeToMerge,
        avgTimeToClose,
        uniqueContributors,
        avgCommitsPerPR,
        avgFilesChanged,
        totalAdditions,
        totalDeletions,
      });

      setTrends({
        prCountTrend,
        mergeRateTrend,
        timeToMergeTrend: -timeToMergeTrend, // Negative because lower is better
        contributorsTrend,
      });
    } catch (error) {
      console.error('Error calculating PR metrics:', error);
      setMetrics(null);
      setTrends(null);
    } finally {
      setLoading(false);
    }
  }, [repositories, selectedRepositories, timeRange]);

  useEffect(() => {
    calculateMetrics();
  }, [calculateMetrics]);

  if (!metrics && !loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            No pull request data available for the selected repositories and time range.
          </div>
        </CardContent>
      </Card>
    );
  }

  const mergeRate =
    metrics && metrics.totalPRs > 0 ? (metrics.mergedPRs / metrics.totalPRs) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Main Metrics Grid */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total PRs"
          subtitle="In selected period"
          value={metrics?.totalPRs || 0}
          icon={<GitPullRequest className="h-4 w-4" />}
          trend={trends?.prCountTrend}
          format="number"
          color="blue"
          loading={loading}
        />

        <MetricCard
          title="Merge Rate"
          subtitle="Successfully merged"
          value={mergeRate}
          icon={<GitBranch className="h-4 w-4" />}
          trend={trends?.mergeRateTrend}
          format="percentage"
          color="green"
          loading={loading}
        />

        <MetricCard
          title="Avg Time to Merge"
          subtitle="From open to merged"
          value={metrics?.avgTimeToMerge || 0}
          icon={<Clock className="h-4 w-4" />}
          trend={trends?.timeToMergeTrend}
          format="days"
          color="orange"
          loading={loading}
        />

        <MetricCard
          title="Contributors"
          subtitle="Unique PR authors"
          value={metrics?.uniqueContributors || 0}
          icon={<Users className="h-4 w-4" />}
          trend={trends?.contributorsTrend}
          format="number"
          color="purple"
          loading={loading}
        />
      </div>

      {/* Code Changes Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Code Changes Summary</CardTitle>
          <CardDescription>Average code changes per pull request</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">Avg Commits</p>
                <p className="text-2xl font-bold">{metrics?.avgCommitsPerPR.toFixed(1) || 0}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Files</p>
                <p className="text-2xl font-bold">{metrics?.avgFilesChanged.toFixed(1) || 0}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Additions</p>
                <p className="text-2xl font-bold text-green-600">
                  +{metrics?.totalAdditions.toLocaleString() || 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Deletions</p>
                <p className="text-2xl font-bold text-red-600">
                  -{metrics?.totalDeletions.toLocaleString() || 0}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

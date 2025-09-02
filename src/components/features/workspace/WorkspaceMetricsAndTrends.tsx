import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link, TrendingUp } from '@/components/ui/icon';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { PrCountCard } from '../activity/pr-count-card';
import { AvgTimeCard } from '../activity/avg-time-card';
import { VelocityCard } from '../activity/velocity-card';
import type { Repository } from './RepositoryList';

interface WorkspaceMetricsAndTrendsProps {
  repositories: Repository[];
  selectedRepositories: string[];
  timeRange: string;
}

interface ActivityMetrics {
  totalPRs: number;
  openPRs: number;
  averageMergeTime: number;
  averageMergeTimeTrend?: number;
  velocity: {
    current: number;
    previous: number;
    change: number;
  };
  status?: string;
  message?: string;
}

interface TrendData {
  metric: string;
  current: number;
  unit?: string;
  change: number;
  trend: 'up' | 'down' | 'stable';
  insight?: string;
}

function TrendCard({ trend, loading = false }: { trend?: TrendData; loading?: boolean }) {
  if (loading || !trend) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <div className="h-4 w-20 bg-muted animate-pulse rounded" />
            <div className="h-8 w-16 bg-muted animate-pulse rounded" />
            <div className="h-3 w-24 bg-muted animate-pulse rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const getTrendIcon = (trendType: TrendData['trend'], change: number) => {
    if (trendType === 'stable' || change === 0) return null;

    const isPositive = change > 0;
    const Icon = TrendingUp;
    const color = isPositive ? 'text-green-500' : 'text-red-500';

    return <Icon className={`h-4 w-4 ${color} ${!isPositive ? 'rotate-180' : ''}`} />;
  };

  const getTrendColor = (change: number) => {
    if (change > 0) return 'text-green-500';
    if (change < 0) return 'text-red-500';
    return 'text-muted-foreground';
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-3">
          <h4 className="text-sm font-medium">{trend.metric}</h4>

          <dl className="flex items-baseline gap-2">
            <dt className="sr-only">Current {trend.metric}</dt>
            <dd className="text-2xl font-bold">{trend.current}</dd>
            {trend.unit && <dd className="text-sm text-muted-foreground">{trend.unit}</dd>}

            <div className="flex items-center gap-1 ml-2">
              {getTrendIcon(trend.trend, trend.change)}
              <dt className="sr-only">Change from previous period</dt>
              <dd className={`text-sm font-medium ${getTrendColor(trend.change)}`}>
                {trend.change > 0 ? '+' : ''}
                {trend.change}%
              </dd>
            </div>
          </dl>

          {trend.insight && <p className="text-xs text-muted-foreground">{trend.insight}</p>}

          <Badge variant="secondary" className="text-xs">
            vs previous
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

export function WorkspaceMetricsAndTrends({
  repositories,
  selectedRepositories,
  timeRange,
}: WorkspaceMetricsAndTrendsProps) {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<ActivityMetrics | null>(null);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [untrackedRepos, setUntrackedRepos] = useState<string[]>([]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard!');
    } catch {
      toast.error('Failed to copy link');
    }
  };

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
        setTrends([]);
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

      // Calculate metrics
      const openPRs = currentData.filter((pr) => pr.state === 'open').length;
      const totalPRs = currentData.length;

      // Calculate average merge time
      const mergedPRTimes = currentData
        .filter((pr) => pr.merged_at)
        .map((pr) => {
          const created = new Date(pr.created_at);
          const merged = new Date(pr.merged_at);
          return (merged.getTime() - created.getTime()) / (1000 * 60 * 60 * 24); // days
        });

      const avgMergeTime =
        mergedPRTimes.length > 0
          ? mergedPRTimes.reduce((a, b) => a + b, 0) / mergedPRTimes.length
          : 0;

      // Calculate previous period average merge time for trend
      const prevMergedPRTimes = previousData
        .filter((pr) => pr.merged_at)
        .map((pr) => {
          const created = new Date(pr.created_at);
          const merged = new Date(pr.merged_at);
          return (merged.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
        });

      const prevAvgMergeTime =
        prevMergedPRTimes.length > 0
          ? prevMergedPRTimes.reduce((a, b) => a + b, 0) / prevMergedPRTimes.length
          : 0;

      const mergeTimeTrend =
        prevAvgMergeTime > 0 ? ((avgMergeTime - prevAvgMergeTime) / prevAvgMergeTime) * 100 : 0;

      // Calculate velocity (PRs per day)
      const currentVelocity = totalPRs / days;
      const previousVelocity = previousData.length / days;
      const velocityChange =
        previousVelocity > 0 ? ((currentVelocity - previousVelocity) / previousVelocity) * 100 : 0;

      // Fetch review and comment data for trends
      // First, get all PR IDs for the repositories in the full time range
      const allPRsQuery = await supabase
        .from('pull_requests')
        .select('id')
        .in('repository_id', repoIds)
        .gte('created_at', previousStartDate.toISOString());

      const allPRIds = allPRsQuery.data?.map((pr) => pr.id) || [];

      let reviews = 0;
      let prevReviews = 0;
      let comments = 0;
      let prevComments = 0;

      if (allPRIds.length > 0) {
        const [reviewData, commentData] = await Promise.all([
          supabase
            .from('reviews')
            .select('submitted_at')
            .in('pull_request_id', allPRIds)
            .gte('submitted_at', previousStartDate.toISOString()),
          supabase
            .from('comments')
            .select('created_at')
            .in('pull_request_id', allPRIds)
            .gte('created_at', previousStartDate.toISOString()),
        ]);

        // Count reviews and comments by period
        const reviewsArray = reviewData.data || [];
        const commentsArray = commentData.data || [];

        reviews = reviewsArray.filter((r) => new Date(r.submitted_at) >= startDate).length;
        prevReviews = reviewsArray.filter((r) => new Date(r.submitted_at) < startDate).length;

        comments = commentsArray.filter((c) => new Date(c.created_at) >= startDate).length;
        prevComments = commentsArray.filter((c) => new Date(c.created_at) < startDate).length;
      }

      // Calculate unique contributors
      const currentContributors = new Set(currentData.map((pr) => pr.author_id).filter(Boolean));
      const prevContributors = new Set(previousData.map((pr) => pr.author_id).filter(Boolean));

      // Create trend data
      const trendsData: TrendData[] = [
        {
          metric: 'Review Activity',
          current: reviews,
          change: prevReviews > 0 ? Math.round(((reviews - prevReviews) / prevReviews) * 100) : 0,
          trend: (() => {
            if (reviews > prevReviews) return 'up';
            if (reviews < prevReviews) return 'down';
            return 'stable';
          })() as 'up' | 'down' | 'stable',
          insight: (() => {
            if (reviews > prevReviews) return 'Increased engagement';
            if (reviews < prevReviews) return 'Decreased activity';
            return 'Stable activity';
          })(),
        },
        {
          metric: 'Comment Activity',
          current: comments,
          change:
            prevComments > 0 ? Math.round(((comments - prevComments) / prevComments) * 100) : 0,
          trend: (() => {
            if (comments > prevComments) return 'up';
            if (comments < prevComments) return 'down';
            return 'stable';
          })() as 'up' | 'down' | 'stable',
          insight: (() => {
            if (comments > prevComments) return 'More discussions';
            if (comments < prevComments) return 'Less discussions';
            return 'Stable discussions';
          })(),
        },
        {
          metric: 'Active Contributors',
          current: currentContributors.size,
          change:
            prevContributors.size > 0
              ? Math.round(
                  ((currentContributors.size - prevContributors.size) / prevContributors.size) * 100
                )
              : 0,
          trend: (() => {
            if (currentContributors.size > prevContributors.size) return 'up';
            if (currentContributors.size < prevContributors.size) return 'down';
            return 'stable';
          })() as 'up' | 'down' | 'stable',
        },
        {
          metric: 'Avg PRs/Day',
          current: Math.round(currentVelocity * 10) / 10,
          change: Math.round(velocityChange),
          trend: (() => {
            if (velocityChange > 0) return 'up';
            if (velocityChange < 0) return 'down';
            return 'stable';
          })() as 'up' | 'down' | 'stable',
          unit: 'per day',
        },
      ];

      setMetrics({
        totalPRs,
        openPRs,
        averageMergeTime: avgMergeTime,
        averageMergeTimeTrend: mergeTimeTrend,
        velocity: {
          current: currentVelocity,
          previous: previousVelocity,
          change: velocityChange,
        },
        status: 'success',
      });

      setTrends(trendsData);

      // Check for repositories that might need tracking
      const reposWithNoData = filteredRepos.filter((repo) => {
        const repoPRs = currentData.filter((pr) => pr.repository_id === repo.id);
        return repoPRs.length === 0;
      });
      setUntrackedRepos(reposWithNoData.map((r) => r.full_name));
    } catch (error) {
      console.error('Failed to load workspace metrics:', error);
      setMetrics(null);
      setTrends([]);
    } finally {
      setLoading(false);
    }
  }, [repositories, selectedRepositories, timeRange]);

  useEffect(() => {
    calculateMetrics();
  }, [calculateMetrics]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Metrics and Trends</CardTitle>
            <CardDescription>
              Snapshot comparing the previous{' '}
              {(() => {
                if (timeRange === '7d') return '7 days';
                if (timeRange === '30d') return '30 days';
                if (timeRange === '90d') return '90 days';
                if (timeRange === '1y') return 'year';
                return 'period';
              })()}{' '}
              with review and comment data
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopyLink}
              className="h-8 w-8"
              title="Copy page link"
            >
              <Link className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Show CTA for untracked repos */}
        {!loading && untrackedRepos.length > 0 && (
          <div className="mb-6 p-4 rounded-lg border bg-black dark:bg-white">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-white dark:text-black">
                  Add repositories to workspace
                </p>
                <p className="text-xs text-white/70 dark:text-black/70 mt-1">
                  {untrackedRepos.length}{' '}
                  {untrackedRepos.length === 1 ? 'repository needs' : 'repositories need'} to be
                  tracked for complete metrics
                </p>
              </div>
              <Button
                onClick={() => {
                  // Navigate to workspace settings or show add repository modal
                  toast.info('Navigate to workspace settings to add repositories');
                }}
                variant="outline"
                size="sm"
                className="text-xs whitespace-nowrap border-black text-black hover:bg-black/10 dark:border-white dark:text-white dark:hover:bg-white/10 w-full sm:w-auto"
              >
                Add to Workspace
              </Button>
            </div>
          </div>
        )}

        {/* Metrics Section */}
        <section>
          <h3 className="text-sm font-medium mb-3">Activity Metrics</h3>
          {loading || !metrics ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <PrCountCard openPRs={0} totalPRs={0} loading={true} />
              <AvgTimeCard averageMergeTime={0} loading={true} />
              <div className="sm:col-span-2 md:col-span-2">
                <VelocityCard velocity={{ current: 0, previous: 0, change: 0 }} loading={true} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <PrCountCard
                openPRs={metrics.openPRs}
                totalPRs={metrics.totalPRs}
                loading={loading}
              />
              <AvgTimeCard
                averageMergeTime={metrics.averageMergeTime}
                averageMergeTimeTrend={metrics.averageMergeTimeTrend}
                loading={loading}
              />
              <div className="sm:col-span-2 md:col-span-2">
                <VelocityCard velocity={metrics.velocity} loading={loading} />
              </div>
            </div>
          )}
        </section>

        {/* Trends Section */}
        <section>
          <h3 className="text-sm font-medium mb-3">Trends</h3>
          {(() => {
            if (loading) {
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <TrendCard key={i} loading={true} />
                  ))}
                </div>
              );
            }
            if (trends.length === 0) {
              return (
                <div className="text-center py-8">
                  <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Not enough data to show trends</p>
                </div>
              );
            }
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {trends.slice(0, 4).map((trend, index) => (
                  <TrendCard key={index} trend={trend} loading={loading} />
                ))}
              </div>
            );
          })()}
        </section>
      </CardContent>
    </Card>
  );
}

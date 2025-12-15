import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown } from '@/components/ui/icon';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { calculateTrendMetrics, type TrendData } from '@/lib/insights/trends-metrics';
import { PrCountCard } from './pr-count-card';
import { AvgTimeCard } from './avg-time-card';
import { VelocityCard } from './velocity-card';
import {
  calculatePrActivityMetrics,
  type ActivityMetrics,
} from '@/lib/insights/pr-activity-metrics';
import { DataStateIndicator } from '@/components/ui/data-state-indicator';
import { ShareableCard } from '@/components/features/sharing/shareable-card';

interface MetricsAndTrendsCardProps {
  owner: string;
  repo: string;
  timeRange: string;
}

interface TrendCardProps {
  trend?: TrendData;
  loading?: boolean;
}

function TrendCard({ trend, loading = false }: TrendCardProps) {
  if (loading || !trend) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const getTrendIcon = (trendType: TrendData['trend'], change: number, metric: string) => {
    if (trendType === 'stable' || change === 0) return null;

    const isPositive = change > 0;
    const Icon = isPositive ? TrendingUp : TrendingDown;

    // For metrics where lower is better (like review time), reverse the color logic
    const isLowerBetter = metric === 'Avg Review Time';
    let color: string;
    if (isLowerBetter) {
      color = isPositive ? 'text-red-500' : 'text-green-500';
    } else {
      color = isPositive ? 'text-green-500' : 'text-red-500';
    }

    return <Icon className={cn('h-4 w-4', color)} />;
  };

  const getTrendColor = (change: number, metric: string) => {
    if (change === 0) return 'text-muted-foreground';

    // For metrics where lower is better (like review time), reverse the color logic
    const isLowerBetter = metric === 'Avg Review Time';

    if (change > 0) {
      return isLowerBetter ? 'text-red-500' : 'text-green-500';
    } else {
      return isLowerBetter ? 'text-green-500' : 'text-red-500';
    }
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
              {getTrendIcon(trend.trend, trend.change, trend.metric)}
              <dt className="sr-only">Change from previous period</dt>
              <dd className={cn('text-sm font-medium', getTrendColor(trend.change, trend.metric))}>
                {trend.change > 0 ? '+' : ''}
                {trend.change}%
              </dd>
            </div>
          </dl>

          {trend.insight && (
            <p className="text-xs text-muted-foreground leading-tight">{trend.insight}</p>
          )}

          <Badge variant="secondary" className="text-xs">
            vs previous 30d
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

export function MetricsAndTrendsCard({ owner, repo, timeRange }: MetricsAndTrendsCardProps) {
  const [loading, setLoading] = useState(true);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [metrics, setMetrics] = useState<ActivityMetrics | null>(null);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard!');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  /**
   * Loads trend metrics and PR activity metrics for the repository.
   * Fetches data in parallel and updates component state.
   * Handles errors gracefully by resetting state on failure.
   */
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [trendData, metricsData] = await Promise.all([
        calculateTrendMetrics(owner, repo, timeRange),
        calculatePrActivityMetrics(owner, repo, timeRange),
      ]);
      setTrends(trendData);
      setMetrics(metricsData);

      // DISABLED: Auto-capture was causing database hammering
      // TODO: Re-implement with proper debouncing and rate limiting
      // if (hasLowDataQuality(metricsData, trendData) && !dataCapturing && !captureAttempted) {
      //   // Auto-capture logic here
      // }
    } catch (error) {
      // Log error to monitoring service in production
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to load data:', error);
      }
      setTrends([]);
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  }, [owner, repo, timeRange]);

  /**
   * Evaluates the quality of repository metrics data.
   * Checks for protected repositories, missing data, or suspiciously low engagement.
   * Used to determine whether to show data refresh prompts to users.
   * @param {ActivityMetrics | null} metrics - The activity metrics to evaluate
   * @param {TrendData[]} trends - The trend data to check for engagement
   * @returns {boolean} True if data quality is low or missing
   */
  const hasLowDataQuality = useCallback(
    (metrics: ActivityMetrics | null, trends: TrendData[]) => {
      if (!metrics) return true;

      // Check for protected or error status
      if (
        metrics.status === 'large_repository_protected' ||
        metrics.status === 'no_data' ||
        metrics.status === 'error'
      ) {
        return true;
      }

      // More intelligent data quality check for successful status
      const reviewTrend = trends.find((t) => t.metric === 'Review Activity');
      const commentTrend = trends.find((t) => t.metric === 'Comment Activity');

      // Case 1: No PRs at all (definitely missing data)
      if (metrics.totalPRs === 0) {
        return true;
      }

      // Case 2: Has multiple PRs but suspiciously low engagement
      // Only flag as low quality if we have a significant number of PRs but zero engagement
      const hasSignificantPRs = metrics.totalPRs >= 5;
      const hasZeroReviews = reviewTrend?.current === 0;
      const hasZeroComments = commentTrend?.current === 0;
      const hasBothZero = hasZeroReviews && hasZeroComments;

      // Development logging for data completeness tracking
      if (process.env.NODE_ENV === 'development') {
        const reviewTotal = metrics.totalReviews || 0;
        const commentTotal = metrics.totalComments || 0;
        const engagementRatio =
          metrics.totalPRs > 0 ? (reviewTotal + commentTotal) / metrics.totalPRs : 0;

        console.log('📊 Data Quality Analysis for %s/%s:', owner, repo, {
          totalPRs: metrics.totalPRs,
          totalReviews: reviewTotal,
          totalComments: commentTotal,
          engagementRatio: engagementRatio.toFixed(2),
          hasZeroReviews,
          hasZeroComments,
          wouldShowRefresh:
            (hasSignificantPRs && hasBothZero) ||
            (metrics.totalPRs >= 10 && (hasZeroReviews || hasZeroComments)),
        });
      }

      // Only show refresh button if:
      // - We have 5+ PRs but absolutely no reviews AND no comments (very suspicious)
      // - OR we have 10+ PRs but missing either reviews OR comments entirely
      return (
        (hasSignificantPRs && hasBothZero) ||
        (metrics.totalPRs >= 10 && (hasZeroReviews || hasZeroComments))
      );
    },
    [owner, repo]
  );

  // Get appropriate message based on status
  const getStatusMessage = (metrics: ActivityMetrics | null) => {
    if (!metrics)
      return { title: 'No data available', description: 'Unable to load repository data' };

    switch (metrics.status) {
      case 'large_repository_protected':
        return {
          title: 'Large Repository Protection',
          description:
            metrics.message ||
            'This repository is protected from resource-intensive operations. Use progressive data capture for complete analysis.',
        };
      case 'no_data':
        return {
          title: 'No Data Available',
          description:
            metrics.message ||
            'No recent data found. Try using progressive data capture to populate the database.',
        };
      case 'error':
        return {
          title: 'Data Loading Error',
          description: metrics.message || 'An error occurred while loading repository data.',
        };
      default:
        return {
          title: 'Missing engagement data',
          description:
            'This repository has PRs but appears to be missing review or comment data. Use progressive data capture to fetch complete information.',
        };
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Track when status messages are displayed for monitoring
  useEffect(() => {
    if (!loading && hasLowDataQuality(metrics, trends) && metrics) {
      const statusMessage = getStatusMessage(metrics);

      // Simple logging for user experience tracking
      console.log('Metrics and trends user experience:', {
        repository: `${owner}/${repo}`,
        statusDisplayed: statusMessage.title,
        statusDescription: statusMessage.description,
        userCanRetry: metrics.status !== 'large_repository_protected',
        timeRange,
        component: 'MetricsAndTrendsCard',
        status: metrics.status,
      });
    }
  }, [loading, metrics, trends, owner, repo, timeRange, hasLowDataQuality]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Metrics and Trends</CardTitle>
            <CardDescription>
              <span className="font-medium text-foreground">30-day snapshot</span> with review and
              comment data vs <span className="font-medium text-foreground">previous period</span>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopyLink}
              className="h-8 w-8"
              title="Share page link"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <path d="m16 6-4-4-4 4" />
                <path d="M12 2v15" />
              </svg>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Show user-friendly status for all data states */}
        {!loading && metrics && metrics.status !== 'success' && (
          <DataStateIndicator
            status={metrics.status || 'success'}
            message={metrics.message}
            className="mb-6"
          />
        )}

        {/* Show progressive capture option for data quality issues */}
        {!loading &&
          hasLowDataQuality(metrics, trends) &&
          metrics?.status !== 'large_repository_protected' && (
            <div className="mb-6 p-4 rounded-lg border bg-black dark:bg-white">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-medium text-white dark:text-black">
                    Need complete data faster?
                  </p>
                  <p className="text-xs text-white/70 dark:text-black/70 mt-1">
                    Large repositories are queued for daily processing. Request priority indexing
                    through our GitHub discussions or upgrade for faster processing.
                  </p>
                </div>
                <Button
                  onClick={() => {
                    // Log user interest in prioritization
                    console.log('User requested priority indexing:', {
                      repository: `${owner}/${repo}`,
                      status: metrics?.status || 'unknown',
                      action: 'request_priority',
                    });

                    // Open GitHub discussions in new tab with pre-filled repo info
                    const discussionUrl = `https://github.com/bdougie/contributor.info/discussions/new?category=request-a-repo&title=Priority%20indexing%20request%20for%20${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
                    window.open(discussionUrl, '_blank');

                    // Show helpful toast
                    toast.info('Opening priority request form', {
                      description:
                        "Let us know which repository you need indexed and we'll prioritize it in our queue.",
                      duration: 6000,
                    });
                  }}
                  variant="outline"
                  size="sm"
                  className="text-xs whitespace-nowrap border-black text-black hover:bg-black/10 dark:border-white dark:text-white dark:hover:bg-white/10 w-full sm:w-auto"
                  title="Request priority indexing"
                >
                  Request Priority
                </Button>
              </div>
            </div>
          )}

        {/* Metrics Section */}
        <ShareableCard
          title="Activity Metrics"
          contextInfo={{
            repository: `${owner}/${repo}`,
            metric: 'activity metrics',
          }}
          chartType="activity-metrics"
        >
          <section className="rounded-lg border bg-card p-4">
            <h3 className="text-sm font-medium mb-3">Activity Metrics</h3>
            {loading || !metrics ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 shareable-desktop-only">
                <PrCountCard openPRs={0} totalPRs={0} loading={true} />
                <AvgTimeCard averageMergeTime={0} loading={true} />
                <div className="sm:col-span-2 md:col-span-2">
                  <VelocityCard velocity={{ current: 0, previous: 0, change: 0 }} loading={true} />
                </div>
              </div>
            ) : (
              <>
                {/* Desktop view - full grid with all cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 shareable-desktop-only">
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

                {/* Capture-optimized view - simplified layout without icons */}
                <div className="hidden shareable-capture-only">
                  <div className="grid grid-cols-10 gap-4">
                    {/* Avg Merge Time - 30% width, same logic as AvgTimeCard (averageMergeTime is in HOURS) */}
                    <div className="col-span-3 rounded-lg border bg-card p-4 text-center">
                      <p className="text-sm font-medium text-foreground mb-2">Avg Merge Time</p>
                      <p
                        className={cn(
                          'text-3xl font-bold',
                          (() => {
                            if (metrics.averageMergeTime <= 24) return 'text-green-500';
                            if (metrics.averageMergeTime <= 72) return 'text-yellow-500';
                            return 'text-red-500';
                          })()
                        )}
                      >
                        {metrics.averageMergeTime < 24
                          ? `${Math.round(metrics.averageMergeTime)}hrs`
                          : `${(metrics.averageMergeTime / 24).toFixed(1)}d`}
                      </p>
                      <p
                        className={cn(
                          'text-xs mt-1',
                          (() => {
                            if (metrics.averageMergeTime <= 24) return 'text-green-500';
                            if (metrics.averageMergeTime <= 72) return 'text-muted-foreground';
                            return 'text-red-500';
                          })()
                        )}
                      >
                        {(() => {
                          if (metrics.averageMergeTime <= 24) return 'Fast';
                          if (metrics.averageMergeTime <= 72) return 'Normal';
                          return 'Slow';
                        })()}
                      </p>
                    </div>
                    {/* Weekly Velocity - 70% width, with progress bar */}
                    <div className="col-span-7 rounded-lg border bg-card p-4">
                      <p className="text-sm font-medium text-foreground mb-2">Weekly PR Velocity</p>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Current week</span>
                          <span className="text-sm font-bold">
                            {metrics.velocity.current.toFixed(1)} PRs
                          </span>
                        </div>
                        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{
                              width: `${
                                Math.max(metrics.velocity.current, metrics.velocity.previous) > 0
                                  ? (metrics.velocity.current / Math.max(metrics.velocity.current, metrics.velocity.previous)) * 100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Previous week</span>
                          <span className="text-xs font-medium">
                            {metrics.velocity.previous.toFixed(1)} PRs
                          </span>
                        </div>
                        {metrics.velocity.change !== 0 && (
                          <p
                            className={cn(
                              'text-xs font-medium',
                              metrics.velocity.change > 0 ? 'text-green-500' : 'text-red-500'
                            )}
                          >
                            {metrics.velocity.change > 0 ? '+' : ''}
                            {Math.round(metrics.velocity.change)}% change
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>
        </ShareableCard>

        {/* Trends Section */}
        <ShareableCard
          title="Trends"
          contextInfo={{
            repository: `${owner}/${repo}`,
            metric: 'trends',
          }}
          chartType="trends"
        >
          <section className="rounded-lg border bg-card p-4">
            <h3 className="text-sm font-medium mb-3">Trends</h3>
            {(() => {
              if (loading) {
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 shareable-desktop-only">
                    {[1, 2, 3, 4].map((i) => (
                      <TrendCard key={i} loading={true} />
                    ))}
                  </div>
                );
              }
              if (trends.length === 0) {
                return (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">Not enough data to show trends</p>
                  </div>
                );
              }
              return (
                <>
                  {/* Desktop view - full grid with TrendCards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 shareable-desktop-only">
                    {trends.slice(0, 4).map((trend, index) => (
                      <TrendCard key={index} trend={trend} loading={loading} />
                    ))}
                  </div>

                  {/* Capture-optimized view - with inline SVG icons */}
                  <div className="hidden shareable-capture-only">
                    <div className="grid grid-cols-4 gap-4">
                      {trends.slice(0, 4).map((trend, index) => (
                        <div
                          key={index}
                          className="rounded-lg border bg-card p-5 flex flex-col justify-between"
                        >
                          {/* Top: Big number with small unit */}
                          <div className="text-center mb-3">
                            <p className="text-3xl font-bold">
                              {trend.current}
                              {trend.unit && trend.unit !== 'people' && (
                                <span className="text-xs font-normal text-muted-foreground ml-1">
                                  {trend.unit === 'hours' ? 'hrs' : trend.unit}
                                </span>
                              )}
                            </p>
                          </div>
                          {/* Bottom row: Icon + percentage change */}
                          <div className="flex items-center gap-2">
                            {/* Inline SVG icons for capture */}
                            {trend.metric === 'Daily PR Volume' && (
                              <svg
                                className="h-4 w-4 text-muted-foreground flex-shrink-0"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <circle cx="18" cy="18" r="3" />
                                <circle cx="6" cy="6" r="3" />
                                <path d="M6 21V9a9 9 0 0 0 9 9" />
                              </svg>
                            )}
                            {trend.metric === 'Active Contributors' && (
                              <svg
                                className="h-4 w-4 text-muted-foreground flex-shrink-0"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                              </svg>
                            )}
                            {trend.metric === 'Avg Review Time' && (
                              <svg
                                className="h-4 w-4 text-muted-foreground flex-shrink-0"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                              </svg>
                            )}
                            {trend.metric === 'PR Completion Rate' && (
                              <svg
                                className="h-4 w-4 text-muted-foreground flex-shrink-0"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                              </svg>
                            )}
                            <span
                              className={cn(
                                'text-sm font-medium',
                                (() => {
                                  if (trend.change === 0) return 'text-muted-foreground';
                                  const isLowerBetter = trend.metric === 'Avg Review Time';
                                  const isPositive = trend.change > 0;
                                  if (isLowerBetter) {
                                    return isPositive ? 'text-red-500' : 'text-green-500';
                                  }
                                  return isPositive ? 'text-green-500' : 'text-red-500';
                                })()
                              )}
                            >
                              {trend.change > 0 ? '+' : ''}
                              {trend.change}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Badge at bottom left */}
                    <div className="mt-3">
                      <span className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
                        vs previous 30d
                      </span>
                    </div>
                  </div>
                </>
              );
            })()}
          </section>
        </ShareableCard>
      </CardContent>
    </Card>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link, TrendingUp, TrendingDown } from '@/components/ui/icon';
import { toast } from 'sonner';
import { PermissionUpgradeCTA } from '@/components/ui/permission-upgrade-cta';
import { UPGRADE_MESSAGES } from '@/lib/copy/upgrade-messages';
import { PrCountCard } from '../activity/pr-count-card';
import { AvgTimeCard } from '../activity/avg-time-card';
import { VelocityCard } from '../activity/velocity-card';
import { calculateTrendMetrics, type TrendData } from '@/lib/insights/trends-metrics';
import {
  calculatePrActivityMetrics,
  type ActivityMetrics,
} from '@/lib/insights/pr-activity-metrics';
import type { Repository } from './RepositoryList';
import { ShareableCard } from '@/components/features/sharing/shareable-card';
import { cn } from '@/lib/utils';

interface WorkspaceMetricsAndTrendsProps {
  repositories: Repository[];
  selectedRepositories: string[];
  timeRange: string;
  userRole?: string | null;
  isLoggedIn?: boolean;
  workspaceName?: string;
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

  const getTrendIcon = (trendType: TrendData['trend'], change: number, metric: string) => {
    if (trendType === 'stable' || change === 0) return null;

    const isPositive = change > 0;
    const Icon = isPositive ? TrendingUp : TrendingDown;

    // For metrics where lower is better (like review time), reverse the color logic
    const isLowerBetter = metric === 'Avg Review Time';
    let color;
    if (isLowerBetter) {
      color = isPositive ? 'text-red-500' : 'text-green-500';
    } else {
      color = isPositive ? 'text-green-500' : 'text-red-500';
    }

    return <Icon className={`h-4 w-4 ${color}`} />;
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
              <dd className={`text-sm font-medium ${getTrendColor(trend.change, trend.metric)}`}>
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
  userRole,
  isLoggedIn = false,
  workspaceName,
}: WorkspaceMetricsAndTrendsProps) {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<ActivityMetrics | null>(null);
  const [trends, setTrends] = useState<TrendData[]>([]);

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

      // If only one repository is selected, use the standard functions
      if (filteredRepos.length === 1) {
        const repo = filteredRepos[0];
        const [trendData, metricsData] = await Promise.all([
          calculateTrendMetrics(repo.owner, repo.name, timeRange),
          calculatePrActivityMetrics(repo.owner, repo.name, timeRange),
        ]);
        setTrends(trendData);
        setMetrics(metricsData);
      } else {
        // For multiple repositories, we need to aggregate the data
        // Fetch all metrics and trends for each repository
        const allData = await Promise.all(
          filteredRepos.map(async (repo) => {
            const [trendData, metricsData] = await Promise.all([
              calculateTrendMetrics(repo.owner, repo.name, timeRange),
              calculatePrActivityMetrics(repo.owner, repo.name, timeRange),
            ]);
            return { trends: trendData, metrics: metricsData };
          })
        );

        // Aggregate metrics
        const aggregatedMetrics: ActivityMetrics = {
          totalPRs: 0,
          openPRs: 0,
          mergedThisWeek: 0,
          averageMergeTime: 0,
          averageMergeTimeTrend: 'stable',
          totalReviews: 0,
          totalComments: 0,
          topContributors: [],
          velocity: {
            current: 0,
            previous: 0,
            change: 0,
          },
          status: 'success',
        };

        let totalMergeTime = 0;
        let mergeTimeCount = 0;

        allData.forEach(({ metrics }) => {
          if (metrics.status === 'success') {
            aggregatedMetrics.totalPRs += metrics.totalPRs;
            aggregatedMetrics.openPRs += metrics.openPRs;
            aggregatedMetrics.mergedThisWeek += metrics.mergedThisWeek;
            aggregatedMetrics.totalReviews += metrics.totalReviews;
            aggregatedMetrics.totalComments += metrics.totalComments;
            aggregatedMetrics.velocity.current += metrics.velocity.current;
            aggregatedMetrics.velocity.previous += metrics.velocity.previous;

            if (metrics.averageMergeTime > 0) {
              totalMergeTime += metrics.averageMergeTime;
              mergeTimeCount++;
            }
          }
        });

        // Calculate average merge time across all repos
        if (mergeTimeCount > 0) {
          aggregatedMetrics.averageMergeTime = totalMergeTime / mergeTimeCount;
        }

        // Calculate velocity change
        if (aggregatedMetrics.velocity.previous > 0) {
          aggregatedMetrics.velocity.change =
            ((aggregatedMetrics.velocity.current - aggregatedMetrics.velocity.previous) /
              aggregatedMetrics.velocity.previous) *
            100;
        }

        // Aggregate trends - sum the values for each metric type
        const aggregatedTrends: Map<string, TrendData> = new Map();

        allData.forEach(({ trends }) => {
          trends.forEach((trend) => {
            const existing = aggregatedTrends.get(trend.metric);
            if (existing) {
              existing.current += trend.current;
              existing.previous += trend.previous;
            } else {
              aggregatedTrends.set(trend.metric, {
                ...trend,
                current: trend.current,
                previous: trend.previous,
              });
            }
          });
        });

        // Recalculate change percentages for aggregated trends
        const finalTrends: TrendData[] = [];
        aggregatedTrends.forEach((trend) => {
          const change =
            trend.previous > 0
              ? Math.round(((trend.current - trend.previous) / trend.previous) * 100)
              : 0;

          finalTrends.push({
            ...trend,
            change,
            trend: (() => {
              if (change > 0) return 'up';
              if (change < 0) return 'down';
              return 'stable';
            })() as 'up' | 'down' | 'stable',
          });
        });

        // Sort trends to match repo-view order
        const trendOrder = [
          'Daily PR Volume',
          'Active Contributors',
          'Avg Review Time',
          'PR Completion Rate',
          'Review Activity',
          'Comment Activity',
        ];
        finalTrends.sort((a, b) => {
          const aIndex = trendOrder.findIndex((metric) => a.metric.includes(metric));
          const bIndex = trendOrder.findIndex((metric) => b.metric.includes(metric));
          return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
        });

        setMetrics(aggregatedMetrics);
        setTrends(finalTrends);
      }
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

  // Check if user has workspace access (must be logged in and have a role)
  const hasWorkspaceAccess = isLoggedIn && userRole;
  const showUpgradePrompt = !hasWorkspaceAccess;

  const repoName = workspaceName || "Workspace Overview";

  return (
    <Card className="relative">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Metrics and Trends</CardTitle>
            <CardDescription>
              Snapshot comparing the previous 30 days with review and comment data
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
        {/* Metrics Section */}
        <ShareableCard
          title="Activity Metrics"
          contextInfo={{
            repository: repoName,
            metric: 'activity metrics',
          }}
          chartType="activity-metrics"
          hideLogo={true}
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

                {/* Capture-optimized view */}
                <div className="hidden shareable-capture-only">
                  <div className="grid grid-cols-10 gap-4">
                    {/* Avg Merge Time */}
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
                    {/* Weekly Velocity */}
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
            repository: repoName,
            metric: 'trends',
          }}
          chartType="trends"
          hideLogo={true}
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
                    <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Not enough data to show trends</p>
                  </div>
                );
              }
              return (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 shareable-desktop-only">
                    {trends.slice(0, 4).map((trend, index) => (
                      <TrendCard key={index} trend={trend} loading={loading} />
                    ))}
                  </div>

                  {/* Capture-optimized view */}
                  <div className="hidden shareable-capture-only">
                    <div className="grid grid-cols-4 gap-4">
                      {trends.slice(0, 4).map((trend, index) => (
                        <div
                          key={index}
                          className="rounded-lg border bg-card p-5 flex flex-col justify-between"
                        >
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

      {/* Blur overlay with upgrade prompt for users without workspace access */}
      {showUpgradePrompt && (
        <div className="absolute inset-0 backdrop-blur-sm bg-background/50 rounded-lg flex items-start justify-center pt-4 md:items-center md:pt-0 z-10">
          <div className="max-w-md w-full mx-4">
            <PermissionUpgradeCTA
              message={
                isLoggedIn
                  ? UPGRADE_MESSAGES.WORKSPACE_DISCUSSIONS
                  : UPGRADE_MESSAGES.LOGIN_REQUIRED
              }
              variant="card"
              size="md"
            />
          </div>
        </div>
      )}
    </Card>
  );
}

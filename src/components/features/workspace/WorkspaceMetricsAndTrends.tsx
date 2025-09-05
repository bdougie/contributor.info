import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link, TrendingUp, TrendingDown } from '@/components/ui/icon';
import { toast } from 'sonner';
import { PrCountCard } from '../activity/pr-count-card';
import { AvgTimeCard } from '../activity/avg-time-card';
import { VelocityCard } from '../activity/velocity-card';
import { calculateTrendMetrics, type TrendData } from '@/lib/insights/trends-metrics';
import {
  calculatePrActivityMetrics,
  type ActivityMetrics,
} from '@/lib/insights/pr-activity-metrics';
import type { Repository } from './RepositoryList';

interface WorkspaceMetricsAndTrendsProps {
  repositories: Repository[];
  selectedRepositories: string[];
  timeRange: string;
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
          'PRs Merged',
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

  return (
    <Card>
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

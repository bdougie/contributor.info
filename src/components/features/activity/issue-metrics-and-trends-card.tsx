import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Link, AlertTriangle } from '@/components/ui/icon';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  calculateIssueMetrics,
  calculateIssueTrendMetrics,
  type IssueMetrics,
  type IssueTrendData,
} from '@/lib/insights/issue-metrics';
import { DataStateIndicator } from '@/components/ui/data-state-indicator';

// Import individual metric components
import { IssueHealthCard } from './issue-health-card';
import { IssueHalfLifeCard } from './issue-half-life-card';
import { BugPercentageCard } from './bug-percentage-card';
import { ActiveTriagerCard } from './active-triager-card';
import { FirstRespondersCard } from './first-responders-card';
import { RepeatReportersCard } from './repeat-reporters-card';

interface IssueMetricsAndTrendsCardProps {
  owner: string;
  repo: string;
  timeRange: string;
}

interface IssueTrendCardProps {
  trend?: IssueTrendData;
  loading?: boolean;
}

function IssueTrendCard({ trend, loading = false }: IssueTrendCardProps) {
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

  const getTrendIcon = (trendType: IssueTrendData['trend'], change: number) => {
    if (trendType === 'stable' || change === 0) return null;

    const isPositive = change > 0;
    const Icon = TrendingUp;
    const color = isPositive ? 'text-green-500' : 'text-red-500';

    // For issues, some metrics are reverse - higher is worse (like half-life)
    const isReverseMetric = trend.metric.includes('Half-life') || trend.metric.includes('Stale');
    const getDisplayColor = () => {
      if (isReverseMetric) {
        return isPositive ? 'text-red-500' : 'text-green-500';
      }
      return color;
    };
    const displayColor = getDisplayColor();

    return <Icon className={cn('h-4 w-4', displayColor, !isPositive ? 'rotate-180' : '')} />;
  };

  const getTrendColor = (change: number) => {
    const isReverseMetric = trend.metric.includes('Half-life') || trend.metric.includes('Stale');

    if (isReverseMetric) {
      if (change > 0) return 'text-red-500'; // Worse
      if (change < 0) return 'text-green-500'; // Better
    } else {
      if (change > 0) return 'text-green-500'; // Better
      if (change < 0) return 'text-red-500'; // Worse
    }
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
              <dd className={cn('text-sm font-medium', getTrendColor(trend.change))}>
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

export function IssueMetricsAndTrendsCard({
  owner,
  repo,
  timeRange,
}: IssueMetricsAndTrendsCardProps) {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<IssueMetrics | null>(null);
  const [trends, setTrends] = useState<IssueTrendData[]>([]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard!');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [metricsData, trendsData] = await Promise.all([
        calculateIssueMetrics(owner, repo, timeRange),
        calculateIssueTrendMetrics(owner, repo, timeRange),
      ]);
      setMetrics(metricsData);
      setTrends(trendsData);
    } catch (error) {
      console.error('Failed to load issue metrics:', error);
      setMetrics({
        healthMetrics: {
          staleVsActiveRatio: { stale: 0, active: 0, percentage: 0 },
          issueHalfLife: 0,
          legitimateBugPercentage: 0,
        },
        activityPatterns: {
          mostActiveTriager: null,
          firstResponders: [],
          repeatReporters: [],
        },
        status: 'error',
        message: 'Failed to load issue metrics',
      });
      setTrends([]);
    } finally {
      setLoading(false);
    }
  }, [owner, repo, timeRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Issue Metrics and Trends</CardTitle>
            <CardDescription>
              Issue health and activity patterns for repository engagement analysis
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
        {/* Show status indicator for errors or no data */}
        {!loading && metrics && metrics.status !== 'success' && (
          <DataStateIndicator status={metrics.status} message={metrics.message} className="mb-6" />
        )}

        {/* Issue Health Metrics Section */}
        <section>
          <h3 className="text-sm font-medium mb-3">Issue Health Metrics</h3>
          {loading || !metrics ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <IssueHealthCard staleCount={0} activeCount={0} stalePercentage={0} loading={true} />
              <IssueHalfLifeCard halfLife={0} loading={true} />
              <BugPercentageCard percentage={0} loading={true} />
              <div className="md:col-span-1" /> {/* Spacer for 3-card layout in 4-column grid */}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <IssueHealthCard
                staleCount={metrics.healthMetrics.staleVsActiveRatio.stale}
                activeCount={metrics.healthMetrics.staleVsActiveRatio.active}
                stalePercentage={metrics.healthMetrics.staleVsActiveRatio.percentage}
                loading={loading}
              />
              <IssueHalfLifeCard halfLife={metrics.healthMetrics.issueHalfLife} loading={loading} />
              <BugPercentageCard
                percentage={metrics.healthMetrics.legitimateBugPercentage}
                loading={loading}
              />
            </div>
          )}
        </section>

        {/* Activity Pattern Metrics Section */}
        <section>
          <h3 className="text-sm font-medium mb-3">Activity Patterns</h3>
          {loading || !metrics ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <ActiveTriagerCard triager={null} loading={true} />
              <FirstRespondersCard responders={[]} loading={true} />
              <RepeatReportersCard reporters={[]} loading={true} />
              <div className="md:col-span-1" /> {/* Spacer */}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <ActiveTriagerCard
                triager={metrics.activityPatterns.mostActiveTriager}
                loading={loading}
              />
              <FirstRespondersCard
                responders={metrics.activityPatterns.firstResponders}
                loading={loading}
              />
              <RepeatReportersCard
                reporters={metrics.activityPatterns.repeatReporters}
                loading={loading}
              />
            </div>
          )}
        </section>

        {/* Trends Section */}
        <section>
          <h3 className="text-sm font-medium mb-3">Issue Trends</h3>
          {(() => {
            if (loading) {
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <IssueTrendCard key={i} loading={true} />
                  ))}
                </div>
              );
            }
            if (trends.length === 0) {
              return (
                <div className="text-center py-8">
                  <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Not enough data to show issue trends
                  </p>
                </div>
              );
            }
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {trends.slice(0, 4).map((trend, index) => (
                  <IssueTrendCard key={index} trend={trend} loading={loading} />
                ))}
              </div>
            );
          })()}
        </section>
      </CardContent>
    </Card>
  );
}

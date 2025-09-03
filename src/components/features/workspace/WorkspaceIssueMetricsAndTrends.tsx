import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from '@/components/ui/icon';
import { toast } from 'sonner';
import {
  calculateIssueMetrics,
  calculateIssueTrendMetrics,
  type IssueMetrics,
  type IssueTrendData,
} from '@/lib/insights/issue-metrics';
import type { Repository } from './RepositoryList';

// Import individual metric components
import { IssueHalfLifeCard } from '../activity/issue-half-life-card';
import { StaleIssuesCard } from '../activity/stale-issues-card';
import { ActiveTriagerCard } from '../activity/active-triager-card';
import { FirstRespondersCard } from '../activity/first-responders-card';
import { RepeatReportersCard } from '../activity/repeat-reporters-card';

interface WorkspaceIssueMetricsAndTrendsProps {
  repositories: Repository[];
  selectedRepositories: string[];
  timeRange: string;
}

function IssueTrendCard({ trend, loading = false }: { trend?: IssueTrendData; loading?: boolean }) {
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

  const getTrendIcon = () => {
    return null; // Remove all trend icons
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
              {getTrendIcon()}
              <dt className="sr-only">Change from previous period</dt>
              <dd className={`text-sm font-medium ${getTrendColor(trend.change)}`}>
                {trend.change > 0 ? '+' : ''}
                {trend.change}%
              </dd>
            </div>
          </dl>
          {trend.insight && <p className="text-xs text-muted-foreground">{trend.insight}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function WorkspaceIssueMetricsAndTrends({
  repositories,
  selectedRepositories,
  timeRange,
}: WorkspaceIssueMetricsAndTrendsProps) {
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
        const [metricsData, trendsData] = await Promise.all([
          calculateIssueMetrics(repo.owner, repo.name, timeRange),
          calculateIssueTrendMetrics(repo.owner, repo.name, timeRange),
        ]);
        setMetrics(metricsData);
        setTrends(trendsData);
      } else {
        // For multiple repositories, aggregate the data
        const allData = await Promise.all(
          filteredRepos.map(async (repo) => {
            const [metricsData, trendsData] = await Promise.all([
              calculateIssueMetrics(repo.owner, repo.name, timeRange),
              calculateIssueTrendMetrics(repo.owner, repo.name, timeRange),
            ]);
            return { metrics: metricsData, trends: trendsData };
          })
        );

        // Aggregate issue metrics across repositories
        let totalStale = 0;
        let totalActive = 0;
        let totalHalfLife = 0;
        let totalBugPercentage = 0;
        let validHalfLifeCount = 0;
        let validBugPercentageCount = 0;

        // Activity patterns aggregation
        const allTriagers = new Map<
          string,
          { username: string; avatar_url: string; triages: number }
        >();
        const allFirstResponders = new Map<
          string,
          { username: string; avatar_url: string; responses: number }
        >();
        const allReporters = new Map<
          string,
          { username: string; avatar_url: string; issues: number }
        >();

        allData.forEach(({ metrics }) => {
          if (metrics.status === 'success') {
            totalStale += metrics.healthMetrics.staleVsActiveRatio.stale;
            totalActive += metrics.healthMetrics.staleVsActiveRatio.active;

            if (metrics.healthMetrics.issueHalfLife > 0) {
              totalHalfLife += metrics.healthMetrics.issueHalfLife;
              validHalfLifeCount++;
            }

            if (metrics.healthMetrics.legitimateBugPercentage > 0) {
              totalBugPercentage += metrics.healthMetrics.legitimateBugPercentage;
              validBugPercentageCount++;
            }

            // Aggregate activity patterns
            if (metrics.activityPatterns.mostActiveTriager) {
              const triager = metrics.activityPatterns.mostActiveTriager;
              const existing = allTriagers.get(triager.username);
              if (existing) {
                existing.triages += triager.triages;
              } else {
                allTriagers.set(triager.username, { ...triager });
              }
            }

            metrics.activityPatterns.firstResponders.forEach((responder) => {
              const existing = allFirstResponders.get(responder.username);
              if (existing) {
                existing.responses += responder.responses;
              } else {
                allFirstResponders.set(responder.username, { ...responder });
              }
            });

            metrics.activityPatterns.repeatReporters.forEach((reporter) => {
              const existing = allReporters.get(reporter.username);
              if (existing) {
                existing.issues += reporter.issues;
              } else {
                allReporters.set(reporter.username, { ...reporter });
              }
            });
          }
        });

        const total = totalStale + totalActive;
        const aggregatedMetrics: IssueMetrics = {
          healthMetrics: {
            staleVsActiveRatio: {
              stale: totalStale,
              active: totalActive,
              percentage: total > 0 ? Math.round((totalStale / total) * 100) : 0,
            },
            issueHalfLife:
              validHalfLifeCount > 0 ? Math.round(totalHalfLife / validHalfLifeCount) : 0,
            legitimateBugPercentage:
              validBugPercentageCount > 0
                ? Math.round(totalBugPercentage / validBugPercentageCount)
                : 0,
          },
          activityPatterns: {
            mostActiveTriager:
              Array.from(allTriagers.values()).sort((a, b) => b.triages - a.triages)[0] || null,
            firstResponders: Array.from(allFirstResponders.values())
              .sort((a, b) => b.responses - a.responses)
              .slice(0, 3),
            repeatReporters: Array.from(allReporters.values())
              .sort((a, b) => b.issues - a.issues)
              .slice(0, 3),
          },
          status: 'success',
        };

        // Aggregate trends
        const aggregatedTrends: Map<string, IssueTrendData> = new Map();

        allData.forEach(({ trends }) => {
          trends.forEach((trend) => {
            // Skip Time to Resolution only for multi-repo aggregation (can't be meaningfully aggregated)
            if (trend.metric === 'Time to Resolution' && filteredRepos.length > 1) {
              return;
            }

            const existing = aggregatedTrends.get(trend.metric);
            if (
              existing &&
              typeof trend.current === 'number' &&
              typeof trend.previous === 'number' &&
              typeof existing.current === 'number' &&
              typeof existing.previous === 'number'
            ) {
              existing.current += trend.current;
              existing.previous += trend.previous;
            } else if (
              !existing &&
              typeof trend.current === 'number' &&
              typeof trend.previous === 'number'
            ) {
              aggregatedTrends.set(trend.metric, {
                ...trend,
                current: trend.current,
                previous: trend.previous,
              });
            }
          });
        });

        // Recalculate change percentages for aggregated trends
        const finalTrends: IssueTrendData[] = [];
        aggregatedTrends.forEach((trend) => {
          const change =
            typeof trend.current === 'number' &&
            typeof trend.previous === 'number' &&
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

        setMetrics(aggregatedMetrics);
        setTrends(finalTrends);
      }
    } catch (error) {
      console.error('Failed to load workspace issue metrics:', error);
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
  }, [repositories, selectedRepositories, timeRange]);

  useEffect(() => {
    calculateMetrics();
  }, [calculateMetrics]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Issue Metrics and Trends</CardTitle>
            <CardDescription>
              Issue health and activity patterns across your workspace repositories
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
          <h3 className="text-sm font-medium mb-3">Metrics</h3>
          {loading || !metrics ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <IssueHalfLifeCard halfLife={0} loading={true} />
              <StaleIssuesCard staleCount={0} totalCount={0} loading={true} />
              <div className="md:col-span-2">
                <IssueTrendCard loading={true} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <IssueHalfLifeCard halfLife={metrics.healthMetrics.issueHalfLife} loading={loading} />
              <StaleIssuesCard
                staleCount={metrics.healthMetrics.staleVsActiveRatio.stale}
                totalCount={
                  metrics.healthMetrics.staleVsActiveRatio.stale +
                  metrics.healthMetrics.staleVsActiveRatio.active
                }
                loading={loading}
              />
              {(() => {
                const issueVolumeTrend = trends.find((trend) => trend.metric === 'Issue Volume');
                return (
                  <div className="md:col-span-2">
                    <IssueTrendCard trend={issueVolumeTrend} loading={loading} />
                  </div>
                );
              })()}
            </div>
          )}
        </section>

        {/* Trends Section */}
        <section>
          <h3 className="text-sm font-medium mb-3">Trends</h3>
          {loading || !metrics ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <ActiveTriagerCard triager={null} loading={true} />
              <FirstRespondersCard responders={[]} loading={true} />
              <RepeatReportersCard reporters={[]} loading={true} />
              <IssueTrendCard key={1} loading={true} />
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
              {(() => {
                // Show Time to Resolution trend if available
                const timeToResolutionTrend = trends.find(
                  (trend) => trend.metric === 'Time to Resolution'
                );
                return timeToResolutionTrend ? (
                  <IssueTrendCard trend={timeToResolutionTrend} loading={loading} />
                ) : (
                  // Fallback to any non-Issue Volume trend
                  trends
                    .filter((trend) => trend.metric !== 'Issue Volume')
                    .slice(0, 1)
                    .map((trend, index) => (
                      <IssueTrendCard key={index} trend={trend} loading={loading} />
                    ))
                );
              })()}
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}

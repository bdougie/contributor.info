import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from '@/components/ui/icon';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PermissionUpgradeCTA } from '@/components/ui/permission-upgrade-cta';
import { UPGRADE_MESSAGES } from '@/lib/copy/upgrade-messages';
import { ShareableCard } from '@/components/features/sharing/shareable-card';
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
import { IssueVolumeCalendarCard } from '../activity/issue-volume-calendar-card';

interface WorkspaceIssueMetricsAndTrendsProps {
  repositories: Repository[];
  selectedRepositories: string[];
  timeRange: string;
  userRole?: string | null;
  isLoggedIn?: boolean;
}

export function WorkspaceIssueMetricsAndTrends({
  repositories,
  selectedRepositories,
  timeRange,
  userRole,
  isLoggedIn = false,
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
            // Skip Time to Resolution - removed from display
            if (trend.metric === 'Time to Resolution') {
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

  // Check if user has workspace access (must be logged in and have a role)
  const hasWorkspaceAccess = isLoggedIn && userRole;
  const showUpgradePrompt = !hasWorkspaceAccess;

  return (
    <Card className="relative">
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
              aria-label="Copy page link"
            >
              <Link className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Metrics Section */}
        <ShareableCard
          title="Issue Metrics"
          contextInfo={{
            repository: 'Workspace Issues',
            metric: 'issue metrics',
          }}
          chartType="issue-metrics"
          hideLogo={true}
        >
          <section className="rounded-lg border bg-card p-4">
            <h3 className="text-sm font-medium mb-3">Metrics</h3>
            {loading || !metrics ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 shareable-desktop-only">
                <IssueHalfLifeCard halfLife={0} loading={true} />
                <StaleIssuesCard staleCount={0} totalCount={0} loading={true} />
                <IssueVolumeCalendarCard
                  volumeData={{
                    current: 0,
                    previous: 0,
                    change: 0,
                    dailyIssues: [],
                  }}
                  loading={true}
                />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 shareable-desktop-only">
                  <IssueHalfLifeCard
                    halfLife={metrics.healthMetrics.issueHalfLife}
                    loading={loading}
                  />
                  <StaleIssuesCard
                    staleCount={metrics.healthMetrics.staleVsActiveRatio.stale}
                    totalCount={
                      metrics.healthMetrics.staleVsActiveRatio.stale +
                      metrics.healthMetrics.staleVsActiveRatio.active
                    }
                    loading={loading}
                  />
                  {(() => {
                    const issueVolumeTrend = trends.find(
                      (trend) => trend.metric === 'Issue Volume'
                    );
                    if (issueVolumeTrend) {
                      return (
                        <IssueVolumeCalendarCard
                          volumeData={{
                            current:
                              typeof issueVolumeTrend.current === 'number'
                                ? issueVolumeTrend.current
                                : 0,
                            previous:
                              typeof issueVolumeTrend.previous === 'number'
                                ? issueVolumeTrend.previous
                                : 0,
                            change: issueVolumeTrend.change,
                            dailyIssues: issueVolumeTrend.dailyIssues || [],
                          }}
                          loading={loading}
                        />
                      );
                    }
                    return (
                      <IssueVolumeCalendarCard
                        volumeData={{
                          current: 0,
                          previous: 0,
                          change: 0,
                          dailyIssues: [],
                        }}
                        loading={loading}
                      />
                    );
                  })()}
                </div>

                {/* Capture-optimized view */}
                <div className="hidden shareable-capture-only">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-lg border bg-card p-4 text-center">
                      <p className="text-sm font-medium text-foreground mb-2">Issue Half-Life</p>
                      <p
                        className={cn(
                          'text-3xl font-bold',
                          (() => {
                            const days = metrics.healthMetrics.issueHalfLife;
                            if (days <= 7) return 'text-green-500';
                            if (days <= 30) return 'text-yellow-500';
                            return 'text-red-500';
                          })()
                        )}
                      >
                        {metrics.healthMetrics.issueHalfLife} days
                      </p>
                    </div>
                    <div className="rounded-lg border bg-card p-4 text-center">
                      <p className="text-sm font-medium text-foreground mb-2">Stale Rate</p>
                      <p className="text-3xl font-bold">
                        {metrics.healthMetrics.staleVsActiveRatio.percentage}%
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {metrics.healthMetrics.staleVsActiveRatio.stale} stale issues
                      </p>
                    </div>
                    <div className="rounded-lg border bg-card p-4 text-center">
                      <p className="text-sm font-medium text-foreground mb-2">Bug Rate</p>
                      <p className="text-3xl font-bold">
                        {metrics.healthMetrics.legitimateBugPercentage}%
                      </p>
                      <p className="text-xs text-muted-foreground">legitimate bugs</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>
        </ShareableCard>

        {/* Trends Section */}
        <ShareableCard
          title="Issue Trends"
          contextInfo={{
            repository: 'Workspace Issues',
            metric: 'issue trends',
          }}
          chartType="issue-trends"
          hideLogo={true}
        >
          <section className="rounded-lg border bg-card p-4">
            <h3 className="text-sm font-medium mb-3">Trends</h3>
            {loading || !metrics ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 shareable-desktop-only">
                <ActiveTriagerCard triager={null} loading={true} />
                <FirstRespondersCard responders={[]} loading={true} />
                <RepeatReportersCard reporters={[]} loading={true} />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 shareable-desktop-only">
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

                {/* Capture-optimized view */}
                <div className="hidden shareable-capture-only">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-lg border bg-card p-4">
                      <p className="text-sm font-medium text-foreground mb-2">Top Triager</p>
                      {metrics.activityPatterns.mostActiveTriager ? (
                        <div className="flex items-center gap-2">
                          <img
                            src={metrics.activityPatterns.mostActiveTriager.avatar_url}
                            alt={`Avatar for ${metrics.activityPatterns.mostActiveTriager.username}`}
                            className="w-8 h-8 rounded-full"
                          />
                          <div className="overflow-hidden">
                            <p className="font-medium truncate">
                              {metrics.activityPatterns.mostActiveTriager.username}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {metrics.activityPatterns.mostActiveTriager.triages} triages
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm">No active triager</p>
                      )}
                    </div>
                    <div className="rounded-lg border bg-card p-4">
                      <p className="text-sm font-medium text-foreground mb-2">First Responders</p>
                      <div className="space-y-2">
                        {metrics.activityPatterns.firstResponders.slice(0, 3).map((r) => (
                          <div
                            key={r.username}
                            className="flex justify-between items-center text-sm"
                          >
                            <span className="truncate max-w-[80px]">{r.username}</span>
                            <span className="font-medium">{r.responses}</span>
                          </div>
                        ))}
                        {metrics.activityPatterns.firstResponders.length === 0 && (
                          <p className="text-muted-foreground text-sm">No data</p>
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg border bg-card p-4">
                      <p className="text-sm font-medium text-foreground mb-2">Top Reporters</p>
                      <div className="space-y-2">
                        {metrics.activityPatterns.repeatReporters.slice(0, 3).map((r) => (
                          <div
                            key={r.username}
                            className="flex justify-between items-center text-sm"
                          >
                            <span className="truncate max-w-[80px]">{r.username}</span>
                            <span className="font-medium">{r.issues}</span>
                          </div>
                        ))}
                        {metrics.activityPatterns.repeatReporters.length === 0 && (
                          <p className="text-muted-foreground text-sm">No data</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
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

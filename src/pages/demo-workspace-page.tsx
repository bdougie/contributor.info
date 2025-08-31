import { useState, useMemo, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { WorkspaceExportService } from '@/services/workspace-export.service';
import { WorkspaceDashboard } from '@/components/features/workspace';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Info, Sparkles, GitPullRequest, AlertCircle, Layout, X } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

// Lazy load the heavy analytics dashboard
const AnalyticsDashboard = lazy(() =>
  import('@/components/features/workspace/AnalyticsDashboard').then((m) => ({
    default: m.AnalyticsDashboard,
  }))
);

// Import demo data cache
import {
  getCachedAnalyticsData,
  getCachedWorkspaceRepositories,
  getCachedWorkspaceMetrics,
  getCachedWorkspaceTrendData,
  getCachedRepositories,
} from '@/lib/demo/demo-data-cache';

import {
  TimeRangeSelector,
  type TimeRange,
} from '@/components/features/workspace/TimeRangeSelector';
import { ActivityTable } from '@/components/features/workspace/ActivityTable';
import { ActivityChart } from '@/components/features/workspace/ActivityChart';
import { TrendChart } from '@/components/features/workspace/TrendChart';
import { ContributorLeaderboard } from '@/components/features/workspace/ContributorLeaderboard';
import { RisingStarsChart } from '@/components/features/analytics/RisingStarsChart';

// Time range mappings
const TIME_RANGE_DAYS = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
  all: 730,
} as const;

export function DemoWorkspacePage() {
  const { workspaceId = 'demo', tab } = useParams<{ workspaceId: string; tab?: string }>();
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [tier] = useState<'free' | 'pro' | 'enterprise'>('pro');
  const [expandedChart, setExpandedChart] = useState<'trends' | 'activity' | null>(null);

  // Generate demo data with caching
  const demoAnalyticsData = useMemo(() => getCachedAnalyticsData(), []);
  const demoRepositories = useMemo(
    () => getCachedWorkspaceRepositories(workspaceId),
    [workspaceId]
  );
  const demoRepos = useMemo(() => getCachedRepositories(), []);

  // Generate time-range aware metrics and trends with caching
  const demoMetrics = useMemo(
    () => getCachedWorkspaceMetrics(demoRepos, timeRange),
    [demoRepos, timeRange]
  );

  const demoActivityData = useMemo(
    () => getCachedWorkspaceTrendData(TIME_RANGE_DAYS[timeRange], demoRepos),
    [demoRepos, timeRange]
  );

  const demoTrendData = useMemo(() => {
    // Generate trend data with proper structure
    const days = TIME_RANGE_DAYS[timeRange];
    const labels = Array.from({ length: days }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (days - i - 1));
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    return {
      labels,
      datasets: [
        {
          label: 'Pull Requests',
          data: Array.from({ length: days }, () => Math.floor(Math.random() * 20) + 5),
          color: '#10B981',
        },
        {
          label: 'Issues',
          data: Array.from({ length: days }, () => Math.floor(Math.random() * 15) + 3),
          color: '#3B82F6',
        },
        {
          label: 'Commits',
          data: Array.from({ length: days }, () => Math.floor(Math.random() * 30) + 10),
          color: '#8B5CF6',
        },
      ],
    };
  }, [timeRange]);

  // Generate rising stars data with varied activity levels and sizes
  const risingStarsData = useMemo(() => {
    // Directly create the RisingStarsData format for better control over avatar sizes
    const contributors = demoAnalyticsData.contributors.map((contributor, idx) => {
      // Create different activity profiles with clear size variations
      const activityProfile = idx % 6;
      let commits, pullRequests, issues, comments, reviews, discussions;
      let velocityScore, growthRate;

      switch (activityProfile) {
        case 0: // Very high activity - large avatars
          commits = Math.floor(Math.random() * 80) + 120;
          pullRequests = Math.floor(Math.random() * 40) + 60;
          issues = Math.floor(Math.random() * 30) + 40;
          comments = Math.floor(Math.random() * 50) + 70;
          reviews = Math.floor(Math.random() * 30) + 40;
          discussions = Math.floor(Math.random() * 20) + 30;
          velocityScore = Math.random() * 15 + 25; // 25-40 per week
          growthRate = Math.random() * 150 + 100; // 100-250% growth
          break;
        case 1: // High activity - large-medium avatars
          commits = Math.floor(Math.random() * 60) + 60;
          pullRequests = Math.floor(Math.random() * 30) + 30;
          issues = Math.floor(Math.random() * 20) + 20;
          comments = Math.floor(Math.random() * 40) + 40;
          reviews = Math.floor(Math.random() * 20) + 20;
          discussions = Math.floor(Math.random() * 15) + 15;
          velocityScore = Math.random() * 10 + 15; // 15-25 per week
          growthRate = Math.random() * 100 + 50; // 50-150% growth
          break;
        case 2: // Medium-high activity - medium avatars
          commits = Math.floor(Math.random() * 40) + 30;
          pullRequests = Math.floor(Math.random() * 20) + 15;
          issues = Math.floor(Math.random() * 15) + 10;
          comments = Math.floor(Math.random() * 30) + 20;
          reviews = Math.floor(Math.random() * 15) + 10;
          discussions = Math.floor(Math.random() * 10) + 8;
          velocityScore = Math.random() * 8 + 8; // 8-16 per week
          growthRate = Math.random() * 80 + 20; // 20-100% growth
          break;
        case 3: // Medium activity - medium-small avatars
          commits = Math.floor(Math.random() * 25) + 15;
          pullRequests = Math.floor(Math.random() * 15) + 8;
          issues = Math.floor(Math.random() * 10) + 5;
          comments = Math.floor(Math.random() * 20) + 10;
          reviews = Math.floor(Math.random() * 10) + 5;
          discussions = Math.floor(Math.random() * 8) + 4;
          velocityScore = Math.random() * 5 + 5; // 5-10 per week
          growthRate = Math.random() * 50 + 10; // 10-60% growth
          break;
        case 4: // Low-medium activity - small avatars
          commits = Math.floor(Math.random() * 15) + 5;
          pullRequests = Math.floor(Math.random() * 10) + 3;
          issues = Math.floor(Math.random() * 8) + 2;
          comments = Math.floor(Math.random() * 15) + 5;
          reviews = Math.floor(Math.random() * 8) + 2;
          discussions = Math.floor(Math.random() * 5) + 2;
          velocityScore = Math.random() * 3 + 2; // 2-5 per week
          growthRate = Math.random() * 30; // 0-30% growth
          break;
        default: // Low activity - very small avatars
          commits = Math.floor(Math.random() * 8) + 1;
          pullRequests = Math.floor(Math.random() * 5) + 1;
          issues = Math.floor(Math.random() * 5);
          comments = Math.floor(Math.random() * 10) + 2;
          reviews = Math.floor(Math.random() * 5);
          discussions = Math.floor(Math.random() * 3);
          velocityScore = Math.random() * 2 + 0.5; // 0.5-2.5 per week
          growthRate = Math.random() * 20; // 0-20% growth
          break;
      }

      // Vary the contribution dates
      const daysAgo = idx < 5 ? Math.random() * 30 : Math.random() * 365;
      const firstContributionDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      const lastContributionDate = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);

      // Determine if new or rising star
      const isNewContributor = daysAgo < 90;
      const isRisingStar = velocityScore > 10 && daysAgo < 180 && Math.random() > 0.5;

      const totalActivity = commits + pullRequests + issues + comments + reviews + discussions;

      return {
        x: commits + pullRequests, // Code contributions
        y: issues + comments + reviews + discussions, // Non-code contributions
        size: Math.min(Math.max(velocityScore * 10, 10), 100), // Scale size based on velocity
        contributor: {
          login: contributor.username,
          avatar_url: contributor.avatar_url || '',
          github_id: Math.floor(Math.random() * 100000),
          commits,
          pullRequests,
          issues,
          comments,
          reviews,
          discussions,
          totalGithubEvents: totalActivity,
          totalActivity,
          velocityScore,
          growthRate,
          firstContributionDate: firstContributionDate.toISOString(),
          lastContributionDate: lastContributionDate.toISOString(),
          contributionSpan: Math.ceil(
            (lastContributionDate.getTime() - firstContributionDate.getTime()) /
              (1000 * 60 * 60 * 24)
          ),
          isNewContributor,
          isRisingStar,
        },
      };
    });

    // Sort by velocity score and return as RisingStarsData format
    const sortedContributors = contributors.sort(
      (a, b) => b.contributor.velocityScore - a.contributor.velocityScore
    );

    return [
      {
        id: 'rising-stars',
        data: sortedContributors,
      },
    ];
  }, [demoAnalyticsData.contributors]);

  const handleTabChange = (value: string) => {
    if (value === 'overview') {
      navigate(`/i/demo`);
    } else {
      navigate(`/i/demo/${value}`);
    }
  };

  const toggleChartExpansion = (chart: 'trends' | 'activity') => {
    setExpandedChart(expandedChart === chart ? null : chart);
  };

  const handleExport = async (format: 'csv' | 'json' | 'pdf') => {
    try {
      await WorkspaceExportService.export(demoAnalyticsData, format, {
        workspaceName: 'Demo Workspace',
        dateRange: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          end: new Date(),
        },
      });
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        {/* Demo workspace banner */}
        <Alert className="mb-6 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <Sparkles className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            <strong>Demo Workspace</strong> - This workspace uses sample data to showcase
            contributor.info's features. All data shown here is generated for demonstration
            purposes.
          </AlertDescription>
        </Alert>

        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Sparkles className="h-8 w-8 text-primary" />
                Demo Workspace
              </h1>
              <p className="text-muted-foreground mt-2">
                Explore contributor analytics with sample data
              </p>
            </div>
            <TimeRangeSelector
              value={timeRange}
              onChange={setTimeRange}
              data-testid="time-range-selector"
            />
          </div>
        </div>

        <Tabs value={tab || 'overview'} onValueChange={handleTabChange} className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="prs">Pull Requests</TabsTrigger>
            <TabsTrigger value="issues">Issues</TabsTrigger>
            <TabsTrigger value="contributors">Contributors</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <WorkspaceDashboard
              workspaceId="demo"
              workspaceName="Demo Workspace"
              metrics={demoMetrics}
              trendData={{ labels: [], datasets: [] }} // Empty for now
              activityData={demoActivityData}
              repositories={demoRepos}
              loading={false}
              tier={tier}
              timeRange={timeRange}
            >
              {/* Rising Stars Chart */}
              <RisingStarsChart
                data={risingStarsData}
                height={400}
                maxBubbles={30}
                className="mt-6"
              />
            </WorkspaceDashboard>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  About This Demo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  This demo workspace showcases the full power of contributor.info's analytics
                  platform. The data you see here is generated using deterministic algorithms to
                  provide a realistic view of how the platform works with actual repository data.
                </p>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <h4 className="font-medium text-foreground mb-1">Sample Repositories</h4>
                    <p className="text-muted-foreground">
                      {demoRepositories.length} repositories with varied languages and activities
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground mb-1">Generated Activities</h4>
                    <p className="text-muted-foreground">
                      {demoAnalyticsData.activities.length} activities across the last 30 days
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground mb-1">Contributors</h4>
                    <p className="text-muted-foreground">
                      {demoAnalyticsData.contributors.length} active contributors
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <Suspense
              fallback={
                <div className="flex items-center justify-center min-h-[400px]">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              }
            >
              <AnalyticsDashboard
                data={demoAnalyticsData}
                repositories={demoRepositories}
                loading={false}
                tier={tier}
                onExport={handleExport}
              />
            </Suspense>
          </TabsContent>

          <TabsContent value="activity" className="space-y-6">
            <div className={cn('grid gap-6', expandedChart ? 'grid-cols-1' : 'lg:grid-cols-2')}>
              {(!expandedChart || expandedChart === 'trends') && (
                <Card
                  className={cn(
                    'transition-all duration-300',
                    expandedChart === 'trends' && 'col-span-full'
                  )}
                >
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Activity Trends</CardTitle>
                      <CardDescription>Repository activity over time</CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleChartExpansion('trends')}
                      className="h-8 w-8"
                    >
                      {expandedChart === 'trends' ? (
                        <X className="h-4 w-4" />
                      ) : (
                        <Layout className="h-4 w-4" />
                      )}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <TrendChart
                      title=""
                      data={demoTrendData}
                      height={expandedChart === 'trends' ? 500 : 300}
                      showLegend={true}
                    />
                  </CardContent>
                </Card>
              )}

              {(!expandedChart || expandedChart === 'activity') && (
                <Card
                  className={cn(
                    'transition-all duration-300',
                    expandedChart === 'activity' && 'col-span-full'
                  )}
                >
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Code Activity</CardTitle>
                      <CardDescription>Daily code changes (additions vs deletions)</CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleChartExpansion('activity')}
                      className="h-8 w-8"
                    >
                      {expandedChart === 'activity' ? (
                        <X className="h-4 w-4" />
                      ) : (
                        <Layout className="h-4 w-4" />
                      )}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <ActivityChart
                      title=""
                      data={demoActivityData}
                      height={expandedChart === 'activity' ? 500 : 300}
                    />
                  </CardContent>
                </Card>
              )}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Activity Timeline</CardTitle>
                <CardDescription>Recent activity across all repositories</CardDescription>
              </CardHeader>
              <CardContent>
                <ActivityTable
                  activities={demoAnalyticsData.activities.slice(0, 10)}
                  loading={false}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="prs" className="space-y-6">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GitPullRequest className="h-5 w-5" />
                    Pull Requests Overview
                  </CardTitle>
                  <CardDescription>
                    Recent pull request activity across all repositories
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="p-4 rounded-lg bg-muted">
                      <div className="text-2xl font-bold">142</div>
                      <div className="text-sm text-muted-foreground">Open PRs</div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <div className="text-2xl font-bold">89</div>
                      <div className="text-sm text-muted-foreground">Merged Today</div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <div className="text-2xl font-bold">23</div>
                      <div className="text-sm text-muted-foreground">Awaiting Review</div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <div className="text-2xl font-bold">1.2h</div>
                      <div className="text-sm text-muted-foreground">Avg. Time to Merge</div>
                    </div>
                  </div>
                  <ActivityTable
                    activities={demoAnalyticsData.activities
                      .filter((a) => a.type === 'pr')
                      .slice(0, 20)}
                    loading={false}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="issues" className="space-y-6">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    Issues Overview
                  </CardTitle>
                  <CardDescription>
                    Track and manage issues across your repositories
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="p-4 rounded-lg bg-muted">
                      <div className="text-2xl font-bold">287</div>
                      <div className="text-sm text-muted-foreground">Open Issues</div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <div className="text-2xl font-bold">45</div>
                      <div className="text-sm text-muted-foreground">Closed Today</div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <div className="text-2xl font-bold">62</div>
                      <div className="text-sm text-muted-foreground">High Priority</div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <div className="text-2xl font-bold">3.4d</div>
                      <div className="text-sm text-muted-foreground">Avg. Resolution</div>
                    </div>
                  </div>
                  <ActivityTable
                    activities={demoAnalyticsData.activities
                      .filter((a) => a.type === 'issue')
                      .slice(0, 20)}
                    loading={false}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="contributors" className="space-y-6">
            <ContributorLeaderboard contributors={demoAnalyticsData.contributors} loading={false} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default DemoWorkspacePage;
